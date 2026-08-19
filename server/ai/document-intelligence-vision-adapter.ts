import OpenAI from "openai";

import type {
  DocumentIntelligenceAdministrativeStatus,
  DocumentIntelligenceAdministrativeType,
  DocumentIntelligenceDocumentType,
  DocumentIntelligenceInputType,
  DocumentIntelligenceResult,
  DocumentIntelligenceSource,
  DocumentIntelligenceSubject,
} from "./document-intelligence.types";

const openai =
  new OpenAI({
    apiKey:
      process.env.OPENAI_API_KEY,
  });

type AnalyzeDocumentVisionInput = {
  sourceType:
    DocumentIntelligenceSource;

  inputType:
    DocumentIntelligenceInputType;

  fileUrl:
    string;

  studentId?:
    number |
    null;

  userMessage?:
    string |
    null;

  expectedDocumentType?:
    DocumentIntelligenceDocumentType |
    null;
};

type RawVisionResult = {
  documentType:
    DocumentIntelligenceDocumentType;

  confidence:
    number;

  person: {
    name:
      string |
      null;

    birthDate:
      string |
      null;

    studentNumber:
      string |
      null;
  };

  institution: {
    name:
      string |
      null;

    department:
      string |
      null;

    major:
      string |
      null;
  };

  academic: {
    graduationStatus:
      | "graduated"
      | "expected"
      | "enrolled"
      | "withdrawn"
      | "unknown"
      | null;

    degreeType:
      string |
      null;

    totalCredits:
      number |
      null;

    subjects:
      Array<{
  name:
    string;

  credits:
    number |
    null;

  grade:
    string |
    null;

  category:
    | "전공"
    | "교양"
    | "일반"
    | null;

  requirementType:
    | "전공필수"
    | "전공선택"
    | "교양"
    | "일반"
    | null;

  semesterNo:
    number |
    null;

  semester:
    string |
    null;

  year:
    string |
    null;

  rawName:
    string |
    null;
}>;
  };

enrollment: {
  courseName:
    string |
    null;

  semesterLabel:
    string |
    null;

  startDate:
    string |
    null;

  endDate:
    string |
    null;
};

payment: {
  amount:
    number |
    null;

  status:
    | "paid"
    | "scheduled"
    | "unpaid"
    | "partial_refund"
    | "full_refund"
    | "cancelled"
    | "unknown"
    | null;

  paidAt:
    string |
    null;
};

  administrative: {
    procedureType:
      DocumentIntelligenceAdministrativeType |
      null;

    detectedStatus:
      DocumentIntelligenceAdministrativeStatus;

    paymentAmount:
      number |
      null;

    applicationDate:
      string |
      null;

    completionDate:
      string |
      null;

    receiptNumber:
      string |
      null;
  };

  extractedText:
    string |
    null;

  evidence:
    Array<{
      key:
        string;

      value:
        string;

      confidence:
        number;
    }>;

  missingEvidence:
    string[];

  warnings:
    string[];

  summary:
    string;
};

function normalizeConfidence(
  value: unknown
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(number)
  ) {
    return 0;
  }

  return Math.min(
    Math.max(
      number,
      0
    ),
    1
  );
}

function normalizeNullableText(
  value: unknown,
  maxLength = 1000
): string | null {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const normalized =
    String(value)
      .replace(/\s+/g, " ")
      .trim()
      .slice(
        0,
        maxLength
      );

  return normalized ||
    null;
}

function normalizeTextArray(
  value: unknown,
  maxItems = 100
) {
  if (
    !Array.isArray(value)
  ) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map(
          item =>
            normalizeNullableText(
              item,
              1000
            )
        )
        .filter(
          (
            item
          ): item is string =>
            Boolean(item)
        )
    )
  ).slice(
    0,
    maxItems
  );
}

function normalizeSubjects(
  value: unknown
): DocumentIntelligenceSubject[] {
  if (
    !Array.isArray(value)
  ) {
    return [];
  }

  return value
    .slice(0, 300)
    .map(
      (
        item: any
      ) => {
        const name =
          normalizeNullableText(
            item?.name,
            500
          );

        if (!name) {
          return null;
        }

        const creditsRaw =
          Number(
            item?.credits
          );

        const credits =
          Number.isFinite(
            creditsRaw
          ) &&
          creditsRaw > 0
            ? creditsRaw
            : null;

        const rawCategory =
  item?.category;

const category:
  | "전공"
  | "교양"
  | "일반"
  | null =
  rawCategory === "전공" ||
  rawCategory === "교양" ||
  rawCategory === "일반"
    ? rawCategory
    : null;

const rawRequirementType =
  item?.requirementType;

const requirementType:
  | "전공필수"
  | "전공선택"
  | "교양"
  | "일반"
  | null =
  rawRequirementType === "전공필수" ||
  rawRequirementType === "전공선택" ||
  rawRequirementType === "교양" ||
  rawRequirementType === "일반"
    ? rawRequirementType
    : null;

const semesterNoRaw =
  Number(
    item?.semesterNo
  );

const semesterNo =
  Number.isFinite(
    semesterNoRaw
  ) &&
  semesterNoRaw > 0
    ? Math.floor(
        semesterNoRaw
      )
    : null;

return {
  name,

  credits,

  grade:
    normalizeNullableText(
      item?.grade,
      100
    ),

  category,

  requirementType,

  semesterNo,

  semester:
    normalizeNullableText(
      item?.semester,
      100
    ),

  year:
    normalizeNullableText(
      item?.year,
      20
    ),

  rawName:
    normalizeNullableText(
      item?.rawName,
      500
    ),
};
      }
    )
    .filter(
      (
        item
      ): item is
        DocumentIntelligenceSubject =>
        Boolean(item)
    );
}

function buildInputContent(
  input:
    AnalyzeDocumentVisionInput
): any[] {
  const contextText =
    JSON.stringify({
      studentId:
        input.studentId ??
        null,

      userMessage:
        input.userMessage ??
        null,

      expectedDocumentType:
        input.expectedDocumentType ??
        null,

      request:
        "첨부된 문서를 전체적으로 보고 문서 종류와 실제 확인 가능한 사실을 구조화해주세요.",
    });

  if (
    input.inputType ===
      "image"
  ) {
    return [
      {
        type:
          "input_text",

        text:
          contextText,
      },

      {
        type:
          "input_image",

        image_url:
          input.fileUrl,

        detail:
          "high",
      },
    ];
  }

  /**
   * PDF / 일반 문서는
   * Responses API file input을 사용한다.
   */
  return [
    {
      type:
        "input_text",

      text:
        contextText,
    },

    {
      type:
        "input_file",

      file_url:
        input.fileUrl,
    },
  ];
}

function normalizeResult(
  raw:
    RawVisionResult,

  input:
    AnalyzeDocumentVisionInput
): DocumentIntelligenceResult {
  const confidence =
    normalizeConfidence(
      raw?.confidence
    );

  const extractedSubjects =
  normalizeSubjects(
    raw?.academic
      ?.subjects
  );

const subjects =
  raw?.documentType ===
    "transcript"
    ? extractedSubjects.map(
        subject => ({
          ...subject,

          /**
           * 대학 성적증명서의 전공/교양은
           * 원래 대학 기준이므로
           * 목표 학점은행제 분류로 사용 금지.
           */
          category:
            null,

          requirementType:
            null,

          semesterNo:
            null,
        })
      )
    : extractedSubjects;

  const documentType =
    raw?.documentType ||
    "unknown";

  const procedureType =
    raw?.administrative
      ?.procedureType ??
    null;

  const missingEvidence =
    normalizeTextArray(
      raw?.missingEvidence
    );

  const warnings =
    normalizeTextArray(
      raw?.warnings
    );

  const decision:
    DocumentIntelligenceResult["decision"] =
    confidence >= 0.85 &&
    missingEvidence.length === 0
      ? "accepted"
      : confidence >= 0.5
        ? "review_required"
        : "rejected";

  const canUseAcademicEngine =
    documentType ===
      "transcript" &&
    subjects.length > 0 &&
    confidence >= 0.7;

  const canUseAdministrativeEngine =
    Boolean(
      procedureType
    ) &&
    confidence >= 0.7;

  return {
    version:
      "1.0",

    documentType,

    confidence,

    inputType:
      input.inputType,

    sourceType:
      input.sourceType,

    person: {
      name:
        normalizeNullableText(
          raw?.person
            ?.name,
          200
        ),

      birthDate:
        normalizeNullableText(
          raw?.person
            ?.birthDate,
          50
        ),

      studentNumber:
        normalizeNullableText(
          raw?.person
            ?.studentNumber,
          100
        ),
    },

    institution: {
      name:
        normalizeNullableText(
          raw?.institution
            ?.name,
          500
        ),

      department:
        normalizeNullableText(
          raw?.institution
            ?.department,
          500
        ),

      major:
        normalizeNullableText(
          raw?.institution
            ?.major,
          500
        ),
    },

    academic: {
      graduationStatus:
        raw?.academic
          ?.graduationStatus ??
        null,

      degreeType:
        normalizeNullableText(
          raw?.academic
            ?.degreeType,
          500
        ),

      totalCredits:
        Number.isFinite(
          Number(
            raw?.academic
              ?.totalCredits
          )
        )
          ? Number(
              raw.academic
                .totalCredits
            )
          : null,

      subjects,
    },


enrollment: {
  courseName:
    normalizeNullableText(
      raw?.enrollment
        ?.courseName,
      500
    ),

  semesterLabel:
    normalizeNullableText(
      raw?.enrollment
        ?.semesterLabel,
      200
    ),

  startDate:
    normalizeNullableText(
      raw?.enrollment
        ?.startDate,
      50
    ),

  endDate:
    normalizeNullableText(
      raw?.enrollment
        ?.endDate,
      50
    ),
},

payment: {
  amount:
    Number.isFinite(
      Number(
        raw?.payment
          ?.amount
      )
    )
      ? Number(
          raw.payment.amount
        )
      : null,

  status:
    raw?.payment
      ?.status ??
    null,

  paidAt:
    normalizeNullableText(
      raw?.payment
        ?.paidAt,
      50
    ),
},
    administrative: {
      procedureType,

      detectedStatus:
        raw
          ?.administrative
          ?.detectedStatus ||
        "not_detected",

      paymentAmount:
        Number.isFinite(
          Number(
            raw
              ?.administrative
              ?.paymentAmount
          )
        )
          ? Number(
              raw
                .administrative
                .paymentAmount
            )
          : null,

      applicationDate:
        normalizeNullableText(
          raw
            ?.administrative
            ?.applicationDate,
          50
        ),

      completionDate:
        normalizeNullableText(
          raw
            ?.administrative
            ?.completionDate,
          50
        ),

      receiptNumber:
        normalizeNullableText(
          raw
            ?.administrative
            ?.receiptNumber,
          200
        ),
    },

    extractedText:
      raw?.extractedText
        ? String(
            raw.extractedText
          )
            .trim()
            .slice(
              0,
              50_000
            )
        : null,

    evidence:
      Array.isArray(
        raw?.evidence
      )
        ? raw.evidence
            .slice(0, 200)
            .map(
              item => ({
                key:
                  normalizeNullableText(
                    item?.key,
                    200
                  ) ||
                  "evidence",

                value:
                  normalizeNullableText(
                    item?.value,
                    2000
                  ) ||
                  "",

                confidence:
                  normalizeConfidence(
                    item
                      ?.confidence
                  ),
              })
            )
            .filter(
              item =>
                Boolean(
                  item.value
                )
            )
        : [],

    missingEvidence,

    warnings,

    decision,

    summary:
      normalizeNullableText(
        raw?.summary,
        5000
      ) ||
      "문서 분석 결과",

    canUseAcademicEngine,

    canUseAdministrativeEngine,
  };
}

export async function analyzeDocumentWithVision(
  input:
    AnalyzeDocumentVisionInput
): Promise<DocumentIntelligenceResult> {
  if (
    !process.env
      .OPENAI_API_KEY
  ) {
    throw new Error(
      "OPENAI_API_KEY가 설정되지 않았습니다."
    );
  }

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
          role:
            "system",

          content: [
            {
              type:
                "input_text",

              text: [
                "너는 EduCanvas의 공통 Document Intelligence AI다.",
                "",
                "신규자 AI, 등록자 AI, CRM 업무비서가 모두 같은 분석 결과를 사용한다.",
                "",
                "첨부 문서를 OCR처럼 글자만 읽지 말고 문서 전체의 시각적 구조와 의미를 함께 이해한다.",
                "",
                "분석 가능한 주요 문서:",
                "- 대학교·전문대학교 성적증명서",
                "- 학위증명서",
                "- 자격증 또는 자격 관련 서류",
                "- 학점은행제 교육원 수강내역",
                "- 교육원 결제내역",
                "- 학습자등록 화면 및 증빙",
                "- 학점인정신청 화면 및 증빙",
                "- 학위신청 화면 및 증빙",
                "- 자격증신청 화면 및 증빙",
                "- 실습 관련 서류",
                "- 기타 교육 관련 문서",
                "",
                "절대 원칙:",
                "1. 이미지나 문서에서 실제로 확인되는 사실만 추출한다.",
                "2. 보이지 않는 이름, 날짜, 금액, 과목, 학점, 상태를 추측하지 않는다.",
                "3. 사용자의 말은 문서 종류를 이해하기 위한 참고정보일 뿐 문서에 없는 사실의 증거가 아니다.",
                "4. 완료라는 단어 하나만으로 행정절차 최종 완료를 확정하지 않는다.",
                "5. 행정절차 완료 판단 시 실제 신청 상태, 완료 문구, 접수번호, 결제 또는 완료화면 등의 시각적 근거를 evidence에 기록한다.",
                "6. 증거가 부족하면 missingEvidence에 무엇이 부족한지 기록한다.",
                "7. 흐림, 잘림, 작은 글자, 일부 화면 누락 등 판독 위험은 warnings에 기록한다.",
                "8. 대학 성적증명서의 전공/교양 표시는 해당 대학 기준이다. 목표 학점은행제 전공의 인정구분으로 재해석하지 않는다.",
                "9. 학점/학위/자격요건 계산은 하지 않는다. 사실 추출만 한다.",
"9-1. 교육원 수강내역에서는 과정명, 학기표시, 개강일, 종강일을 실제 화면에서 확인되는 경우 추출한다.",
"9-2. 결제 관련 문서에서는 결제금액, 결제상태, 결제일을 실제 화면에서 확인되는 경우 추출한다.",
"9-3. payment.status는 paid, scheduled, unpaid, partial_refund, full_refund, cancelled, unknown 중 하나로 정규화한다.",
"9-4. 교육원 수강내역에 전공/교양/일반 또는 전공필수/전공선택 구분이 실제로 표시되어 있으면 category와 requirementType에 추출한다.",
"9-5. 표시되지 않은 학습구분은 추측하지 말고 null로 둔다.",
"9-6. 대학교·전문대학교 성적증명서는 category, requirementType, semesterNo를 최종 CRM 분류로 판단하지 않는다.",              
 "10. 학생 CRM을 수정하거나 행정절차 상태를 직접 변경하지 않는다.",
              ].join(
                "\n"
              ),
            },
          ],
        },

        {
          role:
            "user",

          content:
            buildInputContent(
              input
            ) as any,
        },
      ],

      text: {
        format: {
          type:
            "json_schema",

          name:
            "educanvas_document_intelligence",

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
                  "transcript",
                  "degree_certificate",
                  "qualification_certificate",
                  "learner_registration",
                  "credit_recognition",
                  "degree_application",
                  "qualification_application",
                  "practice_document",
                  "payment_proof",
                  "administrative_document",
                  "general_document",
                  "unknown",
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

              person: {
                type:
                  "object",

                additionalProperties:
                  false,

                properties: {
                  name: {
                    type: [
                      "string",
                      "null",
                    ],
                  },

                  birthDate: {
                    type: [
                      "string",
                      "null",
                    ],
                  },

                  studentNumber: {
                    type: [
                      "string",
                      "null",
                    ],
                  },
                },

                required: [
                  "name",
                  "birthDate",
                  "studentNumber",
                ],
              },

              institution: {
                type:
                  "object",

                additionalProperties:
                  false,

                properties: {
                  name: {
                    type: [
                      "string",
                      "null",
                    ],
                  },

                  department: {
                    type: [
                      "string",
                      "null",
                    ],
                  },

                  major: {
                    type: [
                      "string",
                      "null",
                    ],
                  },
                },

                required: [
                  "name",
                  "department",
                  "major",
                ],
              },

              academic: {
                type:
                  "object",

                additionalProperties:
                  false,

                properties: {
                  graduationStatus: {
                    type: [
                      "string",
                      "null",
                    ],

                    enum: [
                      "graduated",
                      "expected",
                      "enrolled",
                      "withdrawn",
                      "unknown",
                      null,
                    ],
                  },

                  degreeType: {
                    type: [
                      "string",
                      "null",
                    ],
                  },

                  totalCredits: {
                    type: [
                      "number",
                      "null",
                    ],
                  },

                  subjects: {
                    type:
                      "array",

                    maxItems:
                      300,

                    items: {
                      type:
                        "object",

                      additionalProperties:
                        false,

                      properties: {
                        name: {
                          type:
                            "string",
                        },

                        credits: {
                          type: [
                            "number",
                            "null",
                          ],
                        },

                        grade: {
                          type: [
                            "string",
                            "null",
                          ],
                        },

category: {
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

requirementType: {
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

semesterNo: {
  type: [
    "number",
    "null",
  ],
},

                        semester: {
                          type: [
                            "string",
                            "null",
                          ],
                        },

                        year: {
                          type: [
                            "string",
                            "null",
                          ],
                        },

                        rawName: {
                          type: [
                            "string",
                            "null",
                          ],
                        },
                      },

                      required: [
  "name",
  "credits",
  "grade",
  "category",
  "requirementType",
  "semesterNo",
  "semester",
  "year",
  "rawName",
],
                    },
                  },
                },

                required: [
                  "graduationStatus",
                  "degreeType",
                  "totalCredits",
                  "subjects",
                ],
              },

enrollment: {
  type:
    "object",

  additionalProperties:
    false,

  properties: {
    courseName: {
      type: [
        "string",
        "null",
      ],
    },

    semesterLabel: {
      type: [
        "string",
        "null",
      ],
    },

    startDate: {
      type: [
        "string",
        "null",
      ],
    },

    endDate: {
      type: [
        "string",
        "null",
      ],
    },
  },

  required: [
    "courseName",
    "semesterLabel",
    "startDate",
    "endDate",
  ],
},

payment: {
  type:
    "object",

  additionalProperties:
    false,

  properties: {
    amount: {
      type: [
        "number",
        "null",
      ],
    },

    status: {
      type: [
        "string",
        "null",
      ],

      enum: [
        "paid",
        "scheduled",
        "unpaid",
        "partial_refund",
        "full_refund",
        "cancelled",
        "unknown",
        null,
      ],
    },

    paidAt: {
      type: [
        "string",
        "null",
      ],
    },
  },

  required: [
    "amount",
    "status",
    "paidAt",
  ],
},

              administrative: {
                type:
                  "object",

                additionalProperties:
                  false,

                properties: {
                  procedureType: {
                    type: [
                      "string",
                      "null",
                    ],

                    enum: [
                      "learner_registration",
                      "credit_recognition",
                      "degree_application",
                      "qualification_application",
                      null,
                    ],
                  },

                  detectedStatus: {
                    type:
                      "string",

                    enum: [
                      "not_detected",
                      "in_progress",
                      "completed",
                      "failed",
                      "unknown",
                    ],
                  },

                  paymentAmount: {
                    type: [
                      "number",
                      "null",
                    ],
                  },

                  applicationDate: {
                    type: [
                      "string",
                      "null",
                    ],
                  },

                  completionDate: {
                    type: [
                      "string",
                      "null",
                    ],
                  },

                  receiptNumber: {
                    type: [
                      "string",
                      "null",
                    ],
                  },
                },

                required: [
                  "procedureType",
                  "detectedStatus",
                  "paymentAmount",
                  "applicationDate",
                  "completionDate",
                  "receiptNumber",
                ],
              },

              extractedText: {
                type: [
                  "string",
                  "null",
                ],
              },

              evidence: {
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
                    key: {
                      type:
                        "string",
                    },

                    value: {
                      type:
                        "string",
                    },

                    confidence: {
                      type:
                        "number",

                      minimum:
                        0,

                      maximum:
                        1,
                    },
                  },

                  required: [
                    "key",
                    "value",
                    "confidence",
                  ],
                },
              },

              missingEvidence: {
                type:
                  "array",

                items: {
                  type:
                    "string",
                },
              },

              warnings: {
                type:
                  "array",

                items: {
                  type:
                    "string",
                },
              },

              summary: {
                type:
                  "string",
              },
            },

            required: [
  "documentType",
  "confidence",
  "person",
  "institution",
  "academic",
  "enrollment",
  "payment",
  "administrative",
  "extractedText",
  "evidence",
  "missingEvidence",
  "warnings",
  "summary",
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

  if (!outputText) {
    throw new Error(
      "Document Intelligence 분석 결과가 비어 있습니다."
    );
  }

  let parsed:
    RawVisionResult;

  try {
    parsed =
      JSON.parse(
        outputText
      ) as RawVisionResult;
  } catch (
    error
  ) {
    console.error(
      "[DOCUMENT INTELLIGENCE] JSON 변환 실패",
      error
    );

    throw new Error(
      "Document Intelligence 분석 결과 형식이 올바르지 않습니다."
    );
  }

  return normalizeResult(
    parsed,
    input
  );
}