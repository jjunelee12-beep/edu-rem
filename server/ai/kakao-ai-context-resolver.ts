import * as db from "../db";

import {
  buildKakaoAiCompanyContext,
  type KakaoAiCompanyContext,
} from "./kakao-ai-company-context";

import {
  resolveKakaoAiRegisteredStudentAnalysis,
  type KakaoAiRegisteredStudentAnalysis,
} from "./kakao-ai-registered-student-adapter";

import {
  resolveKakaoAiLeadAcademicAnalysis,
  type KakaoAiLeadAcademicAnalysis,
} from "./kakao-ai-lead-academic-adapter";

import {
  resolveKakaoAiLeadPriorAcademic,
} from "./kakao-ai-lead-prior-academic-resolver";

import type {
  KakaoAiStructuredMemory,
} from "./kakao-ai-memory-resolver";

import {
  resolveKakaoAiPracticeCenter,
  type KakaoAiPracticeCenterResult,
} from "./kakao-ai-practice-center-adapter";

import type {
  KakaoAiCustomerContext,
} from "./kakao-ai-customer-resolver";

import type {
  DocumentIntelligenceResult,
} from "./document-intelligence.types";

import type {
  KakaoAiCapability,
  KakaoAiCustomerType,
} from "./kakao-ai-access-policy";

import type {
  KakaoAiRequiredContext,
  KakaoAiRoutedIntent,
} from "./kakao-ai-intent-router";

/**
 * 카카오 AI Context Resolver
 *
 * 역할:
 *
 * Intent 분석
 * ↓
 * 중앙 권한정책 적용
 * ↓
 * "실제로 어떤 데이터를 가져올 것인가" 결정
 *
 * 중요:
 *
 * 모델이 requiredContexts에
 * practice_center / registered_student 등을 넣었다고 해서
 * 그대로 DB를 조회하면 안 된다.
 *
 * 반드시 Access Policy를 통과한 결과만 사용한다.
 */

/**
 * 카카오 AI 담당자 Context.
 *
 * 담당자 추천 / 목록 / 선택 / 변경 /
 * 현재 선택상태 판단에 사용하는
 * 서버 확정 Context다.
 *
 * 실제 선택 변경은 여기서 수행하지 않는다.
 * Context Resolver는 조회만 담당한다.
 */
export type KakaoAiStaffContext = {
  /**
   * 현재 회사에서
   * 고객에게 보여줄 수 있는 담당자 후보.
   */
  candidates:
    db.KakaoAiStaffCandidateMemory[];

  /**
   * 현재 Conversation에서
   * 마지막으로 추천된 담당자.
   */
  recommendedStaff:
    db.KakaoAiStaffCandidateMemory |
    null;

  /**
   * 고객이 현재 Conversation에서
   * 실제 선택한 담당자.
   */
  selectedStaff:
    db.KakaoAiStaffCandidateMemory |
    null;

  /**
   * 담당자 선택 진행상태.
   */
  status:
    | "none"
    | "recommended"
    | "selected";

  /**
   * 직전 담당자 관련 Intent.
   */
  lastIntent:
    string |
    null;
};

/**
 * 실제 Context를 가져오기 전에 만드는
 * 서버 확정 Fetch Plan.
 *
 * 이 값은 AI가 만드는 값이 아니다.
 */
export type KakaoAiContextFetchPlan = {
  companyContext:
    boolean;

  commonRuleEngine:
    boolean;

  conversationMemory:
    boolean;

  transferDocument:
    boolean;

  registeredStudent:
    boolean;

  academicSummary:
    boolean;

  riskAnalysis:
    boolean;

  administrativeStatus:
    boolean;

  practiceCenter:
    boolean;

    careerContext:
    boolean;

  /**
   * 담당자 목록 / 추천 / 선택 /
   * 변경 / 현재 선택상태 확인에 필요한
   * 담당자 Context.
   */
  staffContext:
    boolean;

  attachmentAnalysis:
    boolean;
};

/**
 * Context Resolver가 최종적으로 반환하는 값.
 *
 * 아직 학생/실습/공통엔진 실제 데이터는
 * 다음 단계에서 연결한다.
 */
export type KakaoAiResolvedContext = {
  customerType:
    KakaoAiCustomerType;

  /**
   * 현재 허용된 capability.
   */
  allowedCapabilities:
    KakaoAiCapability[];

  /**
   * 중앙정책으로 차단된 capability.
   */
  restrictedCapabilities:
    KakaoAiCapability[];

  /**
   * 서버가 최종 확정한
   * 데이터 Fetch Plan.
   */
  fetchPlan:
    KakaoAiContextFetchPlan;

  /**
   * 회사별 Context.
   *
   * 필요한 경우에만 조회한다.
   */
  companyContext:
    KakaoAiCompanyContext | null;


/**
 * 현재 메시지에 첨부된 문서의
 * 공통 Document Intelligence 분석결과.
 *
 * 신규자 / 등록자 모두 동일한 결과를 사용한다.
 *
 * null이면:
 * - 첨부가 없었거나
 * - 분석 실패했거나
 * - 현재 메시지에서 분석하지 않은 상태
 */
documentIntelligence:
  DocumentIntelligenceResult |
  null;
  /**
   * 신규 상담자의 실제 공통 규칙엔진 분석결과.
   *
   * 신규 고객의 자격취득 기간 / 필요과목 /
   * 학위요건 / 실습시간 / 예상일정 등을
   * AI가 직접 계산하지 않도록 한다.
   *
   * 공통엔진이 필요하지 않거나
   * 등록회원인 경우에는 null이다.
   */
  leadAcademicAnalysis:
    KakaoAiLeadAcademicAnalysis | null;

  /**
   * 등록회원의 실제 CRM + 공통엔진 분석결과.
   *
   * 필요한 경우에만 계산한다.
   *
   * 포함:
   * - 학점 / 인정과목
   * - 부족과목
   * - 자격요건
   * - 학기배치
   * - 행정일정
   * - Academic Summary
   * - 위험도
   *
   * 신규 고객에게는 항상 null이다.
   */
  registeredStudentAnalysis:
    KakaoAiRegisteredStudentAnalysis | null;

  /**
   * 등록회원 본인의 위치를 기준으로 조회한
   * 실제 실습배정지원센터 결과.
   *
   * 신규 고객에게는 항상 null이다.
   */
  practiceCenter:
    KakaoAiPracticeCenterResult | null;

  /**
   * 현재 카카오 상담의 담당자 Context.
   *
   * 신규 / 등록회원 모두 사용할 수 있다.
   *
   * 등록학생 CRM의 기존 담당자 변경 기능과는
   * 별개의 "카카오 상담 담당자 선택" Context다.
   */
  staffContext:
    KakaoAiStaffContext |
    null;

  /**
   * 추가 확인이 필요한 상태에서는
   * 민감하거나 불필요한 조회를 최대한 하지 않는다.
   */
  needsClarification:
  boolean;

clarificationQuestion:
  string | null;

/**
 * Intent가 여러 의미로 해석될 수 있을 때
 * 사용자에게 보여줄 자연어 재확인 후보.
 *
 * 내부 capability 이름은 포함하지 않는다.
 */
clarificationOptions:
  string[];
};

function hasCapability(
  capabilities:
    KakaoAiCapability[],

  capability:
    KakaoAiCapability
): boolean {
  return capabilities.includes(
    capability
  );
}

function hasRequiredContext(
  requiredContexts:
    KakaoAiRequiredContext[],

  context:
    KakaoAiRequiredContext
): boolean {
  return requiredContexts.includes(
    context
  );
}

/**
 * 회사 Context가 필요한 capability인지
 * 서버에서도 다시 확인한다.
 *
 * 모델의 requiresCompanyContext만
 * 그대로 믿지 않는다.
 */
function requiresCompanyContextByCapability(
  capabilities:
    KakaoAiCapability[]
): boolean {
  /**
   * 카카오 AI는 회사별 상담 AI다.
   *
   * 회사 Context에는 단순 회사소개뿐 아니라:
   *
   * - AI 표시 이름
   * - 첫 인사말
   * - 기본 상담 안내
   * - 상담 가능시간
   * - 회사 혜택
   * - 상담 강조포인트
   * - 등록회원 혜택
   * - 이론수업 안내
   * - 실습지원 안내
   * - 행정지원 범위
   * - 회사 내부 상담정책
   *
   * 등이 포함된다.
   *
   * 따라서 학점은행제 상담 범위의 정상 대화에서는
   * 특정 capability 하나에 종속시키지 않는다.
   *
   * off_topic만 회사 Context가 없어도 된다.
   */

  if (
    capabilities.length ===
    0
  ) {
    return false;
  }

  const hasEducationConversation =
    capabilities.some(
      capability =>
        capability !==
        "off_topic_conversation"
    );

  return hasEducationConversation;
}

/**
 * 공통 규칙엔진이 필요한 capability인지
 * 서버에서도 다시 확인한다.
 *
 * 자격조건 / 개인 상담분석처럼
 * 법적 규칙 계산이 필요한 요청은
 * 모델 boolean이 빠져도 공통엔진을 사용하게 한다.
 */
function requiresCommonRuleEngineByCapability(
  capabilities:
    KakaoAiCapability[]
): boolean {
  return (
    hasCapability(
      capabilities,
      "qualification_general_guide"
    ) ||
    hasCapability(
      capabilities,
      "qualification_consultation_analysis"
    )
  );
}

/**
 * 신규 상담자의 Structured Memory만으로도
 * 개인별 학습설계가 가능한 상태인지 확인한다.
 *
 * 중요:
 *
 * Intent 모델이 순간적으로
 * qualification_consultation_analysis를
 * capabilities에서 누락하더라도,
 *
 * 이미
 * - 희망과정
 * - 최종학력
 *
 * 이 확인되어 있고
 * 현재 질문이 개인 상담분석과 연결되어 있다면
 * 서버가 공통 Rule Engine 사용을 보강할 수 있다.
 *
 * 단, 단순 인사 / 회사소개 / 실습 일반안내처럼
 * 숫자 계산이 전혀 필요하지 않은 모든 메시지마다
 * Rule Engine을 실행하기 위한 함수는 아니다.
 */
function hasLeadAcademicMemory(
  memory:
    KakaoAiStructuredMemory
): boolean {
  const desiredCourse =
    String(
      memory.desiredCourse ||
      ""
    ).trim();

  const finalEducation =
    String(
      memory.finalEducation ||
      ""
    ).trim();

  return Boolean(
    desiredCourse &&
    finalEducation
  );
}

/**
 * 현재 허용 capability 중
 * 개인별 자격 / 학위 계산과 연결될 가능성이 있는
 * 상담 요청인지 서버에서 판단한다.
 */
function isLeadAcademicConversation(
  capabilities:
    KakaoAiCapability[]
): boolean {
  return (
    hasCapability(
      capabilities,
      "qualification_general_guide"
    ) ||
    hasCapability(
      capabilities,
      "qualification_consultation_analysis"
    ) ||
    hasCapability(
      capabilities,
      "transfer_document_analysis"
    ) ||
    hasCapability(
      capabilities,
      "administrative_general_guide"
    ) ||
    hasCapability(
      capabilities,
      "certificate_application_general_guide"
    )
  );
}

/**
 * 등록학생 실제 데이터가 필요한
 * capability.
 */
function requiresRegisteredStudentByCapability(
  capabilities:
    KakaoAiCapability[]
): boolean {
  return (
    hasCapability(
      capabilities,
      "student_private_data_lookup"
    ) ||
    hasCapability(
      capabilities,
      "academic_private_data_lookup"
    ) ||
    hasCapability(
      capabilities,
      "administrative_status_lookup"
    ) ||
    hasCapability(
      capabilities,
      "registered_risk_analysis"
    ) ||
    hasCapability(
      capabilities,
      "practice_institution_lookup"
    ) ||
    hasCapability(
      capabilities,
      "career_consulting"
    ) ||
    hasCapability(
      capabilities,
      "career_document_support"
    )
  );
}

/**
 * 등록자의 Academic Summary가
 * 필요한 capability.
 */
function requiresAcademicSummaryByCapability(
  capabilities:
    KakaoAiCapability[]
): boolean {
  return (
    hasCapability(
      capabilities,
      "academic_private_data_lookup"
    ) ||
    hasCapability(
      capabilities,
      "registered_risk_analysis"
    ) ||
    hasCapability(
      capabilities,
      "career_consulting"
    )
  );
}

/**
 * 실제 위험도 엔진이 필요한 요청.
 */
function requiresRiskAnalysisByCapability(
  capabilities:
    KakaoAiCapability[]
): boolean {
  return hasCapability(
    capabilities,
    "registered_risk_analysis"
  );
}

/**
 * 실제 행정절차 완료상태가 필요한 요청.
 */
function requiresAdministrativeStatusByCapability(
  capabilities:
    KakaoAiCapability[]
): boolean {
  return hasCapability(
    capabilities,
    "administrative_status_lookup"
  );
}

/**
 * 실제 실습배정지원센터 DB가
 * 필요한 요청.
 */
function requiresPracticeCenterByCapability(
  capabilities:
    KakaoAiCapability[]
): boolean {
  return hasCapability(
    capabilities,
    "practice_institution_lookup"
  );
}

/**
 * 취업컨설팅 개인 Context가 필요한 요청.
 */
function requiresCareerContextByCapability(
  capabilities:
    KakaoAiCapability[]
): boolean {
  return (
    hasCapability(
      capabilities,
      "career_consulting"
    ) ||
    hasCapability(
      capabilities,
      "career_document_support"
    )
  );
}

/**
 * 회사 담당자 Context가 필요한 capability.
 *
 * 모델이 requiredContexts에서
 * staff_context를 누락하더라도
 * 담당자 capability 자체가 허용되었다면
 * 서버에서 Context 사용을 보강한다.
 */
function requiresStaffContextByCapability(
  capabilities:
    KakaoAiCapability[]
): boolean {
  return (
    hasCapability(
      capabilities,
      "staff_list"
    ) ||
    hasCapability(
      capabilities,
      "staff_recommend"
    ) ||
    hasCapability(
      capabilities,
      "staff_select"
    ) ||
    hasCapability(
      capabilities,
      "staff_change"
    ) ||
    hasCapability(
      capabilities,
      "staff_current"
    )
  );
}

/**
 * 첨부자료 분석이 필요한 capability.
 */
function requiresAttachmentByCapability(
  capabilities:
    KakaoAiCapability[]
): boolean {
  return (
    hasCapability(
      capabilities,
      "transfer_document_analysis"
    ) ||
    hasCapability(
      capabilities,
      "administrative_document_support"
    ) ||
    hasCapability(
      capabilities,
      "career_document_support"
    )
  );
}

/**
 * Intent + Access Policy 결과를 바탕으로
 * 안전한 Fetch Plan을 생성한다.
 */
export function buildKakaoAiContextFetchPlan(
  params: {
    routedIntent:
      KakaoAiRoutedIntent;

    /**
     * 현재 메시지까지 반영된
     * 서버 Structured Memory.
     *
     * Intent가 일부 Context를 누락하더라도
     * 이미 확인된 상담사실을 이용해
     * 필요한 Context를 안전하게 보강한다.
     */
    structuredMemory:
      KakaoAiStructuredMemory;
  }
): KakaoAiContextFetchPlan {
  const routedIntent =
    params.routedIntent;

  const intent =
    routedIntent.intent;

const structuredMemory =
  params.structuredMemory;

  /**
   * 여기서는 전체 capability가 아니라
   * 반드시 중앙정책을 통과한
   * allowedCapabilities만 사용한다.
   */
  const allowedCapabilities =
    routedIntent.allowedCapabilities;

  const customerType =
    routedIntent.customerType;

  /**
   * 애매해서 사용자 확인이 먼저 필요한 경우
   *
   * 회사 일반 Context나 대화메모리는
   * 사용할 수 있지만,
   *
   * 학생 개인DB / 실습DB /
   * 위험도 / 행정상태 같은
   * 민감하고 비용이 드는 조회는 보류한다.
   */
  const needsClarification =
    intent.needsClarification ===
    true;

  /**
 * 회사 Context는 특정 회사소개 질문에서만
 * 사용하는 부가정보가 아니다.
 *
 * 카카오 AI의 말투 / 첫 인사 / 상담정책 /
 * 서비스 범위를 결정하는 기본 Context이므로
 * 학점은행제 상담 범위에서는 기본적으로 준비한다.
 */
const companyContext =
  intent.requiresCompanyContext ===
    true ||
  hasRequiredContext(
    intent.requiredContexts,
    "company_context"
  ) ||
  requiresCompanyContextByCapability(
    allowedCapabilities
  );

  const conversationMemory =
    hasRequiredContext(
      intent.requiredContexts,
      "conversation_memory"
    ) ||
    true;

  /**
 * 신규 상담 개인 학습설계 Context 보강.
 *
 * Intent가 common_rule_engine을 명시하면 당연히 사용한다.
 *
 * 추가로:
 * - 신규 고객
 * - 희망과정 확인됨
 * - 최종학력 확인됨
 * - 현재 capability가 개인 자격/학위 분석과 연관됨
 *
 * 상태라면 Intent 모델이
 * qualification_consultation_analysis를 일부 누락했더라도
 * 서버가 공통 Rule Engine 사용을 보강한다.
 */
const shouldSupplementLeadAcademicAnalysis =
  customerType ===
    "lead" &&
  hasLeadAcademicMemory(
    structuredMemory
  ) &&
  isLeadAcademicConversation(
    allowedCapabilities
  );

const commonRuleEngine =
  !needsClarification &&
  (
    intent.requiresCommonRuleEngine ===
      true ||
    hasRequiredContext(
      intent.requiredContexts,
      "common_rule_engine"
    ) ||
    requiresCommonRuleEngineByCapability(
      allowedCapabilities
    ) ||
    shouldSupplementLeadAcademicAnalysis
  );

  const transferDocument =
    !needsClarification &&
    (
      hasRequiredContext(
        intent.requiredContexts,
        "transfer_document"
      ) ||
      hasCapability(
        allowedCapabilities,
        "transfer_document_analysis"
      )
    );

  /**
   * 등록학생 관련 데이터는
   * customerType === registered가 아니면
   * 절대로 Fetch Plan에 올라갈 수 없다.
   *
   * Access Policy에서 이미 차단하지만
   * Resolver에서 한 번 더 막는다.
   */
  const canUseRegisteredData =
    customerType ===
    "registered";

  const registeredStudent =
    !needsClarification &&
    canUseRegisteredData &&
    (
      intent.requiresRegisteredStudentData ===
        true ||
      hasRequiredContext(
        intent.requiredContexts,
        "registered_student"
      ) ||
      requiresRegisteredStudentByCapability(
        allowedCapabilities
      )
    );

  const academicSummary =
    registeredStudent &&
    (
      hasRequiredContext(
        intent.requiredContexts,
        "academic_summary"
      ) ||
      requiresAcademicSummaryByCapability(
        allowedCapabilities
      )
    );

  const riskAnalysis =
    registeredStudent &&
    (
      hasRequiredContext(
        intent.requiredContexts,
        "risk_analysis"
      ) ||
      requiresRiskAnalysisByCapability(
        allowedCapabilities
      )
    );

  const administrativeStatus =
    registeredStudent &&
    (
      hasRequiredContext(
        intent.requiredContexts,
        "administrative_status"
      ) ||
      requiresAdministrativeStatusByCapability(
        allowedCapabilities
      )
    );

  const practiceCenter =
    registeredStudent &&
    (
      intent.requiresPracticeCenterLookup ===
        true ||
      hasRequiredContext(
        intent.requiredContexts,
        "practice_center"
      ) ||
      requiresPracticeCenterByCapability(
        allowedCapabilities
      )
    );

  const careerContext =
    registeredStudent &&
    (
      hasRequiredContext(
        intent.requiredContexts,
        "career_context"
      ) ||
      requiresCareerContextByCapability(
        allowedCapabilities
      )
    );

  /**
   * 담당자 Context는 신규 / 등록회원
   * 모두 사용할 수 있다.
   *
   * registeredStudent 조건을 걸면 안 된다.
   *
   * 다만 Intent가 아직 애매해서
   * clarification이 필요한 경우에는
   * 불필요한 담당자 DB 조회를 보류한다.
   */
  const staffContext =
    !needsClarification &&
    (
      hasRequiredContext(
        intent.requiredContexts,
        "staff_context"
      ) ||
      requiresStaffContextByCapability(
        allowedCapabilities
      )
    );

  const attachmentAnalysis =
    !needsClarification &&
    (
      intent.requiresAttachmentAnalysis ===
        true ||
      hasRequiredContext(
        intent.requiredContexts,
        "attachment_analysis"
      ) ||
      requiresAttachmentByCapability(
        allowedCapabilities
      )
    );

  return {
    companyContext,

    commonRuleEngine,

    conversationMemory,

    transferDocument,

    registeredStudent,

    academicSummary,

    riskAnalysis,

    administrativeStatus,

        practiceCenter,

    careerContext,

    staffContext,

    attachmentAnalysis,
  };
}

/**
 * 회사 Context까지 실제로 해결한다.
 *
 * 학생 / 공통엔진 / 실습센터는
 * 아직 여기에서 직접 호출하지 않는다.
 *
 * 다음 단계에서 각 Resolver를
 * 실제 기존 EduCanvas 함수에 연결한다.
 */
export async function resolveKakaoAiContext(
  params: {
    organizationId:
      number;

    /**
     * 현재 카카오 Conversation ID.
     *
     * 담당자 추천 / 선택 상태는
     * Conversation 단위 Memory에 저장되므로
     * 서버에서 명시적으로 전달받는다.
     */
    conversationId:
      number;

    routedIntent:
      KakaoAiRoutedIntent;

    /**
     * 서버가 확정한 카카오 고객 Context.
     *
     * lead / registered 여부와
     * 등록회원 studentId의 신뢰근거다.
     */
    customer:
      KakaoAiCustomerContext;

    /**
     * 현재 사용자 메시지까지 반영된
     * 구조화 Conversation Memory.
     *
     * 신규 상담 공통엔진에서
     * 희망과정 / 최종학력 / 법적용기준 등을
     * 서버 입력값으로 사용한다.
     */
    structuredMemory:
      KakaoAiStructuredMemory;

/**
 * 현재 메시지의 첨부파일을
 * 공통 Document Intelligence에서
 * 이미 한 번 분석한 결과.
 *
 * Context Resolver에서는
 * Vision을 다시 호출하지 않는다.
 */
documentIntelligence?:
  DocumentIntelligenceResult |
  null;
  }
): Promise<KakaoAiResolvedContext> {
  const organizationId =
    Math.floor(
      Number(
        params.organizationId ||
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

  const customer =
    params.customer;

  /**
   * Router / Context / 인증 고객의 회사가
   * 반드시 동일해야 한다.
   */
  if (
    Number(
      customer.organizationId
    ) !==
    organizationId
  ) {
    throw new Error(
      "카카오 AI 고객 회사정보가 일치하지 않습니다."
    );
  }

  const routedIntent =
    params.routedIntent;

  /**
   * Intent 권한판단에 사용된 고객유형과
   * 실제 서버 인증 고객유형이 반드시 같아야 한다.
   *
   * 예:
   * routedIntent = registered
   * customer = lead
   *
   * 같은 상태는 절대로 허용하지 않는다.
   */
  if (
    routedIntent.customerType !==
    customer.customerType
  ) {
    throw new Error(
      "카카오 AI 고객 인증 상태가 일치하지 않습니다."
    );
  }

  /**
   * registered 권한은 단순 문자열만으로
   * 사용할 수 없다.
   *
   * 반드시 서버 인증 성공 상태여야 한다.
   */
  if (
    routedIntent.customerType ===
      "registered" &&
    (
      customer.verified !==
        true ||
      customer.verificationStatus !==
        "registered" ||
      !Number(
        customer.studentId ||
        0
      )
    )
  ) {
    throw new Error(
      "등록회원 인증이 필요합니다."
    );
  }

  const fetchPlan =
  buildKakaoAiContextFetchPlan({
    routedIntent,

    structuredMemory:
      params.structuredMemory,
  });

  let companyContext:
    KakaoAiCompanyContext | null =
    null;

  if (
    fetchPlan.companyContext
  ) {
    companyContext =
      await buildKakaoAiCompanyContext({
        organizationId,
      });
  }

  let leadAcademicAnalysis:
    KakaoAiLeadAcademicAnalysis | null =
    null;

  /**
   * 신규 상담자가 개인 조건에 따른
   * 자격 / 학위 / 기간 분석을 요청한 경우에만
   * 기존 공통 규칙엔진을 실행한다.
   *
   * 등록회원은 여기서 신규상담 Adapter를
   * 사용하지 않는다.
   *
   * 등록회원의 개인 데이터 분석은
   * Registered Student Adapter가 담당한다.
   */
  if (
  fetchPlan.commonRuleEngine &&
  customer.customerType ===
    "lead"
) {
  const priorAcademic =
  resolveKakaoAiLeadPriorAcademic({
    memory:
      params.structuredMemory,

    documentIntelligence:
      params.documentIntelligence ??
      null,
  });

  const leadMemory:
    KakaoAiStructuredMemory = {
    ...params.structuredMemory,

    /**
     * 사회복지사 과정이면
     * Prior Academic Resolver가 판정한
     * 구법/신법 결과를 이번 계산에 사용한다.
     *
     * 다른 과정이면 기존 Memory 유지.
     */
    socialWorkerLawVersion:
  priorAcademic.courseKey ===
    "social_worker_2" &&
  (
    priorAcademic
      .socialWorkerLawVersion ===
      "old" ||
    priorAcademic
      .socialWorkerLawVersion ===
      "current"
  )
    ? priorAcademic
        .socialWorkerLawVersion
    : priorAcademic.courseKey ===
        "social_worker_2"
      ? null
      : params
          .structuredMemory
          .socialWorkerLawVersion,
  };

  leadAcademicAnalysis =
    await resolveKakaoAiLeadAcademicAnalysis({
      organizationId,

      memory:
        leadMemory,

      recognizedSubjects:
        priorAcademic
          .recognizedSubjects,
    });

  /**
   * 기이수과목 Resolver에서 나온
   * 확인 필요 사유 / 경고도
   * 최종 Academic Analysis에 합친다.
   */
  const mergedLeadUnresolvedReasons =
  Array.from(
    new Set([
      ...leadAcademicAnalysis
        .unresolvedReasons,

      ...priorAcademic
        .unresolvedReasons,
    ])
  );

const mergedLeadWarnings =
  Array.from(
    new Set([
      ...leadAcademicAnalysis
        .warnings,

      ...priorAcademic
        .warnings,
    ])
  );

const hasPriorAcademicBlockingReason =
  priorAcademic.courseKey ===
    "social_worker_2" &&
  (
    priorAcademic
      .socialWorkerLawResolved ===
      false ||
    priorAcademic
      .unresolvedReasons
      .length > 0
  );

leadAcademicAnalysis = {
  ...leadAcademicAnalysis,

  status:
    hasPriorAcademicBlockingReason
      ? "review_required"
      : leadAcademicAnalysis
          .status,

  canExplain:
    hasPriorAcademicBlockingReason
      ? false
      : leadAcademicAnalysis
          .canExplain,

  unresolvedReasons:
    mergedLeadUnresolvedReasons,

  warnings:
    mergedLeadWarnings,
};
}

  let registeredStudentAnalysis:
    KakaoAiRegisteredStudentAnalysis | null =
    null;

  /**
   * 전체 등록학생 분석은
   * 실제 Academic Summary 또는 위험도처럼
   * 공통엔진 결과가 필요한 경우에만 실행한다.
   *
   * fetchPlan.registeredStudent만 보고
   * 무조건 실행하면 안 된다.
   *
   * 예:
   * 실습기관 조회도 registeredStudent=true지만
   * 실습기관을 찾기 위해 전체 위험도 엔진까지
   * 실행할 필요는 없다.
   */
  const shouldResolveRegisteredStudentAnalysis =
  fetchPlan.registeredStudent &&
  (
    fetchPlan.academicSummary ||
    fetchPlan.riskAnalysis ||
    fetchPlan.administrativeStatus ||
    fetchPlan.careerContext ||
    hasCapability(
      routedIntent.allowedCapabilities,
      "student_private_data_lookup"
    )
  );

  if (
    shouldResolveRegisteredStudentAnalysis
  ) {
    if (
      customer.customerType !==
        "registered" ||
      customer.verified !==
        true
    ) {
      throw new Error(
        "등록회원 인증이 필요합니다."
      );
    }

    registeredStudentAnalysis =
      await resolveKakaoAiRegisteredStudentAnalysis({
        customer,
      });
  }

  let practiceCenter:
    KakaoAiPracticeCenterResult | null =
    null;

  /**
   * 실제 실습기관 조회가 필요한 경우에만
   * 실습배정지원센터 DB를 조회한다.
   *
   * 신규 고객은 Fetch Plan 단계에서
   * practiceCenter=true가 될 수 없지만
   * 여기서도 인증을 다시 검사한다.
   */
  if (
    fetchPlan.practiceCenter
  ) {
    if (
      customer.customerType !==
        "registered" ||
      customer.verified !==
        true ||
      customer.verificationStatus !==
        "registered"
    ) {
      throw new Error(
        "실습배정지원센터 조회는 등록회원만 이용할 수 있습니다."
      );
    }

    practiceCenter =
      await resolveKakaoAiPracticeCenter({
        customer,

        /**
         * 카카오 한 번의 답변에서
         * 너무 많은 기관정보를 모델에 전달하지 않는다.
         */
        limitPerType:
          10,
      });
  }

  let staffContext:
    KakaoAiStaffContext |
    null =
    null;

  /**
   * 담당자 Context 조회.
   *
   * 중요:
   * 여기서는 추천 확정 / 선택 / 변경을
   * 절대로 수행하지 않는다.
   *
   * Context Resolver는 현재 상태와
   * 선택 가능한 후보를 읽기만 한다.
   */
  if (
    fetchPlan.staffContext
  ) {
    const selectionState =
      await db.getKakaoStaffSelectionState({
        organizationId,

        conversationId:
  params.conversationId,
      });

    /**
     * DB Selection State의 전체 공개 프로필을
     * Intent / Composer에 필요한
     * 최소 담당자 Memory 형식으로 축소한다.
     */
    const toCandidate =
      (
        staff:
          any
      ):
        db.KakaoAiStaffCandidateMemory |
        null => {
        const userId =
          Math.floor(
            Number(
              staff?.userId ||
              0
            )
          );

        if (
          !Number.isFinite(
            userId
          ) ||
          userId <=
          0
        ) {
          return null;
        }

        return {
          userId,

          displayName:
            staff?.displayName
              ? String(
                  staff.displayName
                )
              : null,

          publicToken:
            staff?.publicToken
              ? String(
                  staff.publicToken
                )
              : null,

          publicPositionName:
            staff?.publicPositionName
              ? String(
                  staff.publicPositionName
                )
              : null,
        };
      };

    const recommendedStaff =
      toCandidate(
        selectionState
          .recommendedStaff
      );

    const selectedStaff =
      toCandidate(
        selectionState
          .selectedStaff
      );

    const candidates =
      Array.isArray(
        selectionState
          .candidates
      )
        ? selectionState
            .candidates
            .filter(
              (
                candidate
              ) =>
                Number(
                  candidate
                    ?.userId ||
                  0
                ) >
                0
            )
            .slice(
              0,
              20
            )
        : [];

    staffContext = {
      candidates,

      recommendedStaff,

      selectedStaff,

      status:
        selectionState.status ===
          "selected"
          ? "selected"
          : selectionState.status ===
              "recommended"
            ? "recommended"
            : "none",

      lastIntent:
        selectionState.lastIntent
          ? String(
              selectionState
                .lastIntent
            )
          : null,
    };
  }

  return {
    customerType:
      routedIntent.customerType,

    allowedCapabilities:
      routedIntent.allowedCapabilities,

    restrictedCapabilities:
      routedIntent.restrictedCapabilities,

    fetchPlan,

    companyContext,

documentIntelligence:
  params.documentIntelligence ??
  null,

    leadAcademicAnalysis,

        registeredStudentAnalysis,

    practiceCenter,

    staffContext,

    needsClarification:
      routedIntent.intent
        .needsClarification ===
      true,

    clarificationQuestion:
      routedIntent.intent
        .clarificationQuestion ||
      null,

clarificationOptions:
  Array.isArray(
    routedIntent.intent
      .clarificationOptions
  )
    ? routedIntent.intent
        .clarificationOptions
        .slice(
          0,
          5
        )
    : [],
  };
}