import crypto from "crypto";

import type {
  AiDocumentAnalysisResult,
  AiDocumentConfidenceLevel,
  AiDocumentExtractedField,
  AiDocumentExtractedSubject,
  AiDocumentTarget,
  AiDocumentType,
} from "./ai.types";

import type {
  DocumentIntelligencePaymentStatus,
  DocumentIntelligenceResult,
} from "./document-intelligence.types";

function getConfidenceLevel(
  confidence: number
): AiDocumentConfidenceLevel {
  if (
    confidence >= 0.85
  ) {
    return "high";
  }

  if (
    confidence >= 0.6
  ) {
    return "medium";
  }

  return "low";
}

function buildField<T>(
  value:
    T |
    null,

  confidence:
    number,

  warning?:
    string |
    null
): AiDocumentExtractedField<T> {
  const normalizedConfidence =
    value === null
      ? 0
      : Math.min(
          Math.max(
            Number(
              confidence ||
              0
            ),
            0
          ),
          1
        );

  return {
    value,

    confidence:
      normalizedConfidence,

    confidenceLevel:
      getConfidenceLevel(
        normalizedConfidence
      ),

    status:
      "extracted",

    warning:
      warning ??
      null,
  };
}

function mapPaymentStatus(
  value:
    DocumentIntelligencePaymentStatus |
    null
):
  | "결제완료"
  | "결제예정"
  | "미결제"
  | "부분환불"
  | "전액환불"
  | "취소"
  | null {
  switch (
    value
  ) {
    case "paid":
      return "결제완료";

    case "scheduled":
      return "결제예정";

    case "unpaid":
      return "미결제";

    case "partial_refund":
      return "부분환불";

    case "full_refund":
      return "전액환불";

    case "cancelled":
      return "취소";

    default:
      return null;
  }
}

function resolveLegacyDocument(
  result:
    DocumentIntelligenceResult
): {
  documentType:
    AiDocumentType;

  target:
    AiDocumentTarget;
} {
  if (
    result.documentType ===
      "transcript"
  ) {
    return {
      documentType:
        "university_transcript",

      target:
        "transfer",
    };
  }

  const hasSubjects =
    result.academic
      .subjects.length >
    0;

  const hasPayment =
    result.payment
      .amount !==
      null ||
    Boolean(
      result.payment
        .paidAt
    ) ||
    (
      result.payment
        .status !==
        null &&
      result.payment
        .status !==
        "unknown"
    );

  if (
    hasSubjects &&
    hasPayment
  ) {
    return {
      documentType:
        "education_enrollment_and_payment",

      target:
        "plan_and_payment",
    };
  }

  if (
    hasSubjects
  ) {
    return {
      documentType:
        "education_enrollment",

      target:
        "plan",
    };
  }

  if (
    hasPayment ||
    result.documentType ===
      "payment_proof"
  ) {
    return {
      documentType:
        "education_payment",

      target:
        "payment",
    };
  }

  return {
    documentType:
      "unknown",

    target:
      "analysis_only",
  };
}

function getDocumentTypeLabel(
  value:
    AiDocumentType
) {
  switch (
    value
  ) {
    case "university_transcript":
      return "대학교·전문대학교 성적증명서";

    case "education_enrollment":
      return "교육원 수강내역";

    case "education_payment":
      return "교육원 결제내역";

    case "education_enrollment_and_payment":
      return "교육원 수강·결제내역";

    default:
      return "문서 종류 확인 필요";
  }
}

function getTargetLabel(
  value:
    AiDocumentTarget
) {
  switch (
    value
  ) {
    case "transfer":
      return "전적대";

    case "plan":
      return "우리플랜";

    case "payment":
      return "결제내역";

    case "plan_and_payment":
      return "우리플랜 + 결제내역";

    default:
      return "분석만";
  }
}

function buildSubjects(
  result:
    DocumentIntelligenceResult
): AiDocumentExtractedSubject[] {
  return result.academic
    .subjects
    .map(
      (
        subject,
        index
      ) => {
        const confidence =
          result.confidence;

        const completionYearRaw =
          Number(
            subject.year
          );

        const completionYear =
          Number.isFinite(
            completionYearRaw
          ) &&
          completionYearRaw >=
            1900 &&
          completionYearRaw <=
            2200
            ? Math.floor(
                completionYearRaw
              )
            : null;

        return {
          rowId:
            crypto.randomUUID(),

          selected:
            Boolean(
              subject.name
            ),

          subjectName:
            buildField(
              subject.name,
              confidence
            ),

          credits:
            buildField(
              subject.credits,
              confidence,
              subject.credits ===
                null
                ? "과목 학점을 확인하지 못했습니다."
                : null
            ),

          grade:
            buildField(
              subject.grade,
              confidence
            ),

          category:
            buildField(
              subject.category,
              confidence,
              subject.category ===
                null
                ? "학습구분 확인이 필요합니다."
                : null
            ),

          requirementType:
            buildField(
              subject
                .requirementType,
              confidence,
              subject
                .requirementType ===
                null
                ? "전공필수·전공선택 구분 확인이 필요합니다."
                : null
            ),

          semesterNo:
            buildField(
              subject.semesterNo,
              confidence
            ),

          completionYear:
            buildField(
              completionYear,
              confidence
            ),

          completionSemester:
            buildField(
              subject.semester,
              confidence
            ),

          rawText:
            subject.rawName ||
            subject.name,

          warnings:
            [
              subject.credits ===
                null
                ? "과목 학점 확인 필요"
                : null,

              subject.category ===
                null
                ? "학습구분 확인 필요"
                : null,

              subject
                .requirementType ===
                null
                ? "전필·전선 확인 필요"
                : null,
            ].filter(
              (
                item
              ): item is string =>
                Boolean(item)
            ),
        } satisfies
          AiDocumentExtractedSubject;
      }
    );
}

export function mapDocumentIntelligenceToLegacyAnalysis(
  result:
    DocumentIntelligenceResult
): AiDocumentAnalysisResult {
  const legacy =
    resolveLegacyDocument(
      result
    );

  const paymentStatus =
    mapPaymentStatus(
      result.payment
        .status
    );

  const requiredConfirmations =
    Array.from(
      new Set([
        ...result
          .missingEvidence,

        ...(
          result.decision !==
            "accepted"
            ? [
                "AI 문서 분석 결과를 담당자가 확인해주세요.",
              ]
            : []
        ),

        ...(
          legacy.target ===
            "analysis_only"
            ? [
                "분석 결과를 실제 CRM에 반영할지 확인해주세요.",
              ]
            : []
        ),
      ])
    );

  return {
    analysisId:
      crypto.randomUUID(),

    documentType:
      legacy.documentType,

    documentTypeLabel:
      getDocumentTypeLabel(
        legacy.documentType
      ),

    recommendedTarget:
      legacy.target,

    recommendedTargetLabel:
      getTargetLabel(
        legacy.target
      ),

    confidence:
      result.confidence,

    confidenceLevel:
      getConfidenceLevel(
        result.confidence
      ),

    institutionName:
      buildField(
        result.institution
          .name,
        result.confidence
      ),

    studentName:
      buildField(
        result.person
          .name,
        result.confidence
      ),

    courseName:
      buildField(
        result.enrollment
          .courseName,
        result.confidence
      ),

    semesterLabel:
      buildField(
        result.enrollment
          .semesterLabel,
        result.confidence
      ),

    startDate:
      buildField(
        result.enrollment
          .startDate,
        result.confidence
      ),

    endDate:
      buildField(
        result.enrollment
          .endDate,
        result.confidence
      ),

    paymentAmount:
      buildField(
        result.payment
          .amount,
        result.confidence
      ),

    paymentStatus:
      buildField(
        paymentStatus,
        result.confidence
      ),

    paidAt:
      buildField(
        result.payment
          .paidAt,
        result.confidence
      ),

    subjects:
      buildSubjects(
        result
      ),

    rawText:
      result.extractedText ||
      "",

    warnings:
      Array.from(
        new Set(
          result.warnings
        )
      ),

    requiredConfirmations,

    analyzedAt:
      new Date()
        .toISOString(),
  };
}