import crypto from "crypto";
import OpenAI from "openai";

import type {
  AiDocumentAnalysisInput,
  AiDocumentAnalysisResult,
  AiDocumentConfidenceLevel,
  AiDocumentExtractedField,
  AiDocumentExtractedSubject,
  AiDocumentFieldStatus,
  AiDocumentTarget,
  AiDocumentType,
} from "./ai.types";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

const MAX_IMAGE_BASE64_LENGTH =
  14_000_000;

/**
 * AI Structured Output에서 전달받는 원본 필드
 *
 * 서버에서 다시 정규화하기 전 구조다.
 */
type RawDocumentField<T> = {
  value: T | null;
  confidence: number | null;
  warning: string | null;
};

type RawDocumentSubject = {
  subjectName:
    RawDocumentField<string>;

  credits:
    RawDocumentField<number>;

  grade:
    RawDocumentField<string>;

  category:
    RawDocumentField<
      | "전공"
      | "교양"
      | "일반"
    >;

  requirementType:
    RawDocumentField<
      | "전공필수"
      | "전공선택"
      | "교양"
      | "일반"
    >;

  semesterNo:
    RawDocumentField<number>;

  rawText:
    string | null;

  warnings:
    string[];
};

type RawDocumentAnalysis = {
  documentType:
    AiDocumentType;

  recommendedTarget:
    AiDocumentTarget;

  confidence:
    number;

  institutionName:
    RawDocumentField<string>;

  studentName:
    RawDocumentField<string>;

  courseName:
    RawDocumentField<string>;

  semesterLabel:
    RawDocumentField<string>;

  startDate:
    RawDocumentField<string>;

  endDate:
    RawDocumentField<string>;

  paymentAmount:
    RawDocumentField<number>;

  paymentStatus:
    RawDocumentField<
      | "결제완료"
      | "결제예정"
      | "미결제"
      | "부분환불"
      | "전액환불"
      | "취소"
    >;

  paidAt:
    RawDocumentField<string>;

  subjects:
    RawDocumentSubject[];

  rawText:
    string;

  warnings:
    string[];

  requiredConfirmations:
    string[];
};

function normalizeText(
  value: unknown,
  maxLength = 500
): string | null {
  const text =
    String(value ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxLength);

  return text || null;
}

function normalizeRawText(
  value: unknown
): string {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim()
    .slice(0, 30_000);
}

function normalizeStringArray(
  value: unknown,
  limit = 100
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) =>
          normalizeText(
            item,
            500
          )
        )
        .filter(
          (
            item
          ): item is string =>
            Boolean(item)
        )
    )
  ).slice(0, limit);
}

function normalizeConfidence(
  value: unknown
): number {
  const number =
    Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.min(
    Math.max(number, 0),
    1
  );
}

function getConfidenceLevel(
  confidence: number
): AiDocumentConfidenceLevel {
  if (confidence >= 0.85) {
    return "high";
  }

  if (confidence >= 0.6) {
    return "medium";
  }

  return "low";
}

function normalizeNullableNumber(
  value: unknown
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const normalized =
    typeof value === "string"
      ? value.replace(
          /[^0-9.-]/g,
          ""
        )
      : value;

  const number =
    Number(normalized);

  if (!Number.isFinite(number)) {
    return null;
  }

  return number;
}

function normalizePositiveInteger(
  value: unknown,
  max = 100
): number | null {
  const number =
    normalizeNullableNumber(
      value
    );

  if (
    number === null ||
    number <= 0 ||
    number > max
  ) {
    return null;
  }

  return Math.floor(
    number
  );
}

function normalizeMoney(
  value: unknown
): number | null {
  const number =
    normalizeNullableNumber(
      value
    );

  if (
    number === null ||
    number < 0
  ) {
    return null;
  }

  return Math.round(number);
}

function normalizeDate(
  value: unknown
): string | null {
  const text =
    normalizeText(value, 30);

  if (!text) {
    return null;
  }

  /**
   * YYYY-MM-DD
   * YYYY.MM.DD
   * YYYY/MM/DD
   */
  const fullDateMatch =
    text.match(
      /(\d{4})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})/
    );

  if (fullDateMatch) {
    const year =
      Number(fullDateMatch[1]);

    const month =
      Number(fullDateMatch[2]);

    const day =
      Number(fullDateMatch[3]);

    if (
      year >= 1900 &&
      year <= 2200 &&
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= 31
    ) {
      return [
        String(year).padStart(
          4,
          "0"
        ),
        String(month).padStart(
          2,
          "0"
        ),
        String(day).padStart(
          2,
          "0"
        ),
      ].join("-");
    }
  }

  return text;
}

function normalizeDocumentType(
  value: unknown
): AiDocumentType {
  const allowed:
    AiDocumentType[] = [
      "university_transcript",
      "education_enrollment",
      "education_payment",
      "education_enrollment_and_payment",
      "unknown",
    ];

  const normalized =
    String(value ?? "");

  return allowed.includes(
    normalized as AiDocumentType
  )
    ? (
        normalized as
          AiDocumentType
      )
    : "unknown";
}

function normalizeDocumentTarget(
  value: unknown
): AiDocumentTarget {
  const allowed:
    AiDocumentTarget[] = [
      "plan",
      "transfer",
      "payment",
      "plan_and_payment",
      "analysis_only",
    ];

  const normalized =
    String(value ?? "");

  return allowed.includes(
    normalized as AiDocumentTarget
  )
    ? (
        normalized as
          AiDocumentTarget
      )
    : "analysis_only";
}

function getDocumentTypeLabel(
  value: AiDocumentType
): string {
  if (
    value ===
    "university_transcript"
  ) {
    return "대학교·전문대학교 성적증명서";
  }

  if (
    value ===
    "education_enrollment"
  ) {
    return "교육원 수강내역";
  }

  if (
    value ===
    "education_payment"
  ) {
    return "교육원 결제내역";
  }

  if (
    value ===
    "education_enrollment_and_payment"
  ) {
    return "교육원 수강·결제내역";
  }

  return "문서 종류 확인 필요";
}

function getTargetLabel(
  value: AiDocumentTarget
): string {
  if (value === "plan") {
    return "우리플랜";
  }

  if (value === "transfer") {
    return "전적대";
  }

  if (value === "payment") {
    return "결제내역";
  }

  if (
    value ===
    "plan_and_payment"
  ) {
    return "우리플랜 + 결제내역";
  }

  return "분석만";
}

function buildField<T>(
  params: {
    value: T | null;
    confidence: unknown;
    warning?: unknown;
  }
): AiDocumentExtractedField<T> {
  const confidence =
    normalizeConfidence(
      params.confidence
    );

  return {
    value:
      params.value ??
      null,

    confidence,

    confidenceLevel:
      getConfidenceLevel(
        confidence
      ),

    /**
     * AI 분석 결과는
     * 최초에 모두 미확인 상태다.
     */
    status:
      "extracted" satisfies
        AiDocumentFieldStatus,

    warning:
      normalizeText(
        params.warning,
        500
      ),
  };
}

function buildStringField(
  value: unknown
): AiDocumentExtractedField<string> {
  const source =
    value &&
    typeof value === "object"
      ? (
          value as
            RawDocumentField<string>
        )
      : {
          value: null,
          confidence: 0,
          warning: null,
        };

  return buildField({
    value:
      normalizeText(
        source.value,
        500
      ),

    confidence:
      source.confidence,

    warning:
      source.warning,
  });
}

function buildDateField(
  value: unknown
): AiDocumentExtractedField<string> {
  const source =
    value &&
    typeof value === "object"
      ? (
          value as
            RawDocumentField<string>
        )
      : {
          value: null,
          confidence: 0,
          warning: null,
        };

  return buildField({
    value:
      normalizeDate(
        source.value
      ),

    confidence:
      source.confidence,

    warning:
      source.warning,
  });
}

function buildNumberField(
  value: unknown,
  options?: {
    positiveInteger?: boolean;
    money?: boolean;
    max?: number;
  }
): AiDocumentExtractedField<number> {
  const source =
    value &&
    typeof value === "object"
      ? (
          value as
            RawDocumentField<number>
        )
      : {
          value: null,
          confidence: 0,
          warning: null,
        };

  let normalized:
    number | null;

  if (options?.money) {
    normalized =
      normalizeMoney(
        source.value
      );
  } else if (
    options?.positiveInteger
  ) {
    normalized =
      normalizePositiveInteger(
        source.value,
        options.max
      );
  } else {
    normalized =
      normalizeNullableNumber(
        source.value
      );
  }

  return buildField({
    value:
      normalized,

    confidence:
      source.confidence,

    warning:
      source.warning,
  });
}

function buildEnumField<
  T extends string
>(
  value: unknown,
  allowed: readonly T[]
): AiDocumentExtractedField<T> {
  const source =
    value &&
    typeof value === "object"
      ? (
          value as
            RawDocumentField<T>
        )
      : {
          value: null,
          confidence: 0,
          warning: null,
        };

  const normalized =
    source.value &&
    allowed.includes(
      source.value
    )
      ? source.value
      : null;

  return buildField({
    value:
      normalized,

    confidence:
      source.confidence,

    warning:
      source.warning,
  });
}

function normalizeSubjects(
  value: unknown
): AiDocumentExtractedSubject[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .slice(0, 200)
    .map(
  (
    rawSubject
  ) => {
        const source =
          rawSubject &&
          typeof rawSubject ===
            "object"
            ? (
                rawSubject as
                  RawDocumentSubject
              )
            : (
                {} as
                  RawDocumentSubject
              );

        const subjectName =
          buildStringField(
            source.subjectName
          );

        const warnings =
          normalizeStringArray(
            source.warnings,
            20
          );

        if (
          !subjectName.value
        ) {
          warnings.push(
            "과목명을 확인하지 못했습니다."
          );
        }

        if (
          subjectName
            .confidenceLevel ===
          "low"
        ) {
          warnings.push(
            "과목명 인식 신뢰도가 낮습니다."
          );
        }

        return {
          rowId:
            crypto.randomUUID(),

          /**
           * 과목명이 없으면 기본 제외한다.
           */
          selected:
            Boolean(
              subjectName.value
            ),

          subjectName,

          credits:
            buildNumberField(
              source.credits,
              {
                positiveInteger:
                  true,

                max: 30,
              }
            ),

          grade:
            buildStringField(
              source.grade
            ),

          category:
            buildEnumField(
              source.category,
              [
                "전공",
                "교양",
                "일반",
              ] as const
            ),

          requirementType:
            buildEnumField(
              source
                .requirementType,
              [
                "전공필수",
                "전공선택",
                "교양",
                "일반",
              ] as const
            ),

          semesterNo:
            buildNumberField(
              source.semesterNo,
              {
                positiveInteger:
                  true,

                max: 30,
              }
            ),

          rawText:
            normalizeText(
              source.rawText,
              1000
            ),

          warnings:
            Array.from(
              new Set(
                warnings
              )
            ),
        };
      }
    );
}

function buildRequiredConfirmations(
  params: {
    raw:
      unknown;

    documentType:
      AiDocumentType;

    recommendedTarget:
      AiDocumentTarget;

    subjects:
      AiDocumentExtractedSubject[];

    institutionName:
      AiDocumentExtractedField<string>;

    paymentAmount:
      AiDocumentExtractedField<number>;
  }
): string[] {
  const confirmations =
    normalizeStringArray(
      params.raw,
      100
    );

  confirmations.push(
    "저장 위치를 우리플랜, 전적대, 결제내역 중에서 선택해주세요."
  );

  if (
    params.documentType ===
    "unknown"
  ) {
    confirmations.push(
      "문서 종류를 직접 확인해주세요."
    );
  }

  if (
    params.recommendedTarget ===
    "analysis_only"
  ) {
    confirmations.push(
      "분석 결과를 실제 데이터에 반영할지 확인해주세요."
    );
  }

  if (
    params.subjects.length >
    0
  ) {
    confirmations.push(
      "추출된 과목을 한 항목씩 확인해주세요."
    );
  }

  if (
    !params
      .institutionName
      .value
  ) {
    confirmations.push(
      "학교 또는 교육원명을 확인해주세요."
    );
  }

  if (
    params.paymentAmount
      .value !== null
  ) {
    confirmations.push(
      "결제금액이 전체 금액인지 과목별 금액인지 확인해주세요."
    );
  }

  return Array.from(
    new Set(
      confirmations
    )
  );
}

function validateInput(
  input: AiDocumentAnalysisInput
) {
  if (
    !process.env
      .OPENAI_API_KEY
  ) {
    throw new Error(
      "OPENAI_API_KEY가 설정되지 않았습니다."
    );
  }

  if (
    !ALLOWED_MIME_TYPES.includes(
      input.mimeType
    )
  ) {
    throw new Error(
      "지원하지 않는 이미지 형식입니다."
    );
  }

  if (
    !input.imageBase64 ||
    input.imageBase64
      .length < 100
  ) {
    throw new Error(
      "분석할 이미지가 없습니다."
    );
  }

  if (
    input.imageBase64
      .length >
    MAX_IMAGE_BASE64_LENGTH
  ) {
    throw new Error(
      "이미지 용량이 너무 큽니다."
    );
  }

  /**
   * Base64 이외의 문자가 포함돼 있는지 확인한다.
   *
   * 줄바꿈은 프론트 변환 과정에서 포함될 수 있어 제거 후 검사한다.
   */
  const compact =
    input.imageBase64
      .replace(/\s+/g, "");

  if (
    !/^[A-Za-z0-9+/]+={0,2}$/.test(
      compact
    )
  ) {
    throw new Error(
      "이미지 데이터 형식이 올바르지 않습니다."
    );
  }
}

function buildImageDataUrl(
  input: AiDocumentAnalysisInput
): string {
  const compact =
    input.imageBase64
      .replace(/\s+/g, "");

  return [
    "data:",
    input.mimeType,
    ";base64,",
    compact,
  ].join("");
}

function normalizeAnalysisResult(
  raw: RawDocumentAnalysis
): AiDocumentAnalysisResult {
  const documentType =
    normalizeDocumentType(
      raw.documentType
    );

  const recommendedTarget =
    normalizeDocumentTarget(
      raw.recommendedTarget
    );

  const confidence =
    normalizeConfidence(
      raw.confidence
    );

  const institutionName =
    buildStringField(
      raw.institutionName
    );

  const studentName =
    buildStringField(
      raw.studentName
    );

  const courseName =
    buildStringField(
      raw.courseName
    );

  const semesterLabel =
    buildStringField(
      raw.semesterLabel
    );

  const startDate =
    buildDateField(
      raw.startDate
    );

  const endDate =
    buildDateField(
      raw.endDate
    );

  const paymentAmount =
    buildNumberField(
      raw.paymentAmount,
      {
        money: true,
      }
    );

  const paymentStatus =
    buildEnumField(
      raw.paymentStatus,
      [
        "결제완료",
        "결제예정",
        "미결제",
        "부분환불",
        "전액환불",
        "취소",
      ] as const
    );

  const paidAt =
    buildDateField(
      raw.paidAt
    );

  const subjects =
    normalizeSubjects(
      raw.subjects
    );

  const warnings =
    normalizeStringArray(
      raw.warnings,
      100
    );

  if (
    subjects.length === 0 &&
    (
      documentType ===
        "university_transcript" ||
      documentType ===
        "education_enrollment" ||
      documentType ===
        "education_enrollment_and_payment"
    )
  ) {
    warnings.push(
      "문서에서 과목을 찾지 못했습니다."
    );
  }

  if (
    confidence <
    0.6
  ) {
    warnings.push(
      "문서 전체 분석 신뢰도가 낮습니다."
    );
  }

  return {
    analysisId:
      crypto.randomUUID(),

    documentType,

    documentTypeLabel:
      getDocumentTypeLabel(
        documentType
      ),

    recommendedTarget,

    recommendedTargetLabel:
      getTargetLabel(
        recommendedTarget
      ),

    confidence,

    confidenceLevel:
      getConfidenceLevel(
        confidence
      ),

    institutionName,

    studentName,

    courseName,

    semesterLabel,

    startDate,

    endDate,

    paymentAmount,

    paymentStatus,

    paidAt,

    subjects,

    rawText:
      normalizeRawText(
        raw.rawText
      ),

    warnings:
      Array.from(
        new Set(
          warnings
        )
      ),

    requiredConfirmations:
      buildRequiredConfirmations({
        raw:
          raw.requiredConfirmations,

        documentType,

        recommendedTarget,

        subjects,

        institutionName,

        paymentAmount,
      }),

    analyzedAt:
      new Date()
        .toISOString(),
  };
}

export async function analyzeAiDocument(
  input: AiDocumentAnalysisInput
): Promise<AiDocumentAnalysisResult> {
  validateInput(input);

  const imageDataUrl =
    buildImageDataUrl(input);

  const response =
    await openai.responses.create({
      model:
        process.env
          .OPENAI_VISION_MODEL ||
        process.env
          .OPENAI_AI_MODEL ||
        "gpt-5.4-mini",

      input: [
        {
          role: "system",

          content: [
            {
              type:
                "input_text",

              text: [
                "너는 EduCanvas CRM의 교육 문서 분석 AI다.",
                "",
                "분석 가능한 문서:",
                "- 대학교 또는 전문대학교 성적증명서",
                "- 학점은행제 교육원 수강신청 내역",
                "- 교육원 홈페이지 수강과목 캡처",
                "- 교육원 결제내역",
                "- 과목과 결제정보가 함께 표시된 캡처",
                "",
                "중요 원칙:",
                "1. 이미지에 실제로 보이는 값만 추출한다.",
                "2. 보이지 않는 과목, 금액, 날짜, 학점은 만들지 않는다.",
                "3. 불확실한 값은 null로 반환하거나 낮은 confidence를 부여한다.",
                "4. 과목 학점이 보이지 않으면 임의로 3학점을 넣지 않는다.",
                "5. 과목 분류가 보이지 않으면 전공선택으로 추측하지 않는다.",
                "6. 숫자 0과 영문 O, 숫자 1과 영문 I를 주의한다.",
                "7. 표의 행과 열 관계를 유지하여 과목별 값을 연결한다.",
                "8. 잘린 행이나 일부만 보이는 과목은 warning에 표시한다.",
                "9. 저장 위치는 추천만 하고 실제 저장은 수행하지 않는다.",
                "10. 개인정보는 이미지에 표시된 범위 안에서만 추출한다.",
                "",
                "문서 분류 규칙:",
                "- 대학 성적증명서: university_transcript",
                "- 교육원 과목·수강내역: education_enrollment",
                "- 교육원 결제내역: education_payment",
                "- 교육원 과목과 결제가 모두 있음: education_enrollment_and_payment",
                "- 판단 불가: unknown",
                "",
                "저장 위치 추천 규칙:",
                "- 대학 성적증명서: transfer",
                "- 교육원 수강내역: plan",
                "- 결제내역만 있음: payment",
                "- 수강내역과 결제가 모두 있음: plan_and_payment",
                "- 판단 불가: analysis_only",
                "",
                "confidence는 0부터 1 사이 숫자다.",
                "날짜는 가능하면 YYYY-MM-DD로 반환한다.",
                "금액은 쉼표와 원 단위를 제거한 숫자로 반환한다.",
                "rawText에는 이미지에서 실제로 확인한 원문을 가능한 순서대로 기록한다.",
                "모든 필드는 담당자가 확인하기 전의 추출 결과다.",
              ].join("\n"),
            },
          ],
        },

        {
          role: "user",

          content: [
            {
              type:
                "input_text",

              text:
                JSON.stringify({
                  fileName:
                    input.fileName,

                  studentId:
                    input.studentId ??
                    null,

                  request:
                    "업로드된 교육 문서를 분석하고 구조화된 결과를 반환해주세요.",
                }),
            },

            {
              type:
                "input_image",

              image_url:
                imageDataUrl,

              detail:
                "high",
            },
          ],
        },
      ],

      text: {
        format: {
          type:
            "json_schema",

          name:
            "educanvas_document_analysis",

          strict:
            true,

          schema: {
            type:
              "object",

            additionalProperties:
              false,

            properties: {
              documentType: {
                type:
                  "string",

                enum: [
                  "university_transcript",
                  "education_enrollment",
                  "education_payment",
                  "education_enrollment_and_payment",
                  "unknown",
                ],
              },

              recommendedTarget: {
                type:
                  "string",

                enum: [
                  "plan",
                  "transfer",
                  "payment",
                  "plan_and_payment",
                  "analysis_only",
                ],
              },

              confidence: {
                type:
                  "number",

                minimum:
                  0,

                maximum:
                  1,
              },

              institutionName:
                buildJsonFieldSchema(
                  "string"
                ),

              studentName:
                buildJsonFieldSchema(
                  "string"
                ),

              courseName:
                buildJsonFieldSchema(
                  "string"
                ),

              semesterLabel:
                buildJsonFieldSchema(
                  "string"
                ),

              startDate:
                buildJsonFieldSchema(
                  "string"
                ),

              endDate:
                buildJsonFieldSchema(
                  "string"
                ),

              paymentAmount:
                buildJsonFieldSchema(
                  "number"
                ),

              paymentStatus: {
                type:
                  "object",

                additionalProperties:
                  false,

                properties: {
                  value: {
                    type: [
                      "string",
                      "null",
                    ],

                    enum: [
                      "결제완료",
                      "결제예정",
                      "미결제",
                      "부분환불",
                      "전액환불",
                      "취소",
                      null,
                    ],
                  },

                  confidence: {
                    type: [
                      "number",
                      "null",
                    ],

                    minimum:
                      0,

                    maximum:
                      1,
                  },

                  warning: {
                    type: [
                      "string",
                      "null",
                    ],
                  },
                },

                required: [
                  "value",
                  "confidence",
                  "warning",
                ],
              },

              paidAt:
                buildJsonFieldSchema(
                  "string"
                ),

              subjects: {
                type:
                  "array",

                maxItems:
                  200,

                items: {
                  type:
                    "object",

                  additionalProperties:
                    false,

                  properties: {
                    subjectName:
                      buildJsonFieldSchema(
                        "string"
                      ),

                    credits:
                      buildJsonFieldSchema(
                        "number"
                      ),

                    grade:
                      buildJsonFieldSchema(
                        "string"
                      ),

                    category: {
                      type:
                        "object",

                      additionalProperties:
                        false,

                      properties: {
                        value: {
                          type: [
                            "string",
                            "null",
                          ],

                          enum: [
                            "전공",
                            "교양",
                            "일반",
                            null,
                          ],
                        },

                        confidence: {
                          type: [
                            "number",
                            "null",
                          ],

                          minimum:
                            0,

                          maximum:
                            1,
                        },

                        warning: {
                          type: [
                            "string",
                            "null",
                          ],
                        },
                      },

                      required: [
                        "value",
                        "confidence",
                        "warning",
                      ],
                    },

                    requirementType: {
                      type:
                        "object",

                      additionalProperties:
                        false,

                      properties: {
                        value: {
                          type: [
                            "string",
                            "null",
                          ],

                          enum: [
                            "전공필수",
                            "전공선택",
                            "교양",
                            "일반",
                            null,
                          ],
                        },

                        confidence: {
                          type: [
                            "number",
                            "null",
                          ],

                          minimum:
                            0,

                          maximum:
                            1,
                        },

                        warning: {
                          type: [
                            "string",
                            "null",
                          ],
                        },
                      },

                      required: [
                        "value",
                        "confidence",
                        "warning",
                      ],
                    },

                    semesterNo:
                      buildJsonFieldSchema(
                        "number"
                      ),

                    rawText: {
                      type: [
                        "string",
                        "null",
                      ],
                    },

                    warnings: {
                      type:
                        "array",

                      items: {
                        type:
                          "string",
                      },
                    },
                  },

                  required: [
                    "subjectName",
                    "credits",
                    "grade",
                    "category",
                    "requirementType",
                    "semesterNo",
                    "rawText",
                    "warnings",
                  ],
                },
              },

              rawText: {
                type:
                  "string",
              },

              warnings: {
                type:
                  "array",

                items: {
                  type:
                    "string",
                },
              },

              requiredConfirmations: {
                type:
                  "array",

                items: {
                  type:
                    "string",
                },
              },
            },

            required: [
              "documentType",
              "recommendedTarget",
              "confidence",
              "institutionName",
              "studentName",
              "courseName",
              "semesterLabel",
              "startDate",
              "endDate",
              "paymentAmount",
              "paymentStatus",
              "paidAt",
              "subjects",
              "rawText",
              "warnings",
              "requiredConfirmations",
            ],
          },
        },
      },
    });

  const outputText =
    response.output_text
      ?.trim();

  if (!outputText) {
    throw new Error(
      "AI 문서 분석 결과가 비어 있습니다."
    );
  }

  let parsed:
    RawDocumentAnalysis;

  try {
    parsed =
      JSON.parse(
        outputText
      ) as
        RawDocumentAnalysis;
  } catch (error) {
    console.error(
      "[AI DOCUMENT] JSON 변환 실패",
      error
    );

    throw new Error(
      "AI 문서 분석 결과 형식이 올바르지 않습니다."
    );
  }

  return normalizeAnalysisResult(
    parsed
  );
}

/**
 * Structured Output 공통 필드 스키마
 *
 * OpenAI 요청 객체 안에서 사용하기 위해
 * 일반 객체로 반환한다.
 */
function buildJsonFieldSchema(
  valueType:
    | "string"
    | "number"
) {
  return {
    type:
      "object",

    additionalProperties:
      false,

    properties: {
      value: {
        type: [
          valueType,
          "null",
        ],
      },

      confidence: {
        type: [
          "number",
          "null",
        ],

        minimum:
          0,

        maximum:
          1,
      },

      warning: {
        type: [
          "string",
          "null",
        ],
      },
    },

    required: [
      "value",
      "confidence",
      "warning",
    ],
  };
}