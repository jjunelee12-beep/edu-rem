export type DocumentIntelligenceDocumentType =
  | "transcript"
  | "degree_certificate"
  | "qualification_certificate"
  | "learner_registration"
  | "credit_recognition"
  | "degree_application"
  | "qualification_application"
  | "practice_document"
  | "payment_proof"
  | "administrative_document"
  | "general_document"
  | "unknown";

export type DocumentIntelligenceSource =
  | "KAKAO_AI"
  | "CRM_AI"
  | "SYSTEM_AI"
  | "STAFF"
  | "SYSTEM";

export type DocumentIntelligenceInputType =
  | "image"
  | "pdf"
  | "document";

export type DocumentIntelligenceDecision =
  | "accepted"
  | "review_required"
  | "rejected";

export type DocumentIntelligenceAdministrativeType =
  | "learner_registration"
  | "credit_recognition"
  | "degree_application"
  | "qualification_application";

export type DocumentIntelligenceAdministrativeStatus =
  | "not_detected"
  | "in_progress"
  | "completed"
  | "failed"
  | "unknown";

export interface DocumentIntelligenceSubject {
  name:
    string;

  credits:
    number |
    null;

  grade:
    string |
    null;

  /**
   * 교육원 수강내역처럼 문서 자체에서
   * CRM 반영에 사용할 학습구분이 확인되는 경우만 사용.
   *
   * 대학·전문대 성적증명서는
   * 원래 대학 기준 학습구분이므로 null 처리한다.
   */
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

  /**
   * CRM 기준 학기 순번이 문서에서
   * 명확하게 확인되는 경우.
   */
  semesterNo:
    number |
    null;

  /**
   * 실제 문서 이수학기.
   */
  semester:
    string |
    null;

  /**
   * 실제 문서 이수연도.
   */
  year:
    string |
    null;

  rawName:
    string |
    null;
}

export interface DocumentIntelligencePerson {
  name:
    string |
    null;

  birthDate:
    string |
    null;

  studentNumber:
    string |
    null;
}

export interface DocumentIntelligenceInstitution {
  name:
    string |
    null;

  department:
    string |
    null;

  major:
    string |
    null;
}

export interface DocumentIntelligenceAcademic {
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
    DocumentIntelligenceSubject[];
}

export interface DocumentIntelligenceEnrollment {
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
}

export type DocumentIntelligencePaymentStatus =
  | "paid"
  | "scheduled"
  | "unpaid"
  | "partial_refund"
  | "full_refund"
  | "cancelled"
  | "unknown";

export interface DocumentIntelligencePayment {
  amount:
    number |
    null;

  status:
    DocumentIntelligencePaymentStatus |
    null;

  paidAt:
    string |
    null;
}

export interface DocumentIntelligenceAdministrative {
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
}

export interface DocumentIntelligenceEvidence {
  key: string;

  value:
    string;

  confidence:
    number;
}

export interface DocumentIntelligenceResult {
  version:
    "1.0";

  documentType:
    DocumentIntelligenceDocumentType;

  confidence:
    number;

  inputType:
    DocumentIntelligenceInputType;

  sourceType:
    DocumentIntelligenceSource;

  person:
    DocumentIntelligencePerson;

  institution:
    DocumentIntelligenceInstitution;

  academic:
    DocumentIntelligenceAcademic;

enrollment:
  DocumentIntelligenceEnrollment;

payment:
  DocumentIntelligencePayment;

  administrative:
    DocumentIntelligenceAdministrative;

  extractedText:
    string |
    null;

  evidence:
    DocumentIntelligenceEvidence[];

  missingEvidence:
    string[];

  warnings:
    string[];

  decision:
    DocumentIntelligenceDecision;

  /**
   * AI가 읽은 사실의 요약.
   * 학점/학위/자격 계산 결과가 아님.
   */
  summary:
    string;

  /**
   * 공통 Academic Engine에 넘길 수 있는지.
   */
  canUseAcademicEngine:
    boolean;

  /**
   * 행정절차 자동검증 후보인지.
   * true라도 즉시 completed를 의미하지 않는다.
   */
  canUseAdministrativeEngine:
    boolean;
}