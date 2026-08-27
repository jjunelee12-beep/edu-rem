import {
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  Bot,
  CheckCircle2,
  Copy,
  FileScan,
  GraduationCap,
  Loader2,
  MessageCircle,
  RefreshCw,
  Save,
  UserRoundSearch,
  Users,
  WalletCards,
} from "lucide-react";

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";

type KakaoAiSettingsForm = {
  enabled: boolean;

  newConsultationEnabled: boolean;
  registeredStudentEnabled: boolean;

  ocrEnabled: boolean;
  practiceSupportEnabled: boolean;
  assigneeRecommendationEnabled: boolean;

  aiDisplayName: string;

  welcomeMessage: string;
defaultGuideMessage: string;
consultationHoursMessage: string;

companyIntroduction: string;
companyBenefits: string;
salesPoints: string;
registeredAiBenefits: string;
classManagementPolicy: string;
practicePolicy: string;
administrativeSupportPolicy: string;
  consultationPolicy: string;

  priceDisclosureEnabled: boolean;
priceGuide: string;
  kakaoBotId: string;
};

type StaffTeamPageForm = {
  enabled: boolean;

  title: string;
  description: string;

  staffSectionTitle: string;
  staffSectionDescription: string;

  footerIntroduction: string;
};

const DEFAULT_STAFF_TEAM_PAGE_FORM: StaffTeamPageForm = {
  enabled: false,

  title: "",
  description: "",

  staffSectionTitle: "",
  staffSectionDescription: "",

  footerIntroduction: "",
};

const DEFAULT_FORM: KakaoAiSettingsForm = {
  enabled: false,

  newConsultationEnabled: true,
  registeredStudentEnabled: true,

  ocrEnabled: true,
  practiceSupportEnabled: true,
  assigneeRecommendationEnabled: true,

  aiDisplayName: "EduCanvas AI",

  welcomeMessage: "",
defaultGuideMessage: "",
consultationHoursMessage: "",

companyIntroduction: "",
companyBenefits: "",
salesPoints: "",
registeredAiBenefits: "",
classManagementPolicy: "",
practicePolicy: "",
administrativeSupportPolicy: "",
consultationPolicy: "",

  priceDisclosureEnabled: false,
priceGuide: "",
  kakaoBotId: "",
};

type LeadFlowBuilderStageId =
  | "TRUST"
  | "OVERVIEW"
  | "THEORY"
  | "PRACTICUM"
  | "ADMINISTRATION"
  | "CERTIFICATE"
  | "BENEFITS"
  | "STAFF"
  | "CONSULTATION";

type LeadFlowBuilderStage = {
  id: LeadFlowBuilderStageId;
  enabled: boolean;
  order: number;
  detailEnabled: boolean;
};

type LeadFlowStageDefinition = {
  label: string;
  description: string;

  summaryMemoryPath: string;
  detailMemoryPath: string | null;

  summaryActionId: string;
  detailActionId: string | null;
  detailFollowupActionId: string | null;

  choiceActionId: string | null;
  choiceAfterDetailActionId: string | null;

  detailLabel: string | null;
  detailSemanticDescription: string | null;

  contentKeys: string[];

  purpose: string;

  summaryGuidance: string;
  detailGuidance: string | null;
  detailFollowupGuidance: string | null;
  choiceGuidance: string | null;
  choiceAfterDetailGuidance: string | null;
};

const LEAD_FLOW_STAGE_DEFINITIONS:
  Record<
    LeadFlowBuilderStageId,
    LeadFlowStageDefinition
  > = {
    TRUST: {
    label:
      "상담 방식 안내",

    description:
      "상담 근거와 회사의 관리방식을 처음에 짧게 안내합니다.",

    summaryMemoryPath:
      "memory.consultationFlow.trustExplained",

    detailMemoryPath:
      null,

    summaryActionId:
      "explain_trust_summary",

    detailActionId:
      null,

    detailFollowupActionId:
      null,

    choiceActionId:
      "offer_trust_next",

    choiceAfterDetailActionId:
      null,

    detailLabel:
      null,

    detailSemanticDescription:
      null,

    contentKeys: [
      "leadAcademicContext",
      "companyContext",
    ],

    purpose:
  "신규상담 초기에 고객의 희망과정에 맞는 개인별 학습설계를 위해 최종학력 등 필요한 기본조건을 먼저 확인하고, 조건이 확인된 뒤 전체 과정 안내로 연결한다.",

       summaryGuidance:
  "현재 고객의 질문에 먼저 짧게 답한다. 아직 memory.finalEducation이 확인되지 않았다면 개인별 기간, 학기 수, 과목 수, 필요학점, 실습시간, 예상 종료일, 자격증 신청 예상시점을 먼저 설명하지 않는다. 국가평생교육진흥원 기준엔진이나 담당자·AI 관리방식에 대한 신뢰설명도 이 단계에서는 길게 설명하지 않는다. 정확한 개인별 학습설계를 위해 최종학력을 먼저 확인한다. 최종학력이 없다면 답변 마지막에 '정확한 진행기간을 확인하기 위해 최종학력이 어떻게 되실까요? 고졸 / 전문대졸 / 4년제졸 중 말씀해주세요.'라는 취지로 질문하고 이번 답변은 여기서 끝낸다. 이미 최종학력이 확인되어 있다면 같은 질문을 반복하지 않고 개인별 전체 과정 안내로 연결한다.",

    detailGuidance:
      null,

    detailFollowupGuidance:
      null,

   choiceGuidance:
  "최종학력이 아직 확인되지 않았다면 다른 상담단계로 넘어가지 않고 최종학력 확인을 우선한다. 최종학력이 확인된 상태라면 같은 질문을 반복하지 않고 개인별 전체 과정 안내로 연결한다.",

    choiceAfterDetailGuidance:
      null,
  },

  OVERVIEW: {
    label:
      "전체 과정 안내",

    description:
      "고객 조건에 맞는 전체 취득과정을 먼저 간단히 설명합니다.",

    summaryMemoryPath:
      "memory.consultationFlow.courseOverviewExplained",

    detailMemoryPath:
      null,

    summaryActionId:
      "explain_course_overview_summary",

    detailActionId:
      null,

    detailFollowupActionId:
      null,

    choiceActionId:
      "offer_overview_next",

    choiceAfterDetailActionId:
      null,

    detailLabel:
      null,

    detailSemanticDescription:
      null,

    contentKeys: [
  "leadAcademicContext",
  "companyContext",
],

    purpose:
      "고객 개인조건에 맞는 전체 학습흐름을 이해시키고 세부 진행단계로 연결한다.",

   summaryGuidance:
  `기본 안내에서는 반드시 "국가평생교육진흥원 학점은행제 기준엔진으로"라는 표현을 포함한다. 서버 계산값을 사용하여 '[최종학력] 기준으로 확인해보면 국가평생교육진흥원 학점은행제 기준엔진으로 현재 설계상 [학기 수]학기, 약 [개월 수]개월 정도 소요될 것으로 예상됩니다. 자격증 신청 예상 시점은 [서버 계산 자격증 신청시점]입니다.'라는 구조로 안내한다. "국가평생교육진흥원", "학점은행제", "기준엔진" 표현을 임의로 생략하거나 다른 일반적인 표현으로 대체하지 않는다.`,

    detailGuidance:
      null,

    detailFollowupGuidance:
      null,

    choiceGuidance:
      "전체 과정 안내를 이미 완료했다. 같은 내용을 반복하지 않고 현재 질문에 답한 뒤 다음 상담단계로 자연스럽게 연결한다.",

    choiceAfterDetailGuidance:
      null,
  },

  THEORY: {
    label:
      "이론수업 안내",

    description:
      "온라인 이론수업 진행방식을 안내합니다.",

    summaryMemoryPath:
      "memory.consultationFlow.theoryExplained",

    detailMemoryPath:
      "memory.consultationFlow.theoryDetailExplained",

    summaryActionId:
      "explain_theory_summary",

    detailActionId:
      "explain_theory_detail",

    detailFollowupActionId:
      "answer_theory_detail_followup",

    choiceActionId:
      "offer_theory_choices",

    choiceAfterDetailActionId:
      "offer_theory_choices_after_detail",

    detailLabel:
      "상세 이론수업 안내 허용",

    detailSemanticDescription:
      "고객이 이론수업 진행방법을 더 자세하게 설명해 달라고 요청한다.",

    contentKeys: [
      "leadAcademicContext",
      "companyContext",
    ],

    purpose:
      "이론수업을 간단히 안내하고 필요할 때 상세설명 또는 다음 상담단계로 연결한다.",

        summaryGuidance:
      "현재 질문에 먼저 답하고 이론수업 진행방식은 핵심만 2~4문장으로 안내한다. 수강방식, 출석, 시험 등 무엇이 있는지만 이해할 정도로 설명하고 처음부터 세부 규칙을 모두 풀어놓지 않는다. 회사가 관리하는 부분은 companyContext에 실제 있는 내용만 짧게 덧붙여 안심을 준다.",

    detailGuidance:
      "고객이 이론수업을 더 자세히 요청한 경우에만 서버 Context 범위에서 수강방식, 출석, 시험, 과제, 토론, 퀴즈, 학사일정 관리 등을 자세히 설명한다. 이미 설명한 기본내용을 다시 반복하지 않는다.",

    detailFollowupGuidance:
      "이론수업 상세안내가 이미 완료됐다. 새롭게 질문한 부분만 답하고 전체 이론수업 설명을 다시 반복하지 않는다. 답변 후 다음 상담단계로 연결한다.",

    choiceGuidance:
      "이론수업 기본안내는 끝났다. 이전 내용을 다시 설명하지 않는다. 고객에게 '이론수업을 더 자세히 확인할지' 또는 '실습 안내로 넘어갈지' 두 방향을 짧고 명확하게 제시한다.",

    choiceAfterDetailGuidance:
      "이론수업 상세안내까지 끝났다. 기존 설명을 반복하지 말고 실습 안내로 넘어갈 수 있도록 짧게 제안한다.",
  },

  PRACTICUM: {
    label:
      "실습 안내",

    description:
      "실습 진행방식과 회사의 실습 지원범위를 안내합니다.",

    summaryMemoryPath:
      "memory.consultationFlow.practicumExplained",

    detailMemoryPath:
      "memory.consultationFlow.practicumDetailExplained",

    summaryActionId:
      "explain_practicum_summary",

    detailActionId:
      "explain_practicum_detail",

    detailFollowupActionId:
      "answer_practicum_detail_followup",

    choiceActionId:
      "offer_practicum_choices",

    choiceAfterDetailActionId:
      "offer_practicum_choices_after_detail",

    detailLabel:
      "상세 실습 안내 허용",

    detailSemanticDescription:
      "고객이 실습 진행방법, 일정, 기관 또는 실습지원에 대해 더 자세한 설명을 원한다.",

    contentKeys: [
      "leadAcademicContext",
      "practiceContext",
      "companyContext",
    ],

    purpose:
      "실습 기본 진행방식과 지원범위를 설명하고 다음 상담단계로 연결한다.",

        summaryGuidance:
      "현재 과정에 필요한 실습 여부와 기본 진행방식만 핵심적으로 안내한다. 실습시간, 기관에서 진행한다는 점, 회사가 지원하는 범위 등 서버 Context에 확인된 내용 중 필요한 것만 2~4문장으로 설명한다. 고객이 안심할 수 있도록 회사에서 준비과정과 일정 등을 확인해준다는 취지는 짧게 안내하되 세부절차를 한꺼번에 설명하지 않는다.",

    detailGuidance:
      "고객이 실습을 더 자세히 요청한 경우에만 실습기관, 일정, 진행방식, 준비서류, 회사 지원범위를 서버 Context 기준으로 자세히 설명한다. 기본 실습설명을 처음부터 다시 반복하지 않는다.",

    detailFollowupGuidance:
      "실습 상세안내는 이미 완료됐다. 고객이 새롭게 묻는 내용만 답하고 실습 기본내용을 다시 반복하지 않는다. 답변 후 행정절차로 연결한다.",

    choiceGuidance:
      "실습 기본안내는 끝났다. 실습 내용을 다시 설명하지 않는다. 고객에게 '실습 일정·기관·준비사항을 더 자세히 볼지' 또는 '행정절차 안내로 넘어갈지' 두 방향만 짧게 제시한다.",

    choiceAfterDetailGuidance:
      "실습 상세안내까지 끝났다. 같은 실습내용을 반복하지 말고 행정절차 안내로 넘어가도록 짧게 제안한다.",
  },

  ADMINISTRATION: {
    label:
      "행정절차 안내",

    description:
      "학습자등록, 학점인정, 학위신청 등 필요한 행정절차를 안내합니다.",

    summaryMemoryPath:
      "memory.consultationFlow.administrationExplained",

    detailMemoryPath:
      "memory.consultationFlow.administrationDetailExplained",

    summaryActionId:
      "explain_administration_summary",

    detailActionId:
      "explain_administration_detail",

    detailFollowupActionId:
      "answer_administration_detail_followup",

    choiceActionId:
      "offer_administration_choices",

    choiceAfterDetailActionId:
      "offer_administration_choices_after_detail",

    detailLabel:
      "상세 행정절차 안내 허용",

    detailSemanticDescription:
      "고객이 학습자등록, 학점인정, 학위신청 등의 행정절차를 더 자세하게 확인하고 싶어 한다.",

    contentKeys: [
      "leadAcademicContext",
      "companyContext",
    ],

    purpose:
      "현재 과정에 필요한 행정절차를 안내하고 다음 상담단계로 연결한다.",

        summaryGuidance:
      "현재 고객에게 필요한 행정절차가 무엇인지 서버 Context 기준으로 핵심만 안내한다. 학습자등록, 학점인정신청, 학위신청 등 필요한 절차가 있다는 정도와 회사에서 신청시기 및 누락 여부를 같이 확인해준다는 점을 2~4문장으로 설명한다. 처음부터 각 신청방법과 서류를 모두 설명하지 않는다.",

    detailGuidance:
      "고객이 행정절차를 더 자세히 요청한 경우에만 서버 Context가 제공하는 순서, 신청시기, 준비사항, 진행방법을 자세히 설명한다. 확정되지 않은 날짜를 만들지 않고 기본설명을 반복하지 않는다.",

    detailFollowupGuidance:
      "행정절차 상세안내가 이미 완료됐다. 새롭게 물어본 절차만 답하고 전체 행정절차를 반복하지 않는다. 답변 후 등록회원 관리혜택 단계로 연결한다.",

    choiceGuidance:
      "행정절차 기본안내는 끝났다. 이전 행정설명을 반복하지 않는다. 고객에게 '행정절차를 더 자세히 확인할지' 또는 '등록 후 어떤 관리와 AI 기능을 이용할 수 있는지 볼지' 두 방향을 짧게 제시한다.",

    choiceAfterDetailGuidance:
      "행정절차 상세안내까지 끝났다. 같은 설명을 반복하지 말고 등록 후 관리 및 등록회원 AI 혜택 단계로 넘어가도록 짧게 제안한다.",
  },

  CERTIFICATE: {
    label:
      "자격증 신청 안내",

    description:
      "과정 완료 후 자격증 신청 흐름을 안내합니다.",

    summaryMemoryPath:
      "memory.consultationFlow.certificateExplained",

    detailMemoryPath:
      "memory.consultationFlow.certificateDetailExplained",

    summaryActionId:
      "explain_certificate_summary",

    detailActionId:
      "explain_certificate_detail",

    detailFollowupActionId:
      "answer_certificate_detail_followup",

    choiceActionId:
      "offer_certificate_choices",

    choiceAfterDetailActionId:
      "offer_certificate_choices_after_detail",

    detailLabel:
      "상세 자격증 신청 안내 허용",

    detailSemanticDescription:
      "고객이 자격증 신청시기, 절차 또는 준비서류를 더 자세하게 알고 싶어 한다.",

    contentKeys: [
      "leadAcademicContext",
      "companyContext",
    ],

    purpose:
      "과정 완료 후 자격증 신청흐름을 설명하고 다음 상담단계로 연결한다.",

    summaryGuidance:
      "서버 Context를 기준으로 과정 이수 후 자격증 신청단계와 기본 흐름을 간단히 설명한다.",

    detailGuidance:
      "기본설명을 반복하지 않고 신청 가능한 시점, 절차, 준비사항 등 서버 Context가 지원하는 범위에서 자세히 설명한다.",

    detailFollowupGuidance:
      "자격증 신청 상세안내를 이미 완료했다. 현재 추가질문에 필요한 부분만 답하고 이전 설명 전체를 반복하지 않는다.",

    choiceGuidance:
      "자격증 기본안내는 이미 완료됐다. 현재 질문 후 상세확인 또는 다음 상담단계로 연결한다.",

    choiceAfterDetailGuidance:
      "자격증 상세안내까지 완료됐다. 같은 내용을 반복하지 않고 다음 상담단계로 연결한다.",
  },

  BENEFITS: {
    label:
      "등록 후 관리혜택",

    description:
      "등록 후 담당자 관리와 등록회원 전용 AI 이용혜택을 안내합니다.",

    summaryMemoryPath:
  "memory.consultationFlow.companyBenefitsExplained",

detailMemoryPath:
  "memory.consultationFlow.companyBenefitsDetailExplained",

    summaryActionId:
      "explain_benefits_summary",

    detailActionId:
      "explain_benefits_detail",

    detailFollowupActionId:
      "answer_benefits_detail_followup",

    choiceActionId:
      "offer_benefits_choices",

    choiceAfterDetailActionId:
      "offer_benefits_choices_after_detail",

    detailLabel:
      "등록 후 혜택 상세안내",

    detailSemanticDescription:
      "고객이 등록 후 관리방식, 등록회원 전용 AI, 카카오톡 인증, 조회기능, 서류지원 또는 등록혜택을 더 자세히 알고 싶어 한다.",

    contentKeys: [
      "companyContext",
      "leadAcademicContext",
    ],

    purpose:
      "등록 후 사람이 담당자로서 계속 관리하면서 AI가 누락·위험요소 확인과 조회·서류업무를 보조하는 구조를 짧게 안내하고 담당자 추천 단계로 연결한다.",

    summaryGuidance:
      "등록 후 받을 수 있는 관리혜택을 핵심만 2~4문장으로 안내한다. companyContext의 companyBenefits, registeredAiBenefits, salesPoints 및 서버 Context에 실제 저장된 내용만 사용한다. 등록 후 카카오톡에서 1회 인증하면 등록회원 전용 AI를 이용할 수 있다는 점과, 진행상태 조회·학점 부족 확인·행정 신청시기 확인·실습 관련 안내·필요 서류 지원 등 실제 제공 가능한 기능이 있다는 정도만 간단히 설명한다. AI가 고객을 혼자 관리한다고 표현하지 말고, 실제 담당자가 계속 관리하며 AI는 담당자가 놓칠 수 있는 부분의 확인, 위험요소 점검, 조회 및 서류업무를 보조하는 구조라고 설명한다. 처음부터 기능을 하나씩 길게 설명하지 않는다.",

    detailGuidance:
      "고객이 등록 후 혜택이나 등록회원 전용 AI를 더 자세히 요청한 경우에만 companyContext와 서버 Context에 실제 존재하는 기능을 자세히 설명한다. 카카오톡 1회 인증 후 등록회원 모드에서 가능한 조회, 학점 부족 및 진행상태 확인, 행정 신청시기 확인, 실습 관련 안내, 서류 지원, 피해사례 또는 진행상 위험요소 방지 기능 등 실제 제공되는 범위만 설명한다. 'AI가 관리하는 것이냐'는 취지의 질문에는 AI가 전체 관리를 대신하는 것이 아니라 실제 담당자가 관리하고 AI가 누락·위험요소 확인과 반복 조회·서류업무를 보조한다고 명확히 설명한다. 기본 혜택 설명을 처음부터 반복하지 않는다.",

    detailFollowupGuidance:
      "등록 후 관리혜택과 등록회원 전용 AI 상세안내가 이미 완료됐다. 고객이 새롭게 물어본 기능이나 관리항목만 답하고 전체 혜택을 반복하지 않는다. 답변 후 담당자 추천 단계로 연결한다.",

    choiceGuidance:
      "등록 후 관리혜택 기본안내는 끝났다. 같은 혜택설명을 반복하지 않는다. 고객에게 '등록회원 전용 AI와 관리혜택을 더 자세히 확인할지' 또는 '상담을 담당할 담당자를 추천받을지' 두 방향만 짧고 명확하게 제시한다.",

    choiceAfterDetailGuidance:
      "등록 후 관리혜택 상세안내까지 끝났다. 같은 내용을 반복하지 말고 담당자 추천 단계로 넘어가도록 짧게 제안한다.",
  },

    STAFF: {
    label:
      "담당자 안내",

    description:
      "담당자가 아직 정해지지 않은 고객에게 회사 소속 담당자를 추천하고, 고객이 담당자를 선택한 뒤 상담접수 단계로 연결합니다.",

    summaryMemoryPath:
      "memory.consultationFlow.staffRecommendationOffered",

    detailMemoryPath:
      "memory.consultationFlow.staffDetailExplained",

    summaryActionId:
      "introduce_staff_summary",

    detailActionId:
      "explain_staff_detail",

    detailFollowupActionId:
      "answer_staff_detail_followup",

    choiceActionId:
      "offer_staff_choices",

    choiceAfterDetailActionId:
      "offer_staff_choices_after_detail",

    detailLabel:
      "추천 담당자 상세정보 확인",

    detailSemanticDescription:
      "고객이 추천 담당자의 경력, 관리방식 또는 공개 가능한 담당자 정보를 더 자세히 확인하고 싶어 한다.",

    contentKeys: [
      "staffContext",
    ],

    purpose:
      "담당자가 정해지지 않은 고객에게 실제 회사 담당자를 추천하고, 고객이 추천 담당자를 선택하거나 동의하면 해당 담당자로 확정한 뒤 상담접수 단계로 연결한다.",

    summaryGuidance:
      "staffContext에 이미 선택된 담당자가 있으면 다시 추천하지 않고 해당 담당자를 기준으로 상담접수 단계로 연결한다. 선택된 담당자가 없다면 staffContext의 실제 담당자 후보 중 상담내용에 적합한 담당자를 추천한다. 이때 '아직 담당자가 정해지지 않아 상담 내용에 맞는 담당자를 추천해드릴게요.'처럼 자연스럽게 안내한다. 공개 가능한 담당자 정보만 사용하고 내부 userId나 서버에 없는 경력은 말하지 않는다. 담당자를 추천한 뒤 고객에게 직접 담당자 이름을 입력하라고 요구하지 않는다.",

    detailGuidance:
      "고객이 추천 담당자에 대해 더 알고 싶어 하는 경우에만 staffContext에 실제 존재하는 공개 가능한 담당자 정보를 설명한다. 없는 경력이나 관리방식을 만들어내지 않는다. 설명 후 해당 담당자로 진행할지 자연스럽게 확인한다.",

    detailFollowupGuidance:
      "담당자 상세안내가 이미 완료됐다. 새롭게 질문한 공개정보만 답하고 기존 담당자 소개를 반복하지 않는다. 고객이 해당 담당자로 진행하겠다는 의사를 보이면 담당자를 선택한 뒤 상담접수 단계로 연결한다.",

    choiceGuidance:
      "담당자 추천이 완료됐다. 같은 담당자 소개를 반복하지 않는다. 고객이 추천 담당자로 진행하겠다는 의사를 보이면 해당 담당자를 선택하고 상담접수 단계로 연결한다. 아직 결정하지 않았다면 담당자 상세정보 확인 또는 추천 담당자로 진행하는 두 방향만 짧게 제시한다.",

    choiceAfterDetailGuidance:
      "담당자 상세안내까지 완료됐다. 동일한 소개를 반복하지 않는다. 고객이 진행 의사를 보이면 추천 담당자를 선택하고 바로 상담접수 단계로 연결한다.",
  },

  CONSULTATION: {
    label:
      "상담 접수 안내",

    description:
      "선택된 담당자를 기준으로 고객의 부족한 정보만 확인하고 실제 상담접수를 진행합니다.",

    summaryMemoryPath:
      "memory.consultationFlow.consultationFormOffered",

    detailMemoryPath:
      null,

    summaryActionId:
      "offer_consultation_form",

    detailActionId:
      null,

    detailFollowupActionId:
      null,

    choiceActionId:
      null,

    choiceAfterDetailActionId:
      null,

    detailLabel:
      null,

    detailSemanticDescription:
      null,

    contentKeys: [
      "companyContext",
      "staffContext",
    ],

    purpose:
      "선택된 담당자를 기준으로 상담접수를 진행한다. 담당자가 아직 선택되지 않았다면 고객에게 담당자명을 직접 입력하도록 요구하지 않고 담당자 추천 단계로 연결한다.",

       summaryGuidance:
      "현재 질문에 먼저 답한 뒤 상담 또는 접수를 진행할 수 있도록 서버가 실제 요구하는 정보와 가능한 절차만 안내한다. 이미 확보된 정보를 불필요하게 다시 요구하지 않는다. 담당자가 아직 선택되지 않았다면 고객에게 담당자명을 직접 입력하도록 요구하지 말고, 현재 상담내용에 맞는 담당자를 먼저 추천해드리겠다고 자연스럽게 안내한다. 담당자가 선택된 상태라면 성함, 연락처, 최종학력, 희망과정 등 서버에서 실제로 부족한 정보만 요청하고 이미 확인된 정보는 다시 묻지 않는다.",
    
    detailGuidance:
      null,

    detailFollowupGuidance:
      null,

    choiceGuidance:
      null,

    choiceAfterDetailGuidance:
      null,
  },
};

const DEFAULT_LEAD_FLOW_STAGES:
  LeadFlowBuilderStage[] = [
  {
    id: "TRUST",
    enabled: true,
    order: 10,
    detailEnabled: false,
  },
  {
    id: "OVERVIEW",
    enabled: true,
    order: 20,
    detailEnabled: false,
  },
  {
    id: "THEORY",
    enabled: true,
    order: 30,
    detailEnabled: true,
  },
  {
    id: "PRACTICUM",
    enabled: true,
    order: 40,
    detailEnabled: true,
  },
  {
    id: "ADMINISTRATION",
    enabled: true,
    order: 50,
    detailEnabled: true,
  },
  {
    id: "BENEFITS",
    enabled: true,
    order: 60,
    detailEnabled: true,
  },
  {
    id: "STAFF",
    enabled: true,
    order: 70,
    detailEnabled: true,
  },
  {
    id: "CONSULTATION",
    enabled: true,
    order: 80,
    detailEnabled: false,
  },
  {
    id: "CERTIFICATE",
    enabled: false,
    order: 90,
    detailEnabled: true,
  },
];

function createDefaultLeadFlowStages():
  LeadFlowBuilderStage[] {
  return DEFAULT_LEAD_FLOW_STAGES.map(
    stage => ({
      ...stage,
    })
  );
}

function normalizeLeadFlowBuilderStages(
  value:
    unknown
): LeadFlowBuilderStage[] {
  const source =
    value &&
    typeof value ===
      "object" &&
    !Array.isArray(
      value
    )
      ? value as Record<
          string,
          unknown
        >
      : null;

  const sourceStages =
    Array.isArray(
      source?.stages
    )
      ? source?.stages as Array<
          Record<
            string,
            unknown
          >
        >
      : [];

  const sourceById =
    new Map<
      string,
      Record<
        string,
        unknown
      >
    >();

  for (
    const sourceStage of
    sourceStages
  ) {
    const id =
      String(
        sourceStage?.id ||
        ""
      ).trim();

    if (id) {
      sourceById.set(
        id,
        sourceStage
      );
    }
  }

  return createDefaultLeadFlowStages()
    .map(
      defaultStage => {
        const saved =
          sourceById.get(
            defaultStage.id
          );

        if (!saved) {
          return defaultStage;
        }

        const metadata =
          saved.metadata &&
          typeof saved.metadata ===
            "object" &&
          !Array.isArray(
            saved.metadata
          )
            ? saved.metadata as Record<
                string,
                unknown
              >
            : {};

        const savedOrder =
          Number(
            saved.order
          );

        return {
          ...defaultStage,

          enabled:
            saved.enabled !==
            false,

          order:
            Number.isFinite(
              savedOrder
            )
              ? savedOrder
              : defaultStage.order,

          detailEnabled:
            LEAD_FLOW_STAGE_DEFINITIONS[
              defaultStage.id
            ].detailMemoryPath
              ? metadata
                  .detailEnabled !==
                false
              : false,
        };
      }
    )
    .sort(
      (
        left,
        right
      ) =>
        left.order -
        right.order
    )
    .map(
      (
        stage,
        index
      ) => ({
        ...stage,

        order:
          (
            index +
            1
          ) *
          10,
      })
    );
}

function buildLeadFlowConfig(
  stages:
    LeadFlowBuilderStage[]
) {
  const orderedStages =
    [
      ...stages,
    ].sort(
      (
        left,
        right
      ) =>
        left.order -
        right.order
    );

  const activeStages =
    orderedStages.filter(
      stage =>
        stage.enabled
    );

  const activeStageIds =
    activeStages.map(
      stage =>
        stage.id
    );

  const getNextActiveStageId =
    (
      stageId:
        LeadFlowBuilderStageId
    ):
      LeadFlowBuilderStageId |
      null => {
      const currentIndex =
        activeStageIds.indexOf(
          stageId
        );

      if (
        currentIndex <
          0 ||
        currentIndex >=
          activeStageIds.length -
            1
      ) {
        return null;
      }

      return (
        activeStageIds[
          currentIndex +
            1
        ] ||
        null
      );
    };

  const builtStages =
    orderedStages.map(
      stage => {
        const definition =
          LEAD_FLOW_STAGE_DEFINITIONS[
            stage.id
          ];

        const nextStageId =
          stage.enabled
            ? getNextActiveStageId(
                stage.id
              )
            : null;

        const transitions:
          Array<
            Record<
              string,
              unknown
            >
          > = [];

        if (
          stage.detailEnabled &&
          definition.detailMemoryPath &&
          definition.detailActionId &&
          definition
            .detailFollowupActionId &&
          definition
            .detailSemanticDescription
        ) {
          transitions.push(
            {
              whenSemantic:
                "request_detail",

              semanticDescription:
                definition
                  .detailSemanticDescription,

              when: {
                mode:
                  "all",

                conditions: [
                  {
                    path:
                      definition
                        .detailMemoryPath,

                    operator:
                      "truthy",
                  },
                ],
              },

              toStageId:
                stage.id,

              actionId:
                definition
                  .detailFollowupActionId,

              priority:
                300,
            },
            {
              whenSemantic:
                "request_detail",

              semanticDescription:
                definition
                  .detailSemanticDescription,

              toStageId:
                stage.id,

              actionId:
                definition
                  .detailActionId,

              priority:
                250,
            }
          );
        }

       if (
  nextStageId
) {
  const continueNextConditions:
    Array<
      Record<
        string,
        unknown
      >
    > = [
      /**
       * 현재 Stage의 기본안내가 실제 완료된 뒤에만
       * 다음 Stage 진행을 허용한다.
       *
       * 첫 사용자 메시지가 continue_next처럼 해석되더라도
       * TRUST / OVERVIEW 등을 건너뛰지 못하게 한다.
       */
      {
        path:
          definition
            .summaryMemoryPath,

        operator:
          "truthy",
      },
    ];

  /**
   * 신규상담의 최초 TRUST 단계에서는
   * 개인별 학습설계에 필요한 최종학력이 확인되기 전까지
   * OVERVIEW로 넘어가지 않는다.
   *
   * 회사별 상담 Flow의 순서는 그대로 유지하면서
   * 학력 미확정 상태의 잘못된 과정계산을 방지한다.
   */
  if (
  stage.id ===
    "TRUST"
) {
  continueNextConditions.push(
    {
      path:
        "memory.finalEducation",

      operator:
        "truthy",
    },
    {
      path:
        "memory.desiredCourse",

      operator:
        "truthy",
    }
  );
}

if (
  stage.id ===
    "STAFF"
) {
  continueNextConditions.push({
    path:
      "memory.selectedStaffUserId",

    operator:
      "truthy",
  });
}

  transitions.push({
    whenSemantic:
      "continue_next",

    semanticDescription:
  "고객이 현재 단계의 안내를 확인하고 다음 상담단계로 진행할 수 있는 상태가 되었다. 직전 assistant가 다음 단계 진행을 위해 필요한 정보를 직접 질문했고 사용자가 그 정보를 명확하게 제공한 경우도 포함한다. 또한 직전 assistant가 현재 단계 안내 후 다음 진행을 제안했고 사용자가 별도의 상세질문 없이 '네', '예', '좋아요', '계속해주세요', '그다음요'처럼 긍정하거나 계속 진행 의사를 보이는 경우도 포함한다. 단 실제 다음 단계 이동에 필요한 정보가 충족되었는지는 transition의 when 조건을 기준으로 한다.",

    when: {
      mode:
        "all",

      conditions:
        continueNextConditions,
    },

    toStageId:
      nextStageId,

    priority:
      200,
  });
}

        if (
          nextStageId &&
          stage.detailEnabled &&
          definition.detailMemoryPath &&
          definition
            .choiceAfterDetailActionId
        ) {
          transitions.push({
            when: {
              mode:
                "all",

              conditions: [
                {
                  path:
                    definition
                      .detailMemoryPath,

                  operator:
                    "truthy",
                },
              ],
            },

            toStageId:
              stage.id,

            actionId:
              definition
                .choiceAfterDetailActionId,

            priority:
              20,
          });
        }

        if (
          nextStageId &&
          definition
            .choiceActionId
        ) {
          transitions.push({
            when: {
              mode:
                "all",

              conditions: [
                {
                  path:
                    definition
                      .summaryMemoryPath,

                  operator:
                    "truthy",
                },
              ],
            },

            toStageId:
              stage.id,

            actionId:
              definition
                .choiceActionId,

            priority:
              10,
          });
        }

        const actionGuidance:
          Record<
            string,
            string
          > = {
          [definition
            .summaryActionId]:
            definition
              .summaryGuidance,
        };

        if (
          stage.detailEnabled &&
          definition.detailActionId &&
          definition.detailGuidance
        ) {
          actionGuidance[
            definition
              .detailActionId
          ] =
            definition
              .detailGuidance;
        }

        if (
          stage.detailEnabled &&
          definition
            .detailFollowupActionId &&
          definition
            .detailFollowupGuidance
        ) {
          actionGuidance[
            definition
              .detailFollowupActionId
          ] =
            definition
              .detailFollowupGuidance;
        }

        if (
          definition
            .choiceActionId &&
          definition
            .choiceGuidance
        ) {
          actionGuidance[
            definition
              .choiceActionId
          ] =
            definition
              .choiceGuidance;
        }

        if (
          stage.detailEnabled &&
          definition
            .choiceAfterDetailActionId &&
          definition
            .choiceAfterDetailGuidance
        ) {
          actionGuidance[
            definition
              .choiceAfterDetailActionId
          ] =
            definition
              .choiceAfterDetailGuidance;
        }

        const choiceGuidance =
          [
            stage.detailEnabled &&
            definition.detailLabel
              ? definition.detailLabel
              : null,

            nextStageId
              ? `다음 단계: ${
                  LEAD_FLOW_STAGE_DEFINITIONS[
                    nextStageId
                  ].label
                }`
              : null,
          ].filter(
            (
              value
            ): value is string =>
              Boolean(
                value
              )
          );

        const builtStage:
          Record<
            string,
            unknown
          > = {
          id:
            stage.id,

          enabled:
            stage.enabled,

          order:
            stage.order,

          defaultActionId:
            definition
              .summaryActionId,

          transitions,

          contentKeys:
            definition
              .contentKeys,

          metadata: {
            label:
              definition.label,

            purpose:
              definition.purpose,

            detailEnabled:
              stage.detailEnabled,

            actionGuidance,

            choiceGuidance,
          },
        };

        if (
          stage.enabled &&
          !nextStageId
        ) {
          builtStage.completeWhen = {
            mode:
              "all",

            conditions: [
              {
                path:
                  definition
                    .summaryMemoryPath,

                operator:
                  "truthy",
              },
            ],
          };
        }

        return builtStage;
      }
    );

  builtStages.push({
    id:
      "COMPLETED",

    enabled:
      true,

    order:
      10000,

    defaultActionId:
      null,

    transitions:
      [],

    contentKeys:
      [],

    metadata: {
      label:
        "상담 기본 흐름 완료",

      purpose:
        "신규상담 기본 Flow가 완료된 상태다.",
    },
  });

  return {
    version:
      2,

    enabled:
      activeStages.length >
      0,

    startStageId:
      activeStages[0]
        ?.id ??
      null,

    completedStageId:
      "COMPLETED",

    stages:
      builtStages,

    metadata: {
      flowName:
        "EduCanvas Lead Consultation V2",

      builderVersion:
  2,

      behavior:
        "question_first_then_flow",

      repeatPrevention:
        true,
    },
  };
}

export default function KakaoAISettings() {
  const utils = trpc.useUtils();

  const [form, setForm] =
    useState<KakaoAiSettingsForm>(
      DEFAULT_FORM
    );

  const [initialized, setInitialized] =
    useState(false);

const [
  leadFlowStages,
  setLeadFlowStages,
] = useState<
  LeadFlowBuilderStage[]
>(
  createDefaultLeadFlowStages()
);

const [
  activeManagementTab,
  setActiveManagementTab,
] = useState<
  "aiSettings" | "staffRecommendation"
>("aiSettings");

const [
  staffTeamPageForm,
  setStaffTeamPageForm,
] = useState<StaffTeamPageForm>(
  DEFAULT_STAFF_TEAM_PAGE_FORM
);

const [
  staffTeamPageInitialized,
  setStaffTeamPageInitialized,
] = useState(false);

  /**
   * Webhook 원본 Token은 서버가 DB에 저장하지 않는다.
   *
   * regenerateWebhookToken 호출 직후에만
   * 이 화면에서 URL을 표시한다.
   */
  const [
    generatedWebhookPath,
    setGeneratedWebhookPath,
  ] = useState("");

  const [
    generatedWebhookUrl,
    setGeneratedWebhookUrl,
  ] = useState("");

  const settingsQuery =
    trpc.kakaoAi.settings.get.useQuery(
      undefined,
      {
        refetchOnWindowFocus: false,
      }
    );

const staffTeamPageQuery =
  trpc.staffProfile.teamPage.get.useQuery(
    undefined,
    {
      refetchOnWindowFocus: false,
    }
  );

const staffRecommendationManagementQuery =
  trpc.staffProfile.management.list.useQuery(
    undefined,
    {
      refetchOnWindowFocus: false,

      enabled:
        activeManagementTab ===
        "staffRecommendation",
    }
  );

  const updateMutation =
    trpc.kakaoAi.settings.update.useMutation({
      onSuccess: async () => {
        toast.success(
          "카카오 AI 설정을 저장했습니다."
        );

        await utils.kakaoAi.settings.get.invalidate();
      },

      onError: (error) => {
        toast.error(
          error.message ||
            "카카오 AI 설정 저장에 실패했습니다."
        );
      },
    });

const staffTeamPageUpdateMutation =
  trpc.staffProfile.teamPage.update.useMutation({
    onSuccess: async () => {
      toast.success(
        "담당자 소개 페이지 설정을 저장했습니다."
      );

      await utils.staffProfile.teamPage.get.invalidate();
    },

    onError: (error) => {
      toast.error(
        error.message ||
          "담당자 소개 페이지 설정 저장에 실패했습니다."
      );
    },
  });

const staffRecommendationUpdateMutation =
  trpc.staffProfile.management.update.useMutation({
    onSuccess: async () => {
      toast.success(
        "담당자 추천 설정을 변경했습니다."
      );

      await utils.staffProfile.management.list.invalidate();
    },

    onError: (error) => {
      toast.error(
        error.message ||
          "담당자 추천 설정 변경에 실패했습니다."
      );
    },
  });

  const regenerateWebhookTokenMutation =
    trpc.kakaoAi.settings
      .regenerateWebhookToken
      .useMutation({
        onSuccess: (data) => {
          const webhookPath =
            String(
              data.webhookPath || ""
            ).trim();

          setGeneratedWebhookPath(
            webhookPath
          );

          /**
           * 현재 CRM 도메인과 API 도메인이
           * 동일하게 노출되는 구조라면
           * origin + path가 최종 Skill URL이 된다.
           */
          const webhookUrl =
            webhookPath &&
            typeof window !==
              "undefined"
              ? `${window.location.origin}${webhookPath}`
              : webhookPath;

          setGeneratedWebhookUrl(
            webhookUrl
          );

          toast.success(
            "카카오 Webhook URL을 새로 발급했습니다."
          );
        },

        onError: (error) => {
          toast.error(
            error.message ||
              "카카오 Webhook URL 발급에 실패했습니다."
          );
        },
      });

  useEffect(() => {
    if (
      !settingsQuery.data ||
      initialized
    ) {
      return;
    }

    const data = settingsQuery.data;

setLeadFlowStages(
  normalizeLeadFlowBuilderStages(
    data.leadFlowConfig
  )
);

    setForm({
      enabled:
        data.enabled === true,

      newConsultationEnabled:
        data.newConsultationEnabled === true,

      registeredStudentEnabled:
        data.registeredStudentEnabled === true,

      ocrEnabled:
        data.ocrEnabled === true,

      practiceSupportEnabled:
        data.practiceSupportEnabled === true,

      assigneeRecommendationEnabled:
        data.assigneeRecommendationEnabled ===
        true,

      aiDisplayName:
        String(
          data.aiDisplayName ||
            "EduCanvas AI"
        ),

      welcomeMessage:
        String(
          data.welcomeMessage || ""
        ),

      defaultGuideMessage:
        String(
          data.defaultGuideMessage || ""
        ),

      consultationHoursMessage:
        String(
          data.consultationHoursMessage || ""
        ),

companyIntroduction:
  String(
    data.companyIntroduction || ""
  ),

companyBenefits:
  String(
    data.companyBenefits || ""
  ),

salesPoints:
  String(
    data.salesPoints || ""
  ),

registeredAiBenefits:
  String(
    data.registeredAiBenefits || ""
  ),

classManagementPolicy:
  String(
    data.classManagementPolicy || ""
  ),

practicePolicy:
  String(
    data.practicePolicy || ""
  ),

administrativeSupportPolicy:
  String(
    data.administrativeSupportPolicy || ""
  ),

consultationPolicy:
  String(
    data.consultationPolicy || ""
  ),

            priceDisclosureEnabled:
        data.priceDisclosureEnabled === true,

priceGuide:
  String(
    data.priceGuide || ""
  ),

      kakaoBotId:
        String(
          data.kakaoBotId || ""
        ),
    });

    setInitialized(true);
  }, [
    settingsQuery.data,
    initialized,
  ]);

useEffect(() => {
  if (
    !staffTeamPageQuery.data ||
    staffTeamPageInitialized
  ) {
    return;
  }

  const data =
    staffTeamPageQuery.data;

  setStaffTeamPageForm({
    enabled:
      data.enabled === true,

    title:
      String(
        data.title || ""
      ),

    description:
      String(
        data.description || ""
      ),

    staffSectionTitle:
      String(
        data.staffSectionTitle || ""
      ),

    staffSectionDescription:
      String(
        data.staffSectionDescription || ""
      ),

    footerIntroduction:
      String(
        data.footerIntroduction || ""
      ),
  });

  setStaffTeamPageInitialized(
    true
  );
}, [
  staffTeamPageQuery.data,
  staffTeamPageInitialized,
]);

const staffTeamPageOrganizationId =
  Number(
    staffTeamPageQuery.data
      ?.organizationId ||
      0
  );

const staffTeamPageUrl =
  staffTeamPageOrganizationId > 0 &&
  typeof window !== "undefined"
    ? `${window.location.origin}/team/${staffTeamPageOrganizationId}`
    : "";

  const setBooleanField = (
    field:
      | "enabled"
      | "newConsultationEnabled"
      | "registeredStudentEnabled"
      | "ocrEnabled"
      | "practiceSupportEnabled"
      | "assigneeRecommendationEnabled"
      | "priceDisclosureEnabled",
    value: boolean
  ) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

const handleLeadFlowEnabledChange =
  (
    stageId:
      LeadFlowBuilderStageId,

    enabled:
      boolean
  ) => {
    setLeadFlowStages(
      previous =>
        previous.map(
          stage =>
            stage.id ===
            stageId
              ? {
                  ...stage,
                  enabled,
                }
              : stage
        )
    );
  };

const handleLeadFlowDetailChange =
  (
    stageId:
      LeadFlowBuilderStageId,

    detailEnabled:
      boolean
  ) => {
    if (
      !LEAD_FLOW_STAGE_DEFINITIONS[
        stageId
      ].detailMemoryPath
    ) {
      return;
    }

    setLeadFlowStages(
      previous =>
        previous.map(
          stage =>
            stage.id ===
            stageId
              ? {
                  ...stage,
                  detailEnabled,
                }
              : stage
        )
    );
  };

const handleMoveLeadFlowStage =
  (
    stageId:
      LeadFlowBuilderStageId,

    direction:
      "up" |
      "down"
  ) => {
    setLeadFlowStages(
      previous => {
        const ordered =
          [
            ...previous,
          ].sort(
            (
              left,
              right
            ) =>
              left.order -
              right.order
          );

        const currentIndex =
          ordered.findIndex(
            stage =>
              stage.id ===
              stageId
          );

        if (
          currentIndex <
          0
        ) {
          return previous;
        }

        const targetIndex =
          direction ===
          "up"
            ? currentIndex -
              1
            : currentIndex +
              1;

        if (
          targetIndex <
            0 ||
          targetIndex >=
            ordered.length
        ) {
          return previous;
        }

        const current =
          ordered[
            currentIndex
          ];

        ordered[
          currentIndex
        ] =
          ordered[
            targetIndex
          ];

        ordered[
          targetIndex
        ] =
          current;

        return ordered.map(
          (
            stage,
            index
          ) => ({
            ...stage,

            order:
              (
                index +
                1
              ) *
              10,
          })
        );
      }
    );
  };

const handleResetLeadFlow =
  () => {
    setLeadFlowStages(
      createDefaultLeadFlowStages()
    );

    toast.success(
      "신규상담 기본 흐름으로 초기화했습니다. 설정 저장을 눌러야 실제 반영됩니다."
    );
  };

  const handleSave = () => {
    const aiDisplayName =
      form.aiDisplayName.trim();

    if (!aiDisplayName) {
      toast.error(
        "AI 표시 이름을 입력해주세요."
      );
      return;
    }

    if (aiDisplayName.length > 100) {
      toast.error(
        "AI 표시 이름은 100자를 초과할 수 없습니다."
      );
      return;
    }

const leadFlowConfig =
  buildLeadFlowConfig(
    leadFlowStages
  );

    const kakaoBotId =
      form.kakaoBotId.trim();

    if (
      kakaoBotId.length >
      191
    ) {
      toast.error(
        "카카오 Bot ID는 191자를 초과할 수 없습니다."
      );

      return;
    }

    updateMutation.mutate({
      enabled: form.enabled,

      newConsultationEnabled:
        form.newConsultationEnabled,

      registeredStudentEnabled:
        form.registeredStudentEnabled,

      ocrEnabled:
        form.ocrEnabled,

      practiceSupportEnabled:
        form.practiceSupportEnabled,

      assigneeRecommendationEnabled:
        form.assigneeRecommendationEnabled,

      aiDisplayName,

      welcomeMessage:
        form.welcomeMessage.trim() ||
        null,

      defaultGuideMessage:
        form.defaultGuideMessage.trim() ||
        null,

      consultationHoursMessage:
        form.consultationHoursMessage.trim() ||
        null,

companyIntroduction:
  form.companyIntroduction.trim() ||
  null,

companyBenefits:
  form.companyBenefits.trim() ||
  null,

salesPoints:
  form.salesPoints.trim() ||
  null,

registeredAiBenefits:
  form.registeredAiBenefits.trim() ||
  null,

classManagementPolicy:
  form.classManagementPolicy.trim() ||
  null,

practicePolicy:
  form.practicePolicy.trim() ||
  null,

administrativeSupportPolicy:
  form.administrativeSupportPolicy.trim() ||
  null,

consultationPolicy:
  form.consultationPolicy.trim() ||
  null,

leadFlowConfig,

            priceDisclosureEnabled:
        form.priceDisclosureEnabled,

priceGuide:
  form.priceGuide.trim() ||
  null,

      kakaoBotId:
        kakaoBotId ||
        null,
    });
  };

const handleSaveStaffTeamPage =
  () => {
    staffTeamPageUpdateMutation.mutate({
      enabled:
        staffTeamPageForm.enabled,

      title:
        staffTeamPageForm.title.trim() ||
        null,

      description:
        staffTeamPageForm.description.trim() ||
        null,

      staffSectionTitle:
        staffTeamPageForm.staffSectionTitle.trim() ||
        null,

      staffSectionDescription:
        staffTeamPageForm.staffSectionDescription.trim() ||
        null,

      footerIntroduction:
        staffTeamPageForm.footerIntroduction.trim() ||
        null,
    });
  };

const handleCopyStaffTeamPageUrl =
  async () => {
    if (!staffTeamPageUrl) {
      toast.error(
        "담당자 소개 페이지 링크를 확인할 수 없습니다."
      );

      return;
    }

    try {
      await navigator.clipboard.writeText(
        staffTeamPageUrl
      );

      toast.success(
        "담당자 소개 페이지 링크를 복사했습니다."
      );
    } catch {
      toast.error(
        "링크 복사에 실패했습니다."
      );
    }
  };

const handleUpdateStaffRecommendation =
  (
    userId: number,

    values: {
      recommendationEnabled?:
        boolean;

      showOnTeamPage?:
        boolean;

      recommendationPriority?:
        number;

      sortOrder?:
        number;
    }
  ) => {
    staffRecommendationUpdateMutation.mutate({
      userId,
      ...values,
    });
  };

const getRecommendationPriorityLabel =
  (
    priority: number
  ) => {
    if (priority >= 20) {
      return "최우선";
    }

    if (priority >= 10) {
      return "우선";
    }

    return "기본";
  };

const getRecommendationPriorityValue =
  (
    label:
      | "기본"
      | "우선"
      | "최우선"
  ) => {
    if (label === "최우선") {
      return 20;
    }

    if (label === "우선") {
      return 10;
    }

    return 0;
  };

const staffRecommendationRows =
  Array.isArray(
    staffRecommendationManagementQuery.data
  )
    ? staffRecommendationManagementQuery.data
    : [];

  const handleCopyWebhookUrl =
    async () => {
      const webhookUrl =
        generatedWebhookUrl.trim();

      if (
        !webhookUrl
      ) {
        toast.error(
          "먼저 Webhook URL을 발급해주세요."
        );

        return;
      }

      try {
        await navigator.clipboard.writeText(
          webhookUrl
        );

        toast.success(
          "Webhook URL을 복사했습니다."
        );
      } catch {
        toast.error(
          "Webhook URL 복사에 실패했습니다."
        );
      }
    };

  if (settingsQuery.isLoading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>
            카카오 AI 설정을 불러오는 중입니다.
          </span>
        </div>
      </div>
    );
  }

  if (settingsQuery.isError) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <Card>
          <CardHeader>
            <CardTitle>
              카카오 AI 설정을 불러올 수 없습니다.
            </CardTitle>

            <CardDescription>
              {settingsQuery.error.message}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                settingsQuery.refetch();
              }}
            >
              다시 시도
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <MessageCircle className="h-6 w-6" />

            <h1 className="text-2xl font-bold tracking-tight">
              카카오 AI
            </h1>
          </div>

          <p className="mt-2 text-sm text-muted-foreground">
            카카오톡 고객 상담에 사용할
            회사별 AI 운영 정책을 설정합니다.
          </p>
        </div>

        {activeManagementTab ===
"aiSettings" ? (
  <Button
    type="button"
    onClick={handleSave}
    disabled={
      updateMutation.isPending
    }
  >
    {updateMutation.isPending ? (
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
    ) : (
      <Save className="mr-2 h-4 w-4" />
    )}

    설정 저장
  </Button>
) : (
  <Button
    type="button"
    onClick={
      handleSaveStaffTeamPage
    }
    disabled={
      staffTeamPageUpdateMutation.isPending
    }
  >
    {staffTeamPageUpdateMutation.isPending ? (
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
    ) : (
      <Save className="mr-2 h-4 w-4" />
    )}

    담당자 페이지 저장
  </Button>
)}
</div>

{/* 카카오 AI 관리 탭 */}
<div className="flex flex-wrap items-center gap-2">
  <Button
    type="button"
    variant={
      activeManagementTab ===
      "aiSettings"
        ? "default"
        : "outline"
    }
    className="rounded-xl"
    onClick={() => {
      setActiveManagementTab(
        "aiSettings"
      );
    }}
  >
    <Bot className="mr-2 h-4 w-4" />
    카카오 AI 설정
  </Button>

  <Button
    type="button"
    variant={
      activeManagementTab ===
      "staffRecommendation"
        ? "default"
        : "outline"
    }
    className="rounded-xl"
    onClick={() => {
      setActiveManagementTab(
        "staffRecommendation"
      );
    }}
  >
    <UserRoundSearch className="mr-2 h-4 w-4" />
    담당자 추천 관리
  </Button>
</div>

<div
  className={
    activeManagementTab ===
    "aiSettings"
      ? "contents"
      : "hidden"
  }
>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            카카오 AI 운영
          </CardTitle>

          <CardDescription>
            회사의 카카오 AI 고객 상담을
            실제로 운영할지 설정합니다.
          </CardDescription>
        </CardHeader>

                <CardContent className="space-y-6">
          <SettingSwitch
            title="카카오 AI 운영"
            description={
              form.enabled
                ? "카카오 AI 운영이 활성화되어 있습니다."
                : "현재 카카오 AI 운영이 중지되어 있습니다."
            }
            checked={form.enabled}
            onCheckedChange={(value) =>
              setBooleanField(
                "enabled",
                value
              )
            }
          />

          <div className="border-t pt-6">
            <div className="mb-4">
              <p className="text-sm font-medium">
                카카오 채널 연결
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                현재 회사에서 사용할 카카오 챗봇의 Bot ID와
                Skill Webhook URL을 설정합니다.
              </p>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="kakaoBotId">
                  카카오 Bot ID
                </Label>

                <Input
                  id="kakaoBotId"
                  value={
                    form.kakaoBotId
                  }
                  maxLength={191}
                  placeholder="카카오 챗봇 관리자센터의 Bot ID를 입력하세요."
                  onChange={(event) =>
                    setForm(
                      (prev) => ({
                        ...prev,

                        kakaoBotId:
                          event
                            .target
                            .value,
                      })
                    )
                  }
                />

                <p className="text-xs text-muted-foreground">
                  카카오 챗봇 관리자센터에서 확인한
                  해당 회사 챗봇의 Bot ID를 입력합니다.
                  다른 회사 Bot ID와 공유하지 않습니다.
                </p>
              </div>

              <div className="space-y-2">
                <Label>
                  Skill Webhook URL
                </Label>

                <div className="flex flex-col gap-2 md:flex-row">
                  <Input
                    value={
                      generatedWebhookUrl
                    }
                    readOnly
                    placeholder="아직 Webhook URL이 발급되지 않았습니다."
                    className="font-mono text-xs"
                  />

                  <Button
                    type="button"
                    variant="outline"
                    onClick={
                      handleCopyWebhookUrl
                    }
                    disabled={
                      !generatedWebhookUrl
                    }
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    복사
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    disabled={
                      regenerateWebhookTokenMutation
                        .isPending
                    }
                    onClick={() => {
                      regenerateWebhookTokenMutation
                        .mutate();
                    }}
                  >
                    {regenerateWebhookTokenMutation
                      .isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}

                    {generatedWebhookUrl
                      ? "URL 재발급"
                      : "URL 발급"}
                  </Button>
                </div>

                <p className="text-xs leading-5 text-muted-foreground">
                  이 URL을 카카오 챗봇 관리자센터의
                  Skill URL에 등록합니다.
                  URL을 재발급하면 기존 URL은 즉시 사용할 수 없습니다.
                </p>
              </div>

              <div className="rounded-md border bg-muted/30 p-4">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">
                      Bot ID
                    </span>

                    <span className="font-medium">
                      {form.kakaoBotId.trim()
                        ? "등록됨"
                        : "미등록"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">
                      Webhook URL
                    </span>

                    <span className="font-medium">
                      {generatedWebhookPath
                        ? "발급됨"
                        : "현재 화면에서 미발급"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              상담 대상
            </CardTitle>

            <CardDescription>
              AI가 어떤 고객의 상담을
              담당할지 설정합니다.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <SettingSwitch
              icon={
                <MessageCircle className="h-5 w-5" />
              }
              title="신규 고객 상담"
              description="상담DB에 아직 등록되지 않은 신규 고객의 문의를 AI가 상담합니다."
              checked={
                form.newConsultationEnabled
              }
              onCheckedChange={(value) =>
                setBooleanField(
                  "newConsultationEnabled",
                  value
                )
              }
            />

            <SettingSwitch
              icon={
                <Users className="h-5 w-5" />
              }
              title="기존 등록자 상담"
              description="인증된 기존 학생의 학기, 플랜, 일정 및 행정 관련 상담을 지원합니다."
              checked={
                form.registeredStudentEnabled
              }
              onCheckedChange={(value) =>
                setBooleanField(
                  "registeredStudentEnabled",
                  value
                )
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              AI 기능
            </CardTitle>

            <CardDescription>
              카카오 상담에서 사용할
              세부 AI 기능을 설정합니다.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <SettingSwitch
              icon={
                <FileScan className="h-5 w-5" />
              }
              title="이미지 · OCR 분석"
              description="고객이 전송한 이미지와 서류를 AI가 분석할 수 있도록 허용합니다."
              checked={form.ocrEnabled}
              onCheckedChange={(value) =>
                setBooleanField(
                  "ocrEnabled",
                  value
                )
              }
            />

            <SettingSwitch
              icon={
                <GraduationCap className="h-5 w-5" />
              }
              title="실습 지원"
              description="실습배정지원센터 데이터를 활용한 실습 안내 및 추천 기능을 사용합니다."
              checked={
                form.practiceSupportEnabled
              }
              onCheckedChange={(value) =>
                setBooleanField(
                  "practiceSupportEnabled",
                  value
                )
              }
            />

            <SettingSwitch
              icon={
                <UserRoundSearch className="h-5 w-5" />
              }
              title="담당자 추천"
              description="신규 고객에게 회사 소속 상담 담당자를 선택하거나 추천할 수 있도록 합니다."
              checked={
                form.assigneeRecommendationEnabled
              }
              onCheckedChange={(value) =>
                setBooleanField(
                  "assigneeRecommendationEnabled",
                  value
                )
              }
            />

            <SettingSwitch
              icon={
                <WalletCards className="h-5 w-5" />
              }
              title="비용 안내"
              description="카카오 AI가 회사에서 등록한 비용 및 수강료 정보를 고객에게 안내할 수 있도록 허용합니다."
              checked={
                form.priceDisclosureEnabled
              }
              onCheckedChange={(value) =>
                setBooleanField(
                  "priceDisclosureEnabled",
                  value
                )
              }
            />

{form.priceDisclosureEnabled && (
  <div className="space-y-2 rounded-lg border p-4">
    <Label htmlFor="priceGuide">
      비용 및 할인 안내 기준
    </Label>

    <Textarea
      id="priceGuide"
      value={form.priceGuide}
      maxLength={10000}
      rows={8}
      placeholder={
        "카카오 AI가 고객에게 안내할 실제 비용 및 할인 기준을 입력하세요.\n\n예: 정확한 수강료는 과정, 개강반, 과목 구성 및 적용 가능한 할인에 따라 달라질 수 있습니다. 공개 가능한 기본 비용이나 할인 기준이 있다면 함께 입력해주세요."
      }
      onChange={(event) =>
        setForm((prev) => ({
          ...prev,
          priceGuide:
            event.target.value,
        }))
      }
    />

    <div className="text-right text-xs text-muted-foreground">
      {form.priceGuide.length}
      /10000
    </div>

    <p className="text-xs text-muted-foreground">
      AI는 이곳에 입력된 가격 및 할인 정보를
      기준으로만 비용을 안내합니다.
      입력되지 않은 금액이나 할인율은 임의로
      생성하지 않습니다.
    </p>
  </div>
)}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            AI 기본 정보
          </CardTitle>

          <CardDescription>
            고객에게 표시되는 AI 이름과
            기본 상담 문구를 설정합니다.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="aiDisplayName">
              AI 표시 이름
            </Label>

            <Input
              id="aiDisplayName"
              value={form.aiDisplayName}
              maxLength={100}
              placeholder="EduCanvas AI"
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  aiDisplayName:
                    event.target.value,
                }))
              }
            />

            <p className="text-xs text-muted-foreground">
              카카오톡 상담에서 고객에게
              표시할 AI 이름입니다.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="welcomeMessage">
              첫 인사말
            </Label>

            <Textarea
              id="welcomeMessage"
              value={form.welcomeMessage}
              maxLength={5000}
              rows={5}
              placeholder="고객이 처음 상담을 시작했을 때 보여줄 인사말을 입력하세요."
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  welcomeMessage:
                    event.target.value,
                }))
              }
            />

            <div className="text-right text-xs text-muted-foreground">
              {form.welcomeMessage.length}
              /5000
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="defaultGuideMessage">
              기본 상담 안내
            </Label>

            <Textarea
              id="defaultGuideMessage"
              value={
                form.defaultGuideMessage
              }
              maxLength={10000}
              rows={7}
              placeholder="모든 고객 상담에 공통으로 적용할 회사의 기본 안내 내용을 입력하세요."
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  defaultGuideMessage:
                    event.target.value,
                }))
              }
            />

            <div className="text-right text-xs text-muted-foreground">
              {
                form.defaultGuideMessage
                  .length
              }
              /10000
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="consultationHoursMessage">
              상담 가능 시간 안내
            </Label>

            <Textarea
              id="consultationHoursMessage"
              value={
                form.consultationHoursMessage
              }
              maxLength={5000}
              rows={4}
              placeholder="담당자 상담 가능 시간 또는 운영시간 안내를 입력하세요."
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  consultationHoursMessage:
                    event.target.value,
                }))
              }
            />

            <div className="text-right text-xs text-muted-foreground">
              {
                form
                  .consultationHoursMessage
                  .length
              }
              /5000
            </div>
          </div>
        </CardContent>
      </Card>

<Card>
  <CardHeader>
    <CardTitle>
      회사 상담 정보
    </CardTitle>

    <CardDescription>
      카카오 AI가 고객에게 안내할
      회사 공통 정책과 상담 기준을 설정합니다.
    </CardDescription>
  </CardHeader>

  <CardContent className="space-y-6">
    <div className="space-y-2">
      <Label htmlFor="companyIntroduction">
        회사 소개
      </Label>

      <Textarea
        id="companyIntroduction"
        value={form.companyIntroduction}
        maxLength={10000}
        rows={6}
        placeholder="회사가 어떤 서비스를 제공하는지, 어떤 방식으로 고객을 관리하는지 입력하세요."
        onChange={(event) =>
          setForm((prev) => ({
            ...prev,
            companyIntroduction:
              event.target.value,
          }))
        }
      />

      <div className="text-right text-xs text-muted-foreground">
        {form.companyIntroduction.length}/10000
      </div>
    </div>

    <div className="space-y-2">
      <Label htmlFor="companyBenefits">
        회사 공통 혜택
      </Label>

      <Textarea
        id="companyBenefits"
        value={form.companyBenefits}
        maxLength={10000}
        rows={6}
        placeholder="1:1 학습관리, 일정관리, 실습지원 등 회사가 공통으로 제공하는 혜택을 입력하세요."
        onChange={(event) =>
          setForm((prev) => ({
            ...prev,
            companyBenefits:
              event.target.value,
          }))
        }
      />

      <div className="text-right text-xs text-muted-foreground">
        {form.companyBenefits.length}/10000
      </div>
    </div>

<div className="space-y-2">
  <Label htmlFor="salesPoints">
    상담 강조 포인트
  </Label>

  <Textarea
    id="salesPoints"
    value={form.salesPoints}
    maxLength={10000}
    rows={7}
    placeholder="상담 중 고객의 관심사에 맞춰 AI가 자연스럽게 강조할 회사의 강점과 등록 포인트를 입력하세요. 답변 문구를 작성하는 곳이 아니라 AI가 참고할 사실을 입력합니다. AI는 매 답변마다 반복하지 않고 관련성이 있을 때만 자연스럽게 활용합니다."
    onChange={(event) =>
      setForm((prev) => ({
        ...prev,
        salesPoints:
          event.target.value,
      }))
    }
  />

  <div className="text-right text-xs text-muted-foreground">
    {form.salesPoints.length}/10000
  </div>
</div>

<div className="space-y-2">
  <Label htmlFor="registeredAiBenefits">
    등록회원 AI · 학습관리 혜택
  </Label>

  <Textarea
    id="registeredAiBenefits"
    value={form.registeredAiBenefits}
    maxLength={10000}
    rows={7}
    placeholder="등록 후 이용할 수 있는 개인 학습관리, 학점·과목 조회, 위험도 분석, 행정절차 지원, 실습배정지원센터 조회, 자격증 신청 지원, 취업컨설팅 등 실제 제공하는 혜택을 입력하세요. AI는 신규 고객에게 등록 전후의 차이를 설명할 때 이 정보를 활용합니다."
    onChange={(event) =>
      setForm((prev) => ({
        ...prev,
        registeredAiBenefits:
          event.target.value,
      }))
    }
  />

  <div className="text-right text-xs text-muted-foreground">
    {form.registeredAiBenefits.length}/10000
  </div>
</div>

    <div className="space-y-2">
      <Label htmlFor="classManagementPolicy">
  이론수업 안내
</Label>

      <Textarea
        id="classManagementPolicy"
        value={form.classManagementPolicy}
        maxLength={10000}
        rows={6}
        placeholder="온라인 이론수업 진행방법, 모바일/PC 이용, 출석, 시험, 과제, 토론, 퀴즈 등 고객에게 안내할 실제 수업 내용을 입력하세요. AI는 이 내용을 그대로 복사하지 않고 고객 질문과 대화 맥락에 맞게 자연스럽게 설명합니다."
        onChange={(event) =>
          setForm((prev) => ({
            ...prev,
            classManagementPolicy:
              event.target.value,
          }))
        }
      />

      <div className="text-right text-xs text-muted-foreground">
        {form.classManagementPolicy.length}/10000
      </div>
    </div>

    <div className="space-y-2">
      <Label htmlFor="practicePolicy">
  실습 안내
</Label>

      <Textarea
        id="practicePolicy"
        value={form.practicePolicy}
        maxLength={10000}
        rows={6}
        placeholder="실습 진행방법과 회사의 실습 지원방식, 실습배정지원센터 운영 내용 등 고객에게 안내할 실제 내용을 입력하세요. AI는 고객 질문과 대화 맥락에 맞게 자연스럽게 설명하며, 신규 고객에게 실제 실습기관 내역은 제공하지 않습니다."
        onChange={(event) =>
          setForm((prev) => ({
            ...prev,
            practicePolicy:
              event.target.value,
          }))
        }
      />

      <div className="text-right text-xs text-muted-foreground">
        {form.practicePolicy.length}/10000
      </div>
    </div>

    <div className="space-y-2">
      <Label htmlFor="administrativeSupportPolicy">
  행정절차 지원 안내
</Label>

      <Textarea
        id="administrativeSupportPolicy"
        value={
          form.administrativeSupportPolicy
        }
        maxLength={10000}
        rows={6}
        placeholder="학습자등록, 학점인정신청, 학위신청, 자격증 신청 등 회사가 등록 회원에게 제공하는 행정절차 지원 범위를 입력하세요. 신규 고객에게는 해당 절차의 존재와 개념까지만 안내됩니다."
        onChange={(event) =>
          setForm((prev) => ({
            ...prev,
            administrativeSupportPolicy:
              event.target.value,
          }))
        }
      />

      <div className="text-right text-xs text-muted-foreground">
        {
          form.administrativeSupportPolicy
            .length
        }
        /10000
      </div>
    </div>

    <div className="space-y-2">
      <Label htmlFor="consultationPolicy">
  AI 내부 상담정책
</Label>

      <Textarea
        id="consultationPolicy"
        value={form.consultationPolicy}
        maxLength={10000}
        rows={8}
        placeholder="AI가 상담할 때 내부적으로 지켜야 할 회사 정책을 입력하세요. 고객에게 이 문구를 그대로 공개하지 않습니다. 예: 없는 혜택을 만들어내지 않기, 등록을 과도하게 반복 유도하지 않기, 확정되지 않은 비용·일정을 단정하지 않기, 필요한 정보가 부족하면 고객에게 질문하기."
        onChange={(event) =>
          setForm((prev) => ({
            ...prev,
            consultationPolicy:
              event.target.value,
          }))
        }
      />

      <div className="text-right text-xs text-muted-foreground">
        {form.consultationPolicy.length}/10000
      </div>
    </div>

<div className="space-y-4 border-t pt-6">
  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <p className="text-sm font-medium">
        신규상담 AI 흐름
      </p>

      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        회사에서 사용할 상담단계를 켜거나 끄고
        진행 순서를 변경할 수 있습니다.
        내부 Flow 코드와 JSON은 자동으로 생성됩니다.
      </p>
    </div>

    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={
        handleResetLeadFlow
      }
    >
      <RefreshCw className="mr-2 h-4 w-4" />
      기본 흐름으로 초기화
    </Button>
  </div>

  <div className="space-y-3">
    {leadFlowStages.map(
      (
        stage,
        index
      ) => {
        const definition =
          LEAD_FLOW_STAGE_DEFINITIONS[
            stage.id
          ];

        const supportsDetail =
          Boolean(
            definition
              .detailMemoryPath
          );

        return (
          <div
            key={stage.id}
            className="rounded-xl border bg-muted/10 p-4"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <Switch
                  checked={
                    stage.enabled
                  }
                  onCheckedChange={(
                    value
                  ) => {
                    handleLeadFlowEnabledChange(
                      stage.id,
                      value
                    );
                  }}
                />

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">
                      {
                        definition.label
                      }
                    </p>

                    <span className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
                      {index + 1}단계
                    </span>

                    {!stage.enabled && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        사용 안 함
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {
                      definition.description
                    }
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={
                    index ===
                    0
                  }
                  onClick={() => {
                    handleMoveLeadFlowStage(
                      stage.id,
                      "up"
                    );
                  }}
                >
                  위로
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={
                    index ===
                    leadFlowStages.length -
                      1
                  }
                  onClick={() => {
                    handleMoveLeadFlowStage(
                      stage.id,
                      "down"
                    );
                  }}
                >
                  아래로
                </Button>
              </div>
            </div>

            {supportsDetail && (
              <div className="mt-4 flex items-center justify-between gap-4 border-t pt-4">
                <div>
                  <p className="text-xs font-medium">
                    {
                      definition
                        .detailLabel
                    }
                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    고객이 자세한 설명을 요청하면
                    현재 단계에서 상세 안내 후
                    기존 상담흐름을 이어갑니다.
                  </p>
                </div>

                <Switch
                  checked={
                    stage.detailEnabled
                  }
                  disabled={
                    !stage.enabled
                  }
                  onCheckedChange={(
                    value
                  ) => {
                    handleLeadFlowDetailChange(
                      stage.id,
                      value
                    );
                  }}
                />
              </div>
            )}
          </div>
        );
      }
    )}
  </div>

  <div className="rounded-lg border bg-muted/20 p-4">
    <p className="text-xs font-medium">
      상담 흐름 동작 방식
    </p>

    <p className="mt-2 text-xs leading-5 text-muted-foreground">
      고객의 현재 질문이 있으면 먼저 답변하고,
      이후 현재 상담단계로 복귀합니다.
      상세 안내가 활성화된 단계에서는
      고객이 자세히 요청할 경우 같은 단계에서
      추가 설명한 뒤 다음 단계로 이어집니다.
      사용하지 않는 단계는 자동으로 건너뜁니다.
    </p>
  </div>
</div>
  </CardContent>
</Card>

      <Card>
        <CardContent className="flex gap-3 pt-6">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />

          <div className="space-y-1">
            <p className="text-sm font-medium">
              회사별 독립 설정
            </p>

            <p className="text-sm text-muted-foreground">
              이 설정은 현재 회사에만
              적용되며 다른 회사의 카카오
              AI 설정에는 영향을 주지
              않습니다.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
  <Button
    type="button"
    size="lg"
    onClick={handleSave}
    disabled={updateMutation.isPending}
  >
    {updateMutation.isPending ? (
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
    ) : (
      <Save className="mr-2 h-4 w-4" />
    )}

    설정 저장
  </Button>
</div>

</div>
<div
  className={
    activeManagementTab ===
    "staffRecommendation"
      ? "space-y-6"
      : "hidden"
  }
>
  {/* 회사 담당자 소개 페이지 */}
  <Card>
    <CardHeader>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            회사 담당자 소개 페이지
          </CardTitle>

          <CardDescription className="mt-2">
            고객에게 공개할 회사 담당자 전체 소개
            페이지를 설정합니다.
          </CardDescription>
        </div>

        <div className="flex items-center gap-3 rounded-lg border bg-muted/20 px-4 py-3">
          <div>
            <p className="text-sm font-medium">
              페이지 공개
            </p>

            <p className="text-xs text-muted-foreground">
              외부 고객이 페이지를 열람할 수 있습니다.
            </p>
          </div>

          <Switch
            checked={
              staffTeamPageForm.enabled
            }
            onCheckedChange={(value) => {
              setStaffTeamPageForm(
                (prev) => ({
                  ...prev,
                  enabled:
                    value,
                })
              );
            }}
          />
        </div>
      </div>
    </CardHeader>

    <CardContent className="space-y-6">
      {/* 공개 링크 */}
      <div className="space-y-2">
        <Label>
          전체 담당자 공개 링크
        </Label>

        <div className="flex flex-col gap-2 md:flex-row">
          <Input
            value={
              staffTeamPageUrl
            }
            readOnly
            placeholder="공개 링크를 확인하는 중입니다."
            className="font-mono text-xs"
          />

          <Button
            type="button"
            variant="outline"
            disabled={
              !staffTeamPageUrl
            }
            onClick={
              handleCopyStaffTeamPageUrl
            }
          >
            <Copy className="mr-2 h-4 w-4" />
            복사
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={
              !staffTeamPageUrl
            }
            onClick={() => {
              if (
                staffTeamPageUrl
              ) {
                window.open(
                  staffTeamPageUrl,
                  "_blank",
                  "noopener,noreferrer"
                );
              }
            }}
          >
            미리보기
          </Button>
        </div>

        <p className="text-xs leading-5 text-muted-foreground">
          회사 소속 담당자 중
          전체페이지 노출을 허용한 담당자만 표시됩니다.
        </p>
      </div>

      <div className="border-t" />

      {/* 페이지 기본 문구 */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="staffTeamPageTitle">
            페이지 메인 제목
          </Label>

          <Input
            id="staffTeamPageTitle"
            value={
              staffTeamPageForm.title
            }
            maxLength={255}
            placeholder='비워두면 "{회사명}과 함께하세요"가 자동 표시됩니다.'
            onChange={(event) => {
              setStaffTeamPageForm(
                (prev) => ({
                  ...prev,

                  title:
                    event.target.value,
                })
              );
            }}
          />

          <p className="text-xs text-muted-foreground">
            직접 입력하지 않으면 회사
            브랜딩 이름을 이용해 자동 생성됩니다.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="staffSectionTitle">
            담당자 영역 제목
          </Label>

          <Input
            id="staffSectionTitle"
            value={
              staffTeamPageForm.staffSectionTitle
            }
            maxLength={255}
            placeholder="예: 함께할 담당자를 소개합니다"
            onChange={(event) => {
              setStaffTeamPageForm(
                (prev) => ({
                  ...prev,

                  staffSectionTitle:
                    event.target.value,
                })
              );
            }}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="staffTeamPageDescription">
          페이지 소개 문구
        </Label>

        <Textarea
          id="staffTeamPageDescription"
          value={
            staffTeamPageForm.description
          }
          maxLength={10000}
          rows={4}
          placeholder="회사 담당자 페이지 상단에서 고객에게 보여줄 소개 문구를 입력하세요."
          onChange={(event) => {
            setStaffTeamPageForm(
              (prev) => ({
                ...prev,

                description:
                  event.target.value,
              })
            );
          }}
        />

        <div className="text-right text-xs text-muted-foreground">
          {
            staffTeamPageForm
              .description.length
          }
          /10000
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="staffSectionDescription">
          담당자 영역 설명
        </Label>

        <Textarea
          id="staffSectionDescription"
          value={
            staffTeamPageForm.staffSectionDescription
          }
          maxLength={10000}
          rows={4}
          placeholder="담당자를 선택하거나 상세 프로필을 확인할 수 있다는 내용을 안내합니다."
          onChange={(event) => {
            setStaffTeamPageForm(
              (prev) => ({
                ...prev,

                staffSectionDescription:
                  event.target.value,
              })
            );
          }}
        />

        <div className="text-right text-xs text-muted-foreground">
          {
            staffTeamPageForm
              .staffSectionDescription
              .length
          }
          /10000
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="footerIntroduction">
          하단 회사 소개
        </Label>

        <Textarea
          id="footerIntroduction"
          value={
            staffTeamPageForm.footerIntroduction
          }
          maxLength={10000}
          rows={6}
          placeholder="담당자 목록 아래에 표시할 회사 소개, 상담 철학, 관리 방식 등을 입력하세요."
          onChange={(event) => {
            setStaffTeamPageForm(
              (prev) => ({
                ...prev,

                footerIntroduction:
                  event.target.value,
              })
            );
          }}
        />

        <div className="text-right text-xs text-muted-foreground">
          {
            staffTeamPageForm
              .footerIntroduction
              .length
          }
          /10000
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={
            handleSaveStaffTeamPage
          }
          disabled={
            staffTeamPageUpdateMutation.isPending
          }
        >
          {staffTeamPageUpdateMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}

          담당자 페이지 설정 저장
        </Button>
      </div>
    </CardContent>
  </Card>

 {/* 추천 담당자 관리 */}
<Card>
  <CardHeader>
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div>
        <CardTitle className="flex items-center gap-2">
          <UserRoundSearch className="h-5 w-5" />
          추천 담당자 관리
        </CardTitle>

        <CardDescription className="mt-2">
          회사 소속 담당자의 AI 추천 여부,
          회사 소개페이지 노출 및 추천 우선도를
          관리합니다.
        </CardDescription>
      </div>

      <div className="rounded-lg border bg-muted/20 px-4 py-2 text-sm">
        <span className="text-muted-foreground">
          전체 담당자
        </span>

        <span className="ml-2 font-semibold">
          {staffRecommendationRows.length}명
        </span>
      </div>
    </div>
  </CardHeader>

  <CardContent>
    {staffRecommendationManagementQuery.isLoading ? (
      <div className="flex min-h-[180px] items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          담당자 목록을 불러오는 중입니다.
        </div>
      </div>
    ) : staffRecommendationManagementQuery.isError ? (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-6 text-center">
        <p className="text-sm font-medium">
          담당자 목록을 불러올 수 없습니다.
        </p>

        <p className="mt-2 text-xs text-muted-foreground">
          {
            staffRecommendationManagementQuery
              .error
              .message
          }
        </p>

        <Button
          type="button"
          variant="outline"
          className="mt-4"
          onClick={() => {
            staffRecommendationManagementQuery.refetch();
          }}
        >
          다시 시도
        </Button>
      </div>
    ) : staffRecommendationRows.length ===
      0 ? (
      <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-10 text-center">
        <Users className="mx-auto h-7 w-7 text-muted-foreground" />

        <p className="mt-3 text-sm font-medium">
          관리할 담당자가 없습니다.
        </p>

        <p className="mt-1 text-xs text-muted-foreground">
          회사에 등록된 활성 담당자가 있으면
          이곳에 표시됩니다.
        </p>
      </div>
    ) : (
      <div className="space-y-4">
        {staffRecommendationRows.map(
          (staff: any) => {
            const userId =
              Number(
                staff.userId ||
                0
              );

            const profileCreated =
              staff.profileCreated ===
              true;

            const recommendationEnabled =
              staff.recommendationEnabled ===
              true;

            const showOnTeamPage =
              staff.showOnTeamPage ===
              true;

            const acceptingNewConsultations =
              staff.acceptingNewConsultations !==
              false;

            const priority =
              Number(
                staff.recommendationPriority ||
                0
              );

            const profileName =
              String(
                staff.displayName ||
                staff.name ||
                staff.username ||
                "이름없음"
              );

            const positionName =
              String(
                staff.publicPositionName ||
                staff.positionName ||
                ""
              ).trim();

            const specialties =
              Array.isArray(
                staff.specialties
              )
                ? staff.specialties
                : [];

            const publicToken =
              String(
                staff.publicToken ||
                ""
              ).trim();

            const publicProfileUrl =
              publicToken &&
              typeof window !==
                "undefined"
                ? `${window.location.origin}/staff/${publicToken}`
                : "";

            return (
              <div
                key={userId}
                className="rounded-2xl border bg-background p-4 md:p-5"
              >
                <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                  {/* 담당자 기본 정보 */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold">
                        {profileName}
                      </p>

                      {positionName ? (
                        <span className="text-sm text-muted-foreground">
                          {positionName}
                        </span>
                      ) : null}

                      <span
                        className={
                          profileCreated
                            ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                            : "rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700"
                        }
                      >
                        {profileCreated
                          ? "프로필 등록 완료"
                          : "프로필 미등록"}
                      </span>

                      <span
                        className={
                          acceptingNewConsultations
                            ? "rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
                            : "rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
                        }
                      >
                        {acceptingNewConsultations
                          ? "신규상담 가능"
                          : "신규상담 중지"}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {staff.teamName ? (
                        <span>
                          팀: {staff.teamName}
                        </span>
                      ) : null}

                      {staff.username ? (
                        <span>
                          계정: {staff.username}
                        </span>
                      ) : null}
                    </div>

                    {specialties.length ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {specialties
                          .slice(0, 8)
                          .map(
                            (
                              specialty: string,
                              index: number
                            ) => (
                              <span
                                key={`${specialty}-${index}`}
                                className="rounded-full border bg-muted/30 px-2.5 py-1 text-[11px]"
                              >
                                {specialty}
                              </span>
                            )
                          )}

                        {specialties.length >
                        8 ? (
                          <span className="rounded-full border px-2.5 py-1 text-[11px] text-muted-foreground">
                            +
                            {specialties.length -
                              8}
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-muted-foreground">
                        등록된 전문 상담 분야가 없습니다.
                      </p>
                    )}
                  </div>

                  {/* 관리 설정 */}
                  <div className="grid shrink-0 gap-4 sm:grid-cols-2 xl:grid-cols-[170px_170px_170px]">
                    <div className="rounded-xl border bg-muted/20 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">
                            AI 추천
                          </p>

                          <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                            카카오 AI 추천 대상
                          </p>
                        </div>

                        <Switch
                          checked={
                            recommendationEnabled
                          }
                          disabled={
                            staffRecommendationUpdateMutation.isPending
                          }
                          onCheckedChange={(
                            value
                          ) => {
                            handleUpdateStaffRecommendation(
                              userId,
                              {
                                recommendationEnabled:
                                  value,
                              }
                            );
                          }}
                        />
                      </div>
                    </div>

                    <div className="rounded-xl border bg-muted/20 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">
                            회사페이지
                          </p>

                          <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                            전체 담당자 페이지 노출
                          </p>
                        </div>

                        <Switch
                          checked={
                            showOnTeamPage
                          }
                          disabled={
                            staffRecommendationUpdateMutation.isPending
                          }
                          onCheckedChange={(
                            value
                          ) => {
                            handleUpdateStaffRecommendation(
                              userId,
                              {
                                showOnTeamPage:
                                  value,
                              }
                            );
                          }}
                        />
                      </div>
                    </div>

                    <div className="rounded-xl border bg-muted/20 p-3">
                      <Label className="text-sm font-medium">
                        추천 우선도
                      </Label>

                      <select
                        value={
                          getRecommendationPriorityLabel(
                            priority
                          )
                        }
                        disabled={
                          staffRecommendationUpdateMutation.isPending
                        }
                        onChange={(
                          event
                        ) => {
                          const label =
                            event
                              .target
                              .value as
                              | "기본"
                              | "우선"
                              | "최우선";

                          handleUpdateStaffRecommendation(
                            userId,
                            {
                              recommendationPriority:
                                getRecommendationPriorityValue(
                                  label
                                ),
                            }
                          );
                        }}
                        className="mt-2 h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="기본">
                          기본
                        </option>

                        <option value="우선">
                          우선
                        </option>

                        <option value="최우선">
                          최우선
                        </option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                  <div className="text-xs text-muted-foreground">
                    추천 우선도:
                    <span className="ml-1 font-medium text-foreground">
                      {getRecommendationPriorityLabel(
                        priority
                      )}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {publicProfileUrl ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          window.open(
                            publicProfileUrl,
                            "_blank",
                            "noopener,noreferrer"
                          );
                        }}
                      >
                        공개 프로필 보기
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled
                      >
                        공개 프로필 없음
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          }
        )}
      </div>
    )}
  </CardContent>
</Card>
</div>
    </div>
  );
}

function SettingSwitch(props: {
  icon?: ReactNode;

  title: string;
  description: string;

  checked: boolean;

  onCheckedChange: (
    value: boolean
  ) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 gap-3">
        {props.icon ? (
          <div className="mt-0.5 shrink-0 text-muted-foreground">
            {props.icon}
          </div>
        ) : null}

        <div className="space-y-1">
          <Label className="text-sm font-medium">
            {props.title}
          </Label>

          <p className="text-sm leading-5 text-muted-foreground">
            {props.description}
          </p>
        </div>
      </div>

      <Switch
        checked={props.checked}
        onCheckedChange={
          props.onCheckedChange
        }
        className="shrink-0"
      />
    </div>
  );
}