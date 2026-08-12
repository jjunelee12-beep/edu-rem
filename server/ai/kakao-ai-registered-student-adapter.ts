import {
  analyzeVerifiedStudentDetailRisk,
} from "./ai-risk-engine";

import type {
  StudentDetailRiskToolOutput,
} from "./ai.types";

import type {
  KakaoAiCustomerContext,
} from "./kakao-ai-customer-resolver";

/**
 * 카카오 등록회원 실제 학습분석 결과.
 *
 * 기존 위험도 엔진 결과를 그대로 보존한다.
 *
 * 이 결과 안에는 이미:
 * - 학생 기본정보
 * - 학점
 * - 인정과목
 * - 중복과목
 * - 자격요건
 * - 부족과목
 * - 학기배치
 * - 행정일정
 * - Academic Summary
 * - 위험도 issues
 *
 * 등이 포함된다.
 */
export type KakaoAiRegisteredStudentAnalysis = {
  studentId:
    number;

  organizationId:
    number;

  detail:
    StudentDetailRiskToolOutput;
};

/**
 * 카카오 등록회원 본인의
 * 실제 CRM + 공통엔진 학습분석을 실행한다.
 *
 * 중요:
 * customer.studentId는
 * verifyKakaoAiRegisteredCustomer()가
 * 서버에서 확정한 값이어야 한다.
 */
export async function resolveKakaoAiRegisteredStudentAnalysis(
  params: {
    customer:
      KakaoAiCustomerContext;
  }
): Promise<KakaoAiRegisteredStudentAnalysis> {
  const customer =
    params.customer;

  if (
    customer.customerType !==
      "registered" ||
    customer.verified !==
      true ||
    customer.verificationStatus !==
      "registered"
  ) {
    throw new Error(
      "등록회원 인증이 필요합니다."
    );
  }

  const organizationId =
    Math.floor(
      Number(
        customer.organizationId ||
        0
      )
    );

  const studentId =
    Math.floor(
      Number(
        customer.studentId ||
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
      "등록회원 회사 정보가 올바르지 않습니다."
    );
  }

  if (
    !Number.isFinite(
      studentId
    ) ||
    studentId <=
      0
  ) {
    throw new Error(
      "등록회원 학생 정보가 올바르지 않습니다."
    );
  }

  /**
   * 카카오 Adapter는
   * AI 모델에서 전달된 studentId를 받지 않는다.
   *
   * 오직 인증된 customer.studentId만 사용한다.
   */
  const detail =
    await analyzeVerifiedStudentDetailRisk({
      organizationId,

      verifiedStudentId:
        studentId,
    });

  /**
   * 최종 결과의 studentId까지 다시 검사한다.
   */
  if (
    Number(
      detail.student.id
    ) !==
    studentId
  ) {
    throw new Error(
      "등록회원 학생정보 검증에 실패했습니다."
    );
  }

  return {
    studentId,

    organizationId,

    detail,
  };
}