import * as db from "../db";

import type {
  KakaoAiCustomerType,
} from "./kakao-ai-access-policy";

/**
 * 카카오 AI가 서버에서 확정한
 * 고객 인증 상태.
 *
 * AI 모델이 이 값을 만들지 않는다.
 */
export type KakaoAiCustomerContext = {
  customerType:
    KakaoAiCustomerType;

  verified:
    boolean;

  organizationId:
    number;

  studentId:
    number | null;

  studentName:
    string | null;

  course:
    string | null;

  finalEducation:
    string | null;

  assigneeId:
    number | null;

  /**
   * 등록회원 인증 상태.
   */
  verificationStatus:
    | "lead"
    | "registered"
    | "not_found"
    | "duplicate";

  /**
   * 서버 내부 판단용.
   * 고객에게 문구 그대로 출력하지 않는다.
   */
  verificationMessage:
    string | null;
};

function normalizeOrganizationId(
  value:
    unknown
): number {
  const organizationId =
    Math.floor(
      Number(
        value ||
        0
      )
    );

  if (
    !Number.isFinite(
      organizationId
    ) ||
    organizationId <=
      0
  ) {
    throw new Error(
      "카카오 AI 회사 정보가 올바르지 않습니다."
    );
  }

  return organizationId;
}

/**
 * 인증 전 신규 고객 Context.
 */
export function createLeadKakaoAiCustomerContext(
  params: {
    organizationId:
      number;
  }
): KakaoAiCustomerContext {
  const organizationId =
    normalizeOrganizationId(
      params.organizationId
    );

  return {
    customerType:
      "lead",

    verified:
      false,

    organizationId,

    studentId:
      null,

    studentName:
      null,

    course:
      null,

    finalEducation:
      null,

    assigneeId:
      null,

    verificationStatus:
      "lead",

    verificationMessage:
      null,
  };
}

/**
 * 이름 + 연락처로
 * CRM 등록회원 여부를 확인한다.
 *
 * 이 함수가 성공해서 반환한 studentId만
 * 이후 카카오 등록회원 데이터 조회에 사용한다.
 */
export async function verifyKakaoAiRegisteredCustomer(
  params: {
    organizationId:
      number;

    clientName:
      string;

    phone:
      string;
  }
): Promise<KakaoAiCustomerContext> {
  const organizationId =
    normalizeOrganizationId(
      params.organizationId
    );

  const result =
    await db.findStudentForKakaoVerification({
      organizationId,

      clientName:
        params.clientName,

      phone:
        params.phone,
    });

  if (
    !result.matched ||
    !result.student
  ) {
    return {
      customerType:
        "lead",

      verified:
        false,

      organizationId,

      studentId:
        null,

      studentName:
        null,

      course:
        null,

      finalEducation:
        null,

      assigneeId:
        null,

      verificationStatus:
        result.reason ===
          "duplicate"
          ? "duplicate"
          : "not_found",

      verificationMessage:
        result.reason ===
          "duplicate"
          ? "동일한 회원정보가 여러 건 확인되어 자동 인증할 수 없습니다."
          : "등록회원 정보를 확인할 수 없습니다.",
    };
  }

  const student =
    result.student;

  /**
   * DB에서 organizationId를 다시 확인한다.
   */
  if (
    Number(
      student.organizationId
    ) !==
    organizationId
  ) {
    throw new Error(
      "등록회원 회사정보가 일치하지 않습니다."
    );
  }

  return {
    customerType:
      "registered",

    verified:
      true,

    organizationId,

    studentId:
      student.id,

    studentName:
      student.clientName,

    course:
      student.course,

    finalEducation:
      student.finalEducation,

    assigneeId:
      student.assigneeId,

    verificationStatus:
      "registered",

    verificationMessage:
      null,
  };
}