import { useEffect, useMemo, useRef, useState } from "react";
import PrivateCertificateSupportDialog from "@/components/PrivateCertificateSupportDialog";
import SocialWelfareNewsSection from "@/components/SocialWelfareNewsSection";
import SocialWelfarePressSection from "@/components/SocialWelfarePressSection";
import SocialWelfareReviewSection from "@/components/SocialWelfareReviewSection";
import SocialWelfareLinksSection from "@/components/SocialWelfareLinksSection";
import SocialWelfareSocialLinks from "@/components/SocialWelfareSocialLinks";
import { trpc } from "@/lib/trpc";
import EmploymentKakaoMap, {
  type EmploymentMapJob,
} from "@/components/EmploymentKakaoMap";

import PracticeKakaoMap, {
  loadKakao as loadPracticeKakao,
} from "@/components/PracticeKakaoMap";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Clock3,
  ExternalLink,
  LocateFixed,
  MapPin,
  Search,
  SlidersHorizontal,
  X,
  Home,
  Wallet,
  GraduationCap,
  FileText,
  CalendarDays,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  ShieldCheck,
  MessageCircle,
     MapPinned,
    HeartHandshake,
  Calculator,
  Sparkles,
} from "lucide-react";


const BANNER = "/images/employment/practice-banner.png";
const PRACTICE_BANNER =
  "/images/employment-center/a_clean_banner_style_image_matching_the_style_left.png";
const PRACTICE_URL = "https://narangedu.liveklass.com/classes/257714";
const COMPANY_IMAGE = "/images/employment/company-default.png";
const HERO_BANNER =
  "/images/employment-center/social-welfare-hero-bg.png";
const JOBS_HERO_BANNER =
  "/images/employment-center/employment-hero-worker.png";

const CENTER_LOGO =
  "/images/employment-center/social-welfare-logo.png";
const CENTER_SYMBOL = "/images/employment-center/social-welfare-symbol-only.png";
const SESSION_KEY = "withone-employment-session";
const SUPPORT_PORTAL_SLUG = "with-one";

const SUPPORT_PORTAL_TOKEN_KEY =
  `student_portal_token:${SUPPORT_PORTAL_SLUG}`;

function readSupportPortalToken(): string {
  try {
    return (
      window.localStorage.getItem(
        SUPPORT_PORTAL_TOKEN_KEY
      ) || ""
    );
  } catch {
    return "";
  }
}

const TRIAL_DEVICE_STORAGE_KEY =
  "student_portal_trial_device:with-one";

function getEmploymentTrialDeviceToken(): string {
  const saved = window.localStorage.getItem(
    TRIAL_DEVICE_STORAGE_KEY
  );

  if (saved && /^[a-f0-9]{64}$/i.test(saved)) {
    return saved;
  }

  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);

  const token = Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");

  window.localStorage.setItem(
    TRIAL_DEVICE_STORAGE_KEY,
    token
  );

  return token;
}

const STUDENT_PORTAL_URL = "https://edu-crm-five.vercel.app/portal/with-one";
type Job = EmploymentMapJob & {
  employmentType?: string;
  registeredAt?: string;
  closesAt?: string;
  detailUrl?: string;
  occupationCode?: string;
  distanceKm?: number;
};

function readSession(): {token:string; expiresAt:number}|null {
  try { const data=JSON.parse(sessionStorage.getItem(SESSION_KEY)||"null"); return data?.token && data.expiresAt>Date.now()?data:null; } catch { return null; }
}
function shortDate(value?: string) { if (!value) return "미정"; const s=String(value); return s.length===8 && /^\d{8}$/.test(s)?`${s.slice(0,4)}.${s.slice(4,6)}.${s.slice(6,8)}`:s; }

type Section =
  | "home"
  | "jobs"
  | "funds"
  | "certificate"
    | "practice"
  | "practiceSupport"
  | "resume"
  | "consultation"
  | "compare"
  | "volunteer"
    | "salary"
  | "careerTest"
  | "benefits";
const SECTION_LABEL: Record<Section,string> = {
  home: "사회복지 통합지원센터", jobs: "일자리 찾기", funds: "지원금 찾기",
  certificate: "자격증 신청 예상일", practice: "실습기관 찾기", resume: "이력서·자기소개서",
  practiceSupport: "실습 배정 신청",
consultation: "사회복지사 2급 상담 신청",
  compare: "학습관리 서비스 비교",
    volunteer: "봉사활동 찾기",
  salary: "급여·호봉 정보",
  careerTest: "사회복지사 진로·성향 테스트",
benefits: "자격증 활용백과",
};
const MAIN_CARDS = [
    {
    key: "practiceSupport" as Section,
    icon: MapPinned,
    title: "실습 배정 신청",
    sub: "실습교육원·실습기관 배정",
    tint: "bg-teal-50 text-teal-600",
  },
  {
    key: "consultation" as Section,
    icon: MessageCircle,
    title: "무료 상담 신청하기",
    sub: "사회복지사 2급 취득 상담",
    tint: "bg-rose-50 text-rose-600",
  },
  {
    key: "benefits" as Section,
    icon: BookOpen,
    title: "자격증 활용백과",
    sub: "추가 자격·교육 단축·창업",
    tint: "bg-indigo-50 text-indigo-600",
  },
  {
    key: "funds" as Section,
    icon: Wallet,
    title: "지원금 찾기",
    sub: "관련 지원제도 확인",
    tint: "bg-amber-50 text-amber-600",
  },
  {
    key: "salary" as Section,
    icon: Calculator,
    title: "급여·호봉 정보",
    sub: "급여표 및 예상 월급 확인",
    tint: "bg-emerald-50 text-emerald-600",
  },
  {
    key: "volunteer" as Section,
    icon: HeartHandshake,
    title: "봉사활동 찾기",
    sub: "나에게 맞는 봉사활동",
    tint: "bg-rose-50 text-rose-600",
  },
    {
    key: "certificate" as Section,
    icon: CalendarDays,
    title: "자격증 신청 예상일",
    sub: "내 상황에 맞춰 확인",
    tint: "bg-indigo-50 text-indigo-600",
  },
];

const STUDENT_CARDS = [
  {
    key: "practice" as Section,
    icon: MapPinned,
    title: "실습기관 찾기",
    sub: "실습기관 조회 및 배정 지원",
    tint: "bg-teal-50 text-teal-600",
  },
  {
    key: "jobs" as Section,
    icon: BriefcaseBusiness,
    title: "일자리 찾기",
    sub: "내 주변 사회복지 채용정보",
    tint: "bg-blue-50 text-blue-600",
  },
  {
    key: "academic" as const,
    icon: ShieldCheck,
    title: "학사관리시스템",
    sub: "개인별 학사일정 및 취득요건",
    tint: "bg-blue-50 text-blue-600",
  },
  {
    key: "privateCertificate" as const,
    icon: GraduationCap,
    title: "취업 연계 자격증",
    sub: "사회복지사 2급 + 추가 자격증",
    tint: "bg-amber-50 text-amber-600",
  },
  {
    key: "resume" as Section,
    icon: FileText,
    title: "이력서·자기소개서",
    sub: "서비스 준비 중입니다",
    tint: "bg-purple-50 text-purple-600",
  },
];

const CARDS = [
  ...MAIN_CARDS,
  ...STUDENT_CARDS.filter(
    (card): card is typeof card & { key: Section } =>
      card.key !== "academic" &&
      card.key !== "privateCertificate"
  ),
  {
    key: "careerTest" as Section,
    icon: Sparkles,
    title: "진로·성향 테스트",
    sub: "나에게 맞는 사회복지 분야",
    tint: "bg-violet-50 text-violet-600",
  },
];
const CONSULTATION_TOKEN = (import.meta.env.VITE_SUPPORT_CONSULTATION_TOKEN || "").trim();
const todayKorea = () => new Intl.DateTimeFormat("en-CA", {timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
function SectionShell({children}: {children:React.ReactNode}) { return <div className="space-y-4 px-4 pb-24 pt-5">{children}</div>; }
function Field({label,children}:{label:string;children:React.ReactNode}) { return <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-700">{label}</span>{children}</label>; }
const inputStyle="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none focus:border-blue-500";


type PreStudyConsultation = {
  finalEducation: string;
  notes: string;
};

function CertificateWizard() {
    type Education =
    | "중졸"
    | "고졸"
    | "중퇴"
    | "2년제"
    | "3년제"
    | "4년제"
    | "대학원";

  type StudyStatus =
    | "none"
    | "yes"
    | "unknown";

  type CreditStatus =
    | "none"
    | "known"
    | "unknown";

  type CompletedSubject = {
    subjectName: string;
    completionYear: number | null;
  };

  const [step, setStep] = useState(0);

const [consultationOpen, setConsultationOpen] =
  useState(false);

const [preStudyPlan, setPreStudyPlan] =
  useState<PreStudyConsultation | null>(null);

  const [education, setEducation] =
    useState<Education | "">("");

  const [previousStudy, setPreviousStudy] =
    useState<StudyStatus>("none");

  const [completedSubjects, setCompletedSubjects] =
    useState<CompletedSubject[]>([]);

  const [hasOtherSubjects, setHasOtherSubjects] =
    useState(false);

  const [creditStatus, setCreditStatus] =
    useState<CreditStatus>("none");

  const [existingCredits, setExistingCredits] =
    useState({
      major: 0,
      liberal: 0,
      general: 0,
    });

  const [startDate, setStartDate] =
    useState(todayKorea);

  const isHighSchool =
    education === "고졸" ||
    education === "중퇴";

  const subjectQuery =
    trpc.socialWorkerGuide.getSubjectOptions.useQuery(
      undefined,
      {
        enabled: step === 2,
        retry: false,
        refetchOnWindowFocus: false,
      }
    );

  const calculation =
    trpc.socialWorkerGuide.calculatePersonal.useMutation();

  const result = calculation.data;

  const educationOptions: {
    value: Education;
    label: string;
  }[] = [
    {
      value: "중졸",
      label: "중학교 졸업 이하",
    },
    {
      value: "고졸",
      label: "고등학교 졸업 (검정고시 포함)",
    },
    {
      value: "2년제",
      label: "2년제 전문대학 졸업",
    },
    {
      value: "3년제",
      label: "3년제 전문대학 졸업",
    },
    {
      value: "4년제",
      label: "4년제 대학교 졸업",
    },
    {
      value: "대학원",
      label: "대학원 졸업",
    },
    {
      value: "중퇴",
      label: "대학교 중퇴",
    },
  ];

  const titles = [
    "최종학력을 선택해 주세요",
    "사회복지사 2급 관련 과목을 수강하신 적이 있으실까요?",
    "이수하신 과목을 선택해 주세요",
    "기존에 취득한 학점이 있으실까요?",
    "언제부터 시작하실 예정인가요?",
    "자격증 신청 예상일",
  ];

    const optionClass =
    "flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left text-sm font-bold text-slate-900 transition-colors hover:border-blue-500 hover:bg-blue-50";

  const nextButtonClass =
    "w-full rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white disabled:opacity-40";

  const selectEducation = (value: Education) => {
    setEducation(value);
    setPreviousStudy("none");
    setCompletedSubjects([]);
    setHasOtherSubjects(false);
    setCreditStatus("none");

    setExistingCredits({
      major: 0,
      liberal: 0,
      general: 0,
    });

    calculation.reset();

    setStep(value === "중졸" ? 0 : 1);
  };

  const selectPreviousStudy = (
    value: StudyStatus
  ) => {
    setPreviousStudy(value);
    setCompletedSubjects([]);
    setHasOtherSubjects(false);

    if (value === "yes") {
      setStep(2);
    } else {
      setStep(isHighSchool ? 3 : 4);
    }
  };

  const toggleSubject = (subjectName: string) => {
    setCompletedSubjects(prev =>
      prev.some(s => s.subjectName === subjectName)
        ? prev.filter(s => s.subjectName !== subjectName)
        : [
            ...prev,
            {
              subjectName,
              completionYear: null,
            },
          ]
    );
  };

  const updateCompletionYear = (
    subjectName: string,
    year: number | null
  ) => {
    setCompletedSubjects(prev =>
      prev.map(subject =>
        subject.subjectName === subjectName
          ? {
              ...subject,
              completionYear: year,
            }
          : subject
      )
    );
  };

  const goBack = () => {
    if (step === 5) {
      calculation.reset();
      setStep(4);
    } else if (step === 4) {
      setStep(
        isHighSchool
          ? 3
          : previousStudy === "yes"
            ? 2
            : 1
      );
    } else if (step === 3) {
      setStep(previousStudy === "yes" ? 2 : 1);
    } else {
      setStep(prev => Math.max(0, prev - 1));
    }
  };

  const calculatePersonal = () => {
    if (!education || education === "중졸") return;

    calculation.reset();

    setStep(5);

    calculation.mutate({
      startDate,
      finalEducation: education,
      previousStudy,
      completedSubjects,
      creditStatus: isHighSchool
        ? creditStatus
        : "none",
      existingCredits:
        isHighSchool && creditStatus === "known"
          ? existingCredits
          : {
              major: 0,
              liberal: 0,
              general: 0,
            },
      hasOtherSubjects,
    });
  };

  const needsDocumentReview =
    previousStudy === "unknown" ||
    creditStatus === "unknown" ||
    hasOtherSubjects ||
    completedSubjects.some(
      subject => subject.completionYear === null
    ) ||
    Boolean(result?.requiresReview);

const openStudyConsultation = () => {
  if (!result || !education || education === "중졸") {
    return;
  }

  const educationLabel =
    educationOptions.find(
      item => item.value === education
    )?.label ?? education;

  const lawLabel =
    result.lawVersion === "old"
      ? "구법"
      : result.lawVersion === "current"
        ? "신법"
        : "확인 필요";

  const previousStudyLabel =
    previousStudy === "yes"
      ? "있음"
      : previousStudy === "unknown"
        ? "잘 모르겠음"
        : "없음";

  const applicationDate =
    result.success &&
    result.expectedApplicationYear &&
    result.expectedApplicationMonth
      ? `${result.expectedApplicationYear}년 ${result.expectedApplicationMonth}월`
      : "개별 확인 필요";

  const subjects =
    completedSubjects.map(subject =>
      `${subject.subjectName}(${
        subject.completionYear ?? "연도 미확인"
      })`
    ).join(", ");

  const creditSummary =
    creditStatus === "known"
      ? `전공 ${existingCredits.major}, 교양 ${existingCredits.liberal}, 일반 ${existingCredits.general}학점`
      : creditStatus === "unknown"
        ? "잘 모르겠음"
        : "없음";

  const semesterSummary =
    result.semesters.map(semester =>
      `${semester.semesterLabel}: ${semester.startDate}~${semester.endDate} (${semester.subjectCount}과목)`
    ).join("\n");

  const planNotes = [
    "[사회복지통합지원센터 사전 학습설계]",
    `시작 예정일: ${startDate}`,
    `적용 기준: ${lawLabel}`,
    `기존 이수 여부: ${previousStudyLabel}`,
    `이수과목: ${subjects || "선택 없음"}`,

    ...(hasOtherSubjects
      ? ["기타 이수과목 있음"]
      : []),

    ...(isHighSchool
      ? [`보유학점: ${creditSummary}`]
      : []),

    `인정 예상과목: ${result.completedSubjectCount}과목`,
    `남은 사회복지 과목: ${result.qualificationRemainingSubjectCount ?? "확인 필요"}`,
    `전체 남은 과목: ${result.remainingSubjectCount ?? "확인 필요"}`,
    `예상 학기: ${result.semesterCount ?? "확인 필요"}`,
    `자격증 신청 예상일: ${applicationDate}`,

    ...(semesterSummary
      ? ["[학기별 일정]", semesterSummary]
      : []),

    ...(needsDocumentReview
      ? ["※ 성적증명서 및 이수내역 확인 필요"]
      : []),

    "※ 회원 입력 기준 예상 설계",
  ].join("\n");

  setPreStudyPlan({
    finalEducation: educationLabel,
    notes: planNotes,
  });

  setConsultationOpen(true);
};

  const renderDocumentGuide = () => (
    <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-black text-amber-900">
        기존 이수내역을 확인해 주세요!
      </p>

      <p className="text-xs leading-6 text-slate-700">
        기존에 이수한 학점이나 과목에 따라
        자격증 취득 기간이 단축될 수 있습니다.
        정확한 학습설계를 위해 성적증명서를
        미리 준비해 주세요.
      </p>

      <div className="rounded-xl bg-white p-3">
        <p className="text-sm font-bold">
          대학교에서 수강하신 경우
        </p>

        <p className="mt-2 text-xs leading-6 text-slate-600">
          카카오톡 → 더보기 → 지갑 →
          전자증명서 → 대학교 성적증명서
        </p>

        <p className="mt-1 text-xs text-slate-500">
          전자증명서 발급 지원 대학에 한하며,
          미지원 대학은 해당 대학에서 발급해 주세요.
        </p>
      </div>

      <div className="rounded-xl bg-white p-3">
        <p className="text-sm font-bold">
          학점은행제로 수강하신 경우
        </p>

        <p className="mt-2 text-xs leading-6 text-slate-600">
          국가평생교육진흥원 학점은행제 홈페이지
          로그인 → MY학적부 → 인정학점 및
          미신청학점내역 확인
        </p>

        <a
          href="https://www.cb.or.kr/"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block rounded-xl bg-slate-100 p-3 text-center text-xs font-bold text-blue-700"
        >
          국가평생교육진흥원 학점은행제 바로가기
        </a>
      </div>
    </div>
  );

  const renderSubjectOptions = (
    title: string,
    subjects: {
      subjectName: string;
      credits: number;
    }[]
  ) => (
    <div className="space-y-2">
      <h3 className="text-sm font-black text-slate-900">
        {title}
      </h3>

      {subjects.map(subject => {
        const selected = completedSubjects.find(
          item => item.subjectName === subject.subjectName
        );

        return (
          <div
            key={subject.subjectName}
            className={`rounded-xl border p-3 ${
              selected
                ? "border-blue-500 bg-blue-50"
                : "border-slate-200 bg-white"
            }`}
          >
            <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold">
              <input
                type="checkbox"
                checked={Boolean(selected)}
                onChange={() =>
                  toggleSubject(subject.subjectName)
                }
                className="h-4 w-4 accent-blue-600"
              />

              <span className="flex-1">
                {subject.subjectName}
              </span>

              <span className="text-xs text-slate-500">
                {subject.credits}학점
              </span>
            </label>

            {selected && (
              <div className="mt-3">
                <select
                  className={inputStyle}
                  value={selected.completionYear ?? ""}
                  onChange={e =>
                    updateCompletionYear(
                      subject.subjectName,
                      e.target.value
                        ? Number(e.target.value)
                        : null
                    )
                  }
                >
                  <option value="">
                    이수연도 선택 / 잘 모르겠어요
                  </option>

                  {Array.from(
                    {
                      length:
                        new Date().getFullYear() - 1949,
                    },
                    (_, index) =>
                      new Date().getFullYear() - index
                  ).map(year => (
                    <option key={year} value={year}>
                      {year}년
                      {year < 2020
                        ? " (2020년 이전)"
                        : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

    return (
    <SectionShell>

      {/* 최초 안내 */}
      {step === 0 && (
        <div className="space-y-3 rounded-2xl border border-blue-100 bg-white p-4">
          <div className="flex items-center gap-2 text-blue-700">
            <ShieldCheck size={19} />

            <span className="text-sm font-black">
              자격증 신청 예상일 안내
            </span>
          </div>

          <p className="text-sm font-bold text-slate-900">
            수업 종료일과 자격증 신청 예상일은 다릅니다.
          </p>

          <p className="text-xs leading-6 text-slate-600">
            최종학력, 기존 이수과목 및 보유학점을
            바탕으로 이론수업, 현장실습, 행정절차를
            모두 포함한 자격증 신청 예상일을 계산합니다.
          </p>
        </div>
      )}

      {/* 진행 단계 */}
      <div className="rounded-2xl bg-blue-50 p-4">
        <p className="text-xs font-bold text-blue-600">
          {step === 5
            ? "개인별 계산 결과"
            : "나에게 맞는 취득 일정 확인"}
        </p>

        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-blue-100">
          <div
            className="h-full bg-blue-600 transition-all"
            style={{
              width: `${((step + 1) / 6) * 100}%`,
            }}
          />
        </div>

        <h2 className="mt-3 text-lg font-black text-slate-900">
          {titles[step]}
        </h2>
      </div>

      {/* 최종학력 */}
      {step === 0 && (
        <div className="grid gap-2">
          {educationOptions.map(item => (
            <button
              key={item.value}
              type="button"
              onClick={() =>
                selectEducation(item.value)
              }
              className={`${optionClass} ${
                education === item.value
                  ? "border-blue-500 bg-blue-50"
                  : ""
              }`}
            >
              {item.label}

              <ChevronRight
                size={18}
                className="text-slate-400"
              />
            </button>
          ))}

          {education === "중졸" && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-black text-amber-900">
                고등학교 졸업 이상의 학력이 필요합니다.
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-700">
                사회복지사 2급은 전문학사 이상의
                학력과 필수 교과목 이수가 필요한
                국가자격증입니다.
                중학교 졸업 이하인 경우 고등학교
                졸업학력 검정고시를 먼저 취득하신 후
                학점은행제 대학과정을 진행하실 수 있습니다.
              </p>
            </div>
          )}
        </div>
      )}

      {/* 기존 사회복지 과목 수강 여부 */}
      {step === 1 && (
        <div className="space-y-3">
          <p className="rounded-xl bg-white p-4 text-xs leading-6 text-slate-600">
            대학교 또는 학점은행제에서
            사회복지사 2급 관련 과목을 수강하셨다면
            기존 이수과목을 인정받아 수강과목과
            취득 기간을 줄일 수 있습니다.
          </p>

          <button
            type="button"
            className={optionClass}
            onClick={() => selectPreviousStudy("yes")}
          >
            네, 수강한 적이 있어요
            <ChevronRight size={18} />
          </button>

          <button
            type="button"
            className={optionClass}
            onClick={() => selectPreviousStudy("none")}
          >
            아니요, 처음 시작해요
            <ChevronRight size={18} />
          </button>

          <button
            type="button"
            className={optionClass}
            onClick={() => selectPreviousStudy("unknown")}
          >
            잘 모르겠어요
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* 기존 이수과목 선택 */}
      {step === 2 && (
        <div className="space-y-4">

          <div className="sticky top-0 z-10 rounded-xl border border-blue-100 bg-blue-50 p-3">
            <p className="text-sm font-bold text-blue-800">
              선택한 과목: {completedSubjects.length}과목
            </p>

            <p className="mt-1 text-xs text-slate-600">
              이수한 과목을 모두 선택하고
              과목별 이수연도를 입력해 주세요.
            </p>
          </div>

          {subjectQuery.isLoading && (
            <p className="p-4 text-sm text-slate-500">
              과목 목록을 불러오고 있습니다...
            </p>
          )}

          {subjectQuery.isError && (
            <div className="rounded-xl bg-red-50 p-4">
              <p className="text-sm text-red-700">
                과목 목록을 불러오지 못했습니다.
              </p>

              <button
                type="button"
                onClick={() => subjectQuery.refetch()}
                className="mt-2 text-sm font-bold text-red-700"
              >
                다시 불러오기
              </button>
            </div>
          )}

          {subjectQuery.data && (
            <>
              {renderSubjectOptions(
                "사회복지사 2급 필수과목",
                subjectQuery.data.requiredSubjects
              )}

              {renderSubjectOptions(
                "사회복지사 2급 선택과목",
                subjectQuery.data.electiveSubjects
              )}
            </>
          )}

          <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm font-bold">
            <input
              type="checkbox"
              checked={hasOtherSubjects}
              onChange={e =>
                setHasOtherSubjects(e.target.checked)
              }
              className="h-4 w-4 accent-blue-600"
            />

            기타 과목 / 목록에 없는 과목
          </label>

          <button
            type="button"
            className={optionClass}
            onClick={() =>
              selectPreviousStudy("unknown")
            }
          >
            어떤 과목을 들었는지 잘 모르겠어요
          </button>

          <button
            type="button"
            className={nextButtonClass}
            disabled={
              completedSubjects.length === 0 &&
              !hasOtherSubjects
            }
            onClick={() =>
              setStep(isHighSchool ? 3 : 4)
            }
          >
            선택 완료
          </button>
        </div>
      )}

      {/* 고졸 및 중퇴자 보유학점 */}
      {step === 3 && (
        <div className="space-y-3">

          <p className="rounded-xl bg-white p-4 text-xs leading-6 text-slate-600">
            대학교 또는 학점은행제에서 취득한
            학점이 있다면 사회복지 전문학사
            학위과정에 활용할 수 있습니다.
          </p>

          <button
            type="button"
            className={optionClass}
            onClick={() => {
              setCreditStatus("known");
            }}
          >
            네, 보유학점이 있어요
            <ChevronRight size={18} />
          </button>

          <button
            type="button"
            className={optionClass}
            onClick={() => {
              setCreditStatus("none");
              setStep(4);
            }}
          >
            아니요, 없어요
            <ChevronRight size={18} />
          </button>

          <button
            type="button"
            className={optionClass}
            onClick={() => {
              setCreditStatus("unknown");
              setStep(4);
            }}
          >
            잘 모르겠어요
            <ChevronRight size={18} />
          </button>

          {creditStatus === "known" && (
            <div className="space-y-3 rounded-2xl border border-blue-100 bg-white p-4">

              <h3 className="text-sm font-black">
                보유학점 입력
              </h3>

              <p className="text-xs leading-6 text-slate-600">
                사회복지 전문학사 과정에서 인정 가능한
                전공·교양·일반 학점을 입력해 주세요.
                앞서 선택한 사회복지 이수과목의 학점도
                포함한 전체 보유학점을 입력해야 합니다.
              </p>

              {([
                ["major", "전공학점"],
                ["liberal", "교양학점"],
                ["general", "일반학점"],
              ] as const).map(([key, label]) => (
                <Field key={key} label={label}>
                  <input
                    type="number"
                    min={0}
                    max={140}
                    step={1}
                    className={inputStyle}
                    value={existingCredits[key]}
                    onChange={e =>
                      setExistingCredits(prev => ({
                        ...prev,
                        [key]: Math.max(
                          0,
                          Math.min(
                            140,
                            Math.floor(
                              Number(e.target.value) || 0
                            )
                          )
                        ),
                      }))
                    }
                  />
                </Field>
              ))}

              <div className="rounded-xl bg-blue-50 p-3 text-sm font-bold text-blue-800">
                총 보유학점: {
                  existingCredits.major +
                  existingCredits.liberal +
                  existingCredits.general
                }학점
              </div>

              <p className="text-xs leading-5 text-amber-700">
                이전 대학의 전공학점이 사회복지 전공으로
                모두 인정되는 것은 아닙니다.
                정확한 학점 구분을 모르신다면
                잘 모르겠어요를 선택해 주세요.
              </p>

              <button
                type="button"
                className={nextButtonClass}
                onClick={() => setStep(4)}
              >
                다음
              </button>
            </div>
          )}
        </div>
      )}

      {/* 시작 예정일 */}
      {step === 4 && (
        <div className="space-y-4">

          {needsDocumentReview &&
            renderDocumentGuide()}

          <Field label="학습 시작 예정일">
            <input
              type="date"
              className={inputStyle}
              value={startDate}
              onChange={e =>
                setStartDate(e.target.value)
              }
            />
          </Field>

          <p className="text-xs leading-5 text-slate-500">
            선택한 날짜는 최단 일정 계산 기준일이며
            실제 교육원 개강일과 다를 수 있습니다.
          </p>

          <button
            type="button"
            className={nextButtonClass}
            disabled={
              !/^\d{4}-\d{2}-\d{2}$/.test(startDate)
            }
            onClick={calculatePersonal}
          >
            자격증 신청 예상일 확인하기
          </button>
        </div>
      )}

      {/* 개인별 계산 결과 */}
      {step === 5 && (
        <div className="space-y-4">

          {calculation.isPending && (
            <div className="rounded-2xl bg-white p-8 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />

              <p className="mt-4 text-sm font-bold">
                개인별 학습설계를 분석하고 있습니다.
              </p>

              <p className="mt-2 text-xs text-slate-500">
                이수과목, 학위요건, 학기별 일정 및
                행정절차를 계산하고 있습니다.
              </p>
            </div>
          )}

          {calculation.isError && (
            <div className="rounded-xl bg-red-50 p-4">
              <p className="text-sm font-bold text-red-700">
                예상일 계산에 실패했습니다.
              </p>

              <p className="mt-2 text-xs text-red-600">
                입력하신 과목과 학점을 다시 확인해 주세요.
              </p>

              <button
                type="button"
                className="mt-3 text-sm font-bold text-red-700"
                onClick={goBack}
              >
                이전 단계로 돌아가기
              </button>
            </div>
          )}

          {result && (
            <>
              <div className="rounded-2xl border border-blue-100 bg-white p-5">

                <p className="text-xs font-bold text-blue-600">
                  한국사회복지사협회 기준
                </p>

                <h3 className="mt-2 text-sm font-bold">
                  사회복지사 2급 자격증 신청 예상일
                </h3>

                <p className="mt-3 text-3xl font-black text-blue-700">
                  {result.success &&
                  result.expectedApplicationYear &&
                  result.expectedApplicationMonth
                    ? `${result.expectedApplicationYear}년 ${result.expectedApplicationMonth}월`
                    : "개별 학습설계 필요"}
                </p>

                <p className="mt-2 text-xs text-slate-500">
                  이론수업 · 현장실습 · 행정절차 포함
                </p>

                <div className="mt-5 space-y-3 border-t border-slate-100 pt-4">

                  {[
                    [
                      "최종학력",
                      educationOptions.find(
                        item => item.value === education
                      )?.label ?? education,
                    ],
                    [
                      "적용 기준",
                      result.lawVersion === "old"
                        ? "2020년 이전 구법"
                        : result.lawVersion === "current"
                          ? "2020년 이후 신법"
                          : "별도 확인 필요",
                    ],
                    [
                      "기존 이수과목",
                      `${result.completedSubjectCount}과목`,
                    ],
                    [
                      "남은 사회복지 과목",
                      result.qualificationRemainingSubjectCount !== null
                        ? `${result.qualificationRemainingSubjectCount}과목`
                        : "확인 필요",
                    ],
                    [
                      "전체 남은 수강과목",
                      result.remainingSubjectCount !== null
                        ? `${result.remainingSubjectCount}과목`
                        : "확인 필요",
                    ],
                    [
                      "예상 수강학기",
                      result.semesterCount !== null
                        ? `${result.semesterCount}학기`
                        : "확인 필요",
                    ],
                    [
                      "학위 취득",
                      result.requiresDegree
                        ? "사회복지 전문학사 과정 포함"
                        : "기존 학위 활용",
                    ],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="text-slate-500">
                        {label}
                      </span>

                      <span className="text-right font-bold text-slate-900">
                        {value}
                      </span>
                    </div>
                  ))}

                </div>

                {!result.lawConfirmed && (
                  <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                    기존 과목의 이수연도 및 인정 여부에
                    따라 적용 법규가 달라질 수 있습니다.
                  </p>
                )}
              </div>

              {/* 학기별 수강 일정 */}
              {result.semesters.length > 0 && (
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">

                  <h3 className="text-sm font-black">
                    학기별 예상 수강일정
                  </h3>

                  {result.semesters.map(
                    (semester, index) => (
                      <div
                        key={`${semester.semesterLabel}-${index}`}
                        className="rounded-xl bg-slate-50 p-3"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-bold">
                            {index + 1}번째 수강학기
                          </p>

                          <p className="text-sm font-bold text-blue-700">
                            {semester.subjectCount}과목
                          </p>
                        </div>

                        <p className="mt-1 text-xs text-slate-500">
                          {semester.semesterLabel}
                          {" · "}
                          {semester.credits}학점
                        </p>

                        <p className="mt-2 text-xs font-semibold text-slate-700">
                          {semester.startDate ?? "미정"}
                          {" ~ "}
                          {semester.endDate ?? "미정"}
                        </p>
                      </div>
                    )
                  )}
                </div>
              )}

              {/* 성적증명서 안내 */}
              {needsDocumentReview &&
                renderDocumentGuide()}

              {/* 필수 주의사항 */}
              <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">

                <div className="flex items-center gap-2 text-amber-900">
                  <ShieldCheck size={21} />

                  <h3 className="text-sm font-black">
                    반드시 확인해 주세요!
                  </h3>
                </div>

                <p className="text-sm leading-6 text-slate-700">
                  안내된 예상일은 학점은행제 제도 및
                  한국사회복지사협회 자격증 신청 기준에 따라
                  이론수업, 현장실습, 행정절차 등
                  모든 과정이 누락 없이 정상적으로
                  완료되는 경우를 기준으로 산정한 일정입니다.
                </p>

                <p className="text-sm leading-6 text-slate-700">
                  단순히 교육과정을 시작한다고 해서
                  해당 시기에 자격증 신청이
                  보장되는 것은 아닙니다.
                </p>

                <p className="text-sm leading-6 text-slate-700">
                  학습설계 오류, 과목 누락, 실습 지연,
                  행정절차 미신청 등이 발생하면
                  자격증 신청 시기가 늦어질 수 있습니다.
                </p>

                <p className="text-sm font-black leading-6 text-amber-900">
                  빠른 시작만큼 중요한 것은
                  정확한 학습설계와 누락 없는 학사관리입니다.
                </p>

                <p className="text-xs leading-6 text-slate-600">
                  교육과정을 선택하기 전 본인의 취득요건과
                  전체 학사일정, 학사관리 체계를
                  반드시 확인하시기 바랍니다.
                  실제 개강일과 실습 선이수 조건은
                  별도로 확인해야 합니다.
                </p>
              </div>

              {/* 1급 응시 안내 유지 */}
              {(education === "4년제" ||
                education === "대학원") && (
                <div className="rounded-xl border border-slate-200 bg-white p-4">

                  <p className="text-sm font-bold">
                    사회복지사 1급 국가시험 안내
                  </p>

                  <p className="mt-2 text-xs leading-6 text-slate-600">
                    학사학위 이상 소지자는 사회복지사 2급
                    관련 교과목 이수 및 국가시험 응시요건을
                    충족하면 사회복지사 1급 시험에
                    응시할 수 있습니다.
                    정확한 응시 가능 여부는 해당 연도
                    시행계획을 확인해야 합니다.
                  </p>
                </div>
              )}

              {/* 상담 신청 */}
              <div className="space-y-3 rounded-2xl border border-blue-100 bg-white p-5">

                <h3 className="text-base font-black text-slate-900">
                  나에게 맞는 정확한 학습설계가 필요하신가요?
                </h3>

                <p className="text-xs leading-6 text-slate-600">
                  기존 이수과목과 보유학점을 확인하여
                  개인별 취득요건과 누락 없는
                  학습설계를 안내해 드립니다.
                </p>

                <button
  type="button"
  onClick={openStudyConsultation}
  className="min-h-[54px] w-full rounded-xl bg-[#2458cc] px-4 py-3 text-[15px] font-bold text-white transition-colors hover:bg-[#1d4bb5]"
>
  나에게 맞는 취득 과정 안내받기
</button>

                <a
                  href="/social-worker-guide"
                  className="block rounded-xl border border-blue-200 py-3 text-center text-sm font-bold text-blue-700"
                >
                  사회복지사 2급 취득 가이드 확인
                </a>
              </div>
            </>
          )}
        </div>
      )}

      {/* 이전 질문 */}
      {step > 0 && (
        <button
          type="button"
          onClick={goBack}
          disabled={calculation.isPending}
          className="flex items-center gap-1 text-sm font-semibold text-slate-500 disabled:opacity-40"
        >
          <ChevronLeft size={16} />
          이전 단계
        </button>
      )}

          <Dialog
        open={consultationOpen}
        onOpenChange={setConsultationOpen}
      >
        <DialogContent
  className="!block !gap-0 max-h-[94dvh] w-[calc(100%_-_24px)] max-w-[460px] overflow-x-hidden overflow-y-auto overscroll-contain rounded-[24px] border border-[#5478ad] !bg-[#0c2043] !p-0 !text-white shadow-[0_24px_80px_rgba(0,0,0,0.4)]"
  style={{
    backgroundColor: "#0c2043",
    color: "#ffffff",
    colorScheme: "light",
  }}
>
          <DialogHeader className="sr-only">
            <DialogTitle>
              사회복지사 2급 취득과정 상담
            </DialogTitle>

            <DialogDescription>
              개인별 자격증 신청 예상일을 바탕으로
              정확한 취득과정을 안내합니다.
            </DialogDescription>
          </DialogHeader>

          {consultationOpen && preStudyPlan && (
            <ConsultationForm
              preStudyPlan={preStudyPlan}
              dialogMode
            />
          )}
        </DialogContent>
      </Dialog>

    </SectionShell>
  );
}


function FundServiceDetail({
  serviceId,
  fallback,
}: {
  serviceId: string;
  fallback: any;
}) {
  const detailQuery = trpc.gov24.detail.useQuery(
    { serviceId },
    {
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  const conditionsQuery = trpc.gov24.conditions.useQuery(
    { serviceId },
    {
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  const item = detailQuery.data || fallback;

  const getText = (key: string) => {
    const detailValue = String(
      item?.[key] ?? ""
    ).trim();

    const fallbackValue = String(
      fallback?.[key] ?? ""
    ).trim();

    return detailValue || fallbackValue ||
      "공식 상세 안내에서 확인 필요";
  };

  const officialUrl = String(
    item?.상세조회URL ||
    fallback?.상세조회URL ||
    ""
  );

  const validUrl = /^https:\/\//i.test(officialUrl);

  const conditions = conditionsQuery.data || [];

  return (
    <div className="mt-3 space-y-4 border-t border-slate-100 pt-4 text-xs leading-6 text-slate-700">

      {(detailQuery.isLoading ||
        conditionsQuery.isLoading) && (
        <p className="rounded-xl bg-blue-50 p-3 text-blue-700">
          정부24 상세정보와 지원조건을 불러오고 있습니다...
        </p>
      )}

      {detailQuery.isError && (
        <p className="rounded-xl bg-amber-50 p-3 text-amber-800">
          상세정보 조회에 실패하여 목록에 제공된
          정보를 표시합니다.
        </p>
      )}

      {[
        ["지원 대상", "지원대상"],
        ["선정 기준", "선정기준"],
        ["지원 내용 및 금액", "지원내용"],
        ["신청 방법", "신청방법"],
        ["신청 기한", "신청기한"],
        ["담당 기관", "소관기관명"],
      ].map(([label, field]) => (
        <div
          key={field}
          className="rounded-xl bg-slate-50 p-3"
        >
          <p className="font-black text-slate-900">
            {label}
          </p>
          <p className="mt-1 whitespace-pre-wrap">
            {getText(field)}
          </p>
        </div>
      ))}

      <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
        <p className="font-black text-blue-800">
          정부24 지원조건 상세
        </p>

        {conditionsQuery.isError ? (
          <p className="mt-2 text-amber-800">
            지원조건 조회에 실패했습니다.
            공식 안내에서 확인해주세요.
          </p>
        ) : conditionsQuery.isLoading ? (
          <p className="mt-2 text-slate-600">
            지원조건 조회 중...
          </p>
        ) : conditions.length === 0 ? (
          <p className="mt-2 text-slate-600">
            별도로 제공된 지원조건 데이터가 없습니다.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {conditions.map((condition: any, index: number) => {
              const entries = Object.entries(condition)
                .filter(([key, value]) =>
                  key !== "서비스ID" &&
                  value !== null &&
                  value !== undefined &&
                  String(value).trim() !== ""
                );

              return (
                <div
                  key={index}
                  className="rounded-lg bg-white p-3"
                >
                  {entries.map(([key, value]) => (
                    <div key={key} className="mb-2 last:mb-0">
                      <b className="text-slate-800">{key}</b>
                      <p className="whitespace-pre-wrap break-words text-slate-600">
                        {String(value)}
                      </p>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-xl bg-amber-50 p-3 text-amber-900">
        지원대상과 선정기준은 공식 자료를 참고한
        안내입니다. 실제 신청 가능 여부와 지급액은
        담당기관 심사 결과에 따라 달라질 수 있습니다.
      </div>

      {validUrl && (
        <a
          href={officialUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-xl bg-blue-600 px-4 py-3 text-center font-bold text-white"
        >
          공식 상세 안내 확인 ↗
        </a>
      )}
    </div>
  );
}

type FundAmountInfo = {
  headline: string;
  period: string;
  note: string;
  evidence: string;
};

function analyzeFundAmount(item: any): FundAmountInfo {
  const content = String(item?.지원내용 ?? "")
    .replace(/\s+/g, " ")
    .trim();

  const unknown: FundAmountInfo = {
    headline: "지원 금액 별도 확인",
    period: "공식 지원내용 확인 필요",
    note: "지원 금액이 명시되지 않았거나 자동 분석이 어려운 사업입니다.",
    evidence: "",
  };

  if (!content) return unknown;

  const amountPattern =
    /(\d[\d,]*(?:\.\d+)?)\s*(억\s*원|만\s*원|천\s*원|원)/g;

  type AmountCandidate = {
    amount: string;
    value: number;
    period: string;
    context: string;
    priority: number;
  };

  const candidates: AmountCandidate[] = [];

  for (const match of content.matchAll(amountPattern)) {
    const raw = match[0];
    const number = Number(match[1].replace(/,/g, ""));
    const unit = match[2].replace(/\s/g, "");

    const multiplier: Record<string, number> = {
      억원: 100000000,
      만원: 10000,
      천원: 1000,
      원: 1,
    };

    const value = number * (multiplier[unit] ?? 1);

    if (!Number.isFinite(value) || value <= 0) {
      continue;
    }

    const index = match.index ?? 0;
    const before = content.slice(Math.max(0, index - 32), index);
    const after = content.slice(index + raw.length, index + raw.length + 32);
    const context = `${before}${raw}${after}`.trim();

    // 지원금이 아닌 비용이나 예시 금액은 자동 표시하지 않음
    if (
      /(?:본인부담|자부담|수강료|등록금|참가비|신청비|수수료|대출금리|소득기준|중위소득|매출액|보증금|임차보증금)/.test(
        context
      )
    ) {
      continue;
    }

    // 명시적 지급 상한이 있는 경우만 최대액으로 인식
    const maximum =
      /(?:최대|상한|한도|최고)\s*(?:월|매월|연|연간|연 최대|총|총액|1인당|인당)?\s*$/.test(
        before
      );

    const month =
  /(?:월|매월|월별)\s*(?:(?:최대|상한|한도|최고)\s*)?$/.test(before);

const year =
  /(?:연|연간|연별)\s*(?:(?:최대|상한|한도|최고)\s*)?$/.test(before);

    const total =
      /(?:총|총액|총 최대|총 지원|일시금|일시 지급)\s*$/.test(
        before
      );

    const monthlyAfter = /^\s*\/\s*월/.test(after);
    const yearlyAfter = /^\s*\/\s*년/.test(after);

    let period = "지급 주기 확인 필요";

    if (month || monthlyAfter) {
      period = "월 기준";
    } else if (year || yearlyAfter) {
      period = "연 기준";
    } else if (total) {
      period = "총액 또는 일시 지급 기준";
    }

    // 지원금 지급과 관련된 표현이 있는 경우만 후보로 채택
    const supportContext =
      /지원|지급|수당|장려금|보조금|급여|바우처|이용권|혜택/.test(
        context
      );

    if (!maximum && !supportContext) {
      continue;
    }

    candidates.push({
      amount: `${match[1]}${unit}`,
      value,
      period,
      context,
      priority: maximum ? 2 : 1,
    });
  }

  if (candidates.length === 0) {
    return unknown;
  }

  // 여러 금액을 합산하거나 서로 다른 지급 주기를 비교하지 않음
  if (candidates.length !== 1) {
    return {
      headline: "지원 금액 상세 확인",
      period: "지급 기준 별도 확인",
      note: "여러 금액 또는 지급 기준이 있어 자동으로 최대 지원액을 확정하지 않았습니다.",
      evidence: "",
    };
  }

  
const selected = candidates[0];
const isMaximum = selected.priority === 2;

return {
  headline: isMaximum
    ? `최대 ${selected.amount}`
    : `지원내용 명시 금액 ${selected.amount}`,
  period: selected.period,
  note: isMaximum
    ? "공개 지원내용에 명시된 상한액입니다. 개인별 지급액은 다를 수 있습니다."
    : "공개 지원내용에서 확인된 금액입니다. 지급액·지급조건 및 실제 수령 가능 여부는 상세 안내를 확인해야 합니다.",
  evidence: selected.context,
};
}


function FundWizard() {
  const [step, setStep] = useState(0);
  const [category, setCategory] = useState("전체");
  const [region, setRegion] = useState("");
  const [district, setDistrict] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [employment, setEmployment] = useState("");
  const [education, setEducation] = useState("");
  const [household, setHousehold] = useState("");
  const [income, setIncome] = useState("");
  const [welfare, setWelfare] = useState("");
  const [special, setSpecial] = useState<string[]>([]);
  const [currentSupport, setCurrentSupport] = useState("");
  const [keyword, setKeyword] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();
  const age = birthYear
    ? currentYear - Number(birthYear)
    : null;

  const searchTerm =
    keyword.trim() ||
    (category === "전체" ? "지원" : category);

  const categoryMap: Record<string,
  "전체" | "취업·구직" | "교육·훈련" | "청년" | "생활·복지"
> = {
  "전체": "전체",
  "취업": "취업·구직",
  "교육": "교육·훈련",
  "청년": "청년",
  "복지": "생활·복지",
};


const fundProfile = {
  region,
  district,
  birthYear,
  employment,
  education,
  household,
  income,
  welfare,
  special,
  currentSupport,
};

const query = trpc.gov24.recommend.useQuery(
  {
    page: 1,
perPage: 10,
    keyword: keyword.trim() || undefined,
    category: categoryMap[category] || "전체",
    profile: fundProfile,
  },
  {
    enabled: step === 10,
    refetchOnWindowFocus: false,
    retry: false,
  }
);

const rankedFunds = query.data?.data ?? [];
const recommendedCount = rankedFunds.length;



  const titles = [
    "어떤 지원을 찾으시나요?",
    "어디에 거주하시나요?",
    "출생연도를 알려주세요",
    "현재 경제활동 상태는?",
    "최종학력은 어떻게 되시나요?",
    "가구원은 몇 명인가요?",
    "월평균 가구소득은 어느 정도인가요?",
    "복지 대상에 해당하시나요?",
    "추가로 해당하는 상황이 있나요?",
    "현재 받고 있는 지원이 있나요?",
    "맞춤 지원제도 검색 결과",
  ];

  const optionClass =
    "flex min-h-12 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-bold text-slate-800 hover:border-amber-400";

  const next = () =>
    setStep(v => Math.min(10, v + 1));

  const choices = (
    options: string[],
    value: string,
    onChoose: (v: string) => void
  ) => (
    <div className="grid gap-2">
      {options.map(v => (
        <button
          key={v}
          type="button"
          className={`${optionClass} ${
            value === v
              ? "border-amber-500 bg-amber-50"
              : ""
          }`}
          onClick={() => {
            onChoose(v);
            next();
          }}
        >
          {v}
          <ChevronRight
            size={17}
            className="text-slate-400"
          />
        </button>
      ))}
    </div>
  );

  const safeUrl = (v: unknown) =>
    typeof v === "string" &&
    /^https:\/\//i.test(v)
      ? v
      : "";

  const details = (item: any, key: string) =>
    String(item?.[key] ?? "").trim();

  const summary = [
    region + (district ? ` ${district}` : ""),
    age !== null ? `${age}세(연도 기준)` : "",
    employment,
    household === "7명 이상"
  ? "7명 이상 가구"
  : `${household}인 가구`,
    welfare,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <SectionShell>
      {/* 진행 단계 */}
      <div className="rounded-2xl bg-amber-50 p-4">
        <p className="text-xs font-bold text-amber-700">
          {step === 10
            ? "검색 결과"
            : `질문 ${step + 1} / 10`}
        </p>

        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-amber-100">
          <div
            className="h-full bg-amber-500 transition-all"
            style={{
              width: `${Math.min(
                100,
                (step + 1) * 10
              )}%`,
            }}
          />
        </div>

        <h2 className="mt-3 text-lg font-black text-slate-900">
          {titles[step]}
        </h2>

        <p className="mt-1 text-xs text-slate-500">
          입력한 정보를 바탕으로 지원사업의 관련성을 비교합니다.
실제 지원 자격은 공식 선정기준을 확인해야 합니다.
        </p>
      </div>

      {/* 1단계: 지원 분야 */}
      {step === 0 &&
        choices(
          ["취업", "교육", "청년", "복지", "전체"],
          category,
          setCategory
        )}

      {/* 2단계: 거주지역 */}
      {step === 1 && (
        <div className="space-y-3">
          <Field label="시·도">
            <select
              className={inputStyle}
              value={region}
              onChange={e => setRegion(e.target.value)}
            >
              <option value="">지역 선택</option>
              {[
                "서울", "경기", "인천", "부산",
                "대구", "대전", "광주", "울산",
                "세종", "강원", "충북", "충남",
                "전북", "전남", "경북", "경남",
                "제주",
              ].map(v => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </Field>

          <Field label="시·군·구 (선택)">
            <input
              className={inputStyle}
              value={district}
              onChange={e => setDistrict(e.target.value)}
              placeholder="예: 도봉구"
            />
          </Field>

          <button
            type="button"
            className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white disabled:opacity-40"
            disabled={!region}
            onClick={next}
          >
            다음
          </button>
        </div>
      )}

      {/* 3단계: 출생연도 */}
      {step === 2 && (
        <div className="space-y-3">
          <Field label="출생연도">
            <input
              className={inputStyle}
              type="number"
              min="1900"
              max={currentYear}
              value={birthYear}
              onChange={e => setBirthYear(e.target.value)}
              placeholder="예: 1997"
            />
          </Field>

          <p className="text-xs text-slate-500">
            정확한 만 나이는 생일에 따라 달라질 수 있어요.
            최종 자격은 공식 안내를 확인해주세요.
          </p>

          <button
            type="button"
            className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white disabled:opacity-40"
            disabled={
              !/^\d{4}$/.test(birthYear) ||
              Number(birthYear) < 1900 ||
              Number(birthYear) > currentYear
            }
            onClick={next}
          >
            다음
          </button>
        </div>
      )}

      {/* 4단계: 경제활동 */}
      {step === 3 &&
        choices(
          [
            "구직 중·실업",
            "재직 중",
            "프리랜서",
            "자영업",
            "학생·취업준비",
            "경력단절·재취업",
            "기타",
          ],
          employment,
          setEmployment
        )}

      {/* 5단계: 최종학력 */}
      {step === 4 &&
        choices(
          [
            "고졸 이하",
            "전문대 졸업",
            "대학교 졸업",
            "대학원 졸업",
            "대학교 재학·휴학·중퇴",
            "기타",
          ],
          education,
          setEducation
        )}

      {/* 6단계: 가구원 수 */}
      {step === 5 &&
        choices(
          ["1", "2", "3", "4", "5", "6", "7명 이상"],
          household,
          setHousehold
        )}

      {/* 7단계: 가구소득 */}
      {step === 6 &&
        choices(
          [
            "100만원 미만",
            "100~199만원",
            "200~299만원",
            "300~399만원",
            "400~499만원",
            "500~699만원",
            "700만원 이상",
            "잘 모르겠어요",
          ],
          income,
          setIncome
        )}

      {/* 8단계: 복지 대상 */}
      {step === 7 &&
        choices(
          [
            "기초생활수급자",
            "차상위계층",
            "한부모가족 지원대상",
            "해당 없음",
            "잘 모르겠어요",
          ],
          welfare,
          setWelfare
        )}

      {/* 9단계: 추가 조건 */}
      {step === 8 && (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            해당하는 항목을 모두 선택하세요.
            없으면 바로 다음으로 진행하세요.
          </p>

          {[
            "장애인",
            "국가보훈대상",
            "장기실업",
            "경력단절",
            "다자녀",
            "무주택",
            "기타",
          ].map(v => (
            <label
              key={v}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold"
            >
              <input
                type="checkbox"
                checked={special.includes(v)}
                onChange={e =>
                  setSpecial(p =>
                    e.target.checked
                      ? [...p, v]
                      : p.filter(x => x !== v)
                  )
                }
              />
              {v}
            </label>
          ))}

          <button
            type="button"
            className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white"
            onClick={next}
          >
            다음
          </button>
        </div>
      )}

      {/* 10단계: 기존 지원 */}
      {step === 9 &&
        choices(
          [
            "현재 지원받는 제도 없음",
            "국민취업지원제도",
            "국민내일배움카드",
            "기타 지원제도 이용 중",
            "잘 모르겠어요",
          ],
          currentSupport,
          setCurrentSupport
        )}

      {/* 지원금 검색 결과 */}
      {step === 10 && (
        <div className="space-y-3">

{query.isSuccess && (
  <div className="rounded-2xl border border-blue-100 bg-white p-4">
    <p className="text-xs font-bold text-slate-500">
      정부24 지원사업 검색 결과
    </p>

    <p className="mt-2 text-2xl font-black text-slate-900">
      {recommendedCount}건
    </p>

    <p className="mt-2 text-xs leading-5 text-slate-600">
     입력하신 거주지역과 개인 조건을 기준으로
관련성이 높은 지원사업을 최대 10건 선별했습니다.
실제 지원 가능 여부는 공식 공고를 확인해 주세요.
    </p>

    <p className="mt-1 text-xs text-amber-700">
      추천 순위는 공개 자료의 키워드 관련성 기준입니다.
실제 신청 자격, 소득 기준, 제외 조건 및 지급액은
공식 공고와 담당기관 심사를 통해 확인해야 합니다.
    </p>
  </div>
)}

          <div className="rounded-xl bg-white p-4 text-xs leading-6 text-slate-700">
            <b className="text-slate-900">
              입력한 검색 조건
            </b>

            <p>{summary}</p>

            <p>
              가구소득: {income} · 학력: {education} ·
              기존 지원: {currentSupport}
            </p>

            {special.length > 0 && (
              <p>
                추가 조건: {special.join(", ")}
              </p>
            )}

            <p className="mt-2 text-amber-700">
              아래 목록은 검색 결과에 포함된 지원사업을
입력 조건과 비교하여 정렬한 참고 목록입니다.
              입력 조건만으로 수급 자격이 확정되지 않으며,
              지역·연령·소득·중복 수급 조건은
              상세 심사가 필요합니다.
            </p>
          </div>

          <Field label="지원사업 검색어">
            <input
              className={inputStyle}
              value={keyword}
              onChange={e => {
  setKeyword(e.target.value);
  setExpanded(null);
}}
              placeholder={`현재 검색어: ${searchTerm}`}
            />
          </Field>

          {query.isLoading && (
            <p className="text-sm text-slate-600">
              정부 지원사업을 검색하고 있습니다...
            </p>
          )}

          {query.isError && (
            <p className="text-sm text-red-600">
              지원사업 조회에 실패했습니다.
              잠시 후 다시 시도해주세요.
            </p>
          )}

          
{rankedFunds.map(({ item, match, applicationPeriod }) => {
  const id = String(item.서비스ID);
  const open = expanded === id;
  const amountInfo = analyzeFundAmount(item);

  return (

              <article
                key={id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                
<div className="space-y-2">
  <p
  className={`text-xs font-black ${
    match.status === "related"
      ? "text-blue-700"
      : "text-amber-700"
  }`}
>
  {match.status === "related"
    ? "입력 조건과 관련성 높음"
    : "지원 조건 추가 확인 필요"}
</p>

  {match.matched.length > 0 && (
    <div className="rounded-xl bg-blue-50 p-3">
      <p className="text-xs font-bold text-blue-800">
        일치하는 관련 문구
      </p>

      {match.matched.map((message, index) => (
        <p
          key={index}
          className="mt-1 text-xs leading-5 text-blue-700"
        >
          • {message}
        </p>
      ))}
    </div>
  )}

  {match.warnings.length > 0 && (
    <div className="rounded-xl bg-amber-50 p-3">
      <p className="text-xs font-bold text-amber-800">
        추가 확인할 조건
      </p>

      {match.warnings.map((message, index) => (
        <p
          key={index}
          className="mt-1 text-xs leading-5 text-amber-800"
        >
          • {message}
        </p>
      ))}
    </div>
  )}
</div>


                <h3 className="mt-1 text-base font-black text-slate-900">
                  {item.서비스명}
                </h3>


<div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
  <div className="flex flex-wrap items-center justify-between gap-2">
    <p className="text-xs font-bold text-slate-700">
      신청기간 안내
    </p>

    <span
      className={`rounded-full px-2.5 py-1 text-xs font-bold ${
        applicationPeriod.status === "within_period"
          ? "bg-green-100 text-green-800"
          : applicationPeriod.status === "upcoming"
            ? "bg-blue-100 text-blue-800"
            : applicationPeriod.status === "ended"
              ? "bg-slate-200 text-slate-700"
              : applicationPeriod.status === "ongoing"
                ? "bg-teal-100 text-teal-800"
                : "bg-amber-100 text-amber-800"
      }`}
    >
      {applicationPeriod.label}
    </span>
  </div>

  {applicationPeriod.startDate &&
    applicationPeriod.endDate && (
      <p className="mt-2 text-sm font-bold text-slate-900">
        {applicationPeriod.startDate}
        {" ~ "}
        {applicationPeriod.endDate}
      </p>
    )}

  <p className="mt-2 text-xs leading-5 text-slate-600">
    {applicationPeriod.description}
  </p>

  {applicationPeriod.originalText && (
    <div className="mt-3 border-t border-slate-200 pt-3">
      <p className="text-xs font-bold text-slate-700">
        정부24 신청기한 원문
      </p>

      <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-slate-600">
        {applicationPeriod.originalText}
      </p>
    </div>
  )}
</div>


                
<div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
  <p className="text-xs font-bold text-blue-700">
    공개 지원내용 기준
  </p>

  <p className="mt-2 text-xl font-black text-blue-900">
    {amountInfo.headline}
  </p>

  <p className="mt-1 text-xs font-semibold text-blue-700">
    {amountInfo.period}
  </p>

  <p className="mt-2 text-xs leading-5 text-slate-600">
    {amountInfo.note}
  </p>

  {amountInfo.evidence && (
    <div className="mt-3 border-t border-blue-100 pt-3">
      <p className="text-xs font-bold text-slate-700">
        금액 확인 근거
      </p>
      <p className="mt-1 text-xs leading-5 text-slate-600">
        {amountInfo.evidence}
      </p>
    </div>
  )}
</div>


                <p className="mt-2 text-xs leading-5 text-slate-600">
                  {details(item, "서비스목적요약") ||
                    details(item, "지원내용") ||
                    "지원내용 확인 필요"}
                </p>

                <p className="mt-2 text-xs text-slate-400">
                  {details(item, "소관기관명") ||
                    "담당기관 확인 필요"}
                </p>

                <button
                  type="button"
                  className="mt-3 flex w-full items-center justify-center rounded-xl border border-blue-200 py-3 text-sm font-bold text-blue-700"
                  onClick={() =>
                    setExpanded(open ? null : id)
                  }
                >
                  {open
                    ? "상세 안내 접기"
                    : "지원 조건·신청 방법 자세히 보기"}
                </button>

                
{open && (
  <FundServiceDetail
    serviceId={id}
    fallback={item}
  />
)}

              </article>
            );
          })}

          {!query.isLoading &&
            !query.isError &&
            query.data?.data?.length === 0 && (
              <p className="rounded-xl bg-white p-4 text-sm">
                검색 결과가 없습니다.
                검색어를 변경해보세요.
              </p>
            )}

          <p className="text-xs leading-5 text-slate-500">
            공개 API의 목록 검색 결과는 개인별
            자격 심사 결과가 아닙니다.
            지원금액은 사업별 공고와 최신 기준에 따라
            변경될 수 있습니다.
          </p>
        </div>
      )}

      {/* 이전 단계 */}
      {step > 0 && (
        <button
          type="button"
          onClick={() => {
            setExpanded(null);
            setStep(v => v - 1);
          }}
          className="flex items-center gap-1 text-sm font-semibold text-slate-500"
        >
          <ChevronLeft size={16} />
          이전 단계
        </button>
      )}
    </SectionShell>
  );
}

function ResumeEditor(){
 const [person,setPerson]=useState("");const [experience,setExperience]=useState("");const [motivation,setMotivation]=useState("");
 const draft=`이름: ${person}\n\n경험 및 강점\n${experience}\n\n지원동기 및 입사 후 포부\n${motivation}`;
 return <SectionShell><div className="rounded-xl bg-purple-50 p-4 text-sm text-slate-700">휴대폰에서 기본 내용을 작성하고 복사할 수 있습니다. 내용은 서버에 저장되지 않으며 화면을 닫으면 사라집니다.</div><Field label="이름"><input className={inputStyle} value={person} onChange={e=>setPerson(e.target.value)}/></Field><Field label="경험 및 강점"><textarea className={inputStyle} rows={5} value={experience} onChange={e=>setExperience(e.target.value)} placeholder="실습, 봉사, 직무 경험 등을 입력해 주세요"/></Field><Field label="지원동기 및 포부"><textarea className={inputStyle} rows={5} value={motivation} onChange={e=>setMotivation(e.target.value)}/></Field><button onClick={()=>navigator.clipboard.writeText(draft).then(()=>alert("작성 내용을 복사했습니다.")).catch(()=>alert("복사에 실패했습니다."))} className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white">작성 내용 복사하기</button></SectionShell>;
}

function ConsultationForm({
  preStudyPlan = null,
  dialogMode = false,
}: {
  preStudyPlan?: PreStudyConsultation | null;
  dialogMode?: boolean;
}) {
  const [clientName, setClientName] = useState("");
  const [phone, setPhone] = useState("");
  const [finalEducation, setFinalEducation] =
  useState(preStudyPlan?.finalEducation ?? "");

const isPreStudyConsultation =
  Boolean(preStudyPlan);
  const [preferredContactTime, setPreferredContactTime] = useState("");
  const [customTime, setCustomTime] = useState("");
  const [notes, setNotes] = useState("");
  const [agree, setAgree] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
const [privacyExpanded, setPrivacyExpanded] = useState(false);

  const submit = trpc.staffProfile.public.submitConsultation.useMutation();

  const timeOptions = [
  { value: "10~12시", label: "10~12시" },
  { value: "12~14시", label: "12~14시" },
  { value: "14~16시", label: "14~16시" },
  { value: "16~18시", label: "16~18시" },
  { value: "시간 무관", label: "시간 무관" },
  { value: "기타", label: "기타 시간" },
];

  const educationOptions = [
    "고등학교 졸업",
    "전문대 졸업",
    "4년제 대학교 졸업",
    "대학원 졸업",
    "대학교 재학·중퇴",
    "기타",
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const digits = phone.replace(/\D/g, "");
    if (clientName.trim().length < 2 || digits.length < 10 || digits.length > 11) {
      setError("이름과 연락처를 정확히 입력해주세요.");
      return;
    }
    if (!finalEducation) {
      setError("최종학력을 선택해주세요.");
      return;
    }
    if (!agree) {
      setError("개인정보 수집 및 이용 동의가 필요합니다.");
      return;
    }
    if (!CONSULTATION_TOKEN) {
      setError("상담 접수 설정이 아직 완료되지 않았습니다.");
      return;
    }

    const selectedTime =
      preferredContactTime === "기타"
        ? customTime.trim()
        : preferredContactTime;

    const consultationNotes = preStudyPlan
  ? [
      preStudyPlan.notes,
      "",
      "[회원 문의내용]",
      notes.trim() || "작성 안 함",
    ].join("\n")
  : [
      "[사회복지 통합지원센터 유입]",
      `걱정되는 점: ${notes.trim() || "작성 안 함"}`,
    ].join("\n");

    try {
      await submit.mutateAsync({
        publicToken: CONSULTATION_TOKEN,
        clientName: clientName.trim(),
        phone: digits,
        finalEducation,
        desiredCourse: "사회복지사 2급",
        preferredContactTime: selectedTime || null,
        notes: isPreStudyConsultation
  ? consultationNotes
  : consultationNotes.slice(0, 500),

isPreStudyConsultation,
      });
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.message || "상담 접수에 실패했습니다.");
    }
  }

const consultationBackground =
  "bg-[radial-gradient(ellipse_at_top_right,#326cc0_0%,transparent_48%),linear-gradient(150deg,#0c2043_0%,#142e61_55%,#091a35_100%)]";

    if (submitted) {
    return (
      <div
  className={`${consultationBackground} px-5 py-12 text-center text-white`}
>
        <img
          src={CENTER_LOGO}
          alt="사회복지 통합지원센터"
          className="mx-auto w-full max-w-[270px] rounded-lg bg-white object-contain p-3"
        />

        <h2 className="mt-8 text-[23px] font-bold text-white">
          상담 신청이 완료되었습니다.
        </h2>

        <p className="mt-4 text-[14px] leading-7 text-[#c5d2e8]">
          남겨주신 내용을 확인한 후
          <br />
          담당자가 연락드리겠습니다.
        </p>
      </div>
    );
  }

  const fieldClass =
  "h-[48px] w-full min-w-0 rounded-[10px] border border-[#d8e3f0] !bg-[#ffffff] px-3 text-[16px] font-medium !text-[#172c48] outline-none placeholder:!text-[#64748b] transition-all focus:border-[#80b9ff] focus:ring-2 focus:ring-[#80b9ff]/30";

  return (
  <div
    className={`${consultationBackground} !text-white ${
      dialogMode
        ? "w-full"
        : `min-h-[calc(100dvh-60px)] px-4 pt-4 ${
            new URLSearchParams(window.location.search)
              .get("embed") === "1"
              ? "pb-5"
              : "pb-24"
          }`
    }`}
    style={{
      color: "#ffffff",
      colorScheme: "light",
    }}
  >
    <div
      className={`mx-auto w-full max-w-[460px] ${
        dialogMode
          ? "px-4 pb-5 pt-7"
          : "px-1 pb-4 pt-3"
      }`}
    >
        {/* 상단 정식 로고 */}
        <div className="flex justify-center">
  <img
    src={CENTER_LOGO}
    alt="사회복지 통합지원센터"
    className="w-full max-w-[290px] rounded-xl bg-white object-contain px-4 py-3 shadow-[0_8px_25px_rgba(0,0,0,0.12)]"
  />
</div>

        {/* 상담 신청 제목 */}
<div className="mb-5 mt-5 text-center">
  <p className="text-[10px] font-semibold tracking-[0.18em] text-[#a7d5ff]">
    SOCIAL WELFARE CONSULTING
  </p>

  <p className="mt-3 text-[13px] font-medium text-[#d1e3ff]">
    사회복지사 2급 무료 상담
  </p>

  <h2 className="mt-2 text-[27px] font-extrabold leading-[1.35] tracking-[-0.05em] !text-white">
    나에게 맞는
    <br />
    <span className="text-[#a3e1ff]">
      취득 과정
    </span>{" "}
    안내받기
  </h2>

  <p className="mt-3 text-[13px] leading-6 text-[#dce7f7]">
    내 상황에 맞는 취득 과정과 학습일정을
    <br />
    전문 상담사가 안내해 드립니다.
  </p>
</div>

        <form
  onSubmit={handleSubmit}
  className="space-y-4 rounded-[20px] border border-[#49638d] p-4 !text-white shadow-[0_8px_24px_rgba(0,0,0,0.15)] sm:p-5"
  style={{
    background: "linear-gradient(145deg, #263f69 0%, #192f53 100%)",
    color: "#ffffff",
    colorScheme: "light",
  }}
>
          {/* 이름 및 연락처 */}
          <div className="grid grid-cols-2 gap-3">
            <label className="min-w-0">
              <span className="mb-2 block text-[13px] font-semibold text-white">
                이름
                <span className="ml-1 text-[#a8c5ff]">*</span>
              </span>

              <input
                className={fieldClass}
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                placeholder="이름"
                autoComplete="name"
                maxLength={100}
                required
              />
            </label>

            <label className="min-w-0">
              <span className="mb-2 block text-[13px] font-semibold text-white">
                연락처
                <span className="ml-1 text-[#a8c5ff]">*</span>
              </span>

              <input
                className={fieldClass}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="010-0000-0000"
                required
              />
            </label>
          </div>

          {/* 일반 상담에서만 최종학력 표시 */}
          {!isPreStudyConsultation && (
            <label className="block">
              <span className="mb-2 block text-[13px] font-semibold text-white">
                최종학력
                <span className="ml-1 text-[#a8c5ff]">*</span>
              </span>

              <select
                className={fieldClass}
                value={finalEducation}
                onChange={e =>
                  setFinalEducation(e.target.value)
                }
                required
              >
                <option value="">최종학력 선택</option>

                {educationOptions.map(item => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* 희망 상담 시간대 */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[13px] font-semibold text-white">
                희망 상담 시간대
              </span>

              <span className="text-[11px] text-[#a8b8d0]">
                선택사항
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {timeOptions.map(item => {
                const selected =
                  preferredContactTime === item.value;

                return (
                  <button
                    key={item.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() =>
                      setPreferredContactTime(
                        selected ? "" : item.value
                      )
                    }
                   className={`min-h-[44px] rounded-[10px] border px-1 text-[13px] font-semibold transition-all ${
  selected
    ? "border-[#8dc4ff] shadow-[0_3px_12px_rgba(36,85,200,0.35)]"
    : "border-[#627da6] hover:border-[#a3c8ff]"
}`}
style={{
  background: selected
    ? "linear-gradient(135deg, #408de9, #2455c8)"
    : "#304c76",
  color: "#ffffff",
}}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            {preferredContactTime === "기타" && (
              <input
                className={`${fieldClass} mt-2`}
                value={customTime}
                onChange={e =>
                  setCustomTime(e.target.value)
                }
                placeholder="희망하시는 시간을 입력해주세요."
                maxLength={80}
              />
            )}
          </div>

          {/* 문의내용 */}
          <label className="block">
            <span className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold leading-5 text-white">
                진행하시면서 걱정되시거나 궁금하신 점
              </span>

              <span className="shrink-0 text-[11px] text-[#a8b8d0]">
                선택사항
              </span>
            </span>

            <textarea
           className="min-h-[100px] w-full resize-none rounded-[10px] border border-[#d8e3f0] !bg-[#ffffff] p-3.5 text-[16px] leading-6 !text-[#172c48] outline-none placeholder:!text-[#64748b] transition-all focus:border-[#80b9ff] focus:ring-2 focus:ring-[#80b9ff]/30"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              maxLength={350}
              placeholder="직장 병행, 학습 부담, 실습, 취업 등 자유롭게 작성해 주세요."
            />

            <span className="mt-1 block text-right text-[11px] text-[#a8b8d0]">
              {notes.length} / 350
            </span>
          </label>

          {/* 개인정보 동의 */}
<div className="border-t border-[#49638d] pt-4">
  <div className="flex items-center gap-2.5">
    <input
      id="consultation-privacy"
      type="checkbox"
      checked={agree}
      onChange={e => setAgree(e.target.checked)}
      className="h-[18px] w-[18px] shrink-0 cursor-pointer accent-[#397fe9]"
    />

    <label
      htmlFor="consultation-privacy"
      className="min-w-0 flex-1 cursor-pointer text-[13px] font-semibold leading-5 !text-white"
    >
      개인정보 수집·이용 동의 (필수)
    </label>

    <button
      type="button"
      onClick={() =>
        setPrivacyExpanded(v => !v)
      }
      aria-expanded={privacyExpanded}
      className="shrink-0 text-[12px] font-medium underline underline-offset-4"
      style={{
        background: "transparent",
        color: "#d1e3ff",
      }}
    >
      {privacyExpanded ? "접기" : "자세히 보기"}
    </button>
  </div>

            {privacyExpanded && (
              <div className="mt-4 space-y-3 rounded-lg border border-[#344968] bg-[#102341] p-4 text-[12px] leading-6 text-[#c5d2e8]">
                <div>
                  <b className="text-white">
                    개인정보 수집·이용 주체
                  </b>
                  <p>
                    위드원교육 (사회복지 통합지원센터 운영 사업자)
                  </p>
                </div>

                <div>
                  <b className="text-white">
                    수집 항목
                  </b>

                  <p>
                    {isPreStudyConsultation
                      ? "이름, 연락처, 최종학력, 상담 희망시간, 문의내용, 기존 이수과목 및 이수연도, 보유학점, 학습설계 계산 결과"
                      : "이름, 연락처, 최종학력, 상담 희망시간, 문의내용"}
                  </p>
                </div>

                <div>
                  <b className="text-white">
                    수집 및 이용 목적
                  </b>

                  <p>
                    사회복지사 2급 상담 신청 접수 및 상담 안내
                  </p>
                </div>

                <div>
                  <b className="text-white">
                    보유 및 이용 기간
                  </b>

                  <p>수집일로부터 1년</p>
                </div>

                <p className="text-[11px] text-[#a8b8d0]">
                  개인정보 수집 및 이용에 동의하지 않을 권리가 있으며,
                  동의하지 않을 경우 상담 신청이 제한됩니다.
                </p>
              </div>
            )}
          </div>

          {/* 오류 안내 */}
          {error && (
            <p
              role="alert"
              className="rounded-lg border border-red-400/30 bg-[#392235] p-3 text-[13px] leading-5 text-[#ffc5c5]"
            >
              {error}
            </p>
          )}

          <button
  type="submit"
  disabled={submit.isPending || !agree}
  className="h-[54px] w-full rounded-xl border border-transparent text-[16px] font-bold transition-all hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed !opacity-100"
  style={{
    background:
      submit.isPending || !agree
        ? "#3b5073"
        : "linear-gradient(110deg, #397fe9 0%, #2458d3 55%, #214ab7 100%)",
    color:
      submit.isPending || !agree
        ? "#d5dfed"
        : "#ffffff",
    boxShadow:
      submit.isPending || !agree
        ? "none"
        : "0 5px 18px rgba(40,116,235,0.35)",
  }}
>
  {submit.isPending
    ? "상담 접수 중..."
    : "무료 상담 신청하기"}
</button>

          <p className="text-center text-[11px] leading-5 text-[#a8b8d0]">
            상담 신청은 교육과정 등록과 별개입니다.
            <br />
            입력하신 정보는 상담 안내 목적으로 사용됩니다.
          </p>
        </form>
      </div>
    </div>
  );
}


type PracticePublicItem = {
  id: string;
  name: string;
  address: string;
  price: string;
  lat?: number | null;
  lng?: number | null;
};

function PracticePage({
  portalToken,
  loggedIn,
  onPortalLogin,
}: {
  portalToken: string;
  loggedIn: boolean;
  onPortalLogin: (token: string) => void;
}) {

const [practiceView, setPracticeView] =
  useState<"map" | "list">("map");

const [selectedPracticeId, setSelectedPracticeId] =
  useState<string | null>(null);

const [address, setAddress] = useState("");
  const [origin, setOrigin] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  const [loginOpen, setLoginOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loginError, setLoginError] = useState("");

  const login = trpc.studentPortal.login.useMutation();

  const preview =
    trpc.employmentCenter.publicPracticePreview.useQuery(
      undefined,
      { retry: false }
    );

  const all = trpc.employmentCenter.practiceNearby.useQuery(
    { token: portalToken },
    {
      enabled: loggedIn && !!portalToken,
      retry: false,
    }
  );

  const requireLogin = () => {
    if (!loggedIn) {
      setLoginOpen(true);
      return false;
    }
    return true;
  };

  const priceText = (price: string | number | null | undefined) => {
  if (price === null || price === undefined || String(price).trim() === "") {
    return "정보 없음";
  }

  const raw = String(price).trim();
  const numeric = raw.replace(/[,\s원₩]/g, "");

  if (/^\d+(\.\d+)?$/.test(numeric)) {
    return `${Number(numeric).toLocaleString("ko-KR")}원`;
  }

  return raw;
};

  const results = useMemo(() => {
    const rows = (all.data || []) as PracticePublicItem[];

    if (!origin) return [];

    const rad = (v: number) => (v * Math.PI) / 180;

    return rows
      .map(item => {
        const lat = item.lat;
        const lng = item.lng;

        if (
          lat == null ||
          lng == null ||
          !Number.isFinite(lat) ||
          !Number.isFinite(lng)
        ) {
          return { ...item, km: null as number | null };
        }

        const a =
          Math.sin(rad(lat - origin.lat) / 2) ** 2 +
          Math.cos(rad(origin.lat)) *
            Math.cos(rad(lat)) *
            Math.sin(rad(lng - origin.lng) / 2) ** 2;

        const km =
          6371 *
          2 *
          Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return { ...item, km };
      })
      .filter(
        (item): item is typeof item & { km: number } =>
          item.km !== null
      )
      .sort((a, b) => a.km - b.km)
      .slice(0, 30);
  }, [all.data, origin]);

const missingCoordinateCount = useMemo(() => {
  const rows = (all.data || []) as PracticePublicItem[];

  return rows.filter(item =>
    item.lat == null ||
    item.lng == null ||
    !Number.isFinite(item.lat) ||
    !Number.isFinite(item.lng) ||
    item.lat < 33 ||
    item.lat > 39 ||
    item.lng < 124 ||
    item.lng > 132
  ).length;
}, [all.data]);

 

  
const searchAddress = async (e: React.FormEvent) => {
  e.preventDefault();

  if (!requireLogin()) return;
  if (!address.trim()) return;

  try {
    const kakao = await loadPracticeKakao();

    if (
      !kakao.maps.services?.Geocoder ||
      !kakao.maps.services?.Places
    ) {
      alert("카카오 주소 검색 서비스를 사용할 수 없습니다.");
      return;
    }

    const apply = (lat: number, lng: number) => {
      setOrigin({ lat, lng });
      setSelectedPracticeId(null);
      setPracticeView("map");
    };

    new kakao.maps.services.Geocoder().addressSearch(
      address.trim(),
      (items: any[], status: string) => {
        if (
          status === kakao.maps.services.Status.OK &&
          items?.length
        ) {
          apply(Number(items[0].y), Number(items[0].x));
          return;
        }

        new kakao.maps.services.Places().keywordSearch(
          address.trim(),
          (places: any[], placeStatus: string) => {
            if (
              placeStatus === kakao.maps.services.Status.OK &&
              places?.length
            ) {
              apply(
                Number(places[0].y),
                Number(places[0].x)
              );
            } else {
              alert("입력하신 주소를 찾지 못했습니다.");
            }
          }
        );
      }
    );
  } catch (error: any) {
    alert(
      error?.message ||
      "카카오 주소 검색 서비스를 불러오지 못했습니다."
    );
  }
};


  const useGps = () => {
    if (!requireLogin()) return;

    navigator.geolocation.getCurrentPosition(
      position => {
        setOrigin({
  lat: position.coords.latitude,
  lng: position.coords.longitude,
});

setSelectedPracticeId(null);
setPracticeView("map");
      },
      () => {
        alert("현재 위치를 확인할 수 없습니다.");
      },
      { timeout: 10000 }
    );
  };

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");

    const digits = phone.replace(/\D/g, "");

    if (
      name.trim().length < 2 ||
      digits.length < 10 ||
      digits.length > 11
    ) {
      setLoginError("이름과 휴대폰 번호를 확인해주세요.");
      return;
    }

    try {
      const res = await login.mutateAsync({
        slug: SUPPORT_PORTAL_SLUG,
        clientName: name.trim(),
        phone: digits,
        deviceToken: getEmploymentTrialDeviceToken(),
      });

      if (!res.success || !res.token) {
        setLoginError("등록 학습자 정보를 확인하지 못했습니다.");
        return;
      }

      localStorage.setItem(
        SUPPORT_PORTAL_TOKEN_KEY,
        res.token
      );

      onPortalLogin(res.token);
      setLoginOpen(false);
    } catch (err: any) {
      setLoginError(
        err?.message || "로그인 중 오류가 발생했습니다."
      );
    }
  };

  
  const visibleInstitutions =
    loggedIn && origin ? results : (preview.data || []);

  const isNearby = loggedIn && !!origin;

  return (
    <SectionShell>
      {/* 1. 실습기관 찾기 전용 이미지 배너 */}
<div className="overflow-hidden rounded-2xl bg-[#effaf6]">
  <img
    src={PRACTICE_BANNER}
    alt="실습기관 찾기"
    className="block h-auto w-full"
  />
</div>

      {/* 2. 등록 학습자 로그인 안내 */}
      <div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-[#f4faf8] px-3 py-3">
        <ShieldCheck
          size={24}
          className="shrink-0 text-emerald-700"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-extrabold text-slate-900">
            등록 학습자 전용 서비스입니다.
          </p>
          <p className="mt-0.5 text-[10px] leading-4 text-slate-500">
            {loggedIn
              ? "로그인되었습니다. 주소를 검색해 가까운 기관을 확인하세요."
              : "로그인하시면 지도 검색과 전체 기관 목록을 이용할 수 있습니다."}
          </p>
        </div>

        {!loggedIn && (
          <button
            type="button"
            onClick={() => setLoginOpen(true)}
            className="shrink-0 rounded-lg bg-emerald-700 px-3.5 py-2 text-[12px] font-bold text-white"
          >
            로그인
          </button>
        )}
      </div>

      {/* 3. 주소 검색 */}
      <form
        onSubmit={searchAddress}
        className="flex items-center gap-2"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
          <MapPin
            size={15}
            className="shrink-0 text-slate-400"
          />
          <input
            value={address}
            onChange={e => setAddress(e.target.value)}
            onFocus={() => {
              if (!loggedIn) setLoginOpen(true);
            }}
            placeholder="주소 입력 (예: 서울 도봉구 방학동)"
            className="h-11 min-w-0 flex-1 bg-transparent text-[11px] outline-none placeholder:text-slate-400"
          />
        </div>

        <button
          type="submit"
          aria-label="주소 검색"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-white"
        >
          <Search size={19} />
        </button>

        <button
          type="button"
          onClick={useGps}
          className="flex h-11 shrink-0 items-center gap-1 rounded-xl border border-emerald-200 bg-white px-2.5 text-[11px] font-bold text-emerald-800"
        >
          <LocateFixed size={15} />
          현재 위치
        </button>
      </form>

      {/* 4. 지도 영역 */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-[#e9f1ed]">
        <div className="absolute right-3 top-3 z-10 flex rounded-full bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => {
              if (requireLogin()) setPracticeView("map");
            }}
            className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${
              practiceView === "map"
                ? "bg-emerald-700 text-white"
                : "text-slate-600"
            }`}
          >
            지도
          </button>

          <button
            type="button"
            onClick={() => {
              if (requireLogin()) setPracticeView("list");
            }}
            className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${
              practiceView === "list"
                ? "bg-emerald-700 text-white"
                : "text-slate-600"
            }`}
          >
            목록
          </button>
        </div>

        {loggedIn && origin && practiceView === "map" ? (
  <PracticeKakaoMap
    institutions={results}
    referencePoint={origin}
    selectedId={selectedPracticeId}
    onSelectInstitution={(institution) => {
      setSelectedPracticeId(String(institution.id));
    }}
    className="h-[220px] w-full"
  />
        ) : loggedIn && origin && practiceView === "list" ? (
          <div className="flex h-[220px] flex-col items-center justify-center px-6 text-center text-sm text-slate-600">
            <MapPin
              className="mb-2 text-emerald-700"
              size={26}
            />
            아래에서 가까운 기관 {results.length}곳을 확인하세요.
          </div>
        ) : (
          <div className="flex h-[220px] flex-col items-center justify-center px-6 text-center">
            <MapPinned
              size={32}
              className="text-emerald-700"
            />

            <p className="mt-3 text-sm font-bold text-slate-800">
              내 주변 실습기관 지도
            </p>

            <p className="mt-1 text-[11px] leading-5 text-slate-500">
              {loggedIn
                ? "주소를 검색하거나 현재 위치를 선택해주세요."
                : "로그인 후 지도와 거리순 검색을 이용할 수 있습니다."}
            </p>

            {!loggedIn && (
              <button
                type="button"
                onClick={() => setLoginOpen(true)}
                className="mt-3 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white"
              >
                로그인하고 지도 보기
              </button>
            )}
          </div>
        )}
      </div>

      {/* 5. 실습기관 목록 */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[15px] font-black text-slate-900">
          {isNearby
            ? `가까운 실습기관 ${results.length}개`
            : "전국 실습기관 미리보기"}
        </h3>

        <span className="text-[11px] font-semibold text-slate-500">
          {isNearby ? "직선거리순" : "지역별 최대 8개"}
        </span>
      </div>

      {(isNearby ? all.isLoading : preview.isLoading) && (
        <p className="text-xs text-slate-500">
          기관 목록을 불러오는 중입니다.
        </p>
      )}

      {(isNearby ? all.isError : preview.isError) && (
        <p className="text-xs text-red-600">
          기관 목록을 불러오지 못했습니다.
        </p>
      )}

      <div className="space-y-2">
        {visibleInstitutions.map((item: any) => (
  <article
    key={item.id}
    role="button"
    tabIndex={0}
    onClick={() => {
      if (!requireLogin()) return;

      if (item.lat == null || item.lng == null) {
        alert("이 기관의 지도 좌표가 등록되어 있지 않습니다.");
        return;
      }

      if (!origin) {
        alert("먼저 주소를 검색하거나 현재 위치를 선택해주세요.");
        return;
      }

      setSelectedPracticeId(String(item.id));
      setPracticeView("map");
    }}
    onKeyDown={(e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.currentTarget.click();
      }
    }}
    className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm"
  >
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100">
  <img
    src={COMPANY_IMAGE}
    alt="실습기관 대표 이미지"
    className="h-full w-full object-cover"
    loading="lazy"
  />
</div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-extrabold text-slate-900">
                {item.name}
              </p>

              <p className="mt-1 flex items-center gap-1 truncate text-[11px] text-slate-500">
                <MapPin
                  size={11}
                  className="shrink-0"
                />
                {item.address}
              </p>

              <p className="mt-1 text-[11px] font-semibold text-slate-700">
                실습비 {priceText(item.price)}
              </p>
            </div>

            <div className="shrink-0 text-right">
              {item.km != null && (
                <p className="text-[12px] font-black text-emerald-700">
                  약 {item.km.toFixed(1)}km
                </p>
              )}
              <ChevronRight
                size={17}
                className="ml-auto mt-2 text-slate-400"
              />
            </div>
          </article>
        ))}
      </div>

      {isNearby &&
        !all.isLoading &&
        !all.isError &&
        results.length === 0 && (
          <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
            거리 계산이 가능한 기관을 찾지 못했습니다.
          </p>
        )}

      {isNearby && missingCoordinateCount > 0 && (
        <p className="text-[11px] text-slate-500">
          위치정보가 없는 일부 기관은 거리순 결과에서 제외됩니다.
        </p>
      )}

      {/* 6. 실습이 어려운 이유 */}
      <div className="rounded-2xl border border-emerald-100 bg-[#f3faf7] p-4">
        <h3 className="text-[14px] font-black text-slate-900">
          실습기관을 직접 구하기 어려운 이유
        </h3>

        <div className="mt-3 space-y-2 text-[11px] leading-5 text-slate-700">
          <p>
            ✓ 신법 적용 대상자는 실습교육원의 대면 세미나 참석이 필요합니다.
          </p>
          <p>
            ✓ 가까운 실습교육원이 없어 다른 광역시로 이동해야 할 수도 있습니다.
          </p>
          <p>
            ✓ 실습 인정기간, 지도자 수용 인원, 모집 여부와 평일·주말 일정까지 맞아야 합니다.
          </p>
        </div>
      </div>

      {/* 7. 실습배정지원센터 */}
      <div className="rounded-2xl border border-emerald-100 bg-white p-4">
        <h3 className="text-[15px] font-black text-slate-900">
          실습배정지원센터
        </h3>

        <p className="mt-2 text-[12px] leading-6 text-slate-600">
          단순히 거리만 가까운 곳이 아니라,
          학습자의 거주지·실습 가능 일정·대면 세미나·
          기관 모집 여부를 함께 확인합니다.
          <strong className="text-emerald-800">
            {" "}조건에 맞는 곳 중 최대한 가까운 실습교육원과
            실습기관을 찾아 배정을 지원합니다.
          </strong>
        </p>

        <p className="mt-2 text-[10px] leading-4 text-slate-500">
          ※ 등록 학습자 전용이며, 실제 배정은 기관의 모집 및
          수용 가능 여부에 따라 달라집니다.
        </p>

        <a
          href="/portal/with-one"
          className="mt-4 block rounded-xl bg-emerald-700 px-4 py-3 text-center text-[12px] font-bold text-white"
        >
          학사관리시스템에서 실습배정 신청하기
        </a>

        <a
          href="/social-worker-guide"
          className="mt-3 block text-center text-[11px] font-bold text-emerald-700"
        >
          사회복지사 2급 취득가이드 확인
        </a>
      </div>


      
{loginOpen && (
  <div
    className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 px-4 py-5 backdrop-blur-[3px]"
    onClick={() => setLoginOpen(false)}
  >
    <div
      role="dialog"
      aria-modal="true"
      aria-label="실습기관 찾기 회원 로그인"
      className="max-h-[90dvh] w-full max-w-[420px] overflow-y-auto rounded-[24px] bg-white p-5 shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
          <ShieldCheck size={25} />
        </div>

        <button
          type="button"
          onClick={() => setLoginOpen(false)}
          aria-label="닫기"
          className="rounded-full bg-slate-100 p-2 text-slate-500"
        >
          <X size={19} />
        </button>
      </div>

      <h2 className="mt-4 text-[20px] font-black text-slate-900">
        등록회원은 무료로 이용할 수 있어요!
      </h2>

      <p className="mt-2 break-keep text-[12px] leading-5 text-slate-500">
        로그인하시면 전국 실습기관 목록과 실습비용,
        내 주변 기관까지 확인하실 수 있습니다.
      </p>

      <div className="mt-4 space-y-3 rounded-2xl bg-emerald-50 p-4">
        {[
          "전국 실습기관 목록 무료 열람",
          "기관별 실습비용 및 주소 확인",
          "지도 기반 내 주변 실습기관 찾기",
          "거리순 정렬 및 지역·주소 검색",
        ].map((item) => (
          <div key={item} className="flex items-center gap-2.5">
            <ShieldCheck
              size={17}
              className="shrink-0 text-emerald-700"
            />
            <span className="text-[12px] font-semibold text-slate-700">
              {item}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-5 border-t border-slate-100 pt-5">
        <h3 className="text-[14px] font-extrabold text-slate-900">
          이미 등록회원이신가요?
        </h3>

        <p className="mt-1 text-[11px] text-slate-500">
          등록하신 이름과 휴대폰 번호를 입력해주세요.
        </p>

        <form onSubmit={submitLogin} className="mt-3 space-y-2.5">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름"
            autoComplete="name"
            required
            className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-[13px] outline-none focus:border-emerald-600"
          />

          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="휴대폰 번호"
            inputMode="tel"
            autoComplete="tel"
            required
            className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-[13px] outline-none focus:border-emerald-600"
          />

          {loginError && (
            <p role="alert" className="text-[12px] text-red-600">
              {loginError}
            </p>
          )}

          <button
            type="submit"
            disabled={login.isPending}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 text-[14px] font-extrabold text-white disabled:opacity-50"
          >
            {login.isPending ? "로그인 확인 중..." : "등록회원 로그인"}
            <ArrowRight size={16} />
          </button>
        </form>
      </div>

      <div className="mt-5 border-t border-slate-100 pt-5">
        <h3 className="text-center text-[13px] font-extrabold text-slate-900">
          사회복지사 2급을 처음 알아보시나요?
        </h3>

        <a
          href="/social-worker-guide"
          className="mt-3 flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 text-[12px] font-bold text-emerald-800"
        >
          사회복지사 2급 취득 가이드
          <ArrowRight size={15} />
        </a>

        <a
          href="/employment-center?section=consultation"
          className="mt-2 flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-100 text-[12px] font-bold text-slate-700"
        >
          사회복지사 2급 상담 신청
          <ArrowRight size={15} />
        </a>
      </div>
    </div>
  </div>
)}
    </SectionShell>
  );
}

function ComparePage(){return <SectionShell><p className="text-sm text-slate-600">학습관리 서비스를 선택할 때 확인해야 할 항목입니다. 특정 기관의 실제 제공 여부는 상담 전에 확인하세요.</p>{[["학사일정","개인별 수업·실습·행정 일정 확인"],["과목 누락 예방","필수·선택 과목 및 기존 이수내역 검토"],["실습 준비","선이수 요건·실습기관·실습 예정월 확인"],["행정절차","학습자등록·학점인정·학위신청 안내"],["자격증 신청","예상 신청시기와 협회 신청절차 확인"],["학생 포털","학생이 직접 진행상황을 조회할 수 있는지"]].map(([a,b])=><div key={a} className="rounded-xl border bg-white p-4"><p className="font-bold">{a}</p><p className="mt-1 text-xs text-slate-500">{b}</p></div>)}</SectionShell>}
export default function EmploymentCenterPage(){
const isConsultationEmbed = (() => {
  const params = new URLSearchParams(window.location.search);

  return (
    params.get("section") === "consultation" &&
    params.get("embed") === "1"
  );
})();

const [portalToken, setPortalToken] = useState(
  readSupportPortalToken
);

const [
  privateCertificateOpen,
  setPrivateCertificateOpen,
] = useState(false);

const portalMeQuery =
  trpc.studentPortal.me.useQuery(
    { token: portalToken },
    {
      enabled: Boolean(portalToken),
      retry: false,
      refetchOnWindowFocus: true,
      refetchInterval: 60_000,
    }
  );

const isPortalLoggedIn =
  portalMeQuery.data?.authenticated === true;
useEffect(() => {
  const syncPortalToken = () => {
    setPortalToken(readSupportPortalToken());
  };

  window.addEventListener("storage", syncPortalToken);
  window.addEventListener("pageshow", syncPortalToken);

  return () => {
    window.removeEventListener("storage", syncPortalToken);
    window.removeEventListener("pageshow", syncPortalToken);
  };
}, []);
 const [section, setSection] = useState<Section>(() => {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("section");

  if (requested === "consultation") {
    return "consultation";
  }

  if (requested === "certificate") {
    return "certificate";
  }

  return "home";
});
 const [menu,setMenu]=useState(false);
 const [session,setSession]=useState<{token:string;expiresAt:number}|null>(()=>readSession());
 useEffect(()=>{const onPop=()=>setSection("home");window.addEventListener("popstate",onPop);return()=>window.removeEventListener("popstate",onPop)},[]);
 const go = (next: Section) => {
  if (next === "resume") return;

  if (next === "practiceSupport") {
    window.location.href = "/practice-support";
    return;
  }

  if (next === "volunteer") {
    window.location.href = "/volunteer";
    return;
  }

   if (next === "salary") {
    window.location.href = "/salary-calculator";
    return;
  }

  if (next === "careerTest") {
    window.location.href = "/career-test";
    return;
  }
if (next === "benefits") {
  window.location.href = "/social-worker-benefits";
  return;
}

  setSection(next);
  setMenu(false);
  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
};
const portalLogout =
  trpc.studentPortal.logout.useMutation();

const signout = async () => {
  const token = readSupportPortalToken();

  if (token) {
    try {
      await portalLogout.mutateAsync({ token });
    } catch {
      alert("서버 로그아웃에 실패했습니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    localStorage.removeItem(SUPPORT_PORTAL_TOKEN_KEY);
    setPortalToken("");
  }

  sessionStorage.removeItem(SESSION_KEY);
  setSession(null);
  go("home");
};

if (isConsultationEmbed) {
  return (
    <div className="min-h-screen bg-[#080b08] text-white">
      <div className="mx-auto max-w-[560px]">
        <ConsultationForm />
      </div>
    </div>
  );
}

 return <div className="min-h-screen bg-[#f1f5fb] text-slate-900"><div className="mx-auto flex min-h-screen max-w-[560px] flex-col bg-[#f8fafc] shadow-[0_0_40px_rgba(18,48,88,.08)]">
 <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 px-4 py-3 backdrop-blur"><div className="flex items-center justify-between gap-2"><button onClick={()=>section==="home"?setMenu(v=>!v):go("home")} className="flex min-w-0 items-center gap-2 text-left">

<span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-blue-50">
  {section === "home" ? (
    <img
      src={CENTER_SYMBOL}
      alt="사회복지 통합지원센터"
      className="h-full w-full object-contain"
    />
  ) : (
    <ArrowLeft size={19} className="text-blue-700" />
  )}
</span>

<span className="min-w-0"><span className="block truncate text-[11px] font-bold text-blue-600">사회복지 통합지원센터</span><span className="block truncate text-sm font-black">{section==="home"?"나에게 필요한 정보를 한눈에":SECTION_LABEL[section]}</span></span></button><div className="flex shrink-0 items-center gap-2"><a href="/portal/with-one" className="rounded-lg bg-blue-50 px-2.5 py-2 text-[11px] font-bold text-blue-700">학사관리시스템</a><button onClick={()=>setMenu(v=>!v)} className="rounded-lg border p-2" aria-label="메뉴"><SlidersHorizontal size={17}/></button></div></div>
{menu && (
  <nav className="flex flex-col gap-1 border-t border-slate-100 bg-white px-4 py-3">
 {CARDS.map((c) => (
  <button
    key={c.key}
    type="button"
    disabled={c.key === "resume"}
    onClick={() => go(c.key)}
    className={`rounded-lg px-3 py-2 text-left text-xs font-bold ${
      c.key === "resume"
        ? "cursor-not-allowed text-slate-400"
        : "hover:bg-white"
    }`}
  >
    {c.title}
  </button>
))}
<a
  className="rounded-lg px-3 py-2 text-xs font-bold"
  href="/social-worker-guide?tab=guide"
>
  사회복지사 2급 취득 가이드
</a>

<a
  className="rounded-lg px-3 py-2 text-left text-xs font-bold"
  href="/social-worker-guide?tab=service"
>
  학습관리 비교
</a>
<a
  href="/portal/with-one"
  className="rounded-lg px-3 py-2 text-xs font-bold"
>
  {isPortalLoggedIn
    ? "학사관리시스템으로 이동"
    : "학사관리시스템 로그인"}
</a>
{(isPortalLoggedIn || session) && (
  <button
    type="button"
    onClick={signout}
    disabled={portalLogout.isPending}
    className="rounded-lg px-3 py-2 text-left text-xs font-bold text-red-600 disabled:opacity-50"
  >
    {portalLogout.isPending ? "로그아웃 중..." : "로그아웃"}
  </button>
)}
  </nav>
)}
</header>
 
{section === "home" && (
  <main className="px-4 pb-6">

    {/* 메인 배너 */}
    <section
      className="relative mt-4 overflow-hidden rounded-[22px] bg-gradient-to-br from-[#123f87] to-[#0869d8] px-5 py-6 text-white"
      style={{
        backgroundImage: `url("${HERO_BANNER}")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="relative z-10 max-w-[78%]">
        <p className="text-[10px] font-bold tracking-wide text-blue-100">
          SOCIAL WELFARE SUPPORT
        </p>

        <h1 className="mt-3 text-[21px] font-black leading-[1.35] tracking-tight">
          사회복지 정보부터
          <br />
          취업 준비까지 한곳에서
        </h1>

        <p className="mt-3 text-[11px] leading-[1.7] text-blue-100">
          일자리, 실습, 지원제도, 자격증 신청시기를
          쉽고 빠르게 확인하세요.
        </p>
      </div>

      <div className="relative z-10 mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => go("certificate")}
          className="rounded-full bg-white px-4 py-2.5 text-[11px] font-extrabold text-blue-700 shadow-sm"
        >
          자격증 예상일 확인
        </button>

        <button
          type="button"
          onClick={() => go("jobs")}
          className="rounded-full border border-white/25 bg-blue-950/30 px-4 py-2.5 text-[11px] font-bold text-white"
        >
          내 주변 일자리
        </button>
      </div>
    </section>

    {/* 사회복지 알아보기 */}
<section className="mt-7">
  <h2 className="mb-3 flex items-center gap-2 text-[17px] font-black text-slate-900">
    <span className="h-5 w-1 rounded-full bg-blue-600" />
    사회복지 알아보기
  </h2>

  <div className="space-y-2.5">
    {[
      {
        href: "/intro",
        icon: BookOpen,
        title: "사회복지사, 어떤 직업일까요?",
        sub: "직업 소개 · 자격요건 · 취업분야 · 급여",
        tint: "bg-blue-100 text-blue-600",
      },
      {
        href: "/career-test",
        icon: Sparkles,
        title: "진로·성향 테스트",
        sub: "나에게 맞는 사회복지 분야 알아보기",
        tint: "bg-violet-100 text-violet-600",
      },
    ].map(item => (
      <a
        key={item.href}
        href={item.href}
        className="group flex min-h-[86px] items-center gap-3 rounded-[17px] border border-slate-200 bg-white px-4 py-3 shadow-[0_3px_12px_rgba(15,43,83,0.035)]"
      >
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] ${item.tint}`}
        >
          <item.icon size={23} />
        </span>

        <span className="min-w-0 flex-1">
          <b className="block text-[13px] font-extrabold text-slate-900">
            {item.title}
          </b>

          <span className="mt-1 block text-[11px] text-slate-500">
            {item.sub}
          </span>
        </span>

        <ChevronRight
          size={16}
          className="shrink-0 text-slate-400"
        />
      </a>
    ))}
  </div>
</section>

{/* 주요 서비스 및 등록자 지원 서비스 */}
{[
  {
    title: "주요 서비스",
    label: "무료 이용",
    cards: MAIN_CARDS,
  },
  {
    title: "등록자 지원 서비스",
    label: "등록자 전용",
    cards: STUDENT_CARDS,
  },
].map(group => (
  <section key={group.title} className="mt-8">
    <div className="mb-3 flex items-center justify-between">
      <h2 className="flex items-center gap-2 text-[17px] font-black text-slate-900">
        <span className="h-5 w-1 rounded-full bg-blue-600" />
        {group.title}
      </h2>

      <span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-semibold text-blue-700">
        {group.label}
      </span>
    </div>

    <div className="grid grid-cols-2 gap-2.5">
      {group.cards.map(c => {
        const disabled = c.key === "resume";

        return (
          <button
            key={c.key}
            type="button"
            disabled={disabled}
            data-support-consultation={
              c.key === "consultation"
                ? "true"
                : undefined
            }
            onClick={() => {
              if (c.key === "academic") {
                window.location.href =
                  "/portal/with-one";
                return;
              }

              if (c.key === "privateCertificate") {
  setPrivateCertificateOpen(true);
  return;
}

if (c.key === "resume") {
  return;
}

go(c.key);
            }}
            className={`group flex min-h-[91px] items-center gap-2 rounded-[17px] border border-slate-200/80 bg-white px-3 py-3 text-left shadow-[0_3px_12px_rgba(15,43,83,0.035)] transition-all ${
              disabled
                ? "cursor-not-allowed opacity-60"
                : "hover:border-blue-200 hover:shadow-md active:scale-[0.99]"
            } ${
              c.key === "resume"
                ? "col-span-2"
                : ""
            }`}
          >
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] ${c.tint}`}
            >
              <c.icon size={21} strokeWidth={2} />
            </span>

            <span className="min-w-0 flex-1">
              <span className="block break-keep text-[12px] font-extrabold leading-[1.35] text-slate-900">
                {c.title}
              </span>

              <span className="mt-1 block break-keep text-[10px] leading-[1.35] text-slate-500">
                {c.sub}
              </span>
            </span>

            <ChevronRight
              size={14}
              className="shrink-0 text-slate-400"
            />
          </button>
        );
      })}
    </div>
  </section>
))}

    {/* 취득 준비 가이드 */}
    <section className="mt-8">
      <h2 className="mb-3 flex items-center gap-2 text-[17px] font-black text-slate-900">
        <span className="h-5 w-1 rounded-full bg-blue-600" />
        취득 준비 가이드
      </h2>

      <div className="space-y-2.5">

        <a
          href="/social-worker-guide"
          className="group flex min-h-[86px] items-center gap-3 overflow-hidden rounded-[17px] border border-blue-100 bg-gradient-to-r from-white via-white to-blue-50 px-4 py-3 shadow-[0_3px_12px_rgba(15,43,83,0.035)]"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-blue-100 text-blue-600">
            <BookOpen size={23} />
          </span>

          <span className="min-w-0 flex-1">
            <b className="block text-[13px] font-extrabold text-slate-900">
              사회복지사 2급 취득 가이드
            </b>

            <small className="mt-1 block text-[11px] leading-4 text-slate-500">
              이론·실습·행정절차·자격증 신청
            </small>
          </span>

          <ChevronRight
            size={18}
            className="shrink-0 text-slate-600"
          />
        </a>

       <a
  href="/social-worker-guide?tab=service"
  className="group flex min-h-[86px] w-full items-center gap-3 overflow-hidden rounded-[17px] border border-cyan-100 bg-gradient-to-r from-white via-white to-cyan-50 px-4 py-3 text-left shadow-[0_3px_12px_rgba(15,43,83,0.035)]"
>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-cyan-100 text-blue-600">
            <ShieldCheck size={23} />
          </span>

          <span className="min-w-0 flex-1">
            <b className="block text-[13px] font-extrabold text-slate-900">
              학습관리 서비스 비교
            </b>

            <small className="mt-1 block text-[11px] leading-4 text-slate-500">
              일정·과목·실습·행정 관리 항목
            </small>
          </span>

                    <ChevronRight
            size={18}
            className="shrink-0 text-slate-600"
          />
                </a>
      </div>
    </section>

        {/* 사회복지 최신 소식 */}
    <SocialWelfareNewsSection />

    {/* 사회복지통합지원센터 언론보도 */}
    <SocialWelfarePressSection />

    {/* 등록자 후기 */}
<SocialWelfareReviewSection />

{/* 사회복지 관련 기관 바로가기 */}
<SocialWelfareLinksSection />

</main>
)}

<PrivateCertificateSupportDialog
  open={privateCertificateOpen}
  onOpenChange={setPrivateCertificateOpen}
  portalToken={isPortalLoggedIn ? portalToken : ""}
/>

{section === "jobs" && (
  <LegacyEmploymentJobs
    portalToken={isPortalLoggedIn ? portalToken : ""}
    onPortalLogin={setPortalToken}
    onSessionChange={setSession}
    onBack={() => go("home")}
  />
)}
 {section==="funds"&&<FundWizard/>}
 {section === "certificate" && (
  <CertificateWizard />
)}
 {section === "practice" && (
  <PracticePage
    portalToken={isPortalLoggedIn ? portalToken : ""}
    loggedIn={isPortalLoggedIn}
    onPortalLogin={setPortalToken}
  />
)}
 {section==="resume"&&<ResumeEditor/>}
 {section==="consultation"&&<ConsultationForm/>}
 {section==="compare"&&<ComparePage/>}
{/* 통합지원센터 푸터 */}
<footer className="mt-auto border-t border-slate-200 bg-[#f8fafc] px-4 pt-4 pb-24">

  {/* 가로 3단 구성 */}
  <div className="grid grid-cols-[1.35fr_1fr_1.1fr] gap-2">

   {/* 왼쪽: 센터 로고 */}
<div className="flex min-w-0 items-start pr-2">
  <img
    src={CENTER_LOGO}
    alt="사회복지 통합지원센터"
    className="h-auto w-full max-w-[160px] object-contain"
  />
</div>

    {/* 가운데: 서비스 */}
    <div className="min-w-0 border-l border-slate-200 pl-3">
      <h4 className="mb-2 text-[10px] font-extrabold text-slate-900">
        서비스
      </h4>

      <div className="flex flex-col items-start gap-1">
        {[
          { label: "자격증 신청 예상일", key: "certificate" },
          { label: "일자리 찾기", key: "jobs" },
          { label: "실습기관 찾기", key: "practice" },
          { label: "지원금 찾기", key: "funds" },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => go(item.key as Section)}
            className="text-left text-[9px] leading-[1.4] text-slate-600 hover:text-blue-600"
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>

    {/* 오른쪽: 문의사항 */}
    <div className="min-w-0 border-l border-slate-200 pl-3">
      <h4 className="mb-2 text-[10px] font-extrabold text-slate-900">
        문의사항
      </h4>

      <a
        href="tel:01093117148"
        className="flex items-center gap-1 text-[11px] font-black text-blue-600"
      >
        <span className="shrink-0">☎</span>
        <span>010-9311-7148</span>
      </a>

      <p className="mt-1 text-[9px] leading-[1.5] text-slate-500">
        이재준 (개발·운영 담당)
      </p>
    </div>
  </div>
{/* 상담 및 SNS 채널 */}
<SocialWelfareSocialLinks />

  {/* 저작권 */}
  <div className="mt-4 border-t border-slate-200 py-3">
    <p className="text-[9px] text-slate-400">
      © 2026 사회복지 통합지원센터. All rights reserved.
    </p>
  </div>

</footer>
 {section!=="home"&&<div className="fixed bottom-4 left-1/2 z-30 flex w-[min(92%,520px)] -translate-x-1/2 justify-between rounded-2xl border bg-white p-2 shadow-xl"><button onClick={()=>go("home")} className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold"><Home size={16}/> 통합지원센터 홈</button><a href="/social-worker-guide" className="flex items-center gap-1 rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700"><BookOpen size={15}/> 취득 가이드</a></div>}
 
</div></div>;
}


function PublicEmploymentJobs({
  onLogin,
  activeToken = "",
  referencePoint = null,
  onSearchAddress,
  onCurrentLocation,
  onSelectJob,
  nearbyJobs = [],
  nearbyLoading = false,
  nearbyPreparing = false,
}: {
  onLogin: () => void;
  activeToken?: string;
  referencePoint?: { lat: number; lng: number } | null;
  onSearchAddress?: (address: string) => void;
  onCurrentLocation?: () => void;
  onSelectJob?: (job: Job) => void;
  nearbyJobs?: Job[];
  nearbyLoading?: boolean;
  nearbyPreparing?: boolean;
}) {
    const [page, setPage] = useState(1);
  const [bannerFailed, setBannerFailed] = useState(false);

  const isLoggedIn = Boolean(activeToken);

  const [draftAddress, setDraftAddress] = useState("");

  const [sortBy, setSortBy] = useState<
    "latest" | "distance" | "deadline"
  >("latest");

  const jobsQuery =
    trpc.employmentCenter.publicLatestJobs.useQuery(
      { page, size: 10 },
      {
        retry: false,
        refetchOnWindowFocus: false,
        staleTime: 60_000,
      }
    );

    const jobs = jobsQuery.data?.jobs ?? [];
  const total = jobsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 10));

    const displayedJobs = useMemo(() => {
    const result: Job[] =
      sortBy === "distance" && isLoggedIn
        ? [...nearbyJobs]
        : [...jobs];


    const getDateValue = (value?: string | null) => {
      if (!value) return null;

      const normalized = String(value).replace(/\D/g, "");

      if (normalized.length < 8) return null;

      const timestamp = new Date(
        `${normalized.slice(0, 4)}-${normalized.slice(4, 6)}-${normalized.slice(6, 8)}T00:00:00`
      ).getTime();

      return Number.isFinite(timestamp) ? timestamp : null;
    };

    if (sortBy === "deadline") {
      result.sort((a, b) => {
        const aDate = getDateValue(a.closesAt);
        const bDate = getDateValue(b.closesAt);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const aValue =
          aDate !== null && aDate >= today.getTime()
            ? aDate
            : Number.POSITIVE_INFINITY;

        const bValue =
          bDate !== null && bDate >= today.getTime()
            ? bDate
            : Number.POSITIVE_INFINITY;

        return aValue - bValue;
      });
    }

        if (sortBy === "distance" && isLoggedIn) {
      result.sort(
        (a, b) =>
          (a.distanceKm ?? Infinity) -
          (b.distanceKm ?? Infinity)
      );
    }

    return result;
  }, [jobs, nearbyJobs, sortBy, isLoggedIn]);

  return (
    <div className="min-h-screen bg-[#f7f9fd] px-4 pb-28 pt-5 text-slate-900">

{/* 일자리 찾기 배너 */}
<div className="overflow-hidden rounded-[22px]">
  <img
    src={JOBS_HERO_BANNER}
    alt="사회복지 일자리 찾기"
    className="block h-auto w-full"
  />
</div>



      {/* 주소 검색 */}
      <div className="mt-5">
        <p className="mb-2 text-[13px] font-bold">
          지역·주소 검색
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onLogin}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3.5 text-left"
          >
            <MapPin size={18} className="shrink-0 text-blue-600" />
            <span className="truncate text-[13px] text-slate-400">
              지역·주소 입력 (예: 서울 도봉구)
            </span>
          </button>

          <button
            type="button"
            onClick={onLogin}
            aria-label="주소 검색"
            className="rounded-xl bg-blue-600 px-3.5 text-white"
          >
            <Search size={19} />
          </button>

          <button
            type="button"
            onClick={onLogin}
            aria-label="내 위치 검색"
            className="rounded-xl border border-slate-200 bg-white px-3.5 text-blue-600"
          >
            <LocateFixed size={19} />
          </button>
        </div>
      </div>

      {/* 비로그인 지도 안내 */}
      <div className="mt-4 rounded-[20px] border border-blue-100 bg-white px-5 py-6 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50">
          <MapPinned size={25} className="text-blue-600" />
        </div>

        <h2 className="mt-3 text-[16px] font-black">
          내 주변 일자리를 지도에서 확인하세요
        </h2>

        <p className="mt-2 text-[12px] leading-5 text-slate-500">
          지도, 지역 검색, 내 위치, 정렬 변경,
          <br />
          채용공고 상세정보는 로그인 후 이용할 수 있습니다.
        </p>

        <button
          type="button"
          onClick={onLogin}
          className="mt-5 w-full rounded-xl bg-blue-600 py-3.5 text-[14px] font-bold text-white"
        >
          로그인하고 이용하기
        </button>
      </div>

      {/* 전국 채용공고 */}
      <section className="mt-7">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[12px] font-bold text-blue-600">
              고용24 채용정보
            </p>
            <h2 className="mt-1 text-[19px] font-black">
              전국 채용공고
            </h2>
            <p className="mt-1 text-[12px] text-slate-500">
              {jobsQuery.isSuccess
                ? `전체 ${total.toLocaleString()}건`
                : "채용정보 조회 중"}
            </p>
          </div>

          
<div className="flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-sm">
  <button
    type="button"
    onClick={() => setSortBy("latest")}
    className={`flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-1.5 text-[10px] font-bold ${
      sortBy === "latest"
        ? "bg-blue-50 text-blue-600"
        : "text-slate-500"
    }`}
  >
    <CalendarDays size={12} />
    등록일순
  </button>

  <button
    type="button"
    onClick={onLogin}
    className="flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-1.5 text-[10px] font-bold text-slate-500"
  >
    <MapPin size={12} />
    거리순
  </button>

  <button
    type="button"
    onClick={onLogin}
    className={`flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-1.5 text-[10px] font-bold ${
      sortBy === "deadline"
        ? "bg-blue-50 text-blue-600"
        : "text-slate-500"
    }`}
  >
    <Clock3 size={12} />
    마감임박순
  </button>
</div>

        </div>

        {jobsQuery.isLoading && (
          <div className="mt-5 rounded-xl bg-white p-8 text-center text-sm text-slate-500">
            채용공고를 불러오고 있습니다...
          </div>
        )}

        {jobsQuery.isError && (
          <div className="mt-5 rounded-xl border bg-white p-5 text-center">
            <p className="text-sm text-red-600">
              채용공고를 불러오지 못했습니다.
            </p>
            <button
              type="button"
              onClick={() => jobsQuery.refetch()}
              className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white"
            >
              다시 시도
            </button>
          </div>
        )}

        {jobsQuery.isSuccess && jobs.length === 0 && (
          <p className="mt-5 rounded-xl bg-white p-8 text-center text-sm text-slate-500">
            표시할 채용공고가 없습니다.
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2.5">
  {displayedJobs.map((job) => (
            <button
              key={job.id}
              type="button"
              onClick={onLogin}
              className="rounded-[18px] border border-slate-100 bg-white p-4 text-left shadow-[0_4px_16px_rgba(18,48,88,.04)] transition-colors active:bg-blue-50"
            >
              <p className="truncate text-[12px] font-bold text-blue-600">
                {job.company || "기관명 확인 필요"}
              </p>

              <h3 className="mt-1.5 line-clamp-2 min-h-[36px] text-[12px] font-extrabold leading-[18px]">
                {job.title}
              </h3>

             <p className="mt-2 text-[11px] font-bold text-slate-800">
                {job.salary || "급여 정보 확인"}
              </p>

              <div className="mt-3 flex items-start gap-1 text-[12px] text-slate-500">
                <MapPin size={14} className="mt-0.5 shrink-0" />
                <span className="line-clamp-1">
                  {job.address || "근무지 확인 필요"}
                </span>
              </div>

              
<div className="mt-3 border-t border-slate-100 pt-2.5">
  <div className="flex items-center justify-between gap-1 text-[10px] text-slate-500">
    <span className="flex items-center gap-1">
      <MapPin size={11} />
      거리 미정
    </span>

    <span className="truncate">
      {job.employmentType || "고용형태 미정"}
    </span>
  </div>

  <div className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-500">
    <Clock3 size={11} />
    {shortDate(job.closesAt)} 마감
  </div>
</div>

            </button>
          ))}
        </div>

        {/* 페이지 이동 */}
        {jobsQuery.isSuccess && totalPages > 1 && (
          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((v) => Math.max(1, v - 1))}
              className="rounded-lg border bg-white px-4 py-2 text-xs font-bold disabled:opacity-40"
            >
              이전
            </button>

            <span className="text-[12px] font-bold text-slate-600">
              {page} / {totalPages}
            </span>

            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((v) => Math.min(totalPages, v + 1))}
              className="rounded-lg border bg-white px-4 py-2 text-xs font-bold disabled:opacity-40"
            >
              다음
            </button>
          </div>
        )}
      </section>

      {/* 기존 실무교육 배너 */}
      <a
        href={PRACTICE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-8 block overflow-hidden rounded-2xl bg-[#e9f3ff]"
      >
        {!bannerFailed ? (
          <img
            src={BANNER}
            alt="사회복지 실무교육 안내"
            className="w-full object-cover"
            onError={() => setBannerFailed(true)}
          />
        ) : (
          <div className="p-5">
            <p className="text-xs font-bold text-blue-600">
              사회복지 실무교육 안내
            </p>
            <p className="mt-2 text-lg font-black">
              실무교육 자세히 보기
            </p>
          </div>
        )}
      </a>

      <p className="mt-5 text-center text-[11px] leading-5 text-slate-400">
        채용정보 제공: 고용24
        <br />
        실제 자격요건과 마감 여부는 원문에서 확인해주세요.
      </p>
    </div>
  );
}


function LegacyEmploymentJobs({
  portalToken,
  onPortalLogin,
  onSessionChange,
  onBack,
}: {
  portalToken: string;
  onPortalLogin: (token: string) => void;
  onSessionChange: (
    session: { token: string; expiresAt: number } | null
  ) => void;
  onBack: () => void;
}) {
  const [session,setSession]=useState<{token:string;expiresAt:number}|null>(()=>readSession());
const activeToken = portalToken || session?.token || "";
    const [name,setName]=useState("");
  const [phone,setPhone]=useState("");
  const [showLogin,setShowLogin]=useState(false);
  const [loginError,setLoginError]=useState("");
  const [keyword,setKeyword]=useState("");
  const [draftKeyword,setDraftKeyword]=useState("");
  const [draftAddress,setDraftAddress]=useState("");
  const [referencePoint,setReferencePoint]=useState<{lat:number;lng:number}|null>(null);
// 주소 검색과 GPS 요청의 순서를 관리
const locationRequestRef = useRef(0);
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [showDetail,setShowDetail]=useState(false);
  const [showList,setShowList]=useState(true);
  const [bannerFailed,setBannerFailed]=useState(false);
  const [imageFailed,setImageFailed]=useState(false);
  const verify = trpc.studentPortal.login.useMutation();
 const jobsQuery = trpc.employmentCenter.nearbyJobs.useQuery(
  {
    token: activeToken,
    lat: referencePoint?.lat ?? 37.5665,
    lng: referencePoint?.lng ?? 126.978,
  },
  {
    enabled: !!activeToken && !!referencePoint,
    refetchOnWindowFocus: false,
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.preparing ? 3000 : false,
  }
);
  const jobs = useMemo<Job[]>(() => {
  if (!referencePoint || !jobsQuery.data) return [];

  return (jobsQuery.data.jobs || []) as Job[];
}, [jobsQuery.data, referencePoint]);
  const detailQuery =
  trpc.employmentCenter.jobDetail.useQuery(
    {
      token: activeToken,
      wantedAuthNo: selectedId || "",
    },
    {
      enabled:
        Boolean(activeToken) &&
        Boolean(selectedId) &&
        showDetail,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );
  const selected=jobs.find(j=>j.id===selectedId)||null;
const mapJobs = useMemo<Job[]>(
  () => jobs.filter((job) => {
    const q = keyword.trim().toLowerCase();
    return (
      !q ||
      `${job.company} ${job.title} ${job.address}`
        .toLowerCase()
        .includes(q)
    );
  }),
  [jobs, keyword]
);

const filtered = mapJobs;
  const total = jobsQuery.data?.total ?? 0;
const displayedCount = filtered.length;
const nearbyCount = jobs.length;

  useEffect(() => {
  if (!session) return;

  const ms = session.expiresAt - Date.now();

  if (ms <= 0) {
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
    onSessionChange(null);
    return;
  }

  const timer = window.setTimeout(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
    onSessionChange(null);
  }, ms);

  return () => window.clearTimeout(timer);
}, [session, onSessionChange]);
  
async function login(e: React.FormEvent) {
  e.preventDefault();
  setLoginError("");

  const digits = phone.replace(/\D/g, "");

  if (
    name.trim().length < 2 ||
    digits.length < 10 ||
    digits.length > 11
  ) {
    setLoginError(
      "이름과 휴대폰 번호를 정확히 입력해주세요."
    );
    return;
  }

  try {
    const deviceToken =
      getEmploymentTrialDeviceToken();

    const res = await verify.mutateAsync({
      slug: SUPPORT_PORTAL_SLUG,
      clientName: name.trim(),
      phone: digits,
      deviceToken,
    });

    if (!res.success || !res.token) {
      setLoginError(
        "등록회원 정보를 확인하지 못했습니다."
      );
      return;
    }

    // 학생일정포털과 공통으로 사용하는 토큰 저장
    window.localStorage.setItem(
      SUPPORT_PORTAL_TOKEN_KEY,
      res.token
    );

    // 이전 취업정보센터 세션 정리
    window.sessionStorage.removeItem(
      SESSION_KEY
    );

    setSession(null);
    onSessionChange(null);

    // 통합지원센터 전체에 로그인 상태 반영
    onPortalLogin(res.token);

    // 기존 채용공고 상세 화면 초기화
    setSelectedId(null);
    setShowDetail(false);

  } catch (err: any) {
    setLoginError(
      err?.message ||
      "회원 확인 중 오류가 발생했습니다."
    );
  }
}  

  function selectJob(job:EmploymentMapJob){setSelectedId(String(job.id));setShowDetail(true);setShowList(true);}
  function searchPlace(e: React.FormEvent) {
  e.preventDefault();

  const address = draftAddress.trim();
  if (!address) return;

  // 이전 주소 검색 및 GPS 요청 무효화
  const requestId = ++locationRequestRef.current;

  const kakao = window.kakao;

  if (!kakao?.maps?.services) {
    alert("지도를 준비하고 있습니다. 잠시 후 다시 검색해주세요.");
    return;
  }

  const applyLocation = (lat: number, lng: number) => {
    // 최신 검색 요청만 반영
    if (requestId !== locationRequestRef.current) return;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      alert("검색한 위치의 좌표를 확인할 수 없습니다.");
      return;
    }
    setReferencePoint({ lat, lng });
    setSelectedId(null);
    setShowDetail(false);
  };

  const geocoder = new kakao.maps.services.Geocoder();

  geocoder.addressSearch(
    address,
    (results: any[], status: string) => {
      if (requestId !== locationRequestRef.current) return;

      if (
        status === kakao.maps.services.Status.OK &&
        results?.length
      ) {
        applyLocation(
          Number(results[0].y),
          Number(results[0].x)
        );
        return;
      }

      const places = new kakao.maps.services.Places();

      places.keywordSearch(
        address,
        (items: any[], placeStatus: string) => {
          if (requestId !== locationRequestRef.current) return;

          if (
            placeStatus === kakao.maps.services.Status.OK &&
            items?.length
          ) {
            applyLocation(
              Number(items[0].y),
              Number(items[0].x)
            );
          } else {
            alert("검색한 지역을 찾을 수 없습니다.");
          }
        }
      );
    }
  );
}

  function findCurrentLocation() {
  const requestId = ++locationRequestRef.current;

  if (!navigator.geolocation) {
    alert("위치 서비스를 사용할 수 없습니다.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      if (requestId !== locationRequestRef.current) return;

      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        alert("현재 위치의 좌표를 확인할 수 없습니다.");
        return;
      }

      setReferencePoint({ lat, lng });
      setDraftAddress("");
      setSelectedId(null);
      setShowDetail(false);
    },
    () => {
      if (requestId !== locationRequestRef.current) return;

      alert(
        "현재 위치를 확인할 수 없습니다. 주소를 직접 입력해주세요."
      );
    },
    {
      enableHighAccuracy: false,
      timeout: 10000,
    }
  );
}

       
if (!activeToken) {
  return (
    <>
      {/* 기존 비로그인 채용공고 화면 유지 */}
      <PublicEmploymentJobs
        onLogin={() => setShowLogin(true)}
      />

      {/* 등록회원 로그인 팝업 */}
      {showLogin && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 px-4 py-5 backdrop-blur-[3px]"
          onClick={() => setShowLogin(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="등록회원 로그인"
            className="max-h-[90dvh] w-full max-w-[420px] overflow-y-auto rounded-[24px] bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 상단 */}
            <div className="flex items-start justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <ShieldCheck size={25} />
              </div>

              <button
                type="button"
                onClick={() => setShowLogin(false)}
                aria-label="닫기"
                className="rounded-full bg-slate-100 p-2 text-slate-500"
              >
                <X size={19} />
              </button>
            </div>

            <h2 className="mt-4 text-[20px] font-black tracking-tight text-slate-900">
              등록회원은 무료로 이용할 수 있어요!
            </h2>

            <p className="mt-2 break-keep text-[12px] leading-5 text-slate-500">
              로그인하시면 채용공고 상세정보부터
              내 주변 일자리까지 확인하실 수 있습니다.
            </p>

            {/* 제공 기능 */}
            <div className="mt-4 space-y-3 rounded-2xl bg-[#f3f7ff] p-4">
              {[
                "채용공고 상세정보 무료 열람",
                "지도 기반 내 주변 일자리 확인",
                "거리순 정렬 및 지역·주소 검색",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-2.5"
                >
                  <ShieldCheck
                    size={17}
                    className="shrink-0 text-blue-600"
                  />
                  <span className="text-[12px] font-semibold text-slate-700">
                    {item}
                  </span>
                </div>
              ))}
            </div>

            {/* 등록회원 로그인 */}
            <div className="mt-5 border-t border-slate-100 pt-5">
              <h3 className="text-[14px] font-extrabold text-slate-900">
                이미 등록회원이신가요?
              </h3>

              <p className="mt-1 text-[11px] text-slate-500">
                등록하신 이름과 휴대폰 번호를 입력해주세요.
              </p>

              <form onSubmit={login} className="mt-3 space-y-2.5">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="이름"
                  autoComplete="name"
                  required
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-[13px] outline-none focus:border-blue-500"
                />

                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="휴대폰 번호"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-[13px] outline-none focus:border-blue-500"
                />

                {loginError && (
                  <p role="alert" className="text-[12px] text-red-600">
                    {loginError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={verify.isPending}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0967f6] text-[14px] font-extrabold text-white disabled:opacity-50"
                >
                  {verify.isPending
                    ? "로그인 확인 중..."
                    : "등록회원 로그인"}
                  <ArrowRight size={16} />
                </button>
              </form>
            </div>

            {/* 취득 가이드와 상담 */}
            <div className="mt-5 border-t border-slate-100 pt-5">
              <h3 className="text-center text-[13px] font-extrabold text-slate-900">
                사회복지사 2급을 처음 알아보시나요?
              </h3>

              <a
                href="/social-worker-guide"
                className="mt-3 flex h-11 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 text-[12px] font-bold text-blue-700"
              >
                사회복지사 2급 취득 가이드
                <ArrowRight size={15} />
              </a>

              <button
                type="button"
                onClick={() => {
                  setShowLogin(false);
                  onBack();
                  window.setTimeout(() => {
                    document
                      .querySelector<HTMLButtonElement>(
                        '[data-support-consultation]'
                      )
                      ?.click();
                  }, 0);
                }}
                className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-100 text-[12px] font-bold text-slate-700"
              >
                사회복지사 2급 상담 신청
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


  return <div className="min-h-screen bg-[#edf3fa] text-slate-900">
    <div className="relative mx-auto flex min-h-screen max-w-[560px] flex-col bg-white shadow-[0_0_40px_rgba(18,48,88,.09)]">
     



{/* 로그인 후 일자리 찾기 배너 */}
<div className="px-4 pt-4">
  <div className="overflow-hidden rounded-[22px]">
    <img
      src={JOBS_HERO_BANNER}
      alt="사회복지 일자리 찾기"
      className="block h-auto w-full"
    />
  </div>
</div>
 
<header className="z-20 bg-white px-5 pb-4 pt-2">

        <form onSubmit={searchPlace} className="mt-5 flex gap-2"><div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3.5"><MapPin size={19} className="shrink-0 text-blue-600"/><input value={draftAddress} onChange={e=>setDraftAddress(e.target.value)} placeholder="지역·주소 검색 (예: 서울 노원구)" className="min-w-0 flex-1 bg-transparent py-3.5 text-sm outline-none"/></div><button className="rounded-2xl bg-[#0967f6] px-4 text-sm font-bold text-white">검색</button><button type="button" onClick={findCurrentLocation} aria-label="현재 위치" className="rounded-2xl border border-slate-200 px-3 text-blue-600"><LocateFixed size={20}/></button></form>
      </header>

      <div className="relative h-[42vh] min-h-[280px] max-h-[470px] bg-slate-100">
        <EmploymentKakaoMap
  jobs={mapJobs}
  selectedId={selectedId}
  referencePoint={referencePoint}
  onSelectJob={selectJob}
  className="h-full w-full"
/>
        <div className="pointer-events-none absolute left-4 top-4 rounded-full bg-white/95 px-3 py-2 text-xs font-extrabold text-blue-700 shadow-md">지도에 표시된 공고 {mapJobs.filter(
  job => job.latitude != null && job.longitude != null
).length}건</div>
        <button onClick={()=>setShowList(v=>!v)} className="absolute bottom-4 right-4 flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-xs font-black text-blue-700 shadow-lg"><SlidersHorizontal size={16}/>{showList?"목록 접기":"공고 목록 보기"}</button>
      </div>
      {showList&&<section className="relative z-10 -mt-3 flex-1 rounded-t-[28px] bg-white px-4 pb-12 pt-5 shadow-[0_-8px_30px_rgba(14,41,80,.08)]">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-200"/>
        <div className="flex items-end justify-between"><div><p className="text-xs font-bold text-blue-600">사회복지 분야 채용정보</p><h2 className="mt-1 text-[21px] font-black">
  가까운 채용공고{" "}
  <span className="text-blue-600">
    {nearbyCount}건
  </span>
</h2></div><div className="text-right">
  <p className="text-[11px] text-slate-400">
    출처: 고용24
  </p>
  <p className="mt-1 text-[11px] text-slate-400">
    전체 공고 {total.toLocaleString()}건
  </p>
</div></div>
        <form onSubmit={e=>{e.preventDefault();setKeyword(draftKeyword)}} className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3"><Search size={18} className="text-slate-400"/><input value={draftKeyword} onChange={e=>setDraftKeyword(e.target.value)} placeholder="회사명 또는 공고명 검색 (가까운 30건)" className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none"/><button className="text-xs font-extrabold text-blue-600">검색</button></form>
        <div className="mt-3 flex items-center justify-between">
  <span className="text-xs font-bold text-blue-600">
    거리순으로 표시 중
  </span>
  <span className="text-[11px] text-slate-400">
    가까운 공고 {displayedCount}건
  </span>
</div>
        {!referencePoint && (
  <p className="py-8 text-center text-sm text-slate-500">
    상단에서 주소를 검색하거나 현재 위치를 선택해주세요.
  </p>
)}

{referencePoint && jobsQuery.isLoading && (
  <p className="py-8 text-center text-sm text-slate-500">
    채용공고를 조회하고 있습니다...
  </p>
)}

{jobsQuery.data?.preparing && (
  <p>
    주변 채용공고를 검색하고 있습니다.
    검색된 공고부터 순서대로 표시됩니다.
  </p>
)}
{jobsQuery.isError && (
  <div className="py-8 text-center">
    <p className="text-sm text-red-600">
      채용공고를 불러오지 못했습니다.
    </p>

    <p className="mt-2 text-xs text-slate-500">
      {jobsQuery.error.message}
    </p>

    <button
      type="button"
      onClick={() => jobsQuery.refetch()}
      className="mt-3 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white"
    >
      다시 시도
    </button>
  </div>
)}

        {referencePoint &&
!jobsQuery.isLoading &&
!jobsQuery.isError &&
!jobsQuery.data?.preparing &&
filtered.length === 0&&<p className="py-12 text-center text-sm text-slate-500">검색 조건에 맞는 채용공고가 없습니다.</p>}
        <div className="mt-4 space-y-3">{filtered.map(job=>{
          const distance = job.distanceKm ?? null;
          return <button key={job.id} onClick={()=>selectJob(job)} className={`flex w-full gap-3 rounded-2xl border p-3.5 text-left transition-colors ${selectedId===job.id?"border-blue-400 bg-blue-50":"border-slate-100 bg-white shadow-[0_4px_16px_rgba(18,48,88,.05)]"}`}>
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-blue-50">{!imageFailed?<img src={COMPANY_IMAGE} alt="공통 복지시설 이미지" className="h-full w-full object-cover" onError={()=>setImageFailed(true)}/>:<div className="flex h-full w-full items-center justify-center text-blue-500"><BriefcaseBusiness size={26}/></div>}</div>
            <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-blue-600">{job.company||"회사명 미표기"}</p><h3 className="mt-1 line-clamp-2 text-[14px] font-extrabold leading-snug">{job.title}</h3><p className="mt-2 flex items-start gap-1 text-xs text-slate-500"><MapPin size={13} className="mt-0.5 shrink-0"/><span className="line-clamp-1">{job.address||"근무지 확인 필요"}{distance!==null?` · ${distance.toFixed(1)}km`:""}</span></p><div className="mt-2 flex items-center justify-between gap-1"><span className="line-clamp-1 text-xs font-extrabold text-slate-800">{job.salary||"급여 정보 확인"}</span><span className="shrink-0 text-[11px] text-slate-400">{shortDate(job.closesAt)} 마감</span></div></div>
          </button>;
        })}</div>
        <a
  href={PRACTICE_URL}
  target="_blank"
  rel="noopener noreferrer"
  aria-label="나랑에듀 사회복지사 실무교육 자세히 보기"
  className="mt-8 block overflow-hidden rounded-2xl bg-[#e9f3ff] transition-transform hover:scale-[1.01]"
>
  {!bannerFailed ? (
    <img
      src={BANNER}
      alt="사회복지사 실무교육 자세히 보기"
      className="w-full object-cover"
      onError={() => setBannerFailed(true)}
    />
  ) : (
    <div className="p-5">
      <p className="text-xs font-bold text-blue-600">
  사회복지 실무교육 안내
</p>
      <p className="mt-1 text-lg font-black">
        사회복지 실무교육 자세히 보기 →
      </p>
    </div>
  )}
</a>
        <p className="mt-5 text-center text-[11px] leading-5 text-slate-400">채용공고는 고용24 제공 정보이며, 실제 채용 조건과 마감 여부는 해당 공고에서 확인해주세요. 주소 변환이 불가능한 공고는 지도에 표시되지 않을 수 있습니다.</p>
      </section>}
      {showDetail&&selected&&<div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/45" onClick={()=>setShowDetail(false)}><div role="dialog" aria-modal="true" aria-label="채용공고 상세정보" onClick={e=>e.stopPropagation()} className="max-h-[82vh] w-full max-w-[560px] overflow-y-auto rounded-t-[28px] bg-white p-5 shadow-2xl"><div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-200"/><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-blue-600">{selected.company}</p><h2 className="mt-2 text-xl font-black leading-snug">{selected.title}</h2></div><button onClick={()=>setShowDetail(false)} aria-label="닫기" className="rounded-full bg-slate-100 p-2"><X size={20}/></button></div><div className="mt-5 space-y-3 rounded-2xl bg-slate-50 p-4 text-sm"><p className="flex gap-2"><MapPin size={18} className="shrink-0 text-blue-600"/>{selected.address||"근무지 정보 없음"}</p><p className="flex gap-2"><BriefcaseBusiness size={18} className="shrink-0 text-blue-600"/>{selected.salary||"급여 확인 필요"}</p><p className="flex gap-2"><Clock3 size={18} className="shrink-0 text-blue-600"/>마감일 {shortDate(selected.closesAt)}</p>{selected.employmentType&&<p className="text-slate-600">고용형태: {selected.employmentType}</p>}</div><p className="mt-5 text-sm font-bold">공고 상세정보</p>{detailQuery.isLoading&&<p className="mt-2 text-sm text-slate-500">상세정보를 확인하는 중...</p>}{detailQuery.isError&&<p className="mt-2 text-xs text-slate-500">상세정보를 불러오지 못했습니다. 고용24 원문에서 확인해주세요.</p>}{detailQuery.isSuccess&&<p className="mt-2 text-xs text-slate-500">고용24 상세공고를 조회했습니다. 자세한 지원조건과 모집내용은 원문에서 확인해주세요.</p>}<a href={selected.detailUrl||`https://www.work24.go.kr/`} target="_blank" rel="noopener noreferrer" className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0967f6] px-5 py-4 text-sm font-black text-white">고용24에서 공고 확인하기 <ExternalLink size={17}/></a></div></div>}
    </div>
  </div>;
}
