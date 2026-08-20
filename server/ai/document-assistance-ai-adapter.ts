import OpenAI from "openai";

import type {
  DocumentIntelligenceResult,
} from "./document-intelligence.types";

import type {
  DocumentAssistanceCategory,
  DocumentAssistanceField,
  DocumentAssistanceIssue,
  DocumentAssistanceStep,
  DocumentAssistanceTask,
} from "./document-assistance.types";

const openai =
  new OpenAI({
    apiKey:
      process.env.OPENAI_API_KEY,
  });

export interface AnalyzeDocumentAssistanceWithAiInput {
  organizationId:
    number;

  documentIntelligence:
    DocumentIntelligenceResult;

  category:
    DocumentAssistanceCategory;

  tasks:
    DocumentAssistanceTask[];

  studentId?:
    number |
    null;

  userMessage?:
    string |
    null;
}

export interface DocumentAssistanceAiResult {
  fields:
    DocumentAssistanceField[];

  issues:
    DocumentAssistanceIssue[];

  nextSteps:
    DocumentAssistanceStep[];

  guidanceSummary:
    string;

  requiresStaffReview:
    boolean;

  warnings:
    string[];
}

type RawDocumentAssistanceAiResult = {
  fields:
    Array<{
      label:
        string;

      currentValue:
        string |
        null;

      required:
        boolean;

      status:
        | "filled"
        | "missing"
        | "uncertain"
        | "mismatch"
        | "not_applicable";

      source:
        | "document"
        | "crm"
        | "document_and_crm"
        | "user"
        | "unknown";

      guidance:
        string |
        null;
    }>;

  issues:
    Array<{
      severity:
        | "info"
        | "warning"
        | "danger";

      code:
        string;

      title:
        string;

      message:
        string;

      autoFixable:
        boolean;
    }>;

  nextSteps:
    Array<{
      order:
        number;

      title:
        string;

      description:
        string;

      requiresUserAction:
        boolean;

      requiresStaffReview:
        boolean;
    }>;

  guidanceSummary:
    string;

  requiresStaffReview:
    boolean;

  warnings:
    string[];
};

function normalizeText(
  value:
    unknown,
  maxLength =
    2000
): string {
  return String(
    value ??
    ""
  )
    .replace(
      /\s+/g,
      " "
    )
    .trim()
    .slice(
      0,
      maxLength
    );
}

function normalizeNullableText(
  value:
    unknown,
  maxLength =
    2000
): string | null {
  const text =
    normalizeText(
      value,
      maxLength
    );

  return text ||
    null;
}

function normalizeWarnings(
  value:
    unknown
): string[] {
  if (
    !Array.isArray(
      value
    )
  ) {
    return [];
  }

  return value
    .map(
      item =>
        normalizeText(
          item,
          1000
        )
    )
    .filter(
      Boolean
    )
    .slice(
      0,
      30
    );
}

function normalizeAiResult(
  raw:
    RawDocumentAssistanceAiResult
): DocumentAssistanceAiResult {
  const fields =
    Array.isArray(
      raw?.fields
    )
      ? raw.fields
          .map(
            field => {
              const label =
                normalizeText(
                  field?.label,
                  300
                );

              if (
                !label
              ) {
                return null;
              }

              return {
                label,

                currentValue:
                  normalizeNullableText(
                    field?.currentValue,
                    1000
                  ),

                required:
                  field?.required ===
                  true,

                status:
                  field?.status,

                source:
                  field?.source,

                guidance:
                  normalizeNullableText(
                    field?.guidance,
                    2000
                  ),
              } satisfies
                DocumentAssistanceField;
            }
          )
          .filter(
            (
              field
            ): field is
              DocumentAssistanceField =>
              field !==
              null
          )
          .slice(
            0,
            100
          )
      : [];

  const issues =
    Array.isArray(
      raw?.issues
    )
      ? raw.issues
          .map(
            issue => {
              const title =
                normalizeText(
                  issue?.title,
                  500
                );

              const message =
                normalizeText(
                  issue?.message,
                  2000
                );

              if (
                !title ||
                !message
              ) {
                return null;
              }

              return {
                severity:
                  issue.severity,

                code:
                  normalizeText(
                    issue.code,
                    200
                  ) ||
                  "DOCUMENT_REVIEW",

                title,

                message,

                autoFixable:
                  issue.autoFixable ===
                  true,
              } satisfies
                DocumentAssistanceIssue;
            }
          )
          .filter(
            (
              issue
            ): issue is
              DocumentAssistanceIssue =>
              issue !==
              null
          )
          .slice(
            0,
            50
          )
      : [];

  const nextSteps =
    Array.isArray(
      raw?.nextSteps
    )
      ? raw.nextSteps
          .map(
            (
              step,
              index
            ) => {
              const title =
                normalizeText(
                  step?.title,
                  500
                );

              const description =
                normalizeText(
                  step?.description,
                  3000
                );

              if (
                !title ||
                !description
              ) {
                return null;
              }

              return {
                order:
                  Number.isFinite(
                    Number(
                      step.order
                    )
                  )
                    ? Math.max(
                        1,
                        Math.floor(
                          Number(
                            step.order
                          )
                        )
                      )
                    : index +
                      1,

                title,

                description,

                requiresUserAction:
                  step
                    .requiresUserAction ===
                  true,

                requiresStaffReview:
                  step
                    .requiresStaffReview ===
                  true,
              } satisfies
                DocumentAssistanceStep;
            }
          )
          .filter(
            (
              step
            ): step is
              DocumentAssistanceStep =>
              step !==
              null
          )
          .sort(
            (
              a,
              b
            ) =>
              a.order -
              b.order
          )
          .slice(
            0,
            30
          )
      : [];

  const requiresStaffReview =
    raw
      ?.requiresStaffReview ===
      true ||
    issues.some(
      issue =>
        issue.severity ===
        "danger"
    ) ||
    nextSteps.some(
      step =>
        step
          .requiresStaffReview ===
        true
    );

  return {
    fields,

    issues,

    nextSteps,

    guidanceSummary:
      normalizeText(
        raw
          ?.guidanceSummary,
        4000
      ),

    requiresStaffReview,

    warnings:
      normalizeWarnings(
        raw?.warnings
      ),
  };
}

export async function analyzeDocumentAssistanceWithAi(
  input:
    AnalyzeDocumentAssistanceWithAiInput
): Promise<DocumentAssistanceAiResult> {
  if (
    !process.env
      .OPENAI_API_KEY
  ) {
    throw new Error(
      "OPENAI_API_KEY가 설정되지 않았습니다."
    );
  }

  const document =
    input.documentIntelligence;

  const userMessage =
    normalizeNullableText(
      input.userMessage,
      3000
    );

  /**
   * 중요:
   *
   * Document Assistance는
   * Document Intelligence가 이미 읽은 사실만 사용한다.
   *
   * 원본 이미지/PDF를 다시 Vision 분석하지 않는다.
   */
  const assistanceContext = {
    documentType:
      document.documentType,

    documentDecision:
      document.decision,

    confidence:
      document.confidence,

    category:
      input.category,

    tasks:
      input.tasks,

    customerType:
      Number(
        input.studentId ||
        0
      ) > 0
        ? "registered"
        : "lead",

    userMessage,

    person:
      document.person,

    institution:
      document.institution,

    academic:
      document.academic,

    administrative:
      document.administrative,

    extractedText:
      document.extractedText,

    evidence:
      document.evidence,

    missingEvidence:
      document.missingEvidence,

    warnings:
      document.warnings,

    documentSummary:
      document.summary,
  };

  const response =
    await openai.responses.create({
      model:
        process.env
          .OPENAI_AI_MODEL ||
        process.env
          .OPENAI_VISION_MODEL ||
        "gpt-5.4-mini",

      input: [
        {
          role:
            "system",

          content: [
            {
              type:
                "input_text",

              text: `
너는 EduCanvas 공통 Document Assistance 엔진이다.

이미 Document Intelligence가 문서를 읽고 구조화했다.
너는 OCR이나 이미지 판독을 다시 하지 않는다.

너의 역할은 문서에서 확인된 사실을 기준으로:

1. 사용자가 작성하거나 확인해야 할 항목(fields)을 정리한다.
2. 누락, 불확실, 잘못 작성되었을 가능성이 있는 항목(issues)을 정리한다.
3. 사용자가 다음으로 해야 할 순서(nextSteps)를 정리한다.
4. 현재 자료만으로 확정할 수 없는 값은 절대로 추측하지 않는다.
5. 외부기관의 실제 제출완료, 자격증 발급완료, 행정처리완료를 임의로 확정하지 않는다.
6. 학점, 자격요건, 남은과목, 학기수 같은 계산을 직접 하지 않는다.
7. Document Intelligence의 evidence / missingEvidence / warnings를 최우선 근거로 사용한다.
8. documentDecision이 review_required이면 필요한 확인사항을 명확하게 안내한다.
9. 등록회원이라고 하더라도 CRM 값은 현재 입력에 포함되지 않았으므로 CRM 정보를 임의로 만들어내지 않는다.
10. 주민등록번호, 계좌번호, 비밀번호, 공동인증서 정보 등 민감정보를 생성하거나 추측하지 않는다.

문서 종류별 원칙:

- practice_document:
  실습기관명, 실습기간, 실습시간, 기관정보,
  실습생 정보, 서명/날인, 지도자 관련 항목,
  제출 전 확인사항을 우선한다.

- qualification_application:
  신청자 정보, 자격종류, 학력/이수 관련 첨부,
  서명/날인, 필수 첨부자료, 제출단계를 우선한다.

- learner_registration / credit_recognition /
  degree_application / administrative_document:
  현재 신청 단계, 누락정보, 완료증빙,
  다음 행정단계를 우선한다.

- transcript / degree_certificate:
  문서 확인 및 학업분석에 사용할 수 있는 정보가
  충분한지 확인한다.
  남은 학점이나 과목 수는 직접 계산하지 않는다.

fields.status:
filled = 값이 확인됨
missing = 필수인데 확인되지 않음
uncertain = 값이 있으나 불명확
mismatch = 서로 다른 근거가 충돌
not_applicable = 현재 문서에 해당 없음

fields.source:
document = 문서에서 확인
crm = CRM에서 확인
document_and_crm = 문서와 CRM 모두 일치
user = 사용자 발언
unknown = 근거 없음

현재 단계에서는 CRM 원본 데이터가 제공되지 않으므로
crm/document_and_crm은 특별한 근거가 없는 한 사용하지 않는다.

issues.severity:
info = 참고사항
warning = 제출 전에 확인 필요
danger = 잘못 제출하거나 잘못 반영될 위험이 큼

autoFixable은
사용자에게 값 작성방법을 안내할 수 있다는 의미이지,
실제 문서나 DB를 자동 수정했다는 의미가 아니다.

반드시 JSON Schema에 맞는 결과만 반환한다.
              `.trim(),
            },
          ],
        },

        {
          role:
            "user",

          content: [
            {
              type:
                "input_text",

              text:
                JSON.stringify(
                  assistanceContext
                ),
            },
          ],
        },
      ],

      text: {
        format: {
          type:
            "json_schema",

          name:
            "document_assistance_result",

          strict:
            true,

          schema: {
            type:
              "object",

            additionalProperties:
              false,

            properties: {
              fields: {
                type:
                  "array",

                maxItems:
                  100,

                items: {
                  type:
                    "object",

                  additionalProperties:
                    false,

                  properties: {
                    label: {
                      type:
                        "string",
                    },

                    currentValue: {
                      type: [
                        "string",
                        "null",
                      ],
                    },

                    required: {
                      type:
                        "boolean",
                    },

                    status: {
                      type:
                        "string",

                      enum: [
                        "filled",
                        "missing",
                        "uncertain",
                        "mismatch",
                        "not_applicable",
                      ],
                    },

                    source: {
                      type:
                        "string",

                      enum: [
                        "document",
                        "crm",
                        "document_and_crm",
                        "user",
                        "unknown",
                      ],
                    },

                    guidance: {
                      type: [
                        "string",
                        "null",
                      ],
                    },
                  },

                  required: [
                    "label",
                    "currentValue",
                    "required",
                    "status",
                    "source",
                    "guidance",
                  ],
                },
              },

              issues: {
                type:
                  "array",

                maxItems:
                  50,

                items: {
                  type:
                    "object",

                  additionalProperties:
                    false,

                  properties: {
                    severity: {
                      type:
                        "string",

                      enum: [
                        "info",
                        "warning",
                        "danger",
                      ],
                    },

                    code: {
                      type:
                        "string",
                    },

                    title: {
                      type:
                        "string",
                    },

                    message: {
                      type:
                        "string",
                    },

                    autoFixable: {
                      type:
                        "boolean",
                    },
                  },

                  required: [
                    "severity",
                    "code",
                    "title",
                    "message",
                    "autoFixable",
                  ],
                },
              },

              nextSteps: {
                type:
                  "array",

                maxItems:
                  30,

                items: {
                  type:
                    "object",

                  additionalProperties:
                    false,

                  properties: {
                    order: {
                      type:
                        "integer",

                      minimum:
                        1,
                    },

                    title: {
                      type:
                        "string",
                    },

                    description: {
                      type:
                        "string",
                    },

                    requiresUserAction: {
                      type:
                        "boolean",
                    },

                    requiresStaffReview: {
                      type:
                        "boolean",
                    },
                  },

                  required: [
                    "order",
                    "title",
                    "description",
                    "requiresUserAction",
                    "requiresStaffReview",
                  ],
                },
              },

              guidanceSummary: {
                type:
                  "string",
              },

              requiresStaffReview: {
                type:
                  "boolean",
              },

              warnings: {
                type:
                  "array",

                maxItems:
                  30,

                items: {
                  type:
                    "string",
                },
              },
            },

            required: [
              "fields",
              "issues",
              "nextSteps",
              "guidanceSummary",
              "requiresStaffReview",
              "warnings",
            ],
          },
        },
      },
    });

  const outputText =
    String(
      response.output_text ||
      ""
    ).trim();

  if (
    !outputText
  ) {
    throw new Error(
      "Document Assistance AI 분석 결과가 비어 있습니다."
    );
  }

  let parsed:
    RawDocumentAssistanceAiResult;

  try {
    parsed =
      JSON.parse(
        outputText
      ) as
        RawDocumentAssistanceAiResult;
  } catch (
    error
  ) {
    console.error(
      "[DOCUMENT ASSISTANCE] JSON 변환 실패",
      error
    );

    throw new Error(
      "Document Assistance AI 결과 형식이 올바르지 않습니다."
    );
  }

  return normalizeAiResult(
    parsed
  );
}