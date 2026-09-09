import { useEffect, useMemo, useState } from "react";
import { useRoute } from "wouter";
import { UsersRound, ChevronRight } from "lucide-react";
import { trpc } from "@/lib/trpc";
import StudentPortalCommunity from "./StudentPortalCommunity";

const PORTAL_TOKEN_KEY_PREFIX = "student_portal_token:";

const PORTAL_IMAGES = {
  login: "/images/portal/portal-login.png",
  home: "/images/portal/portal-home.png",
  myWork: "/images/portal/portal-mywork.png",
  practice: "/images/portal/portal-practice.png",
  administration: "/images/portal/portal-admin.png",
  community: "/images/portal/portal-community.png",
} as const;

function normalizePhone(value: string) {
  return value
    .replace(/\D/g, "")
    .slice(0, 11);
}

function formatPhone(value: string) {
  const digits =
    normalizePhone(value);

  if (digits.length <= 3) {
    return digits;
  }

  if (digits.length <= 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }

  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

type PortalTab =
  | "home"
  | "myWork"
  | "practice"
  | "administration"
  | "community";

type MyWorkSection =
  | "learning"
  | "requirements"
  | "safety";

type PracticeSection =
  | "status"
  | "guide";

type AdministrationView =
  | "list"
  | "learnerRegistration"
  | "creditRecognition"
  | "degreeApplication"
  | "qualificationApplication";

export default function StudentPortalPage() {
  const [, params] =
    useRoute(
      "/portal/:slug"
    );

  const slug =
  String(
    params?.slug || ""
  )
    .trim()
    .toLowerCase();

const openTeamPage = () => {
  if (!slug) {
    return;
  }

  window.location.href =
    `/team/${encodeURIComponent(slug)}`;
};

const tokenStorageKey =
    useMemo(
      () =>
        `${PORTAL_TOKEN_KEY_PREFIX}${slug}`,
      [slug]
    );

  const [portalToken, setPortalToken] =
    useState<string | null>(
      null
    );

  const [tokenReady, setTokenReady] =
    useState(false);

  const [clientName, setClientName] =
    useState("");

  const [phone, setPhone] =
    useState("");

  const [loginError, setLoginError] =
    useState<string | null>(
      null
    );

  /**
   * 업무포털 현재 화면.
   */
  const [activeTab, setActiveTab] =
    useState<PortalTab>(
      "home"
    );

  /**
   * 마이업무 내부 탭.
   */
  const [
    myWorkSection,
    setMyWorkSection,
  ] =
    useState<MyWorkSection>(
      "learning"
    );

  /**
   * 학기 상세 화면.
   *
   * null이면 학기 목록,
   * 숫자가 있으면 해당 학기 상세.
   */
  const [
    selectedSemesterOrder,
    setSelectedSemesterOrder,
  ] =
    useState<number | null>(
      null
    );


  /**
   * 실습 내부 화면.
   *
   * status:
   * MY 실습현황
   *
   * guide:
   * 실습 안내가이드
   */
  const [
    practiceSection,
    setPracticeSection,
  ] =
    useState<PracticeSection>(
      "status"
    );
  /**
   * 행정절차 내부 화면.
   *
   * list:
   * 행정절차 목록
   *
   * learnerRegistration:
   * 학습자등록 상세 가이드
   */
  const [
    administrationView,
    setAdministrationView,
  ] =
    useState<AdministrationView>(
      "list"
    );

  /**
   * 브라우저 저장 토큰 로드.
   *
   * 회사 slug별로 별도 저장한다.
   *
   * 예:
   * student_portal_token:with-one
   */
  useEffect(() => {
    if (!slug) {
      setTokenReady(true);
      return;
    }

    try {
      const savedToken =
        window.localStorage.getItem(
          tokenStorageKey
        );

      setPortalToken(
        savedToken || null
      );
    } catch {
      setPortalToken(null);
    } finally {
      setTokenReady(true);
    }
  }, [
    slug,
    tokenStorageKey,
  ]);

  /**
   * 공개 포털 기본정보.
   *
   * 로그인 전에도 회사명/로고/포털명 등을 보여준다.
   */
  const portalInfoQuery =
    trpc.studentPortal.publicInfo.useQuery(
      {
        slug,
      },
      {
        enabled:
          Boolean(slug),

        retry:
          false,
      }
    );

  /**
   * 저장된 Portal Token 검증.
   *
   * 유효한 경우 학생 화면으로 진입한다.
   */
  const meQuery =
    trpc.studentPortal.me.useQuery(
      {
        token:
          portalToken || "",
      },
      {
        enabled:
          tokenReady &&
          Boolean(
            portalToken
          ),

        retry:
          false,
      }
    );

  /**
   * 등록자 마이업무.
   *
   * 브라우저에서는 Portal Token만 전달한다.
   * organizationId / studentId는 보내지 않는다.
   */
  const myWorkQuery =
    trpc.studentPortal.myWork.useQuery(
      {
        token:
          portalToken || "",
      },
      {
        enabled:
          tokenReady &&
          Boolean(
            portalToken
          ),

        retry:
          false,
      }
    );

  /**
   * 등록자 MY 실습현황.
   *
   * 브라우저에서는 Portal Token만 전달한다.
   */
  const practiceQuery =
    trpc.studentPortal.practice.useQuery(
      {
        token:
          portalToken || "",
      },
      {
        enabled:
          tokenReady &&
          Boolean(
            portalToken
          ),

        retry:
          false,
      }
    );

  /**
   * 학습자등록 완료.
   *
   * 브라우저에서는 Portal Token만 전달한다.
   */
  const completeLearnerRegistrationMutation =
    trpc.studentPortal
      .completeLearnerRegistration
      .useMutation();

const completeCreditRecognitionMutation =
  trpc.studentPortal
    .completeCreditRecognition
    .useMutation();

const completeDegreeApplicationMutation =
  trpc.studentPortal
    .completeDegreeApplication
    .useMutation();

const completeQualificationApplicationMutation =
  trpc.studentPortal
    .completeQualificationApplication
    .useMutation();

  /**
   * 이름 + 전화번호 인증.
   */
  const loginMutation =
    trpc.studentPortal.login.useMutation({
      onSuccess:
        result => {
          try {
            window.localStorage.setItem(
              tokenStorageKey,
              result.token
            );
          } catch {
            // localStorage 저장 실패 시에도
            // 현재 세션에서는 계속 사용 가능
          }

          setPortalToken(
            result.token
          );

          setLoginError(
            null
          );
        },

      onError:
        error => {
          setLoginError(
            error.message ||
            "등록회원 정보를 확인할 수 없습니다."
          );
        },
    });

  /**
   * 로그아웃.
   */
  const logoutMutation =
    trpc.studentPortal.logout.useMutation({
      onSettled:
        () => {
          try {
            window.localStorage.removeItem(
              tokenStorageKey
            );
          } catch {
            // ignore
          }

          setPortalToken(
            null
          );

          setClientName("");
          setPhone("");

          setActiveTab(
            "home"
          );

          setMyWorkSection(
            "learning"
          );

          setPracticeSection(
            "status"
          );

          setSelectedSemesterOrder(
            null
          );

          setAdministrationView(
            "list"
          );
        },
    });

    /**
   * 저장된 Portal Token이 서버에서
   * 실제로 만료/폐기된 경우에만 제거한다.
   *
   * 네트워크 오류 / 서버 500 / 일시적인 장애에서는
   * 정상 토큰을 삭제하지 않는다.
   */
  useEffect(() => {
    if (
      !portalToken ||
      !meQuery.isError
    ) {
      return;
    }

    const error =
      meQuery.error as any;

    const errorCode =
      String(
        error?.data?.code ||
        error?.shape?.data?.code ||
        ""
      )
        .trim()
        .toUpperCase();

    const httpStatus =
      Number(
        error?.data?.httpStatus ||
        error?.shape?.data?.httpStatus ||
        0
      );

    const isAuthenticationError =
      errorCode ===
        "UNAUTHORIZED" ||
      errorCode ===
        "AUTH_REQUIRED" ||
      httpStatus ===
        401;

    /**
     * 인증 오류가 아니면
     * Portal Token을 그대로 유지한다.
     *
     * 서버 500 / 네트워크 오류 /
     * 일시적인 API 장애 때문에
     * 회원을 로그아웃시키지 않는다.
     */
    if (
      !isAuthenticationError
    ) {
      return;
    }

    try {
      window.localStorage.removeItem(
        tokenStorageKey
      );
    } catch {
      // ignore
    }

    setPortalToken(
      null
    );
  }, [
    portalToken,
    meQuery.isError,
    meQuery.error,
    tokenStorageKey,
  ]);

  if (
    portalInfoQuery.isLoading
  ) {
    return (
      <PortalScreen>
        <div className="flex min-h-[70vh] items-center justify-center">
          <div className="text-sm text-slate-500">
            업무포털을 불러오고 있습니다.
          </div>
        </div>
      </PortalScreen>
    );
  }

  if (
    portalInfoQuery.isError ||
    !portalInfoQuery.data
  ) {
    return (
      <PortalScreen>
        <div className="flex min-h-[70vh] items-center justify-center px-6">
          <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <div className="text-lg font-bold text-slate-900">
              업무포털을 이용할 수 없습니다.
            </div>

            <div className="mt-2 text-sm leading-6 text-slate-500">
              주소가 올바른지 확인하거나
              담당 교육원에 문의해주세요.
            </div>
          </div>
        </div>
      </PortalScreen>
    );
  }

  const portal =
    portalInfoQuery.data;

  const primaryColor =
    String(
      portal.primaryColor ||
      "#2563eb"
    );

  /**
   * 토큰 검증 중
   */
  if (
    portalToken &&
    (
      !tokenReady ||
      meQuery.isLoading
    )
  ) {
    return (
      <PortalScreen>
        <PortalHeader
          portalName={
            portal.portalName
          }
          companyLogoUrl={
            portal.companyLogoUrl
          }
        />

        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-sm text-slate-500">
            등록정보를 확인하고 있습니다.
          </div>
        </div>
      </PortalScreen>
    );
  }

    /**
   * ---------------------------------------------------------
   * 인증 성공 후 업무포털
   * ---------------------------------------------------------
   */
  if (
    portalToken &&
    meQuery.data?.authenticated
  ) {
    const student =
      meQuery.data.student;

    const myWork =
      myWorkQuery.data;

    const learnerRegistrationProcedure =
      myWork
        ?.administrativeProcedures
        ?.find(
          (
            row:
              any
          ) =>
            row.procedureType ===
            "learner_registration"
        ) ??
      null;

const creditRecognitionProcedure =
  myWork
    ?.administrativeProcedures
    ?.find(
      (
        row:
          any
      ) =>
        row.procedureType ===
        "credit_recognition"
    ) ??
  null;

const degreeApplicationProcedure =
  myWork
    ?.administrativeProcedures
    ?.find(
      (
        row:
          any
      ) =>
        row.procedureType ===
        "degree_application"
    ) ??
  null;

const degreeApplicationInfo =
  myWork?.degreeApplication ??
  null;

const qualificationApplicationProcedure =
  myWork
    ?.administrativeProcedures
    ?.find(
      (
        row:
          any
      ) =>
        row.procedureType ===
        "qualification_application"
    ) ??
  null;

const qualificationApplicationInfo =
  myWork?.qualificationApplication ??
  null;

const practicePrerequisite =
  (() => {
    const semesters =
      Array.isArray(
        myWork?.semesters
      )
        ? myWork.semesters
        : [];

    const subjects =
      Array.isArray(
        myWork?.subjects
      )
        ? myWork.subjects
        : [];

    /**
     * MY 학적부에서 사용하는 학기 원본을
     * 학기번호 기준으로 연결한다.
     */
    const semesterByOrder =
      new Map<
        number,
        any
      >();

    semesters.forEach(
      (
        semester:
          any
      ) => {
        const semesterOrder =
          Number(
            semester
              ?.semesterOrder ||
            0
          );

        if (
          !Number.isFinite(
            semesterOrder
          ) ||
          semesterOrder <=
            0
        ) {
          return;
        }

        semesterByOrder.set(
          semesterOrder,
          semester
        );
      }
    );

    /**
     * 실습 선이수 화면에는
     * 현재 실제 수강 중이거나
     * 이미 이수한 과목만 표시한다.
     *
     * 예정 / 확인필요 / 재수강은
     * 목록과 계산에서 완전히 제외한다.
     */
    const prerequisiteSubjectMap =
      new Map<
        string,
        {
          subjectName:
            string;

          requirementType:
            "전공필수" |
            "전공선택";

          statusKey:
            "completed" |
            "in_progress";

          statusLabel:
            "이수완료" |
            "진행중";

          semesterNo:
            number;
        }
      >();

    subjects.forEach(
      (
        subject:
          any
      ) => {
        const subjectName =
          String(
            subject
              ?.subjectName ||
            ""
          )
            .trim()
            .replace(
              /\s+/g,
              " "
            );

        if (
          !subjectName
        ) {
          return;
        }

        const requirementType =
          String(
            subject
              ?.requirementType ||
            ""
          ).trim();

        if (
          requirementType !==
            "전공필수" &&
          requirementType !==
            "전공선택"
        ) {
          return;
        }

        const semesterNo =
          Number(
            subject
              ?.semesterNo ||
            0
          );

        const semester =
          semesterByOrder.get(
            semesterNo
          );

        if (
          !semester
        ) {
          return;
        }

        /**
         * MY 학적부 화면과
         * 완전히 동일한 과목 상태 판정.
         */
        const status =
          resolvePortalSubjectStatus(
            subject,
            semester
          );

        /**
         * 예정 과목은 절대 넣지 않는다.
         *
         * scheduled = 예정
         * retake = 재수강
         * review_required = 확인필요
         *
         * 실습 화면에서는
         * completed / in_progress만 허용.
         */
        if (
          status.key !==
            "completed" &&
          status.key !==
            "in_progress"
        ) {
          return;
        }

        const normalizedSubjectKey =
          subjectName
            .replace(
              /\s+/g,
              ""
            )
            .toLowerCase();

        const mapKey =
          `${requirementType}:${normalizedSubjectKey}`;

        const nextRow = {
          subjectName,

          requirementType:
            requirementType as
              | "전공필수"
              | "전공선택",

          statusKey:
            status.key as
              | "completed"
              | "in_progress",

          statusLabel:
            status.label as
              | "이수완료"
              | "진행중",

          semesterNo,
        };

        const existing =
          prerequisiteSubjectMap.get(
            mapKey
          );

        /**
         * 같은 과목이 여러 Row에 존재하면
         * 이수완료를 진행중보다 우선한다.
         */
        if (
          !existing ||
          (
            existing.statusKey ===
              "in_progress" &&
            nextRow.statusKey ===
              "completed"
          )
        ) {
          prerequisiteSubjectMap.set(
            mapKey,
            nextRow
          );
        }
      }
    );

    const visibleSubjects =
      Array.from(
        prerequisiteSubjectMap.values()
      );

    const requiredSubjects =
      visibleSubjects.filter(
        subject =>
          subject.requirementType ===
          "전공필수"
      );

    const electiveSubjects =
      visibleSubjects.filter(
        subject =>
          subject.requirementType ===
          "전공선택"
      );

    /**
     * 분자는 반드시 "이수완료"만 계산한다.
     *
     * 진행중 과목은 목록에는 보이지만
     * 4 / 2 충족 숫자에는 포함하지 않는다.
     */
    const requiredCompleted =
      requiredSubjects.filter(
        subject =>
          subject.statusKey ===
          "completed"
      ).length;

    const electiveCompleted =
      electiveSubjects.filter(
        subject =>
          subject.statusKey ===
          "completed"
      ).length;

    return {
      requiredCompleted,

      electiveCompleted,

      requiredTarget:
        4,

      electiveTarget:
        2,

      eligible:
        requiredCompleted >=
          4 &&
        electiveCompleted >=
          2,

      requiredSubjects,

      electiveSubjects,
    };
  })();

    const selectedSemester =
      selectedSemesterOrder !==
        null &&
      myWork
        ? myWork.semesters.find(
            semester =>
              Number(
                semester.semesterOrder
              ) ===
              selectedSemesterOrder
          ) ?? null
        : null;

    const selectedSemesterSubjects =
      selectedSemesterOrder !==
        null &&
      myWork
        ? myWork.subjects.filter(
            subject =>
              Number(
                subject.semesterNo
              ) ===
              selectedSemesterOrder
          )
        : [];

    const goHome =
      () => {
        setActiveTab(
          "home"
        );

        setSelectedSemesterOrder(
          null
        );
      };

    const goMyWork =
      (
        section:
          MyWorkSection =
            "learning"
      ) => {
        setActiveTab(
          "myWork"
        );

        setMyWorkSection(
          section
        );

        setSelectedSemesterOrder(
          null
        );
      };

        const handleBottomTab =
      (
        tab:
          PortalTab
      ) => {
        setActiveTab(
          tab
        );

        setSelectedSemesterOrder(
          null
        );

        setAdministrationView(
          "list"
        );

        if (
          tab ===
          "myWork"
        ) {
          setMyWorkSection(
            "learning"
          );
        }

        if (
          tab ===
          "practice"
        ) {
          setPracticeSection(
            "status"
          );
        }
      };

        const pageTitle =
      activeTab ===
        "myWork"
        ? selectedSemester
          ? `${selectedSemester.semesterOrder}학기 상세`
          : "마이 업무"
        : activeTab ===
            "practice"
          ? "실습"
         : activeTab ===
    "administration"
  ? administrationView ===
      "learnerRegistration"
    ? "학습자등록 가이드"
    : administrationView ===
        "creditRecognition"
      ? "학점인정신청 가이드"
      : administrationView ===
    "degreeApplication"
  ? "학위신청 가이드"
  : administrationView ===
      "qualificationApplication"
    ? "사회복지사 2급 자격증 신청"
    : "행정절차"
            : activeTab ===
                "community"
              ? "커뮤니티"
              : null;

    return (
      <PortalScreen>
                {activeTab ===
        "home" ? (
          <PortalHeader
            portalName={
              portal.portalName
            }
            companyLogoUrl={
              portal.companyLogoUrl
            }
          />
        ) : activeTab ===
          "community" ? null : (
          <PortalSubHeader
            title={
              pageTitle ||
              "업무포털"
            }
            onBack={() => {
              if (
                selectedSemesterOrder !==
                null
              ) {
                setSelectedSemesterOrder(
                  null
                );

                return;
              }

              if (
                activeTab ===
                  "administration" &&
                administrationView !==
                  "list"
              ) {
                setAdministrationView(
                  "list"
                );

                return;
              }

              goHome();
            }}
          />
        )}

        {activeTab !==
  "community" &&
myWorkQuery.isLoading ? (
          <div className="flex min-h-[60vh] items-center justify-center px-6">
            <div className="text-sm text-slate-500">
              학습관리 정보를 확인하고 있습니다.
            </div>
          </div>
        ) : activeTab !==
    "community" &&
  myWorkQuery.isError ? (
          <div className="px-5 py-8">
            <div className="rounded-2xl border border-red-100 bg-red-50 p-5 text-center">
              <div className="font-bold text-red-700">
                학습관리 정보를 불러오지 못했습니다.
              </div>

              <div className="mt-2 text-sm leading-6 text-red-500">
                잠시 후 다시 확인해주세요.
              </div>
            </div>
          </div>
        ) : activeTab ===
          "home" ? (
          <PortalHomeView
            student={
              student
            }
            myWork={
              myWork
            }
            primaryColor={
              primaryColor
            }
            onMyWork={() =>
              goMyWork(
                "learning"
              )
            }
            onPractice={() =>
              handleBottomTab(
                "practice"
              )
            }
            onAdministration={() =>
              handleBottomTab(
                "administration"
              )
            }
            onCommunity={() =>
              handleBottomTab(
                "community"
              )
            }
            onLogout={() => {
              if (
                logoutMutation.isPending ||
                !portalToken
              ) {
                return;
              }

              logoutMutation.mutate({
                token:
                  portalToken,
              });
            }}
            logoutPending={
              logoutMutation.isPending
            }
          />
        ) : activeTab ===
            "myWork" &&
          selectedSemester ? (
          <PortalSemesterDetail
            semester={
              selectedSemester
            }
            subjects={
              selectedSemesterSubjects
            }
            primaryColor={
              primaryColor
            }
          />
                ) : activeTab ===
          "myWork" ? (
          <PortalMyWorkView
            myWork={
              myWork
            }
            section={
              myWorkSection
            }
            primaryColor={
              primaryColor
            }
            onSectionChange={
              setMyWorkSection
            }
            onSemesterSelect={
              semesterOrder =>
                setSelectedSemesterOrder(
                  semesterOrder
                )
            }
          />
        ) : activeTab ===
            "administration" &&
          administrationView ===
            "learnerRegistration" ? (
                    <PortalLearnerRegistrationGuide
            primaryColor={
              primaryColor
            }

            procedure={
              learnerRegistrationProcedure
            }

            isCompleting={
              completeLearnerRegistrationMutation
                .isPending
            }

            errorMessage={
              completeLearnerRegistrationMutation
                .error
                ?.message ??
              null
            }

            onComplete={async () => {
              if (
                !portalToken
              ) {
                return;
              }

              await completeLearnerRegistrationMutation
                .mutateAsync({
                  token:
                    portalToken,
                });

              /**
               * 같은 DB 원본을 다시 읽어
               * Portal 화면에도 즉시 완료상태 반영.
               */
              await myWorkQuery.refetch();
            }}
          />

        ) : activeTab ===
            "administration" &&
          administrationView ===
            "creditRecognition" ? (
          <PortalCreditRecognitionGuide
            primaryColor={
              primaryColor
            }

            procedure={
              creditRecognitionProcedure
            }

            myWork={
              myWork
            }

            isCompleting={
              completeCreditRecognitionMutation
                .isPending
            }

            errorMessage={
              completeCreditRecognitionMutation
                .error
                ?.message ??
              null
            }

            onComplete={async () => {
              if (
                !portalToken
              ) {
                return;
              }

              await completeCreditRecognitionMutation
                .mutateAsync({
                  token:
                    portalToken,
                });

              /**
               * CRM과 동일한 행정절차 원본을
               * 다시 조회하여 화면에 즉시 반영한다.
               */
              await myWorkQuery.refetch();
            }}
          />

        ) : activeTab ===
            "administration" &&
          administrationView ===
            "degreeApplication" ? (
          <PortalDegreeApplicationGuide
            primaryColor={
              primaryColor
            }

            procedure={
              degreeApplicationProcedure
            }

            degreeApplicationInfo={
              degreeApplicationInfo
            }

            isCompleting={
              completeDegreeApplicationMutation
                .isPending
            }

            errorMessage={
              completeDegreeApplicationMutation
                .error
                ?.message ??
              null
            }

            onComplete={async () => {
              if (
                !portalToken
              ) {
                return;
              }

              await completeDegreeApplicationMutation
                .mutateAsync({
                  token:
                    portalToken,
                });

              /**
               * CRM과 동일한 행정절차 원본을
               * 다시 조회하여 완료상태 즉시 반영.
               */
              await myWorkQuery.refetch();
            }}
          />

        ) : activeTab ===
            "administration" &&
          administrationView ===
            "qualificationApplication" ? (
          <PortalSocialWorkerQualificationGuide
            primaryColor={
              primaryColor
            }

            procedure={
              qualificationApplicationProcedure
            }

            myWork={
              myWork
            }

            qualificationApplicationInfo={
              qualificationApplicationInfo
            }

            isCompleting={
              completeQualificationApplicationMutation
                .isPending
            }

            errorMessage={
              completeQualificationApplicationMutation
                .error
                ?.message ??
              null
            }

            onComplete={async () => {
              if (
                !portalToken
              ) {
                return;
              }

              await completeQualificationApplicationMutation
                .mutateAsync({
                  token:
                    portalToken,
                });

              await myWorkQuery.refetch();
            }}
          />

        ) : activeTab ===
          "administration" ? (
                  <PortalAdministrationView
  primaryColor={
    primaryColor
  }

  learnerRegistrationProcedure={
    learnerRegistrationProcedure
  }

  creditRecognitionProcedure={
    creditRecognitionProcedure
  }

  degreeApplicationProcedure={
    degreeApplicationProcedure
  }

  degreeApplicationInfo={
    degreeApplicationInfo
  }

qualificationApplicationProcedure={
  qualificationApplicationProcedure
}

qualificationApplicationInfo={
  qualificationApplicationInfo
}

  onLearnerRegistration={() =>
    setAdministrationView(
      "learnerRegistration"
    )
  }

  onCreditRecognition={() =>
    setAdministrationView(
      "creditRecognition"
    )
  }

  onDegreeApplication={() =>
    setAdministrationView(
      "degreeApplication"
    )
  }

onQualificationApplication={() =>
  setAdministrationView(
    "qualificationApplication"
  )
}
/>

        ) : activeTab ===
            "practice" ? (
          <PortalPracticeView
            practice={
              practiceQuery.data ??
              null
            }
            prerequisite={
              practicePrerequisite
            }
            section={
              practiceSection
            }
            primaryColor={
              primaryColor
            }
            isLoading={
              practiceQuery.isLoading
            }
            isError={
              practiceQuery.isError
            }
            onSectionChange={
              setPracticeSection
            }
          />
               ) : activeTab ===
            "community" ? (
          <StudentPortalCommunity
            token={
              portalToken
            }
            portal={
              portal
            }
            primaryColor={
              primaryColor
            }
            onNavigateTab={
              handleBottomTab
            }
          />
        ) : (
          <PortalComingSoon
            title={
              pageTitle ||
              "업무포털"
            }
          />
        )}

                {activeTab !==
        "community" ? (
          <PortalBottomNav
            primaryColor={
              primaryColor
            }
            activeTab={
              activeTab
            }
            onChange={
              handleBottomTab
            }
          />
        ) : null}
      </PortalScreen>
    );
  }

  /**
   * 로그인 화면
   */
  return (
    <PortalScreen>
      <main className="relative min-h-screen overflow-hidden bg-white">
  <img
    src={PORTAL_IMAGES.login}
    alt=""
    className="absolute inset-0 h-full w-full object-cover"
  />

  <div className="absolute inset-0 bg-white/30" />
  <div className="absolute inset-x-0 bottom-0 h-[68%] bg-gradient-to-t from-white via-white/95 to-transparent" />

  <div className="absolute left-4 top-4 z-20 sm:left-5 sm:top-5">
    <button
      type="button"
      onClick={openTeamPage}
      className="group flex h-10 items-center gap-1.5 rounded-xl border border-white/80 bg-white/90 px-3.5 text-[11px] font-extrabold text-slate-700 shadow-sm backdrop-blur-md transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 sm:h-11 sm:px-4 sm:text-[12px]"
      aria-label="담당자 소개 페이지로 이동"
    >
      <UsersRound className="h-4 w-4 text-blue-600" />

      <span>
        담당자 소개
      </span>

      <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
    </button>
  </div>

  <div className="relative z-10 flex min-h-screen flex-col px-5 pb-8 pt-12">
          <section className="mx-auto w-full max-w-[390px] text-center">
            {portal.companyLogoUrl ? (
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[24px] bg-white/95 p-3 shadow-sm ring-1 ring-black/5 backdrop-blur-sm">
                <img
                  src={portal.companyLogoUrl}
                  alt={
                    portal.companyName ||
                    portal.portalName
                  }
                  className="h-full w-full object-contain"
                />
              </div>
            ) : (
              <div
                className="mx-auto flex h-20 w-20 items-center justify-center rounded-[24px] text-2xl font-extrabold text-white shadow-sm"
                style={{
                  backgroundColor:
                    primaryColor,
                }}
              >
                {(portal.companyName ||
                  portal.portalName ||
                  "P")
                  .trim()
                  .slice(0, 1)}
              </div>
            )}

            <div className="mt-5 text-sm font-bold text-slate-600">
              {portal.companyName ||
                "등록 교육기관"}
            </div>

            <h1 className="mt-1 text-[28px] font-extrabold tracking-[-0.03em] text-slate-950">
              {portal.portalName}
            </h1>

            <p className="mx-auto mt-3 max-w-[330px] text-[15px] font-medium leading-6 text-slate-600">
              {portal.welcomeMessage ||
                "등록하신 이름과 휴대전화번호로 간편하게 접속해주세요."}
            </p>
          </section>

          <div className="flex-1" />

          <form
            className="mx-auto w-full max-w-[390px] rounded-[28px] bg-white/95 p-5 shadow-[0_18px_55px_rgba(15,23,42,0.14)] ring-1 ring-black/5 backdrop-blur-md"
            onSubmit={event => {
              event.preventDefault();

              setLoginError(
                null
              );

              const normalizedName =
                clientName.trim();

              const normalizedPhone =
                normalizePhone(
                  phone
                );

              if (!normalizedName) {
                setLoginError(
                  "이름을 입력해주세요."
                );
                return;
              }

              if (
                normalizedPhone.length <
                  10 ||
                normalizedPhone.length >
                  11
              ) {
                setLoginError(
                  "휴대전화번호를 확인해주세요."
                );
                return;
              }

              loginMutation.mutate({
                slug,

                clientName:
                  normalizedName,

                phone:
                  normalizedPhone,
              });
            }}
          >
            <div className="mb-5 text-center">
              <div className="text-xl font-extrabold text-slate-950">
                등록회원 로그인
              </div>
              <div className="mt-1 text-sm leading-5 text-slate-500">
                회원 등록정보와 일치하는 경우에만 접속할 수 있습니다.
              </div>
            </div>

            <label className="block">
              <span className="text-[15px] font-bold text-slate-800">
                이름
              </span>

              <input
                type="text"
                value={
                  clientName
                }
                onChange={event =>
                  setClientName(
                    event.target.value
                  )
                }
                autoComplete="name"
                placeholder="등록자 이름"
                className="mt-2 h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-[17px] font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:bg-white"
                style={{
                  caretColor:
                    primaryColor,
                }}
              />
            </label>

            <label className="mt-5 block">
              <span className="text-[15px] font-bold text-slate-800">
                휴대전화번호
              </span>

              <input
                type="tel"
                inputMode="numeric"
                value={
                  formatPhone(
                    phone
                  )
                }
                onChange={event =>
                  setPhone(
                    normalizePhone(
                      event.target.value
                    )
                  )
                }
                autoComplete="tel"
                placeholder="010-0000-0000"
                className="mt-2 h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-[17px] font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:bg-white"
                style={{
                  caretColor:
                    primaryColor,
                }}
              />
            </label>

            {loginError ? (
              <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium leading-5 text-red-600">
                {loginError}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={
                loginMutation.isPending
              }
              className="mt-6 h-14 w-full rounded-2xl px-4 text-[17px] font-extrabold text-white shadow-sm transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                backgroundColor:
                  primaryColor,
              }}
            >
              {loginMutation.isPending
                ? "확인 중..."
                : "업무포털 접속"}
            </button>
          </form>

          {portal.supportText ? (
            <div className="mx-auto mt-5 w-full max-w-[390px] text-center text-sm font-medium text-slate-600">
              {portal.supportUrl ? (
                <a
                  href={
                    portal.supportUrl
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="underline decoration-slate-300 underline-offset-4"
                >
                  {portal.supportText}
                </a>
              ) : (
                portal.supportText
              )}
            </div>
          ) : null}
        </div>
      </main>
    </PortalScreen>
  );
}

function PortalHomeView({
  student,
  myWork,
  primaryColor,
  onMyWork,
  onPractice,
  onAdministration,
  onCommunity,
  onLogout,
  logoutPending,
}: {
  student:
    any;

  myWork:
    any;

  primaryColor:
    string;

  onMyWork:
    () => void;

  onPractice:
    () => void;

  onAdministration:
    () => void;

  onCommunity:
    () => void;

  onLogout:
    () => void;

  logoutPending:
    boolean;
}) {
  const expectedLabel =
    myWork
      ?.expectedQualification
      ?.label ||
    "일정 확인 중";

  const overallProgress =
    typeof myWork
      ?.overallProgress
      ?.percent ===
      "number"
      ? myWork
          .overallProgress
          .percent
      : null;

  return (
    <main className="pb-28">
      <section className="relative h-[285px] overflow-hidden">
        <img
          src={PORTAL_IMAGES.home}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-black/5 to-black/45" />

        <div className="absolute inset-x-0 bottom-0 px-5 pb-6 text-white">
          <div className="text-[15px] font-bold drop-shadow-sm">
            안녕하세요,
          </div>
          <div className="mt-1 text-[30px] font-extrabold tracking-[-0.035em] drop-shadow-sm">
            {student.clientName ||
              "회원"}
            님 👋
          </div>
          <div className="mt-2 text-[15px] font-medium text-white/90 drop-shadow-sm">
            {student.course ||
              "등록 과정"}
          </div>
        </div>
      </section>

      <div className="px-5 pt-6">
        <button
          type="button"
          onClick={
            onMyWork
          }
          className="w-full border-b border-slate-200 pb-6 text-left"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[15px] font-bold text-slate-500">
                예상 자격증 신청일
              </div>
              <div
                className="mt-1 text-[28px] font-extrabold tracking-[-0.03em]"
                style={{
                  color:
                    primaryColor,
                }}
              >
                {expectedLabel}
              </div>
              <div className="mt-1 text-sm font-medium text-slate-400">
                현재 등록된 일정 기준입니다.
              </div>
            </div>

            <div className="text-3xl font-light text-slate-300">
              ›
            </div>
          </div>
        </button>

        <section className="border-b border-slate-200 py-6">
          <div className="flex items-end justify-between gap-4">
            <div className="text-[18px] font-extrabold text-slate-950">
              전체 진행률
            </div>

            <div
              className="text-[26px] font-extrabold"
              style={{
                color:
                  primaryColor,
              }}
            >
              {overallProgress !==
              null
                ? `${overallProgress}%`
                : "확인 중"}
            </div>
          </div>

          <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200">
            {overallProgress !==
            null ? (
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width:
                    `${Math.min(
                      100,
                      Math.max(
                        0,
                        overallProgress
                      )
                    )}%`,
                  backgroundColor:
                    primaryColor,
                }}
              />
            ) : null}
          </div>

          <div className="mt-2 text-[13px] font-medium leading-5 text-slate-400">
            {overallProgress !==
            null
              ? "최초 실제 개강일부터 예상 자격증 신청시점까지의 진행률입니다."
              : "실제 개강일과 예상 신청일을 확인하면 자동으로 표시됩니다."}
          </div>
        </section>

        <section className="py-6">
          <div className="text-[19px] font-extrabold text-slate-950">
            내 업무
          </div>

          <div className="mt-2 divide-y divide-slate-200 border-y border-slate-200">
            <PortalMenuRow
              icon="▣"
              title="마이 업무"
              description="학기현황 및 취득요건 확인"
              onClick={
                onMyWork
              }
            />

            <PortalMenuRow
              icon="↗"
              title="실습"
              description="실습 진행상황 및 안내"
              onClick={
                onPractice
              }
            />

            <PortalMenuRow
              icon="✓"
              title="행정절차"
              description="신청현황 및 절차 가이드"
              onClick={
                onAdministration
              }
            />

            <PortalMenuRow
              icon="◎"
              title="커뮤니티"
              description="공지사항 및 자료 확인"
              onClick={
                onCommunity
              }
            />
          </div>
        </section>

        {myWork
          ?.safetyCheck ? (
          <section className="border-t border-slate-200 py-6">
            <div className="flex items-start gap-4">
              <div
                className={
                  myWork
                    .safetyCheck
                    .safe
                    ? "flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-lg font-extrabold text-emerald-700"
                    : "flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-lg font-extrabold text-amber-700"
                }
              >
                {myWork
                  .safetyCheck
                  .safe
                  ? "✓"
                  : "!"}
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-[17px] font-extrabold text-slate-950">
                  설계 안전검사
                </div>
                <div className="mt-1 text-[14px] font-medium leading-6 text-slate-500">
                  {
                    myWork
                      .safetyCheck
                      .title
                  }
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <button
          type="button"
          disabled={
            logoutPending
          }
          onClick={
            onLogout
          }
          className="mt-2 w-full py-4 text-sm font-bold text-slate-400 disabled:opacity-50"
        >
          {logoutPending
            ? "로그아웃 중..."
            : "로그아웃"}
        </button>
      </div>
    </main>
  );
}

function PortalMenuRow({
  icon,
  title,
  description,
  onClick,
}: {
  icon:
    string;
  title:
    string;
  description:
    string;
  onClick:
    () => void;
}) {
  return (
    <button
      type="button"
      onClick={
        onClick
      }
      className="flex min-h-[82px] w-full items-center gap-4 py-4 text-left active:bg-slate-50"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-lg font-extrabold text-slate-700">
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-[17px] font-extrabold text-slate-950">
          {title}
        </div>
        <div className="mt-1 text-[13px] font-medium text-slate-500">
          {description}
        </div>
      </div>

      <div className="text-2xl font-light text-slate-300">
        ›
      </div>
    </button>
  );
}

function PortalMyWorkView({
  myWork,
  section,
  primaryColor,
  onSectionChange,
  onSemesterSelect,
}: {
  myWork:
    any;

  section:
    MyWorkSection;

  primaryColor:
    string;

  onSectionChange:
    (
      section:
        MyWorkSection
    ) => void;

  onSemesterSelect:
    (
      semesterOrder:
        number
    ) => void;
}) {
  if (!myWork) {
    return (
      <main className="px-5 pb-28 pt-6">
        <div className="py-14 text-center text-[15px] font-medium text-slate-500">
          등록된 학습관리 정보를 확인하고 있습니다.
        </div>
      </main>
    );
  }

  return (
    <main className="pb-28">
      <section className="relative h-[190px] overflow-hidden">
        <img
          src={PORTAL_IMAGES.myWork}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 px-5 pb-5 text-white">
          <div className="text-[25px] font-extrabold tracking-[-0.03em]">
            마이 업무
          </div>
          <div className="mt-1 text-sm font-medium text-white/90">
            학기 진행현황과 취득요건을 한눈에 확인하세요.
          </div>
        </div>
      </section>

      <div className="px-5 pt-5">
        <div className="grid grid-cols-3 border-b border-slate-200">
          <PortalSegmentButton
            active={
              section ===
              "learning"
            }
            primaryColor={
              primaryColor
            }
            onClick={() =>
              onSectionChange(
                "learning"
              )
            }
          >
            학습현황
          </PortalSegmentButton>

          <PortalSegmentButton
            active={
              section ===
              "requirements"
            }
            primaryColor={
              primaryColor
            }
            onClick={() =>
              onSectionChange(
                "requirements"
              )
            }
          >
            취득요건
          </PortalSegmentButton>

          <PortalSegmentButton
            active={
              section ===
              "safety"
            }
            primaryColor={
              primaryColor
            }
            onClick={() =>
              onSectionChange(
                "safety"
              )
            }
          >
            설계검사
          </PortalSegmentButton>
        </div>

        {section ===
        "learning" ? (
          <PortalLearningOverview
            myWork={
              myWork
            }
            primaryColor={
              primaryColor
            }
            onSemesterSelect={
              onSemesterSelect
            }
          />
        ) : section ===
          "requirements" ? (
          <PortalRequirementsView
            myWork={
              myWork
            }
            primaryColor={
              primaryColor
            }
          />
        ) : (
          <PortalSafetyView
            safetyCheck={
              myWork.safetyCheck
            }
          />
        )}
      </div>
    </main>
  );
}

function PortalLearningOverview({
  myWork,
  primaryColor,
  onSemesterSelect,
}: {
  myWork:
    any;

  primaryColor:
    string;

  onSemesterSelect:
    (
      semesterOrder:
        number
    ) => void;
}) {
  const expected =
    myWork
      .expectedQualification;

  const overall =
    myWork
      .overallProgress;

  return (
    <>
      <section className="mt-3 rounded-3xl border border-blue-100 bg-gradient-to-r from-blue-50 to-white p-5">
        <div className="text-xs font-bold text-slate-500">
          예상 자격증 신청일
        </div>

        <div
          className="mt-1 text-[28px] font-extrabold tracking-tight"
          style={{
            color:
              primaryColor,
          }}
        >
          {expected
            ?.label ||
            "일정 확인 중"}
        </div>

        <div className="mt-1 text-xs text-slate-400">
          현재 등록된 일정 기준입니다.
        </div>
      </section>

      <section className="mt-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <div className="flex items-end justify-between">
          <div className="font-extrabold text-slate-900">
            전체 진행률
          </div>

          <div
            className="text-2xl font-extrabold"
            style={{
              color:
                primaryColor,
            }}
          >
            {overall
              ?.available
              ? `${overall.percent}%`
              : "확인 중"}
          </div>
        </div>

        <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100">
          {overall
            ?.available ? (
            <div
              className="h-full rounded-full"
              style={{
                width:
                  `${overall.percent}%`,

                backgroundColor:
                  primaryColor,
              }}
            />
          ) : null}
        </div>
      </section>

      <section className="mt-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-lg font-extrabold text-slate-950">
            학기 진행 현황
          </div>

          <div className="text-xs text-slate-400">
            담당자 등록 일정 기준
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-100">
          {(
            myWork.semesters ||
            []
          ).length >
          0 ? (
            myWork.semesters.map(
              (
                semester:
                  any,
                index:
                  number
              ) => (
                <PortalSemesterRow
                  key={
                    semester.id ||
                    semester.semesterOrder
                  }
                  semester={
                    semester
                  }
                  subjects={
                    (
                      myWork.subjects ||
                      []
                    ).filter(
                      (
                        subject:
                          any
                      ) =>
                        Number(
                          subject.semesterNo
                        ) ===
                        Number(
                          semester.semesterOrder
                        )
                    )
                  }
                  primaryColor={
                    primaryColor
                  }
                  first={
                    index ===
                    0
                  }
                  onClick={() =>
                    onSemesterSelect(
                      Number(
                        semester.semesterOrder
                      )
                    )
                  }
                />
              )
            )
          ) : (
            <div className="p-6 text-center text-sm text-slate-400">
              등록된 학기 일정이 없습니다.
            </div>
          )}
        </div>
      </section>

      <section className="mt-5 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <div className="flex items-center justify-between">
          <div className="text-lg font-extrabold text-slate-950">
            취득 요건 요약
          </div>

          <div className="text-xs font-semibold text-blue-600">
            상단 취득요건 탭에서 확인
          </div>
        </div>

        <PortalRequirementSummary
          myWork={
            myWork
          }
          primaryColor={
            primaryColor
          }
          compact
        />
      </section>

      <section className="mt-5 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <div className="text-lg font-extrabold text-slate-950">
          설계 안전검사
        </div>

        <div className="mt-4">
          <PortalSafetyCard
            safetyCheck={
              myWork.safetyCheck
            }
          />
        </div>
      </section>
    </>
  );
}


function PortalSemesterRow({
  semester,
  subjects,
  primaryColor,
  first,
  onClick,
}: {
  semester:
    any;

  subjects:
    any[];

  primaryColor:
    string;

  first:
    boolean;

  onClick:
    () => void;
}) {
  const status =
    semester.progressStatus;

  const statusClass =
    status ===
    "completed"
      ? "bg-emerald-50 text-emerald-600"
      : status ===
          "in_progress"
        ? "bg-blue-50 text-blue-600"
        : status ===
            "review_required"
          ? "bg-amber-50 text-amber-600"
          : "bg-slate-100 text-slate-500";

  const dotClass =
    status ===
    "completed"
      ? "bg-emerald-500"
      : status ===
          "in_progress"
        ? "bg-blue-500"
        : status ===
            "review_required"
          ? "bg-amber-400"
          : "bg-slate-400";

  const scheduleText =
    semester.progressStartDate &&
    semester.progressEndDate
      ? `${formatPortalDate(
          semester.progressStartDate
        )} ~ ${formatPortalDate(
          semester.progressEndDate
        )}`
      : semester.plannedMonth
        ? `${semester.plannedMonth} 예정`
        : "일정 확인 필요";

  return (
    <button
      type="button"
      onClick={
        onClick
      }
      className={`w-full px-5 py-4 text-left ${
        first
          ? ""
          : "border-t border-slate-100"
      }`}
    >
      <div className="flex gap-3">
        <div className="pt-1">
          <div
            className={`h-4 w-4 rounded-full ${dotClass}`}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="font-extrabold text-slate-900">
              {semester.semesterOrder}학기
            </div>

            <span
              className={`rounded-lg px-2.5 py-1 text-xs font-bold ${statusClass}`}
            >
              {semester.progressLabel ||
                "확인필요"}
            </span>
          </div>

          <div className="mt-1 text-xs text-slate-400">
            {scheduleText}
          </div>

          <div className="mt-1 text-sm font-bold text-slate-700">
            {subjects.length}과목
          </div>

          {status ===
            "in_progress" &&
          typeof semester.progressPercent ===
            "number" ? (
            <div className="mt-3">
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-slate-400">
                  현재 학기 진행률
                </span>

                <span
                  className="font-bold"
                  style={{
                    color:
                      primaryColor,
                  }}
                >
                  {
                    semester.progressPercent
                  }
                  %
                </span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full"
                  style={{
                    width:
                      `${semester.progressPercent}%`,

                    backgroundColor:
                      primaryColor,
                  }}
                />
              </div>
            </div>
          ) : null}
        </div>

        <div className="self-center text-xl text-slate-300">
          ›
        </div>
      </div>
    </button>
  );
}


function PortalSemesterDetail({
  semester,
  subjects,
  primaryColor,
}: {
  semester:
    any;

  subjects:
    any[];

  primaryColor:
    string;
}) {
  const scheduleText =
    semester.progressStartDate &&
    semester.progressEndDate
      ? `${formatPortalDate(
          semester.progressStartDate
        )} ~ ${formatPortalDate(
          semester.progressEndDate
        )}`
      : semester.plannedMonth
        ? `${semester.plannedMonth} 예정`
        : "일정 확인 필요";

  return (
    <main className="px-4 pb-28 pt-4">
      <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-2xl font-extrabold text-slate-950">
              {semester.semesterOrder}학기
            </div>

            <div className="mt-2 text-sm text-slate-500">
              {scheduleText}
            </div>

            <div className="mt-1 text-sm font-bold text-slate-700">
              {subjects.length}과목
            </div>
          </div>

          <PortalStatusBadge
            label={
              semester.progressLabel ||
              "확인필요"
            }
            status={
              semester.progressStatus
            }
          />
        </div>

        {semester.progressStatus ===
          "in_progress" &&
        typeof semester.progressPercent ===
          "number" ? (
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-700">
                현재 학기 진행률
              </span>

              <span
                className="text-lg font-extrabold"
                style={{
                  color:
                    primaryColor,
                }}
              >
                {
                  semester.progressPercent
                }
                %
              </span>
            </div>

            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full"
                style={{
                  width:
                    `${semester.progressPercent}%`,

                  backgroundColor:
                    primaryColor,
                }}
              />
            </div>
          </div>
        ) : null}
      </section>

      <section className="mt-5">
        <div className="mb-3 text-lg font-extrabold text-slate-950">
          수강 과목 목록
        </div>

        <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-100">
          {subjects.length >
          0 ? (
            subjects.map(
              (
                subject:
                  any,
                index:
                  number
              ) => {
                const status =
                  resolvePortalSubjectStatus(
                    subject,
                    semester
                  );

                return (
                  <div
                    key={
                      subject.id ||
                      `${subject.subjectName}-${index}`
                    }
                    className={`flex items-center gap-3 px-5 py-4 ${
                      index >
                      0
                        ? "border-t border-slate-100"
                        : ""
                    }`}
                  >
                    <div
                      className={
                        status.key ===
                        "retake"
                          ? "h-3 w-3 shrink-0 rounded-full bg-orange-500"
                          : status.key ===
                              "completed"
                            ? "h-3 w-3 shrink-0 rounded-full bg-emerald-500"
                            : status.key ===
                                "in_progress"
                              ? "h-3 w-3 shrink-0 rounded-full bg-blue-500"
                              : "h-3 w-3 shrink-0 rounded-full bg-slate-400"
                      }
                    />

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-extrabold text-slate-900">
                        {subject.subjectName ||
                          "과목명 확인 필요"}
                      </div>

                      <div className="mt-1 text-xs text-slate-400">
                        {subject.requirementType ||
                          subject.category ||
                          "구분 확인 필요"}
                      </div>
                    </div>

                    <span
                      className={
                        status.key ===
                        "retake"
                          ? "rounded-lg bg-orange-50 px-2 py-1 text-xs font-bold text-orange-600"
                          : status.key ===
                              "completed"
                            ? "rounded-lg bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-600"
                            : status.key ===
                                "in_progress"
                              ? "rounded-lg bg-blue-50 px-2 py-1 text-xs font-bold text-blue-600"
                              : "rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500"
                      }
                    >
                      {
                        status.label
                      }
                    </span>
                  </div>
                );
              }
            )
          ) : (
            <div className="p-6 text-center text-sm text-slate-400">
              등록된 과목이 없습니다.
            </div>
          )}
        </div>
      </section>

      <section className="mt-5 rounded-3xl border border-blue-100 bg-blue-50/60 p-5">
        <div className="font-extrabold text-blue-900">
          학기 진행 안내
        </div>

        <div className="mt-2 text-sm leading-6 text-blue-700">
          학기 상태와 진행률은 담당자가 등록한 실제 개강일과
          현재 관리정보를 기준으로 표시됩니다.
        </div>
      </section>
    </main>
  );
}


function PortalRequirementsView({
  myWork,
  primaryColor,
}: {
  myWork:
    any;

  primaryColor:
    string;
}) {
  return (
    <>
      <section className="mt-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <div className="text-lg font-extrabold text-slate-950">
          취득 요건
        </div>

        <div className="mt-1 text-xs leading-5 text-slate-400">
          담당자 관리값과 공통 자격요건 엔진을 기준으로 표시됩니다.
        </div>

        <PortalRequirementSummary
          myWork={
            myWork
          }
          primaryColor={
            primaryColor
          }
        />
      </section>

      {myWork.transfer
        ?.hasData ? (
        <section className="mt-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center justify-between">
            <div className="font-extrabold text-slate-900">
              전적대
            </div>

            <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-600">
              확인됨
            </span>
          </div>

          <div className="mt-2 text-2xl font-extrabold text-slate-950">
            {
              myWork
                .transfer
                .totalCredits
            }
            학점
          </div>

          <div className="mt-4 divide-y divide-slate-100">
            {myWork
              .transfer
              .subjects
              .map(
                (
                  subject:
                    any,
                  index:
                    number
                ) => (
                  <div
                    key={
                      subject.id ||
                      index
                    }
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-slate-800">
                        {
                          subject.subjectName
                        }
                      </div>

                      <div className="mt-1 text-xs text-slate-400">
                        {subject.requirementType ||
                          subject.category ||
                          "구분 확인"}
                      </div>
                    </div>

                    <div className="text-sm font-bold text-slate-600">
                      {
                        subject.credits
                      }
                      학점
                    </div>
                  </div>
                )
              )}
          </div>
        </section>
      ) : null}
    </>
  );
}


function PortalRequirementSummary({
  myWork,
  primaryColor,
  compact = false,
}: {
  myWork:
    any;

  primaryColor:
    string;

  compact?:
    boolean;
}) {
  const requirementSummary =
    myWork
      ?.requirementSummary ??
    null;

  const courseKey =
    String(
      requirementSummary
        ?.courseKey ||
      ""
    ).trim();

  const qualification =
    requirementSummary
      ?.qualification ??
    null;

  const socialWorker =
    qualification
      ?.socialWorker ??
    null;

  const degree =
    requirementSummary
      ?.degree ??
    null;

  /**
   * null과 실제 0을 구분한다.
   *
   * null:
   * 엔진에서 아직 기준을 확정하지 못함.
   *
   * 0:
   * 기준은 확정되었고 현재 인정값이 0.
   */
  const toNumberOrNull =
    (
      value:
        any
    ): number | null => {
      if (
        value ===
          null ||
        value ===
          undefined ||
        value ===
          ""
      ) {
        return null;
      }

      const numberValue =
        Number(
          value
        );

      return Number.isFinite(
        numberValue
      )
        ? numberValue
        : null;
    };

  const buildPercent =
    (
      current:
        number,
      required:
        number | null
    ) => {
      if (
        required ===
          null ||
        required <=
          0
      ) {
        return null;
      }

      return Math.min(
        100,
        Math.max(
          0,
          Math.round(
            (
              current /
              required
            ) *
              100
          )
        )
      );
    };

  const renderRequirementRow =
    ({
      key,
      label,
      current,
      required,
      unit,
    }: {
      key:
        string;

      label:
        string;

      current:
        number;

      required:
        number | null;

      unit:
        "과목" |
        "학점";
    }) => {
      const percent =
        buildPercent(
          current,
          required
        );

      const complete =
        required !==
          null &&
        required >
          0 &&
        current >=
          required;

      const partiallySatisfied =
        !complete &&
        current >
          0;

      return (
        <div
          key={
            key
          }
        >
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-extrabold text-slate-800">
              {
                label
              }
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">
                {required !==
                null
                  ? `${current} / ${required}${unit}`
                  : `${current}${unit}`}
              </span>

              <span
                className={
                  complete
                    ? "rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-600"
                    : partiallySatisfied
                      ? "rounded-lg bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-600"
                      : "rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-500"
                }
              >
                {complete
                  ? "충족"
                  : partiallySatisfied
                    ? "일부 충족"
                    : "미충족"}
              </span>
            </div>
          </div>

          {percent !==
          null ? (
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full"
                style={{
                  width:
                    `${percent}%`,

                  backgroundColor:
                    complete
                      ? "#10b981"
                      : primaryColor,
                }}
              />
            </div>
          ) : null}
        </div>
      );
    };

  /**
   * -------------------------------------------------
   * 자격요건 Row
   * -------------------------------------------------
   *
   * 사회복지사 2급:
   * 필수 / 선택 / 전체를 각각 표시한다.
   *
   * 그 외 과정:
   * 공통 qualification 값으로 한 줄 표시한다.
   */
  const qualificationRows:
    Array<{
      key:
        string;

      label:
        string;

      current:
        number;

      required:
        number | null;

      unit:
        "과목" |
        "학점";
    }> =
    [];

  if (
    courseKey ===
      "social_worker_2" &&
    socialWorker
  ) {
    const requiredSubjects =
      toNumberOrNull(
        socialWorker
          .requiredSubjects
      );

    const completedRequiredSubjects =
      Number(
        socialWorker
          .completedRequiredSubjects ??
        0
      );

    const electiveSubjects =
      toNumberOrNull(
        socialWorker
          .electiveSubjects
      );

    const completedElectiveSubjects =
      Number(
        socialWorker
          .completedElectiveSubjects ??
        0
      );

    const totalSubjects =
      toNumberOrNull(
        socialWorker
          .totalSubjects
      );

    const completedTotalSubjects =
      Number(
        socialWorker
          .completedTotalSubjects ??
        qualification
          ?.completedSubjects ??
        0
      );

    if (
      requiredSubjects !==
      null
    ) {
      qualificationRows.push({
        key:
          "social-worker-required",

        label:
          "필수과목",

        current:
          completedRequiredSubjects,

        required:
          requiredSubjects,

        unit:
          "과목",
      });
    }

    if (
      electiveSubjects !==
      null
    ) {
      qualificationRows.push({
        key:
          "social-worker-elective",

        label:
          "선택과목",

        current:
          completedElectiveSubjects,

        required:
          electiveSubjects,

        unit:
          "과목",
      });
    }

    if (
      totalSubjects !==
      null
    ) {
      qualificationRows.push({
        key:
          "social-worker-total",

        label:
          "총 자격과목",

        current:
          completedTotalSubjects,

        required:
          totalSubjects,

        unit:
          "과목",
      });
    }
  } else {
    const requiredSubjects =
      toNumberOrNull(
        qualification
          ?.requiredSubjects
      );

    const completedSubjects =
      Number(
        qualification
          ?.completedSubjects ??
        0
      );

    const requiredCredits =
      toNumberOrNull(
        qualification
          ?.requiredCredits
      );

    const completedCredits =
      Number(
        qualification
          ?.completedCredits ??
        0
      );

    if (
      requiredSubjects !==
      null
    ) {
      qualificationRows.push({
        key:
          "qualification-subjects",

        label:
          "자격요건 과목",

        current:
          completedSubjects,

        required:
          requiredSubjects,

        unit:
          "과목",
      });
    } else if (
      requiredCredits !==
      null
    ) {
      qualificationRows.push({
        key:
          "qualification-credits",

        label:
          "자격요건 학점",

        current:
          completedCredits,

        required:
          requiredCredits,

        unit:
          "학점",
      });
    }
  }

  /**
   * -------------------------------------------------
   * 학위요건 Row
   * -------------------------------------------------
   *
   * 새 학위과정이 실제 필요한 회원에게만 표시한다.
   *
   * 전문대졸/대졸 등 기존 학위로
   * 자격요건을 충족하는 회원에게는
   * 불필요한 학위요건을 보여주지 않는다.
   */
  const degreeRows:
    Array<{
      key:
        string;

      label:
        string;

      current:
        number;

      required:
        number | null;

      unit:
        "학점";
    }> =
    [];

  if (
    degree
      ?.requiresNewDegreeTrack ===
    true
  ) {
    const requiredTotalCredits =
      toNumberOrNull(
        degree
          ?.requiredTotalCredits
      );

    const requiredMajorCredits =
      toNumberOrNull(
        degree
          ?.requiredMajorCredits
      );

    const requiredLiberalCredits =
      toNumberOrNull(
        degree
          ?.requiredLiberalCredits
      );

    if (
      requiredTotalCredits !==
      null
    ) {
      degreeRows.push({
        key:
          "degree-total",

        label:
          "총 학점",

        current:
          Number(
            degree
              ?.currentTotalCredits ??
            0
          ),

        required:
          requiredTotalCredits,

        unit:
          "학점",
      });
    }

    if (
      requiredMajorCredits !==
      null
    ) {
      degreeRows.push({
        key:
          "degree-major",

        label:
          "전공 학점",

        current:
          Number(
            degree
              ?.currentMajorCredits ??
            0
          ),

        required:
          requiredMajorCredits,

        unit:
          "학점",
      });
    }

    if (
      requiredLiberalCredits !==
      null
    ) {
      degreeRows.push({
        key:
          "degree-liberal",

        label:
          "교양 학점",

        current:
          Number(
            degree
              ?.currentLiberalCredits ??
            0
          ),

        required:
          requiredLiberalCredits,

        unit:
          "학점",
      });
    }
  }

  const hasQualificationData =
    qualificationRows.length >
    0;

  const hasDegreeData =
    degreeRows.length >
    0;

  /**
   * 실제 취득요건 데이터가 없을 때만
   * 확인 안내를 보여준다.
   */
  if (
    !hasQualificationData &&
    !hasDegreeData
  ) {
    return (
      <div className="mt-4 rounded-2xl bg-slate-50 p-4">
        <div className="text-sm font-bold text-slate-700">
          취득요건 적용기준을 확인하고 있습니다.
        </div>

        <div className="mt-1 text-xs leading-5 text-slate-500">
          현재 과정 또는 적용기준을 확정하면
          필요한 과목과 학점이 자동으로 표시됩니다.
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        compact
          ? "mt-4 space-y-5"
          : "mt-5 space-y-6"
      }
    >
      {hasQualificationData ? (
        <section>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-extrabold text-slate-900">
                {courseKey ===
                "social_worker_2"
                  ? "사회복지사 2급 자격요건"
                  : "자격 취득요건"}
              </div>

              <div className="mt-1 text-xs leading-5 text-slate-400">
                현재 실제 이수·인정된 과목 기준입니다.
              </div>
            </div>

            {qualification
              ?.canAnalyze ===
            true ? (
              <span className="shrink-0 rounded-lg bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-600">
                자동 계산
              </span>
            ) : (
              <span className="shrink-0 rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-600">
                확인 필요
              </span>
            )}
          </div>

          <div className="mt-4 space-y-4">
            {qualificationRows.map(
              row =>
                renderRequirementRow(
                  row
                )
            )}
          </div>
        </section>
      ) : null}

      {hasDegreeData ? (
        <section className="border-t border-slate-100 pt-5">
          <div>
            <div className="text-sm font-extrabold text-slate-900">
              학위 취득요건
            </div>

            <div className="mt-1 text-xs leading-5 text-slate-400">
              현재 과정은 새 학점은행제 학위 취득이 필요한 과정입니다.
            </div>
          </div>

          <div className="mt-4 space-y-4">
            {degreeRows.map(
              row =>
                renderRequirementRow(
                  row
                )
            )}
          </div>
        </section>
      ) : null}

      {requirementSummary
        ?.requiresReview ===
      true ? (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
          <div className="text-xs font-extrabold text-amber-700">
            일부 취득요건 확인이 필요합니다.
          </div>

          <div className="mt-1 text-xs leading-5 text-amber-600">
            담당자가 확인 중인 기준이 있으면
            최종 확인 후 자동으로 업데이트됩니다.
          </div>
        </div>
      ) : null}
    </div>
  );
}


function PortalSafetyView({
  safetyCheck,
}: {
  safetyCheck:
    any;
}) {
  return (
    <section className="mt-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
      <div className="text-lg font-extrabold text-slate-950">
        설계 안전검사
      </div>

      <div className="mt-4">
        <PortalSafetyCard
          safetyCheck={
            safetyCheck
          }
        />
      </div>

      {safetyCheck
        ?.issues
        ?.length >
      0 ? (
        <div className="mt-4 space-y-2">
          {safetyCheck.issues.map(
            (
              issue:
                any,
              index:
                number
            ) => (
              <div
                key={
                  `${issue.code}-${index}`
                }
                className="rounded-2xl bg-amber-50 px-4 py-3"
              >
                <div className="text-sm font-bold text-amber-800">
                  {
                    issue.message
                  }
                </div>
              </div>
            )
          )}
        </div>
      ) : (
        <div className="mt-4 text-xs leading-6 text-slate-400">
          현재 등록된 학기·과목·전적대 관리값을 기준으로 확인한 결과입니다.
        </div>
      )}
    </section>
  );
}


function PortalSafetyCard({
  safetyCheck,
}: {
  safetyCheck:
    any;
}) {
  const safe =
    safetyCheck
      ?.safe ===
    true;

  return (
    <div
      className={
        safe
          ? "rounded-2xl border border-emerald-100 bg-emerald-50 p-4"
          : "rounded-2xl border border-amber-100 bg-amber-50 p-4"
      }
    >
      <div className="flex items-center gap-3">
        <div
          className={
            safe
              ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 font-bold text-white"
              : "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500 font-bold text-white"
          }
        >
          {safe
            ? "✓"
            : "!"}
        </div>

        <div className="min-w-0">
          <div
            className={
              safe
                ? "font-extrabold text-emerald-800"
                : "font-extrabold text-amber-800"
            }
          >
            {safetyCheck
              ?.title ||
              "설계 상태 확인 중"}
          </div>

          <div
            className={
              safe
                ? "mt-1 text-xs leading-5 text-emerald-600"
                : "mt-1 text-xs leading-5 text-amber-600"
            }
          >
            {safe
              ? "현재 확인된 관리값에서 설계 이상이 확인되지 않았습니다."
              : "담당자가 확인해야 할 항목이 있습니다."}
          </div>
        </div>
      </div>
    </div>
  );
}


function PortalSegmentButton({
  active,
  primaryColor,
  onClick,
  children,
}: {
  active:
    boolean;

  primaryColor:
    string;

  onClick:
    () => void;

  children:
    React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={
        onClick
      }
      className={
        active
          ? "h-12 border-b-2 text-[15px] font-extrabold"
          : "h-12 border-b-2 border-transparent text-[15px] font-bold text-slate-400"
      }
      style={
        active
          ? {
              color:
                primaryColor,
              borderColor:
                primaryColor,
            }
          : undefined
      }
    >
      {children}
    </button>
  );
}


function PortalStatusBadge({
  status,
  label,
}: {
  status:
    string | null;

  label:
    string;
}) {
  const className =
    status ===
    "completed"
      ? "bg-emerald-50 text-emerald-600"
      : status ===
          "in_progress"
        ? "bg-blue-50 text-blue-600"
        : status ===
            "review_required"
          ? "bg-amber-50 text-amber-600"
          : "bg-slate-100 text-slate-500";

  return (
    <span
      className={`rounded-lg px-2.5 py-1 text-xs font-bold ${className}`}
    >
      {label}
    </span>
  );
}


function PortalSubHeader({
  title,
  onBack,
}: {
  title:
    string;

  onBack:
    () => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/95 px-4 backdrop-blur">
      <div className="relative flex h-16 items-center justify-center">
        <button
          type="button"
          onClick={
            onBack
          }
          className="absolute left-0 flex h-10 w-10 items-center justify-center rounded-full text-2xl text-slate-700"
          aria-label="뒤로가기"
        >
          ‹
        </button>

        <div className="max-w-[260px] truncate text-base font-extrabold text-slate-950">
          {title}
        </div>
      </div>
    </header>
  );
}

const LEARNER_REGISTRATION_STEPS = [
  {
    step: 1,
    title:
      "국가평생교육진흥원 학점은행제 접속",
    description:
      "포털에서 '학점은행제'를 검색하거나 국가평생교육진흥원 학점은행제 홈페이지(cb.or.kr)에 접속해주세요.",
    image:
      "/images/learner-registration/step-01.png",
  },

  {
    step: 2,
    title:
      "회원가입 후 로그인",
    description:
      "처음 이용하시는 경우 회원가입 후 로그인해주세요. 기존 회원은 가입 없이 바로 로그인하면 됩니다.",
    image:
      "/images/learner-registration/step-02.png",
  },

  {
    step: 3,
    title:
      "학습자등록 신청 선택",
    description:
      "메인 화면에서 '학습자등록 신청' 메뉴를 선택해주세요. 학습자등록은 일반적으로 1월·4월·7월·10월 신청기간에 진행하며, 신청 가능한 기간에는 메뉴가 활성화됩니다.",
    image:
      "/images/learner-registration/step-03.png",
  },

  {
    step: 4,
    title:
      "온라인 신청안내 확인",
    description:
      "온라인 학점인정 신청 안내 내용을 확인한 뒤 안내내용 확인에 체크하고 '확인'을 눌러주세요.",
    image:
      "/images/learner-registration/step-04.png",
  },

  {
    step: 5,
    title:
      "안내 및 동의사항 확인",
    description:
      "화면에 표시되는 신청 안내와 동의사항을 확인하고 체크한 뒤 다음 단계로 이동해주세요.",
    image:
      "/images/learner-registration/step-05.png",
  },

  {
    step: 6,
    title:
      "본인 실명확인",
    description:
      "국가평생교육진흥원 홈페이지에서 본인의 이름과 주민등록번호를 입력하여 실명확인을 진행해주세요.",
    image:
      "/images/learner-registration/step-06.png",
  },

  {
    step: 7,
    title:
      "본인인증",
    description:
      "공동인증서 또는 화면에서 제공되는 간편인증 방법을 이용하여 본인인증을 완료해주세요.",
    image:
      "/images/learner-registration/step-07.png",
  },

  {
    step: 8,
    title:
      "학습자등록 신청서 작성",
    description:
      "개인정보와 최종학력, 출신학교, 목표학위, 희망전공을 확인하여 입력해주세요. 목표학위와 희망전공은 회원님의 학력 및 진행과정에 따라 달라질 수 있으므로 담당자가 안내한 내용을 우선 확인해주세요.",
    image:
      "/images/learner-registration/step-08.png",
  },

  {
    step: 9,
    title:
      "희망전공 선택",
    description:
      "본인의 최종학력과 진행과정에 맞는 희망전공을 찾아 선택해주세요. 희망전공은 학위과정과 연결되는 중요한 항목이므로 확실하지 않을 경우 임의로 선택하지 않는 것을 권장합니다.",
    image:
      "/images/learner-registration/step-09.png",
  },

  {
    step: 10,
    title:
      "신청서 작성 완료",
    description:
      "입력한 내용을 다시 확인한 뒤 신청서 작성이 완료되면 '학습자등록 결제' 버튼을 눌러주세요.",
    image:
      "/images/learner-registration/step-10.png",
  },

  {
    step: 11,
    title:
      "학습자등록 수수료 결제",
    description:
      "동의사항을 확인하고 학습자등록 수수료 4,000원을 결제해주세요.",
    image:
      "/images/learner-registration/step-11.png",
  },

  {
    step: 12,
    title:
      "최종학력 증명서 제출",
    description:
      "최종학력을 확인하기 위한 증명서 제출이 필요합니다. 화면에서 인터넷 증명서 첨부가 가능한 학교는 온라인으로 제출할 수 있으며, 지원되지 않는 경우 국가평생교육진흥원이 안내하는 별도 제출방법을 확인해주세요.",
    image:
      "/images/learner-registration/step-12.png",
  },

  {
    step: 13,
    title:
      "신청내역 확인",
    description:
      "결제와 신청이 완료되면 마이페이지에서 접수번호, 신청상태, 결제내역 및 신청서 출력 여부를 확인해주세요.",
    image:
      "/images/learner-registration/step-13.png",
  },

  {
    step: 14,
    title:
      "학점은행제 검토 후 완료 확인",
    description:
      "신청 후 국가평생교육진흥원의 검토가 진행됩니다. 처리기간은 신청 상황에 따라 달라질 수 있으며, 학습자등록 완료 후 화면에서 완료 여부를 확인해주세요.",
    image:
      "/images/learner-registration/step-14.png",
  },
] as const;

const CREDIT_RECOGNITION_STEPS = [
  {
    step: 1,
    title:
      "학점은행제 접속 및 학점인정신청 선택",
    description:
      "국가평생교육진흥원 학점은행제 홈페이지에 접속하여 로그인한 뒤 메인 화면의 '학점인정신청' 메뉴를 선택해주세요.",
    image:
      "/images/credit-recognition/step-01.png",
  },

  {
    step: 2,
    title:
      "온라인 신청안내 확인",
    description:
      "온라인 학점인정 신청 안내사항을 확인한 뒤 '위의 안내문을 모두 숙지하였습니다.' 항목에 체크하고 확인을 눌러주세요.",
    image:
      "/images/credit-recognition/step-02.png",
  },

  {
    step: 3,
    title:
      "본인인증",
    description:
      "공동인증서 또는 화면에서 제공되는 간편인증 방법을 이용하여 본인인증을 진행해주세요.",
    image:
      "/images/credit-recognition/step-03.png",
  },

  {
    step: 4,
    title:
      "평가인정 학습과정 선택",
    description:
      "온라인으로 수강한 교육원 과목을 신청하려면 '평가인정 학습과정'을 선택하고 안내사항을 확인한 뒤 다음 단계로 이동해주세요.",
    image:
      "/images/credit-recognition/step-04.png",
  },

  {
    step: 5,
    title:
      "학점인정 신청 과목 확인",
    description:
      "교육원에서 이수한 과목이 학점인정 신청 목록에 정상적으로 표시되는지 확인해주세요. 과목명과 이수정보를 확인한 뒤 신청을 진행합니다.",
    image:
      "/images/credit-recognition/step-05.png",
  },

  {
    step: 6,
    title:
      "학습구분 확인 후 학점인정 신청",
    description:
      "과목별 전공필수·전공선택·교양·일반 학습구분을 확인한 뒤 신청해주세요. 전문학사는 총 80학점 이상·전공 45학점 이상·교양 15학점 이상, 학사는 총 140학점 이상·전공 60학점 이상·교양 30학점 이상을 기준으로 진행합니다.",
    image:
      "/images/credit-recognition/step-06.png",
  },

  {
    step: 7,
    title:
      "신청 목록 확인 및 결제",
    description:
      "신청한 과목과 학점을 확인한 뒤 화면 오른쪽의 '결제하기'를 눌러주세요. 학점인정신청 수수료는 학점당 1,000원입니다. 81학점을 신청하면 81,000원, 사회복지 전공 17과목 51학점을 신청하면 51,000원입니다.",
    image:
      "/images/credit-recognition/step-07.png",
  },

  {
    step: 8,
    title:
      "전적대 학점 신청",
    description:
      "이전 대학 또는 전문대학에서 이수한 학점을 현재 학위과정에 활용하는 경우 진행하는 단계입니다. '학점인정 대상학교'를 선택하고 확인을 눌러주세요. 전적대 학점이 없는 회원은 STEP 08~09를 건너뛰면 됩니다.",
    image:
      "/images/credit-recognition/step-08.png",
  },

  {
    step: 9,
    title:
      "전적대 과목 입력 및 신청",
    description:
      "이전 대학 성적증명서를 확인하면서 희망학습구분, 학습과목명, 학점, 이수년도, 이수학기, 대학명 등을 과목별로 입력하여 신청해주세요. 신청 후 결제를 진행하고 필요한 성적증명서를 제출합니다.",
    image:
      "/images/credit-recognition/step-09.png",
  },

  {
    step: 10,
    title:
      "결제내역 및 신청서 확인",
    description:
      "학점인정신청 결제 후 결제내역과 신청서 출력 메뉴에서 접수한 내용을 다시 확인할 수 있습니다.",
    image:
      "/images/credit-recognition/step-10.png",
  },

  {
    step: 11,
    title:
      "나의 접수현황 확인",
    description:
      "마이페이지의 '나의 접수현황'에서 학점인정신청 내역과 현재 처리 진행상태를 확인해주세요.",
    image:
      "/images/credit-recognition/step-11.png",
  },

  {
    step: 12,
    title:
      "학점인정 처리완료 확인",
    description:
      "국가평생교육진흥원의 학점인정 처리가 완료되면 신청 화면의 상태가 변경됩니다. 최종적으로 마이페이지에서 인정된 학점과 처리 결과를 확인해주세요.",
    image:
      "/images/credit-recognition/step-12.png",
  },
] as const;

const DEGREE_APPLICATION_STEPS = [
  {
    step: 1,
    title:
      "학점은행제 접속 및 학위신청 선택",
    description:
      "국가평생교육진흥원 학점은행제 홈페이지에 접속하여 로그인한 뒤 메인 화면의 '학위신청 및 신청 취소' 메뉴를 선택해주세요.",
    image:
      "/images/degree-application/step-01.png",
  },

  {
    step: 2,
    title:
      "유의사항 확인 및 휴대전화번호 입력",
    description:
      "학위신청 유의사항을 확인한 뒤 '위의 안내문을 모두 숙지 하였습니다.' 항목에 체크해주세요. 학위신청 처리 결과를 안내받을 본인의 휴대전화번호를 확인 또는 입력한 뒤 '다음'을 눌러주세요.",
    image:
      "/images/degree-application/step-02.png",
  },

  {
    step: 3,
    title:
      "학습자 취득학점 정보 확인",
    description:
      "현재 등록된 학위종류, 전공, 총학점과 전공필수·전공선택·교양·일반 학점인정 내역을 확인해주세요. 신청하려는 학위과정과 현재 취득학점 정보가 맞는지 확인한 뒤 학위신청을 진행해주세요.",
    image:
      "/images/degree-application/step-03.png",
  },

  {
    step: 4,
    title:
      "학위신청 및 학위수여 여부 확인",
    description:
      "학위신청 및 학위수여 관련 안내사항을 확인한 뒤 자필서명 동의 항목을 체크해주세요. 신청정보의 휴대전화번호와 이메일 주소를 확인하고 내용이 맞다면 '신청하기'를 눌러주세요.",
    image:
      "/images/degree-application/step-04.png",
  },

  {
    step: 5,
    title:
      "본인인증",
    description:
      "공동인증서 또는 화면에서 제공되는 간편인증 방법을 이용하여 본인인증을 진행해주세요.",
    image:
      "/images/degree-application/step-05.png",
  },

  {
    step: 6,
    title:
      "학위신청 접수 확인",
    description:
      "학위신청이 정상적으로 접수되었는지 확인해주세요. 접수 후에는 국가평생교육진흥원 마이페이지의 '나의 접수현황'에서 학위신청 접수 및 처리상태를 확인할 수 있습니다.",
    image:
      "/images/degree-application/step-06.png",
  },
] as const;

const SOCIAL_WORKER_2_QUALIFICATION_STEPS = [
  {
    step: 1,
    title:
      "한국사회복지사협회 자격관리센터 접속",
    description:
      "한국사회복지사협회 자격관리센터에 접속한 뒤 '온라인 자격신청서 작성'을 선택해주세요. 처음 이용하는 경우 회원가입 후 로그인해주세요.",
    image:
      "/images/qualification-application/social-worker-2/step-01.png",
  },

  {
    step: 2,
    title:
      "신규 온라인 자격 신청서 작성",
    description:
      "온라인 자격신청 화면에서 '신규 온라인 자격 신청서 작성'을 선택하여 사회복지사 2급 신규 발급 신청을 시작해주세요.",
    image:
      "/images/qualification-application/social-worker-2/step-02.png",
  },

  {
    step: 3,
    title:
      "실명인증 및 신청 동의",
    description:
      "이름과 주민등록번호를 입력하여 실명인증을 진행해주세요. 사회복지사 결격사유와 안내사항을 확인하고 필요한 항목에 체크한 뒤 전자서명 사용에 동의하고 인증을 진행해주세요.",
    image:
      "/images/qualification-application/social-worker-2/step-03.png",
  },

  {
    step: 4,
    title:
      "신청 지방협회 선택",
    description:
      "자택 또는 직장 주소지를 기준으로 신청할 지방협회를 선택해주세요. 온라인 신청 후 출력한 신청서와 필요한 증빙서류도 선택한 지방협회에 제출합니다.",
    image:
      "/images/qualification-application/social-worker-2/step-04.png",
  },

  {
    step: 5,
    title:
      "사진 및 기본정보 입력",
    description:
      "사회복지사 자격증에 사용할 3.5 × 4.5cm 사진을 등록해주세요. 이름, 연락처, 이메일 등 기본정보도 정확하게 확인해주세요.",
    image:
      "/images/qualification-application/social-worker-2/step-05.png",
  },

  {
    step: 6,
    title:
      "자격증 수령방법 및 주소 입력",
    description:
      "자격증을 수령할 방법을 선택하고 실제 자격증을 받을 주소를 정확하게 입력해주세요. 입력한 주소를 다시 확인한 뒤 '다음'을 눌러주세요.",
    image:
      "/images/qualification-application/social-worker-2/step-06.png",
  },

  {
    step: 7,
    title:
      "최종학력 정보 입력",
    description:
      "전문대학 또는 대학교를 졸업한 뒤 사회복지 과목만 추가로 이수한 경우 실제 졸업한 학교 정보를 입력해주세요. 고등학교 졸업 또는 대학 중퇴 후 학점은행제로 전문학사를 취득한 경우 국가평생교육진흥원을 검색하여 학점은행제 학위 정보를 입력해주세요.",
    image:
      "/images/qualification-application/social-worker-2/step-07.png",
  },

  {
    step: 8,
    title:
      "사회복지 교과목 이수정보 입력",
    description:
      "사회복지사 2급 취득을 위해 이수한 교육기관과 교과목을 입력해주세요. 두 곳 이상의 교육원에서 과목을 이수했다면 '이수 교육기관 추가'를 눌러 교육기관을 추가하고 각 교육기관에서 이수한 교과목을 빠짐없이 선택해주세요.",
    image:
      "/images/qualification-application/social-worker-2/step-08.png",
  },

  {
    step: 9,
    title:
      "사회복지 현장실습 정보 입력",
    description:
      "화면에 표시되는 사회복지현장실습 적용 기준을 확인하고 본인에게 해당하는 기준을 선택해주세요. 실습기관, 실습기간, 실습지도자, 세미나 교수 및 실제 실습시간을 정확하게 입력한 뒤 '다음'을 눌러주세요.",
    image:
      "/images/qualification-application/social-worker-2/step-09.png",
  },

  {
    step: 10,
    title:
      "작성정보 최종 확인",
    description:
      "신청종류, 신청 자격등급, 신청 지방협회, 기본정보, 최종학력, 이수 교과목 및 현장실습 정보가 실제 이수내용과 일치하는지 최종 확인해주세요.",
    image:
      "/images/qualification-application/social-worker-2/step-10.png",
  },

  {
    step: 11,
    title:
      "접수절차 안내 확인 및 신청서 제출",
    description:
      "접수절차 안내의 각 탭을 순서대로 클릭하여 서류제출 전 확인사항, 심사진행단계, 최종학력 및 성적증명서 발급방법, 자격증명서 안내를 확인해주세요. 내용을 모두 확인한 뒤 '신청 안내문을 확인하였습니다'에 체크하고 신청서를 제출해주세요.",
    image:
      "/images/qualification-application/social-worker-2/step-11.png",
  },

  {
    step: 12,
    title:
      "신청서 출력 및 증빙서류 제출",
    description:
      "온라인 자격 신규 신청이 완료되면 '신청서 출력'을 눌러 사회복지사 자격증 발급 신청서를 출력해주세요. 이후 본인의 최종학력과 과목 이수상황에 맞는 증빙서류를 준비하여 신청한 지방협회에 제출해주세요.",
    image:
      "/images/qualification-application/social-worker-2/step-12.png",
  },
] as const;

function PortalAdministrationView({
  primaryColor,
  learnerRegistrationProcedure,
  creditRecognitionProcedure,
  degreeApplicationProcedure,
  degreeApplicationInfo,
  qualificationApplicationProcedure,
  qualificationApplicationInfo,
  onQualificationApplication,
  onLearnerRegistration,
  onCreditRecognition,
  onDegreeApplication,
}: {
  primaryColor:
    string;

  learnerRegistrationProcedure:
    any;

  creditRecognitionProcedure:
    any;

  degreeApplicationProcedure:
    any;

  degreeApplicationInfo:
    any;

  onLearnerRegistration:
    () => void;

  onCreditRecognition:
    () => void;

  onDegreeApplication:
    () => void;

  qualificationApplicationProcedure:
    any;

  qualificationApplicationInfo:
    any;

  onQualificationApplication:
    () => void;
}) {
  const learnerRegistrationCompleted =
    learnerRegistrationProcedure
      ?.status ===
    "completed";

  const learnerRegistrationCompletedAt =
    learnerRegistrationProcedure
      ?.completedAt ||
    learnerRegistrationProcedure
      ?.statusChangedAt ||
    null;

const creditRecognitionCompleted =
  creditRecognitionProcedure
    ?.status ===
  "completed";

const creditRecognitionCompletedAt =
  creditRecognitionProcedure
    ?.completedAt ||
  creditRecognitionProcedure
    ?.statusChangedAt ||
  null;

const degreeApplicationCompleted =
  degreeApplicationProcedure
    ?.status ===
  "completed";

const degreeApplicationCompletedAt =
  degreeApplicationProcedure
    ?.completedAt ||
  degreeApplicationProcedure
    ?.statusChangedAt ||
  null;

const degreeApplicationRequired =
  degreeApplicationInfo
    ?.required ===
  true;

const degreeApplicationNotRequired =
  degreeApplicationInfo
    ?.required ===
  false;

const degreeApplicationAvailable =
  degreeApplicationCompleted ||
  degreeApplicationRequired;

const qualificationApplicationCompleted =
  qualificationApplicationProcedure
    ?.status ===
  "completed";

const qualificationApplicationCompletedAt =
  qualificationApplicationProcedure
    ?.completedAt ||
  qualificationApplicationProcedure
    ?.statusChangedAt ||
  null;

const socialWorker2QualificationAvailable =
  qualificationApplicationInfo
    ?.guideType ===
  "social_worker_2";

const qualificationApplicationAvailable =
  qualificationApplicationCompleted ||
  socialWorker2QualificationAvailable;

  return (
    <main className="px-4 pb-28 pt-4">
      <section className="relative h-[210px] overflow-hidden rounded-[28px]">
        <img
          src={PORTAL_IMAGES.administration}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-5 text-white">
          <div className="text-[24px] font-extrabold tracking-[-0.03em]">
            행정절차 안내
          </div>
          <div className="mt-2 text-sm font-medium leading-6 text-white/90">
            필요한 신청 절차와 준비사항을 순서대로 확인해주세요.
          </div>
        </div>
      </section>

      <section className="mt-5">
        <div className="mb-3 text-base font-extrabold text-slate-950">
          행정절차 가이드
        </div>

        <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-100">
          <button
            type="button"
            onClick={
              onLearnerRegistration
            }
            className="flex w-full items-center gap-4 px-5 py-5 text-left transition active:bg-slate-50"
          >
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl font-extrabold text-white"
              style={{
                backgroundColor:
                  primaryColor,
              }}
            >
              1
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className="text-base font-extrabold text-slate-900">
                  학습자등록 가이드
                </div>

                {learnerRegistrationCompleted ? (
  <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-600">
    ✓ 완료
  </span>
) : (
  <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-600">
    이용 가능
  </span>
)}
              </div>

              <div className="mt-1 text-xs leading-5 text-slate-500">
                공식영상 · PC 신청방법 · 14단계 사진 안내
              </div>

{learnerRegistrationCompleted &&
learnerRegistrationCompletedAt ? (
  <div className="mt-1 text-[11px] font-medium text-emerald-600">
    {formatPortalDateTime(
      learnerRegistrationCompletedAt
    )} 완료
  </div>
) : null}
            </div>

            <div className="text-2xl text-slate-300">
              ›
            </div>
          </button>

<button
  type="button"
  onClick={
    onCreditRecognition
  }
  className="flex w-full items-center gap-4 border-t border-slate-100 px-5 py-5 text-left transition active:bg-slate-50"
>
  <div
    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl font-extrabold text-white"
    style={{
      backgroundColor:
        primaryColor,
    }}
  >
    2
  </div>

  <div className="min-w-0 flex-1">
    <div className="flex items-center gap-2">
      <div className="text-base font-extrabold text-slate-900">
        학점인정신청 가이드
      </div>

      {creditRecognitionCompleted ? (
        <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-600">
          ✓ 완료
        </span>
      ) : (
        <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-600">
          이용 가능
        </span>
      )}
    </div>

    <div className="mt-1 text-xs leading-5 text-slate-500">
      공식영상 · PC 신청방법 · 12단계 사진 안내
    </div>

    {creditRecognitionCompleted &&
    creditRecognitionCompletedAt ? (
      <div className="mt-1 text-[11px] font-medium text-emerald-600">
        {formatPortalDateTime(
          creditRecognitionCompletedAt
        )} 완료
      </div>
    ) : null}
  </div>

  <div className="text-2xl text-slate-300">
    ›
  </div>
</button>


          <button
  type="button"
  disabled={
    !degreeApplicationAvailable
  }
  onClick={() => {
    if (
      !degreeApplicationAvailable
    ) {
      return;
    }

    onDegreeApplication();
  }}
  className={`flex w-full items-center gap-4 border-t border-slate-100 px-5 py-5 text-left transition ${
    degreeApplicationAvailable
      ? "active:bg-slate-50"
      : "cursor-default"
  }`}
>
  <div
    className={
      degreeApplicationAvailable
        ? "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl font-extrabold text-white"
        : "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-xl font-extrabold text-slate-400"
    }
    style={
      degreeApplicationAvailable
        ? {
            backgroundColor:
              primaryColor,
          }
        : undefined
    }
  >
    3
  </div>

  <div className="min-w-0 flex-1">
    <div className="flex flex-wrap items-center gap-2">
      <div
        className={
          degreeApplicationAvailable
            ? "text-base font-extrabold text-slate-900"
            : "text-base font-extrabold text-slate-600"
        }
      >
        학위신청 가이드
      </div>

      {degreeApplicationCompleted ? (
        <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-600">
          ✓ 완료
        </span>
      ) : degreeApplicationRequired ? (
        <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-600">
          이용 가능
        </span>
      ) : degreeApplicationNotRequired ? (
        <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">
          해당 없음
        </span>
      ) : (
        <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-600">
          확인 필요
        </span>
      )}
    </div>

    {degreeApplicationCompleted ? (
      <div className="mt-1 text-xs leading-5 text-slate-500">
        PC 신청방법 · 6단계 사진 안내
      </div>
    ) : degreeApplicationRequired ? (
      <div className="mt-1 text-xs leading-5 text-slate-500">
        학위 취득 대상 · PC 신청방법 · 6단계 사진 안내
      </div>
    ) : degreeApplicationNotRequired ? (
      <div className="mt-1 text-xs leading-5 text-slate-400">
        현재 등록된 학습설계 기준 별도의 학위신청이 필요하지 않습니다.
      </div>
    ) : (
      <div className="mt-1 text-xs leading-5 text-amber-600">
        과정 또는 최종학력 확인이 필요합니다.
      </div>
    )}

    {degreeApplicationCompleted &&
    degreeApplicationCompletedAt ? (
      <div className="mt-1 text-[11px] font-medium text-emerald-600">
        {formatPortalDateTime(
          degreeApplicationCompletedAt
        )}{" "}
        완료
      </div>
    ) : null}
  </div>

  {degreeApplicationAvailable ? (
    <div className="text-2xl text-slate-300">
      ›
    </div>
  ) : null}
</button>

          <button
  type="button"
  disabled={
    !qualificationApplicationAvailable
  }
  onClick={() => {
    if (
      !qualificationApplicationAvailable
    ) {
      return;
    }

    onQualificationApplication();
  }}
  className={`flex w-full items-center gap-4 border-t border-slate-100 px-5 py-5 text-left transition ${
    qualificationApplicationAvailable
      ? "active:bg-slate-50"
      : "cursor-default"
  }`}
>
  <div
    className={
      qualificationApplicationAvailable
        ? "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl font-extrabold text-white"
        : "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-xl font-extrabold text-slate-400"
    }
    style={
      qualificationApplicationAvailable
        ? {
            backgroundColor:
              primaryColor,
          }
        : undefined
    }
  >
    4
  </div>

  <div className="min-w-0 flex-1">
    <div className="flex flex-wrap items-center gap-2">
      <div
        className={
          qualificationApplicationAvailable
            ? "text-base font-extrabold text-slate-900"
            : "text-base font-extrabold text-slate-600"
        }
      >
        자격증 신청 가이드
      </div>

      {qualificationApplicationCompleted ? (
        <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-600">
          ✓ 완료
        </span>
      ) : socialWorker2QualificationAvailable ? (
        <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-600">
          이용 가능
        </span>
      ) : qualificationApplicationInfo
          ?.status ===
        "review_required" ? (
        <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-600">
          확인 필요
        </span>
      ) : (
        <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">
          준비 중
        </span>
      )}
    </div>

    <div className="mt-1 text-xs leading-5 text-slate-500">
      {socialWorker2QualificationAvailable
        ? "사회복지사 2급 · PC 신청방법 · 12단계 사진 안내"
        : "현재 과정의 자격증 신청 가이드는 준비 중입니다."}
    </div>

    {qualificationApplicationCompleted &&
    qualificationApplicationCompletedAt ? (
      <div className="mt-1 text-[11px] font-medium text-emerald-600">
        {formatPortalDateTime(
          qualificationApplicationCompletedAt
        )}{" "}
        완료
      </div>
    ) : null}
  </div>

  {qualificationApplicationAvailable ? (
    <div className="text-2xl text-slate-300">
      ›
    </div>
  ) : null}
</button>
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-extrabold text-blue-600">
            i
          </div>

          <div>
            <div className="text-sm font-bold text-slate-800">
              안내
            </div>

            <div className="mt-1 text-xs leading-5 text-slate-500">
  현재 사회복지사 2급 자격증 신청 가이드를 지원합니다.
  다른 자격과정 가이드는 순차적으로 추가됩니다.
</div>
          </div>
        </div>
      </section>
    </main>
  );
}

function PortalLearnerRegistrationGuide({
  primaryColor,
  procedure,
  isCompleting,
  errorMessage,
  onComplete,
}: {
  primaryColor:
    string;

  procedure:
    any;

  isCompleting:
    boolean;

  errorMessage:
    string | null;

  onComplete:
    () => Promise<void>;
}) {
  const [
    zoomImage,
    setZoomImage,
  ] =
    useState<string | null>(
      null
    );

  const [
    completeConfirmOpen,
    setCompleteConfirmOpen,
  ] =
    useState(false);

  const completed =
    procedure?.status ===
    "completed";

  const completedAt =
    procedure?.completedAt ||
    procedure?.statusChangedAt ||
    null;

  return (
    <>
      <main className="px-4 pb-28 pt-4">
        {/* 상단 설명 */}
        <section className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5">
          <div className="text-xs font-bold text-blue-600">
            학점은행제 시작의 첫 단계
          </div>

          <div className="mt-2 text-[25px] font-extrabold tracking-tight text-slate-950">
            학습자등록이란?
          </div>

          <div className="mt-3 text-sm leading-6 text-slate-600">
            학습자등록은 학점은행제를 이용하기 위해
            국가평생교육진흥원에 학습자로 등록하는
            행정절차입니다.
          </div>

          <div className="mt-4 rounded-2xl bg-white/80 p-4">
            <div className="text-xs font-bold text-slate-500">
              신청 가능 시기
            </div>

            <div
              className="mt-1 text-lg font-extrabold"
              style={{
                color:
                  primaryColor,
              }}
            >
              1월 · 4월 · 7월 · 10월
            </div>

            <div className="mt-1 text-xs text-slate-400">
              분기별 신청기간에 진행할 수 있습니다.
            </div>
          </div>
        </section>

        {/* PC 권장 */}
        <section className="mt-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-4">
          <div className="flex gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 font-bold text-red-500">
              PC
            </div>

            <div>
              <div className="text-sm font-extrabold text-red-700">
                PC에서 진행을 권장합니다.
              </div>

              <div className="mt-1 text-xs leading-5 text-red-500">
                아래 안내는 국가평생교육진흥원 PC 화면을 기준으로 제작되었습니다.
              </div>
            </div>
          </div>
        </section>

        {/* 공식 영상 */}
        <section className="mt-5">
          <div className="mb-3">
            <div className="text-lg font-extrabold text-slate-950">
              공식 영상으로 먼저 확인하기
            </div>

            <div className="mt-1 text-xs leading-5 text-slate-500">
              국가평생교육진흥원에서 제공하는
              학습자등록 공식 안내영상입니다.
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-100">
            <div className="aspect-video w-full bg-black">
              <iframe
                className="h-full w-full"
                src="https://www.youtube.com/embed/whZNCWc7C7c"
                title="국가평생교육진흥원 학습자등록 안내"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>

            <div className="p-4">
              <div className="text-sm font-extrabold text-slate-900">
                국가평생교육진흥원 학습자등록 신청방법
              </div>

              <div className="mt-1 text-xs leading-5 text-slate-500">
                영상 우측 하단의 전체화면 버튼을 누르면
                크게 보면서 따라할 수 있습니다.
              </div>
            </div>
          </div>
        </section>

        {/* 홈페이지 바로가기 */}
        <a
          href="https://www.cb.or.kr"
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex h-14 w-full items-center justify-center rounded-2xl text-sm font-extrabold text-white shadow-sm"
          style={{
            backgroundColor:
              primaryColor,
          }}
        >
          학점은행제 홈페이지 바로가기 ↗
        </a>

        {/* 14단계 */}
        <section className="mt-7">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-lg font-extrabold text-slate-950">
                학습자등록 따라하기
              </div>

              <div className="mt-1 text-xs text-slate-500">
                아래 순서대로 진행해주세요.
              </div>
            </div>

            <div
              className="rounded-full px-3 py-1.5 text-xs font-extrabold"
              style={{
                backgroundColor:
                  `${primaryColor}12`,

                color:
                  primaryColor,
              }}
            >
              총 14단계
            </div>
          </div>

          <div className="mt-4 space-y-4">
            {LEARNER_REGISTRATION_STEPS.map(
              item => (
                <article
                  key={
                    item.step
                  }
                  className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-100"
                >
                  <div className="p-5">
                    <div className="flex items-start gap-3">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-white"
                        style={{
                          backgroundColor:
                            primaryColor,
                        }}
                      >
                        {
                          item.step
                        }
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="text-base font-extrabold text-slate-900">
                          {
                            item.title
                          }
                        </div>

                        <div className="mt-2 text-sm leading-6 text-slate-500">
                          {
                            item.description
                          }
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setZoomImage(
                        item.image
                      )
                    }
                    className="block w-full border-t border-slate-100 bg-slate-50 p-3"
                  >
                    <img
                      src={
                        item.image
                      }
                      alt={`STEP ${item.step} ${item.title}`}
                      loading="lazy"
                      className="h-auto w-full rounded-2xl object-contain"
                    />

                    <div className="mt-2 text-center text-xs font-medium text-slate-400">
                      이미지를 누르면 크게 볼 수 있습니다.
                    </div>
                  </button>
                </article>
              )
            )}
          </div>
        </section>

                {/* 학습자등록 완료 */}
        {completed ? (
          <section className="mt-5 rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-lg font-extrabold text-white">
                ✓
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-base font-extrabold text-emerald-900">
                  학습자등록 완료
                </div>

                <div className="mt-1 text-sm leading-6 text-emerald-700">
                  학습자등록 완료상태가
                  업무포털과 학습관리 시스템에
                  반영되어 있습니다.
                </div>

                {completedAt ? (
                  <div className="mt-2 text-xs font-bold text-emerald-600">
                    완료일시{" "}
                    {formatPortalDateTime(
                      completedAt
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        ) : (
          <section className="mt-5 rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-lg font-extrabold text-white">
                ✓
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-base font-extrabold text-emerald-900">
                  학습자등록을 완료하셨나요?
                </div>

                <div className="mt-1 text-sm leading-6 text-emerald-700">
                  국가평생교육진흥원에서
                  학습자등록 완료 상태를 확인한 후
                  아래 버튼을 눌러주세요.
                </div>
              </div>
            </div>

            {errorMessage ? (
              <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                {errorMessage}
              </div>
            ) : null}

            <button
              type="button"
              disabled={
                isCompleting
              }
              onClick={() =>
                setCompleteConfirmOpen(
                  true
                )
              }
              className="mt-5 h-14 w-full rounded-2xl text-base font-extrabold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                backgroundColor:
                  primaryColor,
              }}
            >
              학습자등록 완료
            </button>
          </section>
        )}
      </main>

      {zoomImage ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-3"
          onClick={() =>
            setZoomImage(
              null
            )
          }
        >
          <button
            type="button"
            onClick={() =>
              setZoomImage(
                null
              )
            }
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-2xl text-white"
            aria-label="이미지 닫기"
          >
            ×
          </button>

          <img
            src={
              zoomImage
            }
            alt=""
            className="max-h-[90vh] max-w-full object-contain"
            onClick={
              event =>
                event.stopPropagation()
            }
          />
        </div>
      ) : null}

      {completeConfirmOpen ? (
        <div
          className="fixed inset-0 z-[110] flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={() => {
            if (
              isCompleting
            ) {
              return;
            }

            setCompleteConfirmOpen(
              false
            );
          }}
        >
          <div
            className="w-full max-w-[440px] rounded-3xl bg-white p-5 shadow-2xl"
            onClick={
              event =>
                event.stopPropagation()
            }
          >
            <div className="text-lg font-extrabold text-slate-950">
              학습자등록을 완료하셨나요?
            </div>

            <div className="mt-2 text-sm leading-6 text-slate-500">
              국가평생교육진흥원에서
              학습자등록이 완료된 것을 확인하셨다면
              완료하기를 눌러주세요.
            </div>

            <div className="mt-4 rounded-2xl bg-blue-50 p-4 text-xs leading-5 text-blue-700">
              완료하면 회원님의 학습관리 정보에도
              학습자등록 완료 상태가 자동으로 반영됩니다.
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={
                  isCompleting
                }
                onClick={() =>
                  setCompleteConfirmOpen(
                    false
                  )
                }
                className="h-12 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-600 disabled:opacity-50"
              >
                취소
              </button>

              <button
                type="button"
                disabled={
                  isCompleting
                }
                onClick={async () => {
                  try {
                    await onComplete();

                    setCompleteConfirmOpen(
                      false
                    );
                  } catch {
                    /**
                     * Mutation Error는
                     * 가이드 본문에서 표시한다.
                     */
                  }
                }}
                className="h-12 rounded-xl text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  backgroundColor:
                    primaryColor,
                }}
              >
                {isCompleting
                  ? "처리 중..."
                  : "완료하기"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function PortalCreditRecognitionGuide({
  primaryColor,
  procedure,
  myWork,
  isCompleting,
  errorMessage,
  onComplete,
}: {
  primaryColor:
    string;

  procedure:
    any;

  myWork:
    any;

  isCompleting:
    boolean;

  errorMessage:
    string | null;

  onComplete:
    () => Promise<void>;
}) {
  const [
    zoomImage,
    setZoomImage,
  ] =
    useState<string | null>(
      null
    );

  const [
    completeConfirmOpen,
    setCompleteConfirmOpen,
  ] =
    useState(false);

  const completed =
    procedure?.status ===
    "completed";

  const completedAt =
    procedure?.completedAt ||
    procedure?.statusChangedAt ||
    null;

  /**
   * CRM 담당자가 실제로 등록한
   * 우리플랜 과목/학습구분.
   *
   * 서버 myWork.subjects는
   * planCategory / planRequirementType을
   * 그대로 공개 DTO로 변환한 데이터다.
   */
  const academicSubjects =
    Array.isArray(
      myWork?.subjects
    )
      ? myWork.subjects.filter(
          (
            row:
              any
          ) =>
            Boolean(
              String(
                row?.subjectName ||
                ""
              ).trim()
            )
        )
      : [];

  const academicGroups =
    academicSubjects.reduce(
      (
        groups:
          Record<
            string,
            string[]
          >,
        row:
          any
      ) => {
        const label =
          String(
            row?.requirementType ||
            row?.category ||
            "구분 확인"
          ).trim() ||
          "구분 확인";

        const subjectName =
          String(
            row?.subjectName ||
            ""
          ).trim();

        if (
          !subjectName
        ) {
          return groups;
        }

        if (
          !groups[label]
        ) {
          groups[label] =
            [];
        }

        groups[label].push(
          subjectName
        );

        return groups;
      },
      {} as Record<
        string,
        string[]
      >
    );

  const academicGroupEntries =
    Object.entries(
      academicGroups
    );

  /**
   * CRM에 입력된 실제 전적대 데이터.
   *
   * 서버에서 이미:
   * transfer.hasData
   * transfer.totalCredits
   * transfer.subjects
   *
   * 를 내려주고 있으므로
   * 프론트에서 임의 판단하지 않는다.
   */
  const hasTransferData =
    myWork?.transfer
      ?.hasData ===
    true;

  const transferTotalCredits =
    Number(
      myWork?.transfer
        ?.totalCredits ||
      0
    );

  return (
    <>
      <main className="px-4 pb-28 pt-4">
        {/* 상단 설명 */}
        <section className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5">
          <div className="text-xs font-bold text-blue-600">
            이수한 과목을 공식 학점으로 등록하는 절차
          </div>

          <div className="mt-2 text-[25px] font-extrabold tracking-tight text-slate-950">
            학점인정신청이란?
          </div>

          <div className="mt-3 text-sm leading-6 text-slate-600">
            교육원 또는 이전 대학에서 이수한 학점을
            국가평생교육진흥원에 신청하여
            학점은행제 학점으로 인정받는 행정절차입니다.
          </div>

          <div className="mt-4 rounded-2xl bg-white/80 p-4">
            <div className="text-xs font-bold text-slate-500">
              신청 가능 시기
            </div>

            <div
              className="mt-1 text-lg font-extrabold"
              style={{
                color:
                  primaryColor,
              }}
            >
              1월 · 4월 · 7월 · 10월
            </div>

            <div className="mt-1 text-xs leading-5 text-slate-400">
              세부 신청기간은 국가평생교육진흥원 공지에 따라 달라질 수 있습니다.
            </div>
          </div>
        </section>

        {/* PC 권장 */}
        <section className="mt-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-4">
          <div className="flex gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 font-bold text-red-500">
              PC
            </div>

            <div>
              <div className="text-sm font-extrabold text-red-700">
                PC에서 진행을 권장합니다.
              </div>

              <div className="mt-1 text-xs leading-5 text-red-500">
                아래 사진 안내는 국가평생교육진흥원 PC 화면을 기준으로 제작되었습니다.
              </div>
            </div>
          </div>
        </section>

        {/* 공식 영상 */}
        <section className="mt-5">
          <div className="mb-3">
            <div className="text-lg font-extrabold text-slate-950">
              공식 영상으로 먼저 확인하기
            </div>

            <div className="mt-1 text-xs leading-5 text-slate-500">
              국가평생교육진흥원에서 제공하는
              학점인정신청 공식 안내영상입니다.
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-100">
            <div className="aspect-video w-full bg-black">
              <iframe
                className="h-full w-full"
                src="https://www.youtube.com/embed/crXq4Es5OrU"
                title="국가평생교육진흥원 학점인정신청 안내"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>

            <div className="p-4">
              <div className="text-sm font-extrabold text-slate-900">
                국가평생교육진흥원 학점인정신청 방법
              </div>

              <div className="mt-1 text-xs leading-5 text-slate-500">
                영상 우측 하단의 전체화면 버튼을 누르면
                크게 보면서 따라할 수 있습니다.
              </div>
            </div>
          </div>
        </section>

        {/* 홈페이지 바로가기 */}
        <a
          href="https://www.cb.or.kr"
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex h-14 w-full items-center justify-center rounded-2xl text-sm font-extrabold text-white shadow-sm"
          style={{
            backgroundColor:
              primaryColor,
          }}
        >
          학점은행제 홈페이지 바로가기 ↗
        </a>

        {/* 담당자 지정 학습구분 */}
        <section className="mt-5 rounded-3xl border border-blue-100 bg-blue-50 p-5">
          <div className="text-xs font-bold text-blue-600">
            업무포털 내 학적정보
          </div>

          <div className="mt-1 text-base font-extrabold text-blue-950">
            담당자가 지정한 학습구분을 확인하세요.
          </div>

          <div className="mt-2 text-xs leading-5 text-blue-700">
            학점인정신청 화면에서 임의로 전공·교양·일반을
            선택하지 말고 아래 등록정보를 기준으로 확인해주세요.
          </div>

          {academicGroupEntries.length >
          0 ? (
            <div className="mt-4 space-y-3">
              {academicGroupEntries.map(
                ([
                  label,
                  subjectNames,
                ]) => (
                  <div
                    key={
                      label
                    }
                    className="rounded-2xl bg-white p-4"
                  >
                    <div className="text-sm font-extrabold text-slate-900">
                      {label}
                    </div>

                    <div className="mt-2 space-y-1">
                      {subjectNames.map(
                        (
                          subjectName,
                          index
                        ) => (
                          <div
                            key={`${label}-${subjectName}-${index}`}
                            className="text-xs leading-5 text-slate-600"
                          >
                            ·{" "}
                            {
                              subjectName
                            }
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl bg-white p-4 text-xs leading-5 text-slate-500">
              현재 등록된 과목별 학습구분 정보가 없습니다.
              학습구분이 확인되지 않는 경우 임의로 선택하지 마세요.
            </div>
          )}
        </section>

        {/* 12단계 */}
        <section className="mt-7">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-lg font-extrabold text-slate-950">
                학점인정신청 따라하기
              </div>

              <div className="mt-1 text-xs text-slate-500">
                아래 순서대로 진행해주세요.
              </div>
            </div>

            <div
              className="rounded-full px-3 py-1.5 text-xs font-extrabold"
              style={{
                backgroundColor:
                  `${primaryColor}12`,

                color:
                  primaryColor,
              }}
            >
              총 12단계
            </div>
          </div>

          <div className="mt-4 space-y-4">
            {CREDIT_RECOGNITION_STEPS.map(
              item => (
                <article
                  key={
                    item.step
                  }
                  className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-100"
                >
                  <div className="p-5">
                    <div className="flex items-start gap-3">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-white"
                        style={{
                          backgroundColor:
                            primaryColor,
                        }}
                      >
                        {
                          item.step
                        }
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="text-base font-extrabold text-slate-900">
                          {
                            item.title
                          }
                        </div>

                        <div className="mt-2 text-sm leading-6 text-slate-500">
                          {
                            item.description
                          }
                        </div>
                      </div>
                    </div>

                    {item.step ===
                    6 ? (
                      <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                        <div className="text-xs font-extrabold text-blue-700">
                          학습구분 확인
                        </div>

                        <div className="mt-1 text-xs leading-5 text-blue-600">
                          위에 표시된 업무포털 학적정보에서
                          담당자가 지정한 전공필수·전공선택·교양·일반
                          구분을 확인한 뒤 동일하게 신청해주세요.
                        </div>
                      </div>
                    ) : null}

                    {item.step ===
                    8 ? (
                      hasTransferData ? (
                        <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                          <div className="text-sm font-extrabold text-blue-800">
                            전적대 학점 신청 대상
                          </div>

                          <div className="mt-1 text-xs leading-5 text-blue-600">
                            현재 업무포털에 전적대 과목이 등록되어 있습니다.
                            STEP 08~09를 확인하여 진행해주세요.
                          </div>

                          {transferTotalCredits >
                          0 ? (
                            <div className="mt-2 text-xs font-bold text-blue-700">
                              현재 등록된 전적대 학점 합계{" "}
                              {
                                transferTotalCredits
                              }
                              학점
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-4">
                          <div className="text-sm font-extrabold text-amber-800">
                            STEP 08~09는 건너뛰세요.
                          </div>

                          <div className="mt-1 text-xs leading-5 text-amber-700">
                            현재 업무포털에 등록된 전적대 과목이 없습니다.
                            이전 대학 학점을 사용하지 않는 경우
                            STEP 08과 STEP 09는 진행하지 않아도 됩니다.
                          </div>
                        </div>
                      )
                    ) : null}

                    {item.step ===
                      9 &&
                    !hasTransferData ? (
                      <div className="mt-4 rounded-2xl bg-slate-100 p-4 text-xs font-bold leading-5 text-slate-500">
                        현재 등록정보 기준 전적대 신청 대상이 아니므로
                        이 단계는 건너뛰어주세요.
                      </div>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setZoomImage(
                        item.image
                      )
                    }
                    className="block w-full border-t border-slate-100 bg-slate-50 p-3"
                  >
                    <img
                      src={
                        item.image
                      }
                      alt={`STEP ${item.step} ${item.title}`}
                      loading="lazy"
                      className="h-auto w-full rounded-2xl object-contain"
                    />

                    <div className="mt-2 text-center text-xs font-medium text-slate-400">
                      이미지를 누르면 크게 볼 수 있습니다.
                    </div>
                  </button>
                </article>
              )
            )}
          </div>
        </section>

        {/* 학점인정신청 완료 */}
        {completed ? (
          <section className="mt-5 rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-lg font-extrabold text-white">
                ✓
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-base font-extrabold text-emerald-900">
                  학점인정신청 완료
                </div>

                <div className="mt-1 text-sm leading-6 text-emerald-700">
                  학점인정신청 완료상태가
                  업무포털과 학습관리 시스템에
                  반영되어 있습니다.
                </div>

                {completedAt ? (
                  <div className="mt-2 text-xs font-bold text-emerald-600">
                    완료일시{" "}
                    {formatPortalDateTime(
                      completedAt
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        ) : (
          <section className="mt-5 rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-lg font-extrabold text-white">
                ✓
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-base font-extrabold text-emerald-900">
                  학점인정신청을 완료하셨나요?
                </div>

                <div className="mt-1 text-sm leading-6 text-emerald-700">
                  국가평생교육진흥원에서
                  신청 과목 확인과 결제를 완료한 후
                  아래 버튼을 눌러주세요.
                </div>
              </div>
            </div>

            {errorMessage ? (
              <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                {errorMessage}
              </div>
            ) : null}

            <button
              type="button"
              disabled={
                isCompleting
              }
              onClick={() =>
                setCompleteConfirmOpen(
                  true
                )
              }
              className="mt-5 h-14 w-full rounded-2xl text-base font-extrabold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                backgroundColor:
                  primaryColor,
              }}
            >
              학점인정신청 완료
            </button>
          </section>
        )}
      </main>

      {/* 이미지 확대 */}
      {zoomImage ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-3"
          onClick={() =>
            setZoomImage(
              null
            )
          }
        >
          <button
            type="button"
            onClick={() =>
              setZoomImage(
                null
              )
            }
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-2xl text-white"
            aria-label="이미지 닫기"
          >
            ×
          </button>

          <img
            src={
              zoomImage
            }
            alt=""
            className="max-h-[90vh] max-w-full object-contain"
            onClick={
              event =>
                event.stopPropagation()
            }
          />
        </div>
      ) : null}

      {/* 완료 확인 */}
      {completeConfirmOpen ? (
        <div
          className="fixed inset-0 z-[110] flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={() => {
            if (
              isCompleting
            ) {
              return;
            }

            setCompleteConfirmOpen(
              false
            );
          }}
        >
          <div
            className="w-full max-w-[440px] rounded-3xl bg-white p-5 shadow-2xl"
            onClick={
              event =>
                event.stopPropagation()
            }
          >
            <div className="text-lg font-extrabold text-slate-950">
              학점인정신청을 완료하셨나요?
            </div>

            <div className="mt-2 text-sm leading-6 text-slate-500">
              국가평생교육진흥원에서
              신청할 과목을 확인하고 결제까지 완료했다면
              완료하기를 눌러주세요.
            </div>

            <div className="mt-4 rounded-2xl bg-blue-50 p-4 text-xs leading-5 text-blue-700">
              완료하면 회원님의 CRM 학습관리 정보에도
              학점인정신청 완료 상태가 자동으로 반영됩니다.
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={
                  isCompleting
                }
                onClick={() =>
                  setCompleteConfirmOpen(
                    false
                  )
                }
                className="h-12 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-600 disabled:opacity-50"
              >
                취소
              </button>

              <button
                type="button"
                disabled={
                  isCompleting
                }
                onClick={async () => {
                  try {
                    await onComplete();

                    setCompleteConfirmOpen(
                      false
                    );
                  } catch {
                    /**
                     * Mutation Error는
                     * 가이드 본문에서 표시한다.
                     */
                  }
                }}
                className="h-12 rounded-xl text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  backgroundColor:
                    primaryColor,
                }}
              >
                {isCompleting
                  ? "처리 중..."
                  : "완료하기"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function PortalDegreeApplicationGuide({
  primaryColor,
  procedure,
  degreeApplicationInfo,
  isCompleting,
  errorMessage,
  onComplete,
}: {
  primaryColor:
    string;

  procedure:
    any;

  degreeApplicationInfo:
    any;

  isCompleting:
    boolean;

  errorMessage:
    string | null;

  onComplete:
    () => Promise<void>;
}) {
  const [
    zoomImage,
    setZoomImage,
  ] =
    useState<string | null>(
      null
    );

  const [
    completeConfirmOpen,
    setCompleteConfirmOpen,
  ] =
    useState(false);

  const completed =
    procedure?.status ===
    "completed";

  const completedAt =
    procedure?.completedAt ||
    procedure?.statusChangedAt ||
    null;

  const required =
    degreeApplicationInfo
      ?.required ===
    true;

  /**
   * 정상 화면 진입 자체는
   * required 또는 기존 completed일 때만
   * 목록에서 허용하고 있다.
   *
   * 혹시 상태가 변경된 뒤 직접 렌더되더라도
   * 완료된 기존 기록은 계속 볼 수 있게 한다.
   */
  const available =
    required ||
    completed;

  if (
    !available
  ) {
    return (
      <main className="px-4 pb-28 pt-4">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-2xl">
            ✓
          </div>

          <div className="mt-4 text-xl font-extrabold text-slate-900">
            학위신청 대상이 아닙니다.
          </div>

          <div className="mt-2 text-sm leading-6 text-slate-500">
            현재 등록된 학습설계 기준으로
            별도의 학점은행제 학위신청이 필요하지 않습니다.
          </div>
        </section>
      </main>
    );
  }

  return (
    <>
      <main className="px-4 pb-28 pt-4">
        {/* 상단 설명 */}
        <section className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5">
          <div className="text-xs font-bold text-blue-600">
            학점은행제 학위 취득의 마지막 행정절차
          </div>

          <div className="mt-2 text-[25px] font-extrabold tracking-tight text-slate-950">
            학위신청이란?
          </div>

          <div className="mt-3 text-sm leading-6 text-slate-600">
            학점은행제 학위요건을 충족한 학습자가
            국가평생교육진흥원에 학위수여를 신청하는
            행정절차입니다.
          </div>

          <div className="mt-4 rounded-2xl bg-white/80 p-4">
            <div className="text-xs font-bold text-slate-500">
              현재 회원님의 학위신청 대상 여부
            </div>

            <div
              className="mt-1 text-lg font-extrabold"
              style={{
                color:
                  primaryColor,
              }}
            >
              학위신청 대상
            </div>

            <div className="mt-1 text-xs leading-5 text-slate-500">
              현재 등록된 과정과 최종학력을 기준으로
              별도의 학점은행제 학위과정이 필요한 회원입니다.
            </div>
          </div>
        </section>

        {/* 중요 안내 */}
        <section className="mt-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-4">
          <div className="flex gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 font-extrabold text-amber-600">
              !
            </div>

            <div>
              <div className="text-sm font-extrabold text-amber-800">
                학위신청 전 취득학점을 꼭 확인해주세요.
              </div>

              <div className="mt-1 text-xs leading-5 text-amber-700">
                학위신청 화면에 표시되는 학위종류,
                전공, 총학점 및 학점인정 내역이
                현재 진행한 학습설계와 맞는지 확인한 뒤 신청해주세요.
              </div>
            </div>
          </div>
        </section>

        {/* PC 권장 */}
        <section className="mt-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-4">
          <div className="flex gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 font-bold text-red-500">
              PC
            </div>

            <div>
              <div className="text-sm font-extrabold text-red-700">
                PC에서 진행을 권장합니다.
              </div>

              <div className="mt-1 text-xs leading-5 text-red-500">
                아래 사진 안내는 국가평생교육진흥원
                PC 화면을 기준으로 제작되었습니다.
              </div>
            </div>
          </div>
        </section>

        {/* 홈페이지 바로가기 */}
        <a
          href="https://www.cb.or.kr"
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex h-14 w-full items-center justify-center rounded-2xl text-sm font-extrabold text-white shadow-sm"
          style={{
            backgroundColor:
              primaryColor,
          }}
        >
          학점은행제 홈페이지 바로가기 ↗
        </a>

        {/* 6단계 */}
        <section className="mt-7">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-lg font-extrabold text-slate-950">
                학위신청 따라하기
              </div>

              <div className="mt-1 text-xs text-slate-500">
                아래 순서대로 진행해주세요.
              </div>
            </div>

            <div
              className="rounded-full px-3 py-1.5 text-xs font-extrabold"
              style={{
                backgroundColor:
                  `${primaryColor}12`,

                color:
                  primaryColor,
              }}
            >
              총 6단계
            </div>
          </div>

          <div className="mt-4 space-y-4">
            {DEGREE_APPLICATION_STEPS.map(
              item => (
                <article
                  key={
                    item.step
                  }
                  className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-100"
                >
                  <div className="p-5">
                    <div className="flex items-start gap-3">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-white"
                        style={{
                          backgroundColor:
                            primaryColor,
                        }}
                      >
                        {
                          item.step
                        }
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="text-base font-extrabold text-slate-900">
                          {
                            item.title
                          }
                        </div>

                        <div className="mt-2 text-sm leading-6 text-slate-500">
                          {
                            item.description
                          }
                        </div>
                      </div>
                    </div>

                    {item.step ===
                    3 ? (
                      <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                        <div className="text-xs font-extrabold text-blue-700">
                          취득학점 확인
                        </div>

                        <div className="mt-1 text-xs leading-5 text-blue-600">
                          학위신청 화면에 표시된
                          학위종류·전공·총학점·전공필수·전공선택·교양·일반
                          학점 내역을 확인해주세요.
                          내용이 다르면 신청 전에 담당자에게 확인해주세요.
                        </div>
                      </div>
                    ) : null}

                    {item.step ===
                    6 ? (
                      <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                        <div className="text-xs font-extrabold text-emerald-700">
                          최종 접수 확인
                        </div>

                        <div className="mt-1 text-xs leading-5 text-emerald-600">
                          학위신청 후에는
                          마이페이지 → 나의 접수현황에서
                          접수 및 처리상태를 반드시 확인해주세요.
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setZoomImage(
                        item.image
                      )
                    }
                    className="block w-full border-t border-slate-100 bg-slate-50 p-3"
                  >
                    <img
                      src={
                        item.image
                      }
                      alt={`STEP ${item.step} ${item.title}`}
                      loading="lazy"
                      className="h-auto w-full rounded-2xl object-contain"
                    />

                    <div className="mt-2 text-center text-xs font-medium text-slate-400">
                      이미지를 누르면 크게 볼 수 있습니다.
                    </div>
                  </button>
                </article>
              )
            )}
          </div>
        </section>

        {/* 학위신청 완료 */}
        {completed ? (
          <section className="mt-5 rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-lg font-extrabold text-white">
                ✓
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-base font-extrabold text-emerald-900">
                  학위신청 완료
                </div>

                <div className="mt-1 text-sm leading-6 text-emerald-700">
                  학위신청 완료상태가
                  업무포털과 학습관리 시스템에
                  반영되어 있습니다.
                </div>

                {completedAt ? (
                  <div className="mt-2 text-xs font-bold text-emerald-600">
                    완료일시{" "}
                    {formatPortalDateTime(
                      completedAt
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        ) : (
          <section className="mt-5 rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-lg font-extrabold text-white">
                ✓
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-base font-extrabold text-emerald-900">
                  학위신청을 완료하셨나요?
                </div>

                <div className="mt-1 text-sm leading-6 text-emerald-700">
                  국가평생교육진흥원에서
                  학위신청 접수까지 완료한 후
                  아래 버튼을 눌러주세요.
                </div>
              </div>
            </div>

            {errorMessage ? (
              <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                {errorMessage}
              </div>
            ) : null}

            <button
              type="button"
              disabled={
                isCompleting
              }
              onClick={() =>
                setCompleteConfirmOpen(
                  true
                )
              }
              className="mt-5 h-14 w-full rounded-2xl text-base font-extrabold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                backgroundColor:
                  primaryColor,
              }}
            >
              학위신청 완료
            </button>
          </section>
        )}
      </main>

      {/* 이미지 확대 */}
      {zoomImage ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-3"
          onClick={() =>
            setZoomImage(
              null
            )
          }
        >
          <button
            type="button"
            onClick={() =>
              setZoomImage(
                null
              )
            }
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-2xl text-white"
            aria-label="이미지 닫기"
          >
            ×
          </button>

          <img
            src={
              zoomImage
            }
            alt=""
            className="max-h-[90vh] max-w-full object-contain"
            onClick={
              event =>
                event.stopPropagation()
            }
          />
        </div>
      ) : null}

      {/* 완료 확인 */}
      {completeConfirmOpen ? (
        <div
          className="fixed inset-0 z-[110] flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={() => {
            if (
              isCompleting
            ) {
              return;
            }

            setCompleteConfirmOpen(
              false
            );
          }}
        >
          <div
            className="w-full max-w-[440px] rounded-3xl bg-white p-5 shadow-2xl"
            onClick={
              event =>
                event.stopPropagation()
            }
          >
            <div className="text-lg font-extrabold text-slate-950">
              학위신청을 완료하셨나요?
            </div>

            <div className="mt-2 text-sm leading-6 text-slate-500">
              국가평생교육진흥원에서
              학위신청이 정상적으로 접수된 것을 확인했다면
              완료하기를 눌러주세요.
            </div>

            <div className="mt-4 rounded-2xl bg-blue-50 p-4 text-xs leading-5 text-blue-700">
              완료하면 회원님의 CRM 학습관리 정보에도
              학위신청 완료 상태가 자동으로 반영됩니다.
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={
                  isCompleting
                }
                onClick={() =>
                  setCompleteConfirmOpen(
                    false
                  )
                }
                className="h-12 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-600 disabled:opacity-50"
              >
                취소
              </button>

              <button
                type="button"
                disabled={
                  isCompleting
                }
                onClick={async () => {
                  try {
                    await onComplete();

                    setCompleteConfirmOpen(
                      false
                    );
                  } catch {
                    /**
                     * Mutation Error는
                     * 가이드 본문에서 표시한다.
                     */
                  }
                }}
                className="h-12 rounded-xl text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  backgroundColor:
                    primaryColor,
                }}
              >
                {isCompleting
                  ? "처리 중..."
                  : "완료하기"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function PortalSocialWorkerQualificationGuide({
  primaryColor,
  procedure,
  myWork,
  qualificationApplicationInfo,
  isCompleting,
  errorMessage,
  onComplete,
}: {
  primaryColor:
    string;

  procedure:
    any;

  myWork:
    any;

  qualificationApplicationInfo:
    any;

  isCompleting:
    boolean;

  errorMessage:
    string | null;

  onComplete:
    () => Promise<void>;
}) {
  const [
    zoomImage,
    setZoomImage,
  ] =
    useState<string | null>(
      null
    );

  const [
    completeConfirmOpen,
    setCompleteConfirmOpen,
  ] =
    useState(false);

  const completed =
    procedure?.status ===
    "completed";

  const completedAt =
    procedure?.completedAt ||
    procedure?.statusChangedAt ||
    null;

  /**
   * 서버가 확정한 실제 자격과정 가이드.
   *
   * 현재 업무포털 1차 지원은
   * 사회복지사 2급만 허용한다.
   */
  const isSocialWorker2 =
    qualificationApplicationInfo
      ?.guideType ===
    "social_worker_2";

  /**
   * 고졸 등 학점은행제로 새 학위과정을
   * 함께 진행하는 회원인지 여부.
   *
   * 프론트에서 최종학력 문자열을 다시 판단하지 않고
   * 서버가 계산한 degreeApplication.required를 사용한다.
   */
  const requiresNewDegree =
    myWork
      ?.degreeApplication
      ?.required ===
    true;

  const finalEducation =
    String(
      myWork
        ?.student
        ?.finalEducation ||
      ""
    ).trim();

  const feeAmount =
    Number(
      qualificationApplicationInfo
        ?.fee
        ?.amount ||
      10000
    );

  const feeLabel =
    String(
      qualificationApplicationInfo
        ?.fee
        ?.label ||
      "자격증 발급 수수료 10,000원"
    ).trim();

  /**
   * 잘못된 과정에서 직접 URL 상태를 조작해
   * 화면에 들어온 경우에도
   * 사회복지사 2급 가이드를 보여주지 않는다.
   *
   * 이미 CRM에서 완료된 기록은
   * 기존 상태 확인을 위해 허용한다.
   */
  if (
    !isSocialWorker2 &&
    !completed
  ) {
    return (
      <main className="px-4 pb-28 pt-4">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-2xl text-slate-500">
            i
          </div>

          <div className="mt-4 text-xl font-extrabold text-slate-900">
            현재 과정의 자격증 신청 가이드는
            준비 중입니다.
          </div>

          <div className="mt-2 text-sm leading-6 text-slate-500">
            현재 업무포털에서는
            사회복지사 2급 자격증 신청 가이드를
            먼저 지원하고 있습니다.
          </div>
        </section>
      </main>
    );
  }

  return (
    <>
      <main className="px-4 pb-28 pt-4">
        {/* 상단 설명 */}
        <section className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5">
          <div className="text-xs font-bold text-blue-600">
            사회복지사 2급 취득의 마지막 신청절차
          </div>

          <div className="mt-2 text-[25px] font-extrabold tracking-tight text-slate-950">
            자격증 신청이란?
          </div>

          <div className="mt-3 text-sm leading-6 text-slate-600">
            사회복지사 2급 취득에 필요한
            교과목과 현장실습을 이수하고
            필요한 학점인정 및 학위절차를 완료한 뒤
            한국사회복지사협회 자격관리센터에서
            사회복지사 2급 자격증 발급을 신청하는 절차입니다.
          </div>

          <div className="mt-4 rounded-2xl bg-white/80 p-4">
            <div className="text-xs font-bold text-slate-500">
              현재 신청 과정
            </div>

            <div
              className="mt-1 text-lg font-extrabold"
              style={{
                color:
                  primaryColor,
              }}
            >
              사회복지사 2급
            </div>

            {qualificationApplicationInfo
              ?.expectedLabel ? (
              <div className="mt-2 text-xs leading-5 text-slate-500">
                예상 자격증 신청시점 ·{" "}
                {
                  qualificationApplicationInfo
                    .expectedLabel
                }
              </div>
            ) : null}
          </div>
        </section>

        {/* 중요 안내 */}
        <section className="mt-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-4">
          <div className="flex gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 font-extrabold text-amber-600">
              !
            </div>

            <div>
              <div className="text-sm font-extrabold text-amber-800">
                온라인 신청만으로 끝나지 않습니다.
              </div>

              <div className="mt-1 text-xs leading-5 text-amber-700">
                온라인 신청서 제출 후
                신청서를 출력하고 본인에게 필요한
                증빙서류를 선택한 지방협회에 제출해야 합니다.
              </div>
            </div>
          </div>
        </section>

        {/* PC 권장 */}
        <section className="mt-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-4">
          <div className="flex gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 font-bold text-red-500">
              PC
            </div>

            <div>
              <div className="text-sm font-extrabold text-red-700">
                PC에서 진행을 권장합니다.
              </div>

              <div className="mt-1 text-xs leading-5 text-red-500">
                아래 사진 안내는
                한국사회복지사협회 자격관리센터
                PC 화면을 기준으로 제작되었습니다.
              </div>
            </div>
          </div>
        </section>

        {/* 자격관리센터 바로가기 */}
        <a
          href="https://www.welfare.net/lic/"
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex h-14 w-full items-center justify-center rounded-2xl text-sm font-extrabold text-white shadow-sm"
          style={{
            backgroundColor:
              primaryColor,
          }}
        >
          한국사회복지사협회 자격관리센터 바로가기 ↗
        </a>

        {/* 수수료 안내 */}
        <section className="mt-3 rounded-2xl border border-violet-100 bg-violet-50 px-4 py-4">
          <div className="flex gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-extrabold text-violet-600">
              ₩
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-sm font-extrabold text-violet-800">
                자격증 발급 수수료
              </div>

              <div className="mt-1 text-xl font-extrabold text-violet-700">
                {feeAmount.toLocaleString(
                  "ko-KR"
                )}
                원
              </div>

              <div className="mt-1 text-xs leading-5 text-violet-600">
                {feeLabel}
              </div>
            </div>
          </div>
        </section>

        {/* 12단계 */}
        <section className="mt-7">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-lg font-extrabold text-slate-950">
                사회복지사 2급 자격증 신청 따라하기
              </div>

              <div className="mt-1 text-xs text-slate-500">
                아래 순서대로 진행해주세요.
              </div>
            </div>

            <div
              className="rounded-full px-3 py-1.5 text-xs font-extrabold"
              style={{
                backgroundColor:
                  `${primaryColor}12`,

                color:
                  primaryColor,
              }}
            >
              총 12단계
            </div>
          </div>

          <div className="mt-4 space-y-4">
            {SOCIAL_WORKER_2_QUALIFICATION_STEPS.map(
              item => (
                <article
                  key={
                    item.step
                  }
                  className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-100"
                >
                  <div className="p-5">
                    <div className="flex items-start gap-3">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-white"
                        style={{
                          backgroundColor:
                            primaryColor,
                        }}
                      >
                        {
                          item.step
                        }
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="text-base font-extrabold text-slate-900">
                          {
                            item.title
                          }
                        </div>

                        <div className="mt-2 text-sm leading-6 text-slate-500">
                          {
                            item.description
                          }
                        </div>
                      </div>
                    </div>

                    {/* STEP 4 지방협회 안내 */}
                    {item.step ===
                    4 ? (
                      <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-4">
                        <div className="text-xs font-extrabold text-amber-800">
                          서류 제출처 확인
                        </div>

                        <div className="mt-1 text-xs leading-5 text-amber-700">
                          온라인 신청 후 출력한 신청서와
                          증빙서류는 이 단계에서 선택한
                          지방협회로 제출해주세요.
                        </div>
                      </div>
                    ) : null}

                    {/* STEP 5 사진 안내 */}
                    {item.step ===
                    5 ? (
                      <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                        <div className="text-xs font-extrabold text-blue-700">
                          사진 규격
                        </div>

                        <div className="mt-1 text-xs leading-5 text-blue-600">
                          사회복지사 자격증에 사용할
                          3.5 × 4.5cm 사진을 등록해주세요.
                        </div>
                      </div>
                    ) : null}

                    {/* STEP 7 학력별 안내 */}
                    {item.step ===
                    7 ? (
                      <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                        <div className="text-xs font-extrabold text-blue-700">
                          회원님 학력 기준 입력 안내
                        </div>

                        {requiresNewDegree ? (
                          <div className="mt-1 text-xs leading-5 text-blue-600">
                            현재 등록된 학습설계 기준
                            학점은행제 학위과정을 함께 진행한 회원입니다.
                            최종학력 입력 시
                            국가평생교육진흥원을 검색하여
                            취득한 학점은행제 학위정보를 기준으로
                            작성해주세요.
                          </div>
                        ) : (
                          <div className="mt-1 text-xs leading-5 text-blue-600">
                            현재 등록된 최종학력
                            {finalEducation
                              ? `(${finalEducation})`
                              : ""}을
                            기준으로 실제 졸업한
                            전문대학 또는 대학교 정보를 입력해주세요.
                          </div>
                        )}
                      </div>
                    ) : null}

                    {/* STEP 8 교과목 안내 */}
                    {item.step ===
                    8 ? (
                      <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                        <div className="text-xs font-extrabold text-emerald-700">
                          교과목 확인
                        </div>

                        <div className="mt-1 text-xs leading-5 text-emerald-600">
                          두 곳 이상의 교육원에서 과목을 이수했다면
                          교육기관을 각각 추가한 뒤
                          각 교육기관에서 이수한 과목을
                          빠짐없이 선택해주세요.
                        </div>

                        <div className="mt-2 text-xs font-bold leading-5 text-emerald-700">
                          회원님이 진행한 교과목은
                          업무포털 → 마이 업무에서 확인할 수 있습니다.
                        </div>
                      </div>
                    ) : null}

                    {/* STEP 9 실습 안내 */}
                    {item.step ===
                    9 ? (
                      <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-4">
                        <div className="text-xs font-extrabold text-amber-800">
                          현장실습 정보 확인
                        </div>

                        <div className="mt-1 text-xs leading-5 text-amber-700">
                          화면에서 본인에게 적용되는
                          실습 기준을 선택한 뒤
                          실제 실습기관·실습기간·실습지도자·세미나 교수·
                          실습시간을 기준으로 입력해주세요.
                        </div>
                      </div>
                    ) : null}

                    {/* STEP 12 제출서류 */}
                    {item.step ===
                    12 ? (
                      <div className="mt-5 space-y-3">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="text-xs font-extrabold text-slate-500">
                            상황 1
                          </div>

                          <div className="mt-1 text-sm font-extrabold text-slate-900">
                            전문대학 또는 대학교 졸업 후
                            사회복지 과목을 이수한 경우
                          </div>

                          <div className="mt-3 space-y-1.5 text-xs leading-5 text-slate-600">
                            <div>
                              ✓ 사회복지사 자격증 발급 신청서 1부
                            </div>

                            <div>
                              ✓ 대학 졸업증명서 1부
                            </div>

                            <div>
                              ✓ 국가평생교육진흥원 성적증명서 1부
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="text-xs font-extrabold text-slate-500">
                            상황 2
                          </div>

                          <div className="mt-1 text-sm font-extrabold text-slate-900">
                            졸업한 대학에서 일부 과목을 이수하고
                            나머지 과목을 추가로 이수한 경우
                          </div>

                          <div className="mt-3 space-y-1.5 text-xs leading-5 text-slate-600">
                            <div>
                              ✓ 사회복지사 자격증 발급 신청서 1부
                            </div>

                            <div>
                              ✓ 대학 졸업증명서 1부
                            </div>

                            <div>
                              ✓ 대학 성적증명서 1부
                            </div>

                            <div>
                              ✓ 국가평생교육진흥원 성적증명서 1부
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="text-xs font-extrabold text-slate-500">
                            상황 3
                          </div>

                          <div className="mt-1 text-sm font-extrabold text-slate-900">
                            고등학교 졸업 또는 대학 중퇴 후
                            학점은행제로 학위를 취득한 경우
                          </div>

                          <div className="mt-3 space-y-1.5 text-xs leading-5 text-slate-600">
                            <div>
                              ✓ 사회복지사 자격증 발급 신청서 1부
                            </div>

                            <div>
                              ✓ 국가평생교육진흥원 학위증명서 1부
                            </div>

                            <div>
                              ✓ 국가평생교육진흥원 성적증명서 1부
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4">
                          <div className="text-xs font-extrabold text-violet-700">
                            자격증 발급 수수료
                          </div>

                          <div className="mt-1 text-xl font-extrabold text-violet-800">
                            {feeAmount.toLocaleString(
                              "ko-KR"
                            )}
                            원
                          </div>

                          <div className="mt-1 text-xs leading-5 text-violet-600">
                            온라인 신청 후 안내되는 절차에 따라
                            자격증 발급 수수료를 납부해주세요.
                          </div>
                        </div>

                        <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
                          <div className="text-xs font-extrabold text-red-700">
                            마지막 확인
                          </div>

                          <div className="mt-1 text-xs leading-5 text-red-600">
                            신청서 출력만 하고 끝내지 말고
                            본인에게 필요한 증빙서류를 준비하여
                            선택한 지방협회에 제출했는지까지 확인해주세요.
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setZoomImage(
                        item.image
                      )
                    }
                    className="block w-full border-t border-slate-100 bg-slate-50 p-3"
                  >
                    <img
                      src={
                        item.image
                      }
                      alt={`STEP ${item.step} ${item.title}`}
                      loading="lazy"
                      className="h-auto w-full rounded-2xl object-contain"
                    />

                    <div className="mt-2 text-center text-xs font-medium text-slate-400">
                      이미지를 누르면 크게 볼 수 있습니다.
                    </div>
                  </button>
                </article>
              )
            )}
          </div>
        </section>

        {/* 신청 완료 */}
        {completed ? (
          <section className="mt-5 rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-lg font-extrabold text-white">
                ✓
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-base font-extrabold text-emerald-900">
                  자격증 신청 완료
                </div>

                <div className="mt-1 text-sm leading-6 text-emerald-700">
                  사회복지사 2급 자격증 신청 완료상태가
                  업무포털과 학습관리 시스템에
                  반영되어 있습니다.
                </div>

                {completedAt ? (
                  <div className="mt-2 text-xs font-bold text-emerald-600">
                    완료일시{" "}
                    {formatPortalDateTime(
                      completedAt
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        ) : (
          <section className="mt-5 rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-lg font-extrabold text-white">
                ✓
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-base font-extrabold text-emerald-900">
                  사회복지사 2급 자격증 신청을 완료하셨나요?
                </div>

                <div className="mt-1 text-sm leading-6 text-emerald-700">
                  온라인 신청서 제출과
                  필요한 증빙서류 제출까지 확인했다면
                  아래 버튼을 눌러주세요.
                </div>
              </div>
            </div>

            {errorMessage ? (
              <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                {errorMessage}
              </div>
            ) : null}

            <button
              type="button"
              disabled={
                isCompleting
              }
              onClick={() =>
                setCompleteConfirmOpen(
                  true
                )
              }
              className="mt-5 h-14 w-full rounded-2xl text-base font-extrabold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                backgroundColor:
                  primaryColor,
              }}
            >
              자격증 신청 완료
            </button>
          </section>
        )}
      </main>

      {/* 이미지 확대 */}
      {zoomImage ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-3"
          onClick={() =>
            setZoomImage(
              null
            )
          }
        >
          <button
            type="button"
            onClick={() =>
              setZoomImage(
                null
              )
            }
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-2xl text-white"
            aria-label="이미지 닫기"
          >
            ×
          </button>

          <img
            src={
              zoomImage
            }
            alt=""
            className="max-h-[90vh] max-w-full object-contain"
            onClick={
              event =>
                event.stopPropagation()
            }
          />
        </div>
      ) : null}

      {/* 완료 확인 모달 */}
      {completeConfirmOpen ? (
        <div
          className="fixed inset-0 z-[110] flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={() => {
            if (
              isCompleting
            ) {
              return;
            }

            setCompleteConfirmOpen(
              false
            );
          }}
        >
          <div
            className="w-full max-w-[440px] rounded-3xl bg-white p-5 shadow-2xl"
            onClick={
              event =>
                event.stopPropagation()
            }
          >
            <div className="text-lg font-extrabold text-slate-950">
              자격증 신청을 완료하셨나요?
            </div>

            <div className="mt-2 text-sm leading-6 text-slate-500">
              한국사회복지사협회 자격관리센터에서
              온라인 신청을 완료하고
              필요한 신청서 및 증빙서류 제출까지
              확인했다면 완료하기를 눌러주세요.
            </div>

            <div className="mt-4 rounded-2xl bg-blue-50 p-4 text-xs leading-5 text-blue-700">
              완료하면 회원님의 CRM 학습관리 정보에도
              자격증 신청 완료 상태가 자동으로 반영됩니다.
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={
                  isCompleting
                }
                onClick={() =>
                  setCompleteConfirmOpen(
                    false
                  )
                }
                className="h-12 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-600 disabled:opacity-50"
              >
                취소
              </button>

              <button
                type="button"
                disabled={
                  isCompleting
                }
                onClick={async () => {
                  try {
                    await onComplete();

                    setCompleteConfirmOpen(
                      false
                    );
                  } catch {
                    /**
                     * Mutation Error는
                     * 가이드 본문에서 표시한다.
                     */
                  }
                }}
                className="h-12 rounded-xl text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  backgroundColor:
                    primaryColor,
                }}
              >
                {isCompleting
                  ? "처리 중..."
                  : "완료하기"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function PortalPracticeView({
  practice,
  prerequisite,
  section,
  primaryColor,
  isLoading,
  isError,
  onSectionChange,
}: {
  practice:
    any;

    prerequisite: {
    requiredCompleted:
      number;

    electiveCompleted:
      number;

    requiredTarget:
      number;

    electiveTarget:
      number;

    eligible:
      boolean;

    requiredSubjects:
      Array<{
        subjectName:
          string;

        requirementType:
          "전공필수";

        statusKey:
          "completed" |
          "in_progress";

        statusLabel:
          "이수완료" |
          "진행중";

        semesterNo:
          number;
      }>;

    electiveSubjects:
      Array<{
        subjectName:
          string;

        requirementType:
          "전공선택";

        statusKey:
          "completed" |
          "in_progress";

        statusLabel:
          "이수완료" |
          "진행중";

        semesterNo:
          number;
      }>;
  };

  section:
    PracticeSection;

  primaryColor:
    string;

  isLoading:
    boolean;

  isError:
    boolean;

  onSectionChange:
    (
      section:
        PracticeSection
    ) => void;
}) {
  const progressSteps = [
    {
      key:
        "not_requested",
      label:
        "신청 전",
    },
    {
      key:
        "received",
      label:
        "접수",
    },
    {
      key:
        "arranging",
      label:
        "배정 중",
    },
    {
      key:
        "completed",
      label:
        "배정 완료",
    },
  ] as const;

  const progressOrder: Record<
    string,
    number
  > = {
    not_requested:
      0,
    received:
      1,
    arranging:
      2,
    completed:
      3,
  };

  const currentProgressIndex =
    progressOrder[
      String(
        practice
          ?.progress
          ?.status ||
        "not_requested"
      )
    ] ??
    0;

  const practiceMonth =
    String(
      practice
        ?.practiceSemesterLabel ||
      ""
    ).trim() ||
    "미정";

  const practiceHours =
    Number(
      practice
        ?.practiceHours ||
      0
    );

  const assigneeName =
    String(
      practice
        ?.assigneeName ||
      ""
    ).trim() ||
    "담당자 확인 중";

  const studentName =
    String(
      practice
        ?.student
        ?.clientName ||
      ""
    ).trim() ||
    "회원";

    if (
    isError
  ) {
    return (
      <main className="px-5 pb-28 pt-6">
        <div className="border-y border-red-100 bg-red-50 px-5 py-8 text-center">
          <div className="text-[17px] font-extrabold text-red-700">
            실습 정보를 불러오지 못했습니다.
          </div>

          <div className="mt-2 text-[14px] font-medium leading-6 text-red-500">
            잠시 후 다시 확인해 주세요.
          </div>
        </div>
      </main>
    );
  }
 return (
    <main className="pb-28">
      {section ===
      "guide" ? (
        <div className="px-5 pt-5">
          <div className="grid grid-cols-2 border-b border-slate-200">
            <button
              type="button"
              onClick={() =>
                onSectionChange(
                  "status"
                )
              }
              className="relative py-4 text-[16px] font-bold text-slate-500"
            >
              MY 실습현황
            </button>

            <button
              type="button"
              onClick={() =>
                onSectionChange(
                  "guide"
                )
              }
              className="relative py-4 text-[16px] font-extrabold"
              style={{
                color:
                  primaryColor,
              }}
            >
              실습 안내가이드

              <span
                className="absolute inset-x-7 bottom-0 h-[2px]"
                style={{
                  backgroundColor:
                    primaryColor,
                }}
              />
            </button>
          </div>

          <PracticeGuideHub
            primaryColor={
              primaryColor
            }
          />
        </div>
      ) : (
        <>
          {/* 실습 상단 이미지 */}
          <section className="relative h-[190px] overflow-hidden">
            <img
              src={
                PORTAL_IMAGES.practice
              }
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />

            <div className="absolute inset-x-0 bottom-0 px-5 pb-5 text-white">
              <div className="text-[27px] font-extrabold tracking-[-0.03em]">
                실습
              </div>

              <div className="mt-1 max-w-[320px] text-[14px] font-medium leading-6 text-white/90">
                실습 진행현황과 배정 상태를 확인할 수 있습니다.
              </div>
            </div>
          </section>

          {/* 실습 내부 탭 */}
          <div className="px-5">
            <div className="grid grid-cols-2 border-b border-slate-200">
              <button
                type="button"
                onClick={() =>
                  onSectionChange(
                    "status"
                  )
                }
                className="relative py-4 text-[16px] font-extrabold"
                style={{
                  color:
                    primaryColor,
                }}
              >
                MY 실습현황

                <span
                  className="absolute inset-x-7 bottom-0 h-[2px]"
                  style={{
                    backgroundColor:
                      primaryColor,
                  }}
                />
              </button>

              <button
                type="button"
                onClick={() =>
                  onSectionChange(
                    "guide"
                  )
                }
                className="py-4 text-[16px] font-bold text-slate-500"
              >
                실습 안내가이드
              </button>
            </div>
          </div>

          <section className="px-5 pt-7">
            {/* 기본 정보 */}
            <div>
              <div className="mb-2 text-[19px] font-extrabold tracking-[-0.02em] text-slate-950">
                기본 정보
              </div>

              <div className="border-y border-slate-200">
                {/* 회원 */}
                <div className="flex min-h-[78px] items-center gap-4 border-b border-slate-100 py-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[17px] font-extrabold text-slate-500">
                    {studentName
                      .slice(
                        0,
                        1
                      )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-[17px] font-extrabold text-slate-950">
                      {studentName} 회원님
                    </div>

                    {practice
                      ?.student
                      ?.course ? (
                      <div className="mt-1 text-[14px] font-medium text-slate-500">
                        {
                          practice
                            .student
                            .course
                        }
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* 담당자 */}
                <div className="flex min-h-[72px] items-center justify-between gap-5 border-b border-slate-100 py-4">
                  <div>
                    <div className="text-[13px] font-semibold text-slate-400">
                      담당자
                    </div>

                    <div className="mt-1 text-[16px] font-extrabold text-slate-900">
                      {assigneeName}
                    </div>
                  </div>
                </div>

                {/* 예정월 */}
                <div className="flex min-h-[88px] items-center justify-between gap-5 py-4">
                  <div>
                    <div className="text-[14px] font-bold text-slate-500">
                      내 실습 예정월
                    </div>

                    <div
                      className="mt-1 text-[26px] font-extrabold tracking-[-0.03em]"
                      style={{
                        color:
                          primaryColor,
                      }}
                    >
                      {practiceMonth}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 배정 진행상태 */}
            <section className="border-b border-slate-200 py-7">
              <div className="flex items-center justify-between gap-4">
                <div className="text-[18px] font-extrabold text-slate-950">
                  배정 진행상태
                </div>

                <div
                  className="text-[15px] font-extrabold"
                  style={{
                    color:
                      primaryColor,
                  }}
                >
                  {practice
                    ?.progress
                    ?.label ||
                    "신청 전"}
                </div>
              </div>

              <div className="mt-6 flex items-start">
                {progressSteps.map(
                  (
                    step,
                    index
                  ) => {
                    const reached =
                      index <=
                      currentProgressIndex;

                    const current =
                      index ===
                      currentProgressIndex;

                    return (
                      <div
                        key={
                          step.key
                        }
                        className="relative flex flex-1 flex-col items-center"
                      >
                        {index >
                        0 ? (
                          <div
                            className="absolute right-1/2 top-[9px] h-[2px] w-full"
                            style={{
                              backgroundColor:
                                index <=
                                currentProgressIndex
                                  ? primaryColor
                                  : "#e5e7eb",
                            }}
                          />
                        ) : null}

                        <div
                          className="relative z-10 flex h-[20px] w-[20px] items-center justify-center rounded-full border-2"
                          style={{
                            borderColor:
                              reached
                                ? primaryColor
                                : "#d1d5db",

                            backgroundColor:
                              reached
                                ? primaryColor
                                : "#ffffff",
                          }}
                        >
                          {reached ? (
                            <span className="text-[10px] font-black leading-none text-white">
                              ✓
                            </span>
                          ) : null}
                        </div>

                        <div
                          className={`mt-3 text-center text-[13px] font-bold ${
                            current
                              ? "text-slate-950"
                              : reached
                                ? "text-slate-700"
                                : "text-slate-400"
                          }`}
                        >
                          {
                            step.label
                          }
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </section>

            {/* 배정 정보 */}
            <section className="border-b border-slate-200 py-2">
              <PracticeInfoRow
                label="실습교육원"
                value={
                  practice
                    ?.educationCenter
                    ?.name ||
                  "배정 전"
                }
              />

              <PracticeInfoRow
                label="실습기관"
                value={
                  practice
                    ?.practiceInstitution
                    ?.name ||
                  "배정 전"
                }
              />

              <PracticeInfoRow
                label="필요 실습시간"
                value={
                  practiceHours >
                  0
                    ? `${practiceHours}시간`
                    : "확인 중"
                }
              />
            </section>

                  <section className="mt-8 border-t border-slate-200 pt-7">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-[19px] font-extrabold text-slate-950">
                  선이수 조건
                </div>

                <div className="mt-1 text-[13px] font-medium leading-5 text-slate-400">
                  현재 수강 중이거나 이수한 과목만 표시됩니다.
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-6">
              <PracticePrerequisiteRow
                label="전공필수"
                current={
                  prerequisite.requiredCompleted
                }
                target={
                  prerequisite.requiredTarget
                }
                primaryColor={
                  primaryColor
                }
              />

              <PracticePrerequisiteSubjectList
                subjects={
                  prerequisite.requiredSubjects
                }
              />

              <div className="border-t border-slate-100 pt-6">
                <PracticePrerequisiteRow
                  label="전공선택"
                  current={
                    prerequisite.electiveCompleted
                  }
                  target={
                    prerequisite.electiveTarget
                  }
                  primaryColor={
                    primaryColor
                  }
                />
              </div>

              <PracticePrerequisiteSubjectList
                subjects={
                  prerequisite.electiveSubjects
                }
              />
            </div>

            <div className="mt-7 border-t border-slate-200 pt-6">
              <div className="text-[13px] font-bold text-slate-400">
                현재 상태
              </div>

              <div
                className={
                  prerequisite.eligible
                    ? "mt-2 text-[18px] font-extrabold text-emerald-700"
                    : "mt-2 text-[18px] font-extrabold text-amber-700"
                }
              >
                {prerequisite.eligible
                  ? "실습 진행이 가능합니다."
                  : "선이수 조건 충족 전입니다."}
              </div>

              {!prerequisite.eligible ? (
                <div className="mt-2 text-[14px] font-medium leading-6 text-slate-500">
                  {Math.max(
                    prerequisite.requiredTarget -
                      prerequisite.requiredCompleted,
                    0
                  ) >
                  0
                    ? `전공필수 ${Math.max(
                        prerequisite.requiredTarget -
                          prerequisite.requiredCompleted,
                        0
                      )}과목`
                    : ""}

                  {Math.max(
                    prerequisite.requiredTarget -
                      prerequisite.requiredCompleted,
                    0
                  ) >
                    0 &&
                  Math.max(
                    prerequisite.electiveTarget -
                      prerequisite.electiveCompleted,
                    0
                  ) >
                    0
                    ? ", "
                    : ""}

                  {Math.max(
                    prerequisite.electiveTarget -
                      prerequisite.electiveCompleted,
                    0
                  ) >
                  0
                    ? `전공선택 ${Math.max(
                        prerequisite.electiveTarget -
                          prerequisite.electiveCompleted,
                        0
                      )}과목`
                    : ""}

                  의 이수완료가 추가로 필요합니다.
                </div>
              ) : (
                <div className="mt-2 text-[14px] font-medium leading-6 text-slate-500">
                  전공필수 4과목과 전공선택 2과목의 이수완료가 확인되었습니다.
                </div>
              )}
            </div>
          </section>

                    <div className="mt-8 rounded-xl bg-slate-50 px-5 py-5 text-[15px] font-medium leading-7 text-slate-600">
            실습 일정 변경을 원하시거나 실습 관련 문의사항이 있으신 경우, 담당자에게 카카오톡으로 문의해 주세요.
          </div>
        </section>
        </>
      )}
    </main>
  );
}


type PracticeGuideCategoryKey =
  | "process"
  | "support"
  | "documents";

type PracticeGuideStep = {
  step:
    string;
  title:
    string;
  description:
    string;
  image:
    string;
  exampleImage?:
    string;
  exampleTitle?:
    string;
};

const PRACTICE_GUIDE_CATEGORIES: Array<{
  key:
    PracticeGuideCategoryKey;
  number:
    string;
  title:
    string;
  description:
    string;
  stepRange:
    string;
  accent:
    "blue" |
    "green" |
    "orange";
  steps:
    PracticeGuideStep[];
}> = [
  {
    key:
      "process",
    number:
      "01",
    title:
      "실습 진행방법",
    description:
      "실습교육원·실습기관·일정 조율 방법을 단계별로 확인합니다.",
    stepRange:
      "STEP 01 ~ 03",
    accent:
      "blue",
    steps: [
      {
        step:
          "01",
        title:
          "세 가지 일정이 모두 맞아야 합니다",
        description:
          "회원님 일정, 실습교육원 일정, 실습기관 일정이 모두 일치해야 실습이 가능합니다.",
        image:
          "/images/practice/step-01.png",
      },
      {
        step:
          "02",
        title:
          "실습교육원과 실습기관은 다릅니다",
        description:
          "실습교육원은 실습과목을 수강하는 곳, 실습기관은 실제 현장실습을 진행하는 곳입니다.",
        image:
          "/images/practice/step-02.png",
      },
      {
        step:
          "03",
        title:
          "실습 인정기간 안에 필요 시간을 이수해야 합니다",
        description:
          "실습교육원의 학사일정에 정해진 실습 인정기간 안에 회원님의 필요 실습시간을 이수해야 합니다.",
        image:
          "/images/practice/step-03.png",
      },
    ],
  },
  {
    key:
      "support",
    number:
      "02",
    title:
      "실습배정지원센터",
    description:
      "배정 신청부터 교육원·기관 확인과 배정 지원까지 안내합니다.",
    stepRange:
      "STEP 04 ~ 06",
    accent:
      "green",
    steps: [
      {
        step:
          "04",
        title:
          "실습 희망 정보를 제출해 주세요",
        description:
          "회원님의 일정과 조건을 확인하기 위해 배정에 필요한 정보를 제출합니다.",
        image:
          "/images/practice/step-04.png",
      },
      {
        step:
          "05",
        title:
          "지원센터가 교육원과 기관을 확인합니다",
        description:
          "제출한 정보를 바탕으로 실습교육원 일정 확인, 실습기관 섭외 및 배정을 진행합니다.",
        image:
          "/images/practice/step-05.png",
        exampleImage:
          "/images/practice/step-05-01.png",
        exampleTitle:
          "실제 배정 사례",
      },
      {
        step:
          "06",
        title:
          "가능한 곳 중 가까운 곳을 우선으로 배정해 드립니다",
        description:
          "기관별 실습 가능 인원과 일정을 확인한 뒤 가능한 기관 중 거주지와 가까운 곳부터 우선 확인합니다.",
        image:
          "/images/practice/step-06.png",
      },
    ],
  },
  {
    key:
      "documents",
    number:
      "03",
    title:
      "실습서류 안내",
    description:
      "1차·2차 서류와 실습 중 작성하는 서류를 안내합니다.",
    stepRange:
      "STEP 07 ~ 09",
    accent:
      "orange",
    steps: [
      {
        step:
          "07",
        title:
          "1차 서류 선이수조건을 확인합니다",
        description:
          "실습과목 신청 전 성적증명서를 발급하여 선이수조건 충족 여부를 확인합니다.",
        image:
          "/images/practice/step-07.png",
      },
      {
        step:
          "08",
        title:
          "2차 서류 실습기관을 확정하고 신청합니다",
        description:
          "실습기관과 면접 및 일정 조율 후 기관 관련 서류를 준비하여 실습교육원에 신청합니다.",
        image:
          "/images/practice/step-08.png",
      },
      {
        step:
          "09",
        title:
          "실습 중 작성하는 서류",
        description:
          "실습일지, 출석 관련 기록, 평가 서류 등을 실습교육원의 안내에 따라 작성합니다.",
        image:
          "/images/practice/step-09.png",
      },
    ],
  },
];

function PracticeGuideHub({
  primaryColor,
}: {
  primaryColor:
    string;
}) {
  const [
    selectedCategory,
    setSelectedCategory,
  ] =
    useState<PracticeGuideCategoryKey | null>(
      null
    );

  const [
    selectedStep,
    setSelectedStep,
  ] =
    useState<PracticeGuideStep | null>(
      null
    );

  const category =
    selectedCategory
      ? PRACTICE_GUIDE_CATEGORIES.find(
          item =>
            item.key ===
            selectedCategory
        ) ??
        null
      : null;

  if (
    selectedStep
  ) {
    return (
      <section className="pb-8 pt-6">
        <button
          type="button"
          onClick={() =>
            setSelectedStep(
              null
            )
          }
          className="flex items-center gap-2 py-2 text-[14px] font-bold text-slate-500"
        >
          <span className="text-xl leading-none">
            ‹
          </span>
          가이드 목록
        </button>

        <div className="mt-4">
          <div
            className="text-[13px] font-extrabold"
            style={{
              color:
                primaryColor,
            }}
          >
            STEP {selectedStep.step}
          </div>

          <h2 className="mt-2 text-[25px] font-extrabold leading-[1.35] tracking-[-0.03em] text-slate-950">
            {
              selectedStep.title
            }
          </h2>

          <p className="mt-3 text-[15px] font-medium leading-7 text-slate-500">
            {
              selectedStep.description
            }
          </p>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <img
            src={
              selectedStep.image
            }
            alt={`STEP ${selectedStep.step} ${selectedStep.title}`}
            className="block h-auto w-full"
          />
        </div>

        {selectedStep.exampleImage ? (
          <div className="mt-7 border-t border-slate-200 pt-7">
            <div className="mb-3 text-[17px] font-extrabold text-slate-950">
              {
                selectedStep.exampleTitle ||
                "추가 안내"
              }
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <img
                src={
                  selectedStep.exampleImage
                }
                alt={
                  selectedStep.exampleTitle ||
                  "추가 안내"
                }
                className="block h-auto w-full"
              />
            </div>
          </div>
        ) : null}

        {selectedStep.step ===
        "03" ? (
          <div className="mt-6 border-y border-blue-100 bg-blue-50 px-4 py-4 text-[14px] font-medium leading-6 text-blue-700">
            회원님마다 필요한 실습시간은 다를 수 있으므로 MY 실습현황의 필요 실습시간을 확인해 주세요.
          </div>
        ) : null}

        {selectedStep.step ===
        "06" ? (
          <div className="mt-6 border-y border-emerald-100 bg-emerald-50 px-4 py-4 text-[14px] font-medium leading-6 text-emerald-700">
            특정 기관을 지정하는 방식이 아니라 실제 진행 가능한 기관의 일정과 TO를 확인한 뒤, 가능한 범위에서 가까운 곳을 우선으로 배정 지원합니다.
          </div>
        ) : null}

        {selectedStep.step ===
        "09" ? (
          <div className="mt-6 border-y border-amber-100 bg-amber-50 px-4 py-4 text-[14px] font-medium leading-6 text-amber-700">
            서류의 양식, 작성방법, 제출방법은 배정된 실습교육원의 안내를 우선하여 진행해 주세요.
          </div>
        ) : null}
      </section>
    );
  }

  if (
    category
  ) {
    const accentClasses =
      category.accent ===
      "green"
        ? {
            badge:
              "bg-emerald-50 text-emerald-700",
            dot:
              "border-emerald-500 bg-emerald-500",
            line:
              "bg-emerald-100",
            notice:
              "border-emerald-100 bg-emerald-50 text-emerald-700",
          }
        : category.accent ===
            "orange"
          ? {
              badge:
                "bg-orange-50 text-orange-700",
              dot:
                "border-orange-500 bg-orange-500",
              line:
                "bg-orange-100",
              notice:
                "border-orange-100 bg-orange-50 text-orange-700",
            }
          : {
              badge:
                "bg-blue-50 text-blue-700",
              dot:
                "border-blue-500 bg-blue-500",
              line:
                "bg-blue-100",
              notice:
                "border-blue-100 bg-blue-50 text-blue-700",
            };

    return (
      <section className="pb-8 pt-6">
        <button
          type="button"
          onClick={() =>
            setSelectedCategory(
              null
            )
          }
          className="flex items-center gap-2 py-2 text-[14px] font-bold text-slate-500"
        >
          <span className="text-xl leading-none">
            ‹
          </span>
          실습 안내가이드
        </button>

        <div className="mt-4 border-b border-slate-200 pb-6">
          <div className="flex items-start gap-4">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-[18px] font-extrabold ${accentClasses.badge}`}
            >
              {
                category.number
              }
            </div>

            <div className="min-w-0">
              <h2 className="text-[23px] font-extrabold tracking-[-0.03em] text-slate-950">
                {
                  category.title
                }
              </h2>

              <p className="mt-2 text-[14px] font-medium leading-6 text-slate-500">
                {
                  category.description
                }
              </p>
            </div>
          </div>
        </div>

        <div className="relative mt-2">
          <div
            className={`absolute bottom-10 left-[11px] top-10 w-[2px] ${accentClasses.line}`}
          />

          {category.steps.map(
            (
              step,
              index
            ) => (
              <button
                key={
                  step.step
                }
                type="button"
                onClick={() =>
                  setSelectedStep(
                    step
                  )
                }
                className="relative flex w-full gap-4 border-b border-slate-100 py-6 text-left active:bg-slate-50"
              >
                <div
                  className={`relative z-10 mt-1 h-6 w-6 shrink-0 rounded-full border-[5px] border-white ${accentClasses.dot}`}
                />

                <div className="min-w-0 flex-1">
                  <div
                    className={`text-[12px] font-extrabold ${
                      category.accent ===
                      "green"
                        ? "text-emerald-600"
                        : category.accent ===
                            "orange"
                          ? "text-orange-600"
                          : "text-blue-600"
                    }`}
                  >
                    STEP {
                      step.step
                    }
                  </div>

                  <div className="mt-1 text-[17px] font-extrabold leading-6 text-slate-950">
                    {
                      step.title
                    }
                  </div>

                  <div className="mt-2 text-[13px] font-medium leading-5 text-slate-500">
                    {
                      step.description
                    }
                  </div>

                  {category.key ===
                    "support" &&
                  index ===
                    1 ? (
                    <div className="mt-4 flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3">
                      <div>
                        <div className="text-[12px] font-extrabold text-emerald-700">
                          STEP 05-01
                        </div>
                        <div className="mt-0.5 text-[14px] font-bold text-slate-800">
                          실제 배정 사례 포함
                        </div>
                      </div>

                      <span className="text-xl text-emerald-500">
                        ›
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center text-2xl font-light text-slate-300">
                  ›
                </div>
              </button>
            )
          )}
        </div>

        <div
          className={`mt-6 border-y px-4 py-4 text-[14px] font-medium leading-6 ${accentClasses.notice}`}
        >
          {category.key ===
          "process"
            ? "세 가지 일정이 모두 맞아야 실습 진행이 가능하므로, 실습 준비 전 회원님의 가능한 일정을 먼저 확인해 주세요."
            : category.key ===
                "support"
              ? "기관별 실습 가능 인원과 일정에 따라 배정 결과는 달라질 수 있습니다."
              : "서류의 양식과 작성방법은 실습교육원마다 다를 수 있으므로 배정된 교육원의 안내를 우선해 주세요."}
        </div>
      </section>
    );
  }

  return (
    <section className="pb-8 pt-7">
      <div>
        <div className="text-[22px] font-extrabold tracking-[-0.03em] text-slate-950">
          실습 안내가이드
        </div>

        <div className="mt-2 text-[14px] font-medium leading-6 text-slate-500">
          실습 준비와 진행에 필요한 내용을 항목별로 확인해 주세요.
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {PRACTICE_GUIDE_CATEGORIES.map(
          categoryItem => {
            const categoryStyle =
              categoryItem.accent ===
              "green"
                ? {
                    container:
                      "border-emerald-100 bg-emerald-50/70",
                    number:
                      "bg-white text-emerald-700",
                    range:
                      "bg-white text-emerald-700",
                  }
                : categoryItem.accent ===
                    "orange"
                  ? {
                      container:
                        "border-orange-100 bg-orange-50/70",
                      number:
                        "bg-white text-orange-700",
                      range:
                        "bg-white text-orange-700",
                    }
                  : {
                      container:
                        "border-blue-100 bg-blue-50/70",
                      number:
                        "bg-white text-blue-700",
                      range:
                        "bg-white text-blue-700",
                    };

            return (
              <button
                key={
                  categoryItem.key
                }
                type="button"
                onClick={() => {
                  setSelectedCategory(
                    categoryItem.key
                  );

                  setSelectedStep(
                    null
                  );
                }}
                className={`flex min-h-[142px] w-full items-center gap-4 rounded-2xl border px-4 py-5 text-left active:scale-[0.99] ${categoryStyle.container}`}
              >
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[19px] font-extrabold shadow-sm ${categoryStyle.number}`}
                >
                  {
                    categoryItem.number
                  }
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-[18px] font-extrabold text-slate-950">
                    {
                      categoryItem.title
                    }
                  </div>

                  <div className="mt-2 text-[13px] font-medium leading-5 text-slate-500">
                    {
                      categoryItem.description
                    }
                  </div>

                  <div
                    className={`mt-3 inline-flex rounded-full px-3 py-1 text-[11px] font-extrabold ${categoryStyle.range}`}
                  >
                    {
                      categoryItem.stepRange
                    }
                  </div>
                </div>

                <div className="shrink-0 text-3xl font-light text-slate-300">
                  ›
                </div>
              </button>
            );
          }
        )}
      </div>

      <div className="mt-5 border-y border-blue-100 bg-blue-50 px-4 py-4 text-[13px] font-medium leading-6 text-blue-700">
        실습은 기관과 일정에 따라 진행 방식이 다를 수 있습니다. 각 가이드를 확인하여 차근차근 준비해 주세요.
      </div>
    </section>
  );
}

function PracticeInfoRow({
  label,
  value,
}: {
  label:
    string;

  value:
    string;
}) {
  return (
    <div className="flex min-h-[72px] items-center justify-between gap-5 border-b border-slate-100 py-4 last:border-b-0">
      <div className="shrink-0 text-[15px] font-bold text-slate-600">
        {label}
      </div>

      <div className="min-w-0 text-right text-[16px] font-extrabold leading-6 text-slate-950">
        {value}
      </div>
    </div>
  );
}

function PracticePrerequisiteRow({
  label,
  current,
  target,
  primaryColor,
}: {
  label:
    string;

  current:
    number;

  target:
    number;

  primaryColor:
    string;
}) {
  const safeCurrent =
    Math.min(
      Math.max(
        current,
        0
      ),
      target
    );

  const percent =
    target >
    0
      ? Math.min(
          100,
          Math.max(
            0,
            Math.round(
              (
                safeCurrent /
                target
              ) *
                100
            )
          )
        )
      : 0;

  return (
    <div>
      <div className="flex items-center justify-between gap-5">
        <div className="text-[16px] font-extrabold text-slate-800">
          {label}
        </div>

        <div className="text-[16px] font-extrabold text-slate-900">
          {safeCurrent} / {target}
        </div>
      </div>

      <div className="mt-3 h-[7px] overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width:
              `${percent}%`,

            backgroundColor:
              primaryColor,
          }}
        />
      </div>
    </div>
  );
}

function PracticePrerequisiteSubjectList({
  subjects,
}: {
  subjects:
    Array<{
      subjectName:
        string;

      statusKey:
        "completed" |
        "in_progress";

      statusLabel:
        "이수완료" |
        "진행중";

      semesterNo:
        number;
    }>;
}) {
  if (
    subjects.length ===
    0
  ) {
    return (
      <div className="border-y border-slate-100 py-5 text-[14px] font-medium text-slate-400">
        현재 표시할 과목이 없습니다.
      </div>
    );
  }

  return (
    <div className="border-y border-slate-100">
      {subjects.map(
        (
          subject,
          index
        ) => (
          <div
            key={`${subject.subjectName}-${subject.semesterNo}-${index}`}
            className={`flex min-h-[62px] items-center gap-3 py-3.5 ${
              index >
              0
                ? "border-t border-slate-100"
                : ""
            }`}
          >
            <div
              className={
                subject.statusKey ===
                "completed"
                  ? "flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-black text-white"
                  : "h-2.5 w-2.5 shrink-0 rounded-full bg-slate-300"
              }
            >
              {subject.statusKey ===
              "completed"
                ? "✓"
                : null}
            </div>

            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-extrabold text-slate-900">
                {
                  subject.subjectName
                }
              </div>
            </div>

            <div
              className={
                subject.statusKey ===
                  "completed"
                  ? "shrink-0 rounded-lg bg-emerald-50 px-2.5 py-1 text-[12px] font-extrabold text-emerald-700"
                  : "shrink-0 rounded-lg bg-slate-100 px-2.5 py-1 text-[12px] font-bold text-slate-500"
              }
            >
              {
                subject.statusLabel
              }
            </div>
          </div>
        )
      )}
    </div>
  );
}


function PortalComingSoon({
  title,
}: {
  title:
    string;
}) {
  const image =
    title === "실습"
      ? PORTAL_IMAGES.practice
      : title === "커뮤니티"
        ? PORTAL_IMAGES.community
        : PORTAL_IMAGES.home;

  const description =
    title === "실습"
      ? "실습 진행상황과 배정 안내를 확인할 수 있도록 준비하고 있습니다."
      : title === "커뮤니티"
        ? "공지사항과 등록회원 자료를 확인할 수 있도록 준비하고 있습니다."
        : "해당 메뉴는 다음 단계에서 등록회원 관리정보와 연결됩니다.";

  return (
    <main className="pb-28">
      <section className="relative h-[235px] overflow-hidden">
        <img
          src={image}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 px-5 pb-6 text-white">
          <div className="text-[27px] font-extrabold tracking-[-0.03em]">
            {title}
          </div>
          <div className="mt-2 max-w-[350px] text-[15px] font-medium leading-6 text-white/90">
            {description}
          </div>
        </div>
      </section>

      <section className="px-5 py-8">
        <div className="border-y border-slate-200 py-8 text-center">
          <div className="text-lg font-extrabold text-slate-900">
            준비 중입니다.
          </div>
          <div className="mx-auto mt-2 max-w-[320px] text-sm font-medium leading-6 text-slate-500">
            등록회원 관리정보와 안전하게 연결한 뒤 이용할 수 있도록 제공할 예정입니다.
          </div>
        </div>
      </section>
    </main>
  );
}

function resolvePortalSubjectStatus(
  subject:
    any,
  semester:
    any
) {
  if (
    subject
      ?.retakeRequired ===
    true
  ) {
    return {
      key:
        "retake",

      label:
        "재수강",
    };
  }

  if (
    semester
      ?.progressStatus ===
    "completed"
  ) {
    return {
      key:
        "completed",

      label:
        "이수완료",
    };
  }

  if (
    semester
      ?.progressStatus ===
    "in_progress"
  ) {
    return {
      key:
        "in_progress",

      label:
        "진행중",
    };
  }

  if (
    semester
      ?.progressStatus ===
    "scheduled"
  ) {
    return {
      key:
        "scheduled",

      label:
        "예정",
    };
  }

  return {
    key:
      "review_required",

    label:
      "확인필요",
  };
}


function formatPortalDate(
  value:
    unknown
) {
  const normalized =
    String(
      value ||
      ""
    ).trim();

  const matched =
    normalized.match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );

  if (!matched) {
    return normalized;
  }

  return `${matched[1]}.${matched[2]}.${matched[3]}`;
}

function formatPortalDateTime(
  value:
    unknown
) {
  if (!value) {
    return "";
  }

  const date =
    value instanceof Date
      ? value
      : new Date(
          String(
            value
          )
        );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "ko-KR",
    {
      timeZone:
        "Asia/Seoul",

      year:
        "numeric",

      month:
        "2-digit",

      day:
        "2-digit",

      hour:
        "2-digit",

      minute:
        "2-digit",

      hour12:
        false,
    }
  ).format(
    date
  );
}


function PortalScreen({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f3f4f6]">
      <div className="mx-auto min-h-screen w-full max-w-[480px] bg-white shadow-sm">
        {children}
      </div>
    </div>
  );
}


function PortalHeader({
  portalName,
  companyLogoUrl,
}: {
  portalName:
    string | null;

  companyLogoUrl:
    string | null;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/95 px-5 backdrop-blur">
      <div className="flex h-[68px] items-center gap-3">
        {companyLogoUrl ? (
          <img
            src={companyLogoUrl}
            alt=""
            className="h-10 w-10 rounded-xl object-contain"
          />
        ) : (
          <div className="h-10 w-10 rounded-xl bg-slate-100" />
        )}

        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-extrabold tracking-[-0.01em] text-slate-950">
            {portalName ||
              "업무포털"}
          </div>
          <div className="mt-0.5 text-[12px] font-medium text-slate-400">
            등록회원 전용
          </div>
        </div>
      </div>
    </header>
  );
}


function PortalMenuCard({
  icon,
  title,
  description,
  tone,
  onClick,
}: {
  icon:
    string;

  title:
    string;

  description:
    string;

  tone:
    "orange" |
    "blue" |
    "green" |
    "purple";

  onClick:
    () => void;
}) {
  const toneClass =
    tone ===
    "orange"
      ? "border-orange-100 bg-orange-50/70 text-orange-600"
      : tone ===
          "green"
        ? "border-emerald-100 bg-emerald-50/70 text-emerald-600"
        : tone ===
            "purple"
          ? "border-violet-100 bg-violet-50/70 text-violet-600"
          : "border-blue-100 bg-blue-50/70 text-blue-600";

  return (
    <button
      type="button"
      onClick={
        onClick
      }
      className={`min-h-[132px] rounded-2xl border p-4 text-left transition active:scale-[0.98] ${toneClass}`}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 text-lg font-extrabold shadow-sm">
        {icon}
      </div>

      <div className="mt-3 font-extrabold text-slate-900">
        {title}
      </div>

      <div className="mt-1 text-xs leading-5 text-slate-500">
        {description}
      </div>
    </button>
  );
}


function PortalBottomNav({
  primaryColor,
  activeTab,
  onChange,
}: {
  primaryColor:
    string;

  activeTab:
    PortalTab;

  onChange:
    (
      tab:
        PortalTab
    ) => void;
}) {
  const items:
    Array<{
      key:
        PortalTab;

      label:
        string;

      icon:
        string;
    }> = [
    {
      key:
        "home",
      label:
        "홈",
      icon:
        "⌂",
    },

    {
      key:
        "myWork",
      label:
        "마이 업무",
      icon:
        "▣",
    },

    {
      key:
        "practice",
      label:
        "실습",
      icon:
        "↗",
    },

    {
      key:
        "administration",
      label:
        "행정절차",
      icon:
        "✓",
    },

    {
      key:
        "community",
      label:
        "커뮤니티",
      icon:
        "◎",
    },
  ];

  return (
    <nav className="fixed bottom-0 left-1/2 z-40 grid h-[74px] w-full max-w-[480px] -translate-x-1/2 grid-cols-5 border-t border-slate-200 bg-white px-1 pb-[env(safe-area-inset-bottom)]">
      {items.map(
        item => {
          const active =
            activeTab ===
            item.key;

          return (
            <button
              key={
                item.key
              }
              type="button"
              onClick={() =>
                onChange(
                  item.key
                )
              }
              className="flex min-w-0 flex-col items-center justify-center gap-1"
              style={{
                color:
                  active
                    ? primaryColor
                    : "#94a3b8",
              }}
            >
              <span className="text-[19px] font-bold leading-none">
                {
                  item.icon
                }
              </span>

              <span
                className={
                  active
                    ? "text-[11px] font-extrabold"
                    : "text-[11px] font-medium"
                }
              >
                {
                  item.label
                }
              </span>
            </button>
          );
        }
      )}
    </nav>
  );
}