import type {
  DocumentIntelligenceDocumentType,
  DocumentIntelligenceDecision,
  DocumentIntelligenceAdministrativeType,
} from "./document-intelligence.types";

/**
 * Document Assistance가 수행할 업무 종류.
 *
 * Intelligence:
 * "이 문서가 무엇이고 무엇이 적혀 있는가?"
 *
 * Assistance:
 * "그래서 사용자가 지금 무엇을 해야 하는가?"
 */
export type DocumentAssistanceTask =
  | "document_explanation"
  | "field_completion"
  | "missing_field_check"
  | "error_check"
  | "submission_guide"
  | "administrative_guide"
  | "practice_document_guide"
  | "qualification_application_guide"
  | "academic_document_guide"
  | "general_document_guide";

/**
 * 문서 작성/제출 업무 분류.
 */
export type DocumentAssistanceCategory =
  | "academic"
  | "administrative"
  | "practice"
  | "qualification"
  | "payment"
  | "general";

/**
 * 개별 입력칸/항목 분석결과.
 */
export interface DocumentAssistanceField {
  /**
   * 사용자에게 보여줄 항목명.
   *
   * 예:
   * 성명
   * 생년월일
   * 실습기관명
   * 실습기간
   */
  label:
    string;

  /**
   * 문서 또는 CRM에서 확인된 현재 값.
   */
  currentValue:
    string |
    null;

  /**
   * 반드시 작성되어야 하는 값인지.
   */
  required:
    boolean;

  /**
   * 현재 값 상태.
   */
  status:
    | "filled"
    | "missing"
    | "uncertain"
    | "mismatch"
    | "not_applicable";

  /**
   * 값의 근거.
   */
  source:
    | "document"
    | "crm"
    | "document_and_crm"
    | "user"
    | "unknown";

  /**
   * 사용자에게 어떻게 처리할지.
   */
  guidance:
    string |
    null;
}

/**
 * 문서에서 발견한 문제.
 */
export interface DocumentAssistanceIssue {
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

  /**
   * 자동수정 가능 여부.
   *
   * true라고 해도 이 엔진이 DB나 파일을
   * 직접 수정하는 것은 아니다.
   */
  autoFixable:
    boolean;
}

/**
 * 사용자가 다음으로 해야 할 단계.
 */
export interface DocumentAssistanceStep {
  order:
    number;

  title:
    string;

  description:
    string;

  /**
   * 실제 외부사이트 제출,
   * 서명, 담당자 확인 등
   * 사람 행동이 필요한지.
   */
  requiresUserAction:
    boolean;

  /**
   * 담당자 검토가 필요한 단계인지.
   */
  requiresStaffReview:
    boolean;
}

/**
 * 공통 Document Assistance 최종 결과.
 */
export interface DocumentAssistanceResult {
  version:
    "1.0";

  /**
   * 원본 Document Intelligence 정보.
   */
  documentType:
    DocumentIntelligenceDocumentType;

  documentDecision:
    DocumentIntelligenceDecision;

  category:
    DocumentAssistanceCategory;

  tasks:
    DocumentAssistanceTask[];

  administrativeProcedureType:
    DocumentIntelligenceAdministrativeType |
    null;

  /**
   * 현재 자료만으로 안내를 진행해도 되는지.
   *
   * true = 사용자 안내 가능
   * false = 자료가 너무 부족하거나 위험함
   */
  canAssist:
    boolean;

  /**
   * 사람이 검토해야 하는지.
   */
  requiresStaffReview:
    boolean;

  /**
   * 이 문서가 무엇인지 자연어 요약.
   */
  documentSummary:
    string;

  /**
   * 작성항목/확인항목.
   */
  fields:
    DocumentAssistanceField[];

  /**
   * 누락·오류·불일치.
   */
  issues:
    DocumentAssistanceIssue[];

  /**
   * 사용자가 해야 할 순서.
   */
  nextSteps:
    DocumentAssistanceStep[];

  /**
   * 사용자에게 바로 설명 가능한 핵심 안내.
   *
   * 최종 카카오 문장 자체는 아니다.
   * Composer가 자연어로 변환한다.
   */
  guidanceSummary:
    string;

  warnings:
    string[];
}