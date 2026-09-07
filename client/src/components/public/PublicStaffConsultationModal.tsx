import {
  Check,
  CheckCircle2,
  ChevronDown,
  Loader2,
  LockKeyhole,
  Phone,
  Send,
  UserRound,
  X,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  trpc,
} from "@/lib/trpc";

import {
  Button,
} from "@/components/ui/button";

type PublicStaffConsultationModalProps = {
  open: boolean;
  onClose: () => void;
  profile: any;
  teamPageUrl?: string | null;
};

const FINAL_EDUCATION_OPTIONS = [
  "고등학교 졸업",
  "전문대 졸업",
  "4년제 대학교 졸업",
  "대학원 졸업",
  "기타",
];

const CONTACT_TIME_OPTIONS = [
  "언제든지",
  "오전",
  "오후",
  "저녁",
];

function normalizeImageUrl(
  raw?: string | null
) {
  if (!raw) {
    return "";
  }

  const API_BASE_URL =
    (
      import.meta.env
        .VITE_API_BASE_URL ||
      ""
    ).replace(
      /\/$/,
      ""
    );

  if (
    raw.startsWith("http://") ||
    raw.startsWith("https://") ||
    raw.startsWith("data:")
  ) {
    return raw;
  }

  if (
    raw.startsWith("//")
  ) {
    return `https:${raw}`;
  }

  if (!API_BASE_URL) {
    return raw;
  }

  return raw.startsWith("/")
    ? `${API_BASE_URL}${raw}`
    : `${API_BASE_URL}/${raw}`;
}

function normalizeSpecialties(
  profile: any
): string[] {
  if (
    !Array.isArray(
      profile?.specialties
    )
  ) {
    return [];
  }

  return Array.from(
    new Set(
      profile.specialties
        .map(
          (
            item: unknown
          ) =>
            String(
              item || ""
            ).trim()
        )
        .filter(Boolean)
    )
  );
}

function formatPhoneForDisplay(
  value:
    | string
    | null
    | undefined
) {
  const digits =
    String(
      value || ""
    ).replace(
      /\D/g,
      ""
    );

  if (
    digits.length === 11
  ) {
    return digits.replace(
      /(\d{3})(\d{4})(\d{4})/,
      "$1-$2-$3"
    );
  }

  if (
    digits.length === 10
  ) {
    return digits.replace(
      /(\d{3})(\d{3})(\d{4})/,
      "$1-$2-$3"
    );
  }

  return String(
    value || ""
  ).trim();
}

function formatPhoneInput(
  value: string
) {
  const digits =
    String(
      value || ""
    )
      .replace(
        /\D/g,
        ""
      )
      .slice(
        0,
        11
      );

  if (
    digits.length <= 3
  ) {
    return digits;
  }

  if (
    digits.length <= 7
  ) {
    return `${digits.slice(
      0,
      3
    )}-${digits.slice(
      3
    )}`;
  }

  return `${digits.slice(
    0,
    3
  )}-${digits.slice(
    3,
    7
  )}-${digits.slice(
    7
  )}`;
}

function SelectField({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (
    value: string
  ) => void;
  placeholder: string;
  options: string[];
}) {
  return (
    <div className="relative">
      <select
        value={
          value
        }
        onChange={(
          event
        ) =>
          onChange(
            event.target.value
          )
        }
        className="h-[46px] w-full appearance-none rounded-[9px] border border-slate-200 bg-white px-3.5 pr-10 text-[13px] font-medium text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      >
        <option value="">
          {placeholder}
        </option>

        {options.map(
          option => (
            <option
              key={
                option
              }
              value={
                option
              }
            >
              {option}
            </option>
          )
        )}
      </select>

      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
    </div>
  );
}

export default function PublicStaffConsultationModal({
  open,
  onClose,
  profile,
  teamPageUrl,
}: PublicStaffConsultationModalProps) {
  const publicToken =
    String(
      profile?.publicToken ||
      ""
    ).trim();

  const displayName =
    String(
      profile?.displayName ||
      "담당자"
    ).trim();

  const positionName =
    String(
      profile?.publicPositionName ||
      ""
    ).trim();

  const profileImageUrl =
    normalizeImageUrl(
      profile?.profileImageUrl
    );

  const publicPhone =
    String(
      profile?.publicPhone ||
      ""
    ).trim();

  const specialties =
    normalizeSpecialties(
      profile
    );

  const desiredCourseOptions =
    specialties;

  const acceptingNewConsultations =
    profile?.acceptingNewConsultations !==
    false;

  const [
    clientName,
    setClientName,
  ] =
    useState("");

  const [
    phone,
    setPhone,
  ] =
    useState("");

  const [
    finalEducation,
    setFinalEducation,
  ] =
    useState("");

  const [
    desiredCourse,
    setDesiredCourse,
  ] =
    useState("");

  const [
    preferredContactTime,
    setPreferredContactTime,
  ] =
    useState("");

  const [
    notes,
    setNotes,
  ] =
    useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  const [
    submitted,
    setSubmitted,
  ] =
    useState(false);

  const submitMutation =
    trpc.staffProfile.public
      .submitConsultation
      .useMutation();

  useEffect(
    () => {
      if (!open) {
        return;
      }

      setClientName("");
      setPhone("");
      setFinalEducation("");
      setDesiredCourse("");
      setPreferredContactTime("");
      setNotes("");
      setErrorMessage("");
      setSubmitted(false);

      submitMutation.reset();
    },
    [
      open,
      publicToken,
    ]
  );

  useEffect(
    () => {
      if (!open) {
        return;
      }

      const previousOverflow =
        document.body.style
          .overflow;

      document.body.style.overflow =
        "hidden";

      return () => {
        document.body.style.overflow =
          previousOverflow;
      };
    },
    [
      open,
    ]
  );

  useEffect(
    () => {
      if (!open) {
        return;
      }

      const handleEscape =
        (
          event:
            KeyboardEvent
        ) => {
          if (
            event.key ===
            "Escape"
          ) {
            onClose();
          }
        };

      window.addEventListener(
        "keydown",
        handleEscape
      );

      return () => {
        window.removeEventListener(
          "keydown",
          handleEscape
        );
      };
    },
    [
      open,
      onClose,
    ]
  );

  const canSubmit =
    useMemo(
      () => {
        const phoneDigits =
          phone.replace(
            /\D/g,
            ""
          );

        return (
          Boolean(
            publicToken
          ) &&
          acceptingNewConsultations &&
          Boolean(
            clientName.trim()
          ) &&
          phoneDigits.length >=
            10 &&
          phoneDigits.length <=
            11 &&
          Boolean(
            finalEducation
          ) &&
          Boolean(
            desiredCourse
          ) &&
          !submitMutation.isPending
        );
      },
      [
        publicToken,
        acceptingNewConsultations,
        clientName,
        phone,
        finalEducation,
        desiredCourse,
        submitMutation.isPending,
      ]
    );

  if (!open) {
    return null;
  }

  const handleSubmit =
    async () => {
      setErrorMessage("");

      if (
        !acceptingNewConsultations
      ) {
        setErrorMessage(
          "현재 이 담당자는 신규 상담을 받고 있지 않습니다."
        );

        return;
      }

      const phoneDigits =
        phone.replace(
          /\D/g,
          ""
        );

      if (
        phoneDigits.length < 10 ||
        phoneDigits.length > 11
      ) {
        setErrorMessage(
          "올바른 연락처를 입력해주세요."
        );

        return;
      }

      try {
        await submitMutation.mutateAsync(
          {
            publicToken,

            clientName:
              clientName.trim(),

            phone:
              phoneDigits,

            finalEducation,

            desiredCourse,

            preferredContactTime:
              preferredContactTime ||
              null,

            notes:
              notes.trim() ||
              null,
          }
        );

        setSubmitted(
          true
        );
      } catch (
        error: any
      ) {
        setErrorMessage(
          error?.message ||
            "상담 신청 중 문제가 발생했습니다."
        );
      }
    };

  const handleGoProfile =
    () => {
      if (
        !publicToken
      ) {
        return;
      }

      window.location.href =
        `/staff/${encodeURIComponent(
          publicToken
        )}`;
    };

  const handleGoTeam =
    () => {
      if (
        teamPageUrl
      ) {
        window.location.href =
          teamPageUrl;

        return;
      }

      onClose();
    };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/65 md:items-center md:px-5 md:py-8"
      onMouseDown={(
        event
      ) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <div
        className="
          relative
          flex
          max-h-[94dvh]
          w-full
          flex-col
          overflow-hidden
          rounded-t-[24px]
          bg-white
          shadow-[0_24px_80px_rgba(15,23,42,0.35)]
          md:max-h-[90vh]
          md:max-w-[505px]
          md:rounded-[18px]
        "
      >
        {/* 모바일 하단모달 손잡이 */}
        <div className="flex justify-center pb-1 pt-2 md:hidden">
          <div className="h-1 w-10 rounded-full bg-slate-300" />
        </div>

        {!submitted ? (
          <>
            {/* HEADER */}
            <div className="flex shrink-0 items-start justify-between px-4 pb-3 pt-3 md:px-5 md:pb-3 md:pt-5">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  <Send className="h-[18px] w-[18px]" />
                </div>

                <div>
                  <h2 className="text-[19px] font-black leading-6 tracking-[-0.03em] text-slate-950 md:text-[21px]">
                    상담 신청
                  </h2>

                  <p className="mt-1 text-[10px] leading-4 text-slate-500 md:text-[11px]">
                    {displayName}
                    {positionName
                      ? ` ${positionName}`
                      : ""}
                    에게 상담을 신청합니다.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={
                  onClose
                }
                aria-label="닫기"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* 담당자 카드 */}
              <div className="px-4 pb-3 md:px-5">
                <div className="rounded-[12px] bg-[#f7f9fc] p-3">
                  <div className="flex gap-3">
                    <div className="h-[68px] w-[68px] shrink-0 overflow-hidden rounded-[10px] bg-white md:h-[82px] md:w-[82px]">
                      {profileImageUrl ? (
                        <img
                          src={
                            profileImageUrl
                          }
                          alt={`${displayName} 담당자`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-400">
                          <UserRound className="h-8 w-8" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                        <div className="text-[15px] font-black text-slate-950 md:text-base">
                          {displayName}
                        </div>

                        {positionName ? (
                          <div className="text-[11px] font-bold text-slate-700">
                            {positionName}
                          </div>
                        ) : null}
                      </div>

                      <div className="mt-1.5">
                        {acceptingNewConsultations ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[9px] font-bold text-emerald-600">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            현재 상담 가능
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-slate-200 px-2 py-1 text-[9px] font-bold text-slate-500">
                            상담 대기중
                          </span>
                        )}
                      </div>

                      {specialties.length ? (
                        <div className="mt-2 hidden flex-wrap gap-1 md:flex">
                          {specialties
                            .slice(
                              0,
                              4
                            )
                            .map(
                              specialty => (
                                <span
                                  key={
                                    specialty
                                  }
                                  className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[9px] font-semibold text-slate-600"
                                >
                                  {specialty}
                                </span>
                              )
                            )}
                        </div>
                      ) : null}

                      {publicPhone ? (
                        <a
                          href={`tel:${publicPhone.replace(
                            /\D/g,
                            ""
                          )}`}
                          className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-slate-800 shadow-sm md:text-[11px]"
                        >
                          <Phone className="h-3 w-3" />

                          {formatPhoneForDisplay(
                            publicPhone
                          )}
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              {/* FORM */}
              <div className="space-y-3.5 border-t border-slate-100 px-4 py-3 md:px-5 md:py-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <label>
                    <span className="text-[11px] font-black text-slate-800">
                      이름{" "}
                      <span className="text-red-500">
                        *
                      </span>
                    </span>

                    <input
                      value={
                        clientName
                      }
                      onChange={(
                        event
                      ) =>
                        setClientName(
                          event.target.value
                        )
                      }
                      maxLength={
                        100
                      }
                      placeholder="이름을 입력해주세요"
                      className="mt-1.5 h-[46px] w-full rounded-[9px] border border-slate-200 bg-white px-3.5 text-[13px] outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </label>

                  <label>
                    <span className="text-[11px] font-black text-slate-800">
                      연락처{" "}
                      <span className="text-red-500">
                        *
                      </span>
                    </span>

                    <input
                      value={
                        phone
                      }
                      onChange={(
                        event
                      ) =>
                        setPhone(
                          formatPhoneInput(
                            event.target.value
                          )
                        )
                      }
                      inputMode="tel"
                      maxLength={
                        13
                      }
                      placeholder="예) 010-1234-5678"
                      className="mt-1.5 h-[46px] w-full rounded-[9px] border border-slate-200 bg-white px-3.5 text-[13px] outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </label>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <label>
                    <span className="text-[11px] font-black text-slate-800">
                      최종학력{" "}
                      <span className="text-red-500">
                        *
                      </span>
                    </span>

                    <div className="mt-1.5">
                      <SelectField
                        value={
                          finalEducation
                        }
                        onChange={
                          setFinalEducation
                        }
                        placeholder="선택해주세요"
                        options={
                          FINAL_EDUCATION_OPTIONS
                        }
                      />
                    </div>
                  </label>

                  <label>
                    <span className="text-[11px] font-black text-slate-800">
                      희망과정{" "}
                      <span className="text-red-500">
                        *
                      </span>
                    </span>

                    <div className="mt-1.5">
                      {desiredCourseOptions.length ? (
                        <SelectField
                          value={
                            desiredCourse
                          }
                          onChange={
                            setDesiredCourse
                          }
                          placeholder="선택해주세요"
                          options={
                            desiredCourseOptions
                          }
                        />
                      ) : (
                        <input
                          value={
                            desiredCourse
                          }
                          onChange={(
                            event
                          ) =>
                            setDesiredCourse(
                              event.target.value
                            )
                          }
                          placeholder="희망과정을 입력해주세요"
                          className="h-[46px] w-full rounded-[9px] border border-slate-200 bg-white px-3.5 text-[13px] outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      )}
                    </div>
                  </label>
                </div>

                <label>
                  <span className="text-[11px] font-black text-slate-800">
                    상담 가능 시간
                  </span>

                  <div className="mt-1.5">
                    <SelectField
                      value={
                        preferredContactTime
                      }
                      onChange={
                        setPreferredContactTime
                      }
                      placeholder="선택해주세요"
                      options={
                        CONTACT_TIME_OPTIONS
                      }
                    />
                  </div>
                </label>

                <label className="block">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-slate-800">
                      문의내용
                    </span>

                    <span className="text-[10px] text-slate-400">
                      {notes.length}/500
                    </span>
                  </div>

                  <textarea
                    value={
                      notes
                    }
                    onChange={(
                      event
                    ) =>
                      setNotes(
                        event.target.value
                      )
                    }
                    maxLength={
                      500
                    }
                    rows={
                      3
                    }
                    placeholder="궁금한 내용을 자세히 입력해주세요."
                    className="mt-1.5 min-h-[92px] w-full resize-none rounded-[9px] border border-slate-200 bg-white px-3.5 py-3 text-[13px] leading-5 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </label>

                {errorMessage ? (
                  <div className="rounded-lg bg-red-50 px-3 py-2.5 text-[11px] font-medium text-red-600">
                    {errorMessage}
                  </div>
                ) : null}

                <div className="flex items-center justify-center gap-1.5 text-[10px] leading-4 text-slate-400">
                  <LockKeyhole className="h-3 w-3 shrink-0" />

                  입력하신 정보는 상담 목적으로만 사용되며, 안전하게 보호됩니다.
                </div>
              </div>
            </div>

            {/* 하단 버튼 */}
            <div className="grid shrink-0 grid-cols-1 gap-2 border-t border-slate-100 bg-white px-4 py-3 md:grid-cols-[160px_1fr] md:px-5 md:py-4">
              <Button
                type="button"
                variant="outline"
                onClick={
                  onClose
                }
                className="hidden h-[46px] rounded-[9px] border-blue-500 font-bold text-blue-600 hover:bg-blue-50 md:inline-flex"
              >
                취소
              </Button>

              <Button
                type="button"
                disabled={
                  !canSubmit
                }
                onClick={
                  handleSubmit
                }
                className="h-[46px] rounded-[9px] bg-blue-600 font-bold text-white shadow-sm hover:bg-blue-700"
              >
                {submitMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    신청 중...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    상담 신청하기
                  </>
                )}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex min-h-[430px] flex-col items-center justify-center px-6 py-10 text-center md:min-h-[490px]">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/25">
                <Check className="h-6 w-6 stroke-[3]" />
              </div>
            </div>

            <h3 className="mt-5 text-[22px] font-black leading-8 tracking-[-0.03em] text-slate-950">
              상담 신청이
              <br />
              완료되었습니다!
            </h3>

            <p className="mt-4 text-[13px] leading-6 text-slate-500">
              <span className="font-bold text-slate-700">
                {displayName}
                {positionName
                  ? ` ${positionName}`
                  : ""}
              </span>
              에게
              <br />
              상담 내용이 전달되었습니다.
              <br />
              담당자가 확인 후 연락드리겠습니다.
            </p>

            <div className="mt-7 grid w-full max-w-[330px] gap-2">
              <Button
                type="button"
                onClick={
                  handleGoProfile
                }
                className="h-[44px] rounded-[8px] bg-blue-600 font-bold text-white hover:bg-blue-700"
              >
                담당자 프로필로 돌아가기
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={
                  handleGoTeam
                }
                className="h-[44px] rounded-[8px] border-blue-500 font-bold text-blue-600 hover:bg-blue-50"
              >
                {teamPageUrl
                  ? "담당자 목록 보기"
                  : "닫기"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}