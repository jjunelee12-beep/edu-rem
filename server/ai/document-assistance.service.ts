import type {
  DocumentIntelligenceResult,
} from "./document-intelligence.types";

import type {
  DocumentAssistanceCategory,
  DocumentAssistanceResult,
  DocumentAssistanceTask,
} from "./document-assistance.types";

import {
  analyzeDocumentAssistanceWithAi,
} from "./document-assistance-ai-adapter";

export interface AnalyzeDocumentAssistanceInput {
  organizationId:
    number;

  /**
   * Document Intelligence에서
   * 이미 분석을 끝낸 결과.
   *
   * 여기서 Vision/OCR을 다시 실행하지 않는다.
   */
  documentIntelligence:
    DocumentIntelligenceResult;

  /**
   * 등록회원이면 서버에서 인증된 studentId.
   * 신규자는 null.
   */
  studentId?:
    number |
    null;

  /**
   * 사용자의 현재 질문.
   *
   * 예:
   * "여기 뭐 써야 돼요?"
   * "이거 제출해도 돼요?"
   * "잘못 쓴 데 있나요?"
   */
  userMessage?:
    string |
    null;
}

function resolveCategory(
  document:
    DocumentIntelligenceResult
): DocumentAssistanceCategory {
  switch (
    document.documentType
  ) {
    case "transcript":
    case "degree_certificate":
      return "academic";

    case "learner_registration":
    case "credit_recognition":
    case "degree_application":
    case "administrative_document":
      return "administrative";

    case "practice_document":
      return "practice";

    case "qualification_certificate":
    case "qualification_application":
      return "qualification";

    case "payment_proof":
      return "payment";

    default:
      return "general";
  }
}

function resolveTasks(
  document:
    DocumentIntelligenceResult
): DocumentAssistanceTask[] {
  const tasks:
    DocumentAssistanceTask[] = [
      "document_explanation",
      "missing_field_check",
      "error_check",
    ];

  switch (
    document.documentType
  ) {
    case "transcript":
    case "degree_certificate":
      tasks.push(
        "academic_document_guide"
      );
      break;

    case "learner_registration":
    case "credit_recognition":
    case "degree_application":
    case "administrative_document":
      tasks.push(
        "administrative_guide",
        "submission_guide"
      );
      break;

    case "practice_document":
      tasks.push(
        "practice_document_guide",
        "field_completion",
        "submission_guide"
      );
      break;

    case "qualification_application":
    case "qualification_certificate":
      tasks.push(
        "qualification_application_guide",
        "field_completion",
        "submission_guide"
      );
      break;

    default:
      tasks.push(
        "general_document_guide"
      );
      break;
  }

  return Array.from(
    new Set(
      tasks
    )
  );
}

export async function analyzeDocumentAssistance(
  input:
    AnalyzeDocumentAssistanceInput
): Promise<DocumentAssistanceResult> {
  const organizationId =
    Math.floor(
      Number(
        input.organizationId ||
        0
      )
    );

  if (
    !Number.isFinite(
      organizationId
    ) ||
    organizationId <= 0
  ) {
    throw new Error(
      "Document Assistance 회사정보가 올바르지 않습니다."
    );
  }

  const document =
    input.documentIntelligence;

  if (
    !document
  ) {
    throw new Error(
      "Document Intelligence 분석결과가 필요합니다."
    );
  }

  const category =
    resolveCategory(
      document
    );

  const tasks =
    resolveTasks(
      document
    );

  const baseRequiresStaffReview =
  document.decision ===
    "rejected" ||
  document.confidence <
    0.5;

/**
 * Document Intelligence 결과를 바탕으로
 * 작성항목 / 누락 / 오류 / 다음단계를 분석한다.
 *
 * 여기서는 원본 문서를 다시 Vision 호출하지 않는다.
 */
let aiAssistance:
  Awaited<
    ReturnType<
      typeof analyzeDocumentAssistanceWithAi
    >
  > |
  null =
  null;

try {
  aiAssistance =
    await analyzeDocumentAssistanceWithAi({
      organizationId,

      documentIntelligence:
        document,

      category,

      tasks,

      studentId:
        Number(
          input.studentId ||
          0
        ) > 0
          ? Number(
              input.studentId
            )
          : null,

      userMessage:
        input.userMessage ??
        null,
    });
} catch (
  error:
    unknown
) {
  /**
   * Assistance 자연어 분석 실패 때문에
   * 이미 성공한 Document Intelligence 결과까지
   * 사용할 수 없게 만들면 안 된다.
   */
  console.error(
    "[DOCUMENT ASSISTANCE] AI 분석 실패",
    error instanceof
      Error
      ? error.message
      : String(
          error
        )
  );

  aiAssistance =
    null;
}

const requiresStaffReview =
  baseRequiresStaffReview ||
  aiAssistance
    ?.requiresStaffReview ===
    true;

const canAssist =
  document.decision !==
    "rejected" &&
  document.confidence >=
    0.5;

return {
  version:
    "1.0",

  documentType:
    document.documentType,

  documentDecision:
    document.decision,

  category,

  tasks,

  administrativeProcedureType:
    document
      .administrative
      .procedureType,

  canAssist,

  requiresStaffReview,

  documentSummary:
    document.summary ||
    "첨부된 문서를 확인했습니다.",

  fields:
    aiAssistance
      ?.fields ??
    [],

  issues:
    aiAssistance
      ?.issues ??
    [],

  nextSteps:
    aiAssistance
      ?.nextSteps ??
    [],

  guidanceSummary:
    aiAssistance
      ?.guidanceSummary ||
    document.summary ||
    "첨부된 문서를 기준으로 작성 및 제출 방법을 안내할 수 있습니다.",

  warnings:
    Array.from(
      new Set([
        ...document.warnings,
        ...document.missingEvidence,
        ...(
          aiAssistance
            ?.warnings ??
          []
        ),
      ])
    ),
};
}