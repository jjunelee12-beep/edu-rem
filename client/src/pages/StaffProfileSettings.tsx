import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Award,
  BriefcaseBusiness,
  Check,
  Copy,
  ExternalLink,
  GraduationCap,
  ImagePlus,
  Link2,
  Loader2,
  Phone,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";

import { toast } from "sonner";

import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

import {
  Card,
  CardContent,
} from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type StaffProfileForm = {
  isActive: boolean;
  showOnTeamPage: boolean;
  acceptingNewConsultations: boolean;

  profileImageUrl: string;
  displayName: string;
  publicPositionName: string;
  headline: string;

  introduction: string;
  careerText: string;
  awardText: string;
  qualificationText: string;
  consultationStyle: string;

  specialties: string[];

  publicPhone: string;
  showPhone: boolean;

  consultationUrl: string;
  showConsultationButton: boolean;
};

const EMPTY_FORM: StaffProfileForm = {
  isActive: false,
  showOnTeamPage: false,
  acceptingNewConsultations: true,

  profileImageUrl: "",
  displayName: "",
  publicPositionName: "",
  headline: "",

  introduction: "",
  careerText: "",
  awardText: "",
  qualificationText: "",
  consultationStyle: "",

  specialties: [],

  publicPhone: "",
  showPhone: false,

  consultationUrl: "",
  showConsultationButton: true,
};

function normalizeNullableText(
  value: string
) {
  const normalized =
    String(value || "").trim();

  return normalized || null;
}

function normalizePhoneInput(
  value: string
) {
  return String(value || "")
    .replace(/[^\d-]/g, "")
    .slice(0, 20);
}

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
    ).replace(/\/$/, "");

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

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (
    checked: boolean
  ) => void;
}) {
  return (
    <button
      type="button"
      onClick={() =>
        onChange(!checked)
      }
      className="flex w-full items-center justify-between gap-4 rounded-xl border bg-white px-4 py-3 text-left transition hover:bg-slate-50"
    >
      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-900">
          {title}
        </div>

        <div className="mt-0.5 text-xs leading-5 text-muted-foreground">
          {description}
        </div>
      </div>

      <div
        className={[
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          checked
            ? "bg-primary"
            : "bg-slate-200",
        ].join(" ")}
      >
        <span
          className={[
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all",
            checked
              ? "left-[22px]"
              : "left-0.5",
          ].join(" ")}
        />
      </div>
    </button>
  );
}

function SectionHeader({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </div>

      <div>
        <h2 className="font-bold text-slate-900">
          {title}
        </h2>

        {description ? (
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function TextAreaField({
  label,
  description,
  value,
  onChange,
  placeholder,
  rows = 5,
}: {
  label: string;
  description?: string;
  value: string;
  onChange: (
    value: string
  ) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div>
      <label className="text-sm font-semibold text-slate-800">
        {label}
      </label>

      {description ? (
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {description}
        </p>
      ) : null}

      <textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={event =>
          onChange(
            event.target.value
          )
        }
        className="mt-2 w-full resize-y rounded-xl border bg-white px-3 py-3 text-sm leading-6 outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/10"
      />
    </div>
  );
}

export default function StaffProfileSettings() {
  const { user } =
    useAuth();

  const utils =
    trpc.useUtils();

  const fileInputRef =
    useRef<HTMLInputElement>(
      null
    );

  const {
    data: profile,
    isLoading,
  } =
    trpc.staffProfile.my.get.useQuery();

  const {
    data: myProfile,
  } =
    trpc.users.me.useQuery();

  const {
    data: branding,
  } =
    trpc.branding.get.useQuery();

  const [form, setForm] =
    useState<StaffProfileForm>(
      EMPTY_FORM
    );

  const [
    specialtyInput,
    setSpecialtyInput,
  ] = useState("");

  const [
    imagePreview,
    setImagePreview,
  ] = useState("");

  const [
    isUploadingImage,
    setIsUploadingImage,
  ] = useState(false);

  const [
    initialized,
    setInitialized,
  ] = useState(false);

  useEffect(() => {
    if (!profile) {
      return;
    }

    setForm({
      isActive:
        Boolean(
          (profile as any)
            ?.isActive
        ),

      showOnTeamPage:
        Boolean(
          (profile as any)
            ?.showOnTeamPage
        ),

      acceptingNewConsultations:
        (profile as any)
          ?.acceptingNewConsultations !==
        false,

      profileImageUrl:
        String(
          (profile as any)
            ?.profileImageUrl ||
          ""
        ),

      displayName:
        String(
          (profile as any)
            ?.displayName ||
          (myProfile as any)
            ?.name ||
          user?.name ||
          ""
        ),

      publicPositionName:
        String(
          (profile as any)
            ?.publicPositionName ||
          (myProfile as any)
            ?.positionName ||
          (user as any)
            ?.positionName ||
          ""
        ),

      headline:
        String(
          (profile as any)
            ?.headline ||
          ""
        ),

      introduction:
        String(
          (profile as any)
            ?.introduction ||
          ""
        ),

      careerText:
        String(
          (profile as any)
            ?.careerText ||
          ""
        ),

      awardText:
        String(
          (profile as any)
            ?.awardText ||
          ""
        ),

      qualificationText:
        String(
          (profile as any)
            ?.qualificationText ||
          ""
        ),

      consultationStyle:
        String(
          (profile as any)
            ?.consultationStyle ||
          ""
        ),

      specialties:
        Array.isArray(
          (profile as any)
            ?.specialties
        )
          ? (
              (profile as any)
                .specialties as unknown[]
            )
              .map(item =>
                String(
                  item ||
                  ""
                ).trim()
              )
              .filter(Boolean)
          : [],

      publicPhone:
        String(
          (profile as any)
            ?.publicPhone ||
          ""
        ),

      showPhone:
        Boolean(
          (profile as any)
            ?.showPhone
        ),

      consultationUrl:
        String(
          (profile as any)
            ?.consultationUrl ||
          ""
        ),

      showConsultationButton:
        (profile as any)
          ?.showConsultationButton !==
        false,
    });

    setImagePreview("");

    setInitialized(true);
  }, [
    profile,
    myProfile,
    user,
  ]);

  const updateMutation =
    trpc.staffProfile.my.update.useMutation(
      {
        onSuccess: async () => {
          await utils.staffProfile
            .my.get.invalidate();

          toast.success(
            "담당자 프로필이 저장되었습니다."
          );
        },

        onError: error => {
          toast.error(
            error.message ||
              "프로필 저장 중 오류가 발생했습니다."
          );
        },
      }
    );

  const regenerateTokenMutation =
    trpc.staffProfile.my.regenerateToken.useMutation(
      {
        onSuccess: async () => {
          await utils.staffProfile
            .my.get.invalidate();

          toast.success(
            "새 공개 링크가 발급되었습니다."
          );
        },

        onError: error => {
          toast.error(
            error.message ||
              "공개 링크 재발급 중 오류가 발생했습니다."
          );
        },
      }
    );

  const currentImage =
    imagePreview ||
    normalizeImageUrl(
      form.profileImageUrl
    ) ||
    normalizeImageUrl(
      (myProfile as any)
        ?.profileImageUrl
    );

  const publicToken =
    String(
      (profile as any)
        ?.publicToken ||
      ""
    ).trim();

  const publicProfileUrl =
    useMemo(() => {
      if (!publicToken) {
        return "";
      }

      if (
        typeof window ===
        "undefined"
      ) {
        return `/staff/${publicToken}`;
      }

      return `${window.location.origin}/staff/${publicToken}`;
    }, [publicToken]);

  const companyName =
    String(
      (branding as any)
        ?.companyName ||
      ""
    ).trim();

  const previewName =
    form.displayName.trim() ||
    String(
      (myProfile as any)
        ?.name ||
      user?.name ||
      "담당자"
    );

  const previewPosition =
    form.publicPositionName
      .trim();

  const previewHeadline =
    form.headline.trim() ||
    "회원님의 상황에 맞는 학습과정을 함께 안내해드립니다.";

  const setField = <
    K extends keyof StaffProfileForm
  >(
    key: K,
    value:
      StaffProfileForm[K]
  ) => {
    setForm(previous => ({
      ...previous,
      [key]:
        value,
    }));
  };

  const addSpecialty = () => {
    const value =
      specialtyInput.trim();

    if (!value) {
      return;
    }

    const duplicate =
      form.specialties.some(
        item =>
          item
            .trim()
            .toLowerCase() ===
          value.toLowerCase()
      );

    if (duplicate) {
      toast.error(
        "이미 추가된 전문 분야입니다."
      );
      return;
    }

    if (
      form.specialties.length >=
      30
    ) {
      toast.error(
        "전문 분야는 최대 30개까지 등록할 수 있습니다."
      );
      return;
    }

    setField(
      "specialties",
      [
        ...form.specialties,
        value,
      ]
    );

    setSpecialtyInput("");
  };

  const removeSpecialty = (
    index: number
  ) => {
    setField(
      "specialties",
      form.specialties.filter(
        (_, itemIndex) =>
          itemIndex !== index
      )
    );
  };

  const handleImageFile = (
    file: File
  ) => {
    if (
      !file.type.startsWith(
        "image/"
      )
    ) {
      toast.error(
        "이미지 파일만 등록할 수 있습니다."
      );
      return;
    }

    const reader =
      new FileReader();

    reader.onload = () => {
      setImagePreview(
        String(
          reader.result ||
          ""
        )
      );
    };

    reader.readAsDataURL(
      file
    );
  };

  const uploadProfileImage =
    async () => {
      if (!imagePreview) {
        toast.error(
          "먼저 사진을 선택해주세요."
        );
        return;
      }

      try {
        setIsUploadingImage(
          true
        );

        const response =
          await fetch(
            imagePreview
          );

        const blob =
          await response.blob();

        const formData =
          new FormData();

        formData.append(
          "file",
          blob,
          "staff-profile-image.png"
        );

        const uploadResponse =
          await fetch(
            "/api/upload",
            {
              method:
                "POST",

              body:
                formData,

              credentials:
                "include",
            }
          );

        if (
          !uploadResponse.ok
        ) {
          throw new Error(
            "사진 업로드에 실패했습니다."
          );
        }

        const uploaded =
          await uploadResponse.json();

        const fileUrl =
          String(
            uploaded?.fileUrl ||
            ""
          ).trim();

        if (!fileUrl) {
          throw new Error(
            "업로드된 사진 URL을 가져오지 못했습니다."
          );
        }

        setField(
          "profileImageUrl",
          fileUrl
        );

        setImagePreview("");

        toast.success(
          "사진이 업로드되었습니다. 마지막으로 저장 버튼을 눌러주세요."
        );
      } catch (
        error
      ) {
        toast.error(
          error instanceof Error
            ? error.message
            : "사진 업로드 중 오류가 발생했습니다."
        );
      } finally {
        setIsUploadingImage(
          false
        );
      }
    };

  const saveProfile = () => {
    if (
      !form.displayName.trim()
    ) {
      toast.error(
        "공개 이름을 입력해주세요."
      );
      return;
    }

    updateMutation.mutate({
      isActive:
        form.isActive,

      showOnTeamPage:
        form.showOnTeamPage,

      acceptingNewConsultations:
        form.acceptingNewConsultations,

      profileImageUrl:
        normalizeNullableText(
          form.profileImageUrl
        ),

      displayName:
        normalizeNullableText(
          form.displayName
        ),

      publicPositionName:
        normalizeNullableText(
          form.publicPositionName
        ),

      headline:
        normalizeNullableText(
          form.headline
        ),

      introduction:
        normalizeNullableText(
          form.introduction
        ),

      careerText:
        normalizeNullableText(
          form.careerText
        ),

      awardText:
        normalizeNullableText(
          form.awardText
        ),

      qualificationText:
        normalizeNullableText(
          form.qualificationText
        ),

      consultationStyle:
        normalizeNullableText(
          form.consultationStyle
        ),

      specialties:
        form.specialties,

      publicPhone:
        normalizeNullableText(
          form.publicPhone
        ),

      showPhone:
        form.showPhone,

      consultationUrl:
        normalizeNullableText(
          form.consultationUrl
        ),

      showConsultationButton:
        form.showConsultationButton,
    });
  };

  const copyPublicLink =
    async () => {
      if (!publicProfileUrl) {
        toast.error(
          "공개 링크가 없습니다."
        );
        return;
      }

      try {
        await navigator.clipboard.writeText(
          publicProfileUrl
        );

        toast.success(
          "공개 프로필 링크를 복사했습니다."
        );
      } catch {
        toast.error(
          "링크 복사에 실패했습니다."
        );
      }
    };

  const regenerateToken =
    () => {
      const confirmed =
        window.confirm(
          "새 링크를 발급하면 기존 공개 프로필 링크는 더 이상 사용할 수 없습니다.\n\n계속하시겠습니까?"
        );

      if (!confirmed) {
        return;
      }

      regenerateTokenMutation.mutate();
    };

  if (
    isLoading ||
    !initialized
  ) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          담당자 프로필을 불러오는 중입니다.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 pb-12">
      {/* 페이지 헤더 */}
      <div className="overflow-hidden rounded-2xl border bg-white">
        <div className="relative px-6 py-7 md:px-8">
          <div className="pointer-events-none absolute right-[-70px] top-[-90px] h-56 w-56 rounded-full bg-primary/5" />

          <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
                <Sparkles className="h-4 w-4" />
                Public Staff Profile
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">
                담당자 공개 프로필
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                고객에게 보여지는 담당자 소개,
                경력, 전문 분야와 상담 연결
                정보를 직접 관리할 수 있습니다.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {publicProfileUrl ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    window.open(
                      publicProfileUrl,
                      "_blank",
                      "noopener,noreferrer"
                    );
                  }}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  프로필 미리보기
                </Button>
              ) : null}

              <Button
                type="button"
                onClick={
                  saveProfile
                }
                disabled={
                  updateMutation.isPending
                }
              >
                {updateMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}

                변경사항 저장
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* 왼쪽 설정 */}
        <div className="space-y-6">
          {/* 기본 프로필 */}
          <Card className="overflow-hidden rounded-2xl">
            <CardContent className="p-0">
              <div className="border-b px-5 py-5 md:px-6">
                <SectionHeader
                  icon={
                    <UserRound className="h-5 w-5" />
                  }
                  title="기본 프로필"
                  description="담당자 카드와 상세 소개 페이지에 가장 먼저 표시되는 정보입니다."
                />
              </div>

              <div className="grid gap-6 p-5 md:grid-cols-[220px_minmax(0,1fr)] md:p-6">
                {/* 사진 */}
                <div>
                  <div className="rounded-2xl border bg-slate-50 p-4">
                    <div className="mx-auto flex h-40 w-40 items-center justify-center overflow-hidden rounded-2xl border bg-white shadow-sm">
                      {currentImage ? (
                        <img
                          src={
                            currentImage
                          }
                          alt="담당자 프로필"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center text-slate-400">
                          <UserRound className="h-12 w-12" />

                          <span className="mt-2 text-xs">
                            프로필 사진
                          </span>
                        </div>
                      )}
                    </div>

                    <input
                      ref={
                        fileInputRef
                      }
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={
                        event => {
                          const file =
                            event
                              .target
                              .files?.[0];

                          if (
                            file
                          ) {
                            handleImageFile(
                              file
                            );
                          }

                          event.currentTarget.value =
                            "";
                        }
                      }
                    />

                    <div className="mt-4 grid gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          fileInputRef.current?.click()
                        }
                      >
                        <ImagePlus className="mr-2 h-4 w-4" />
                        사진 선택
                      </Button>

                      {imagePreview ? (
                        <Button
                          type="button"
                          onClick={
                            uploadProfileImage
                          }
                          disabled={
                            isUploadingImage
                          }
                        >
                          {isUploadingImage ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="mr-2 h-4 w-4" />
                          )}

                          선택한 사진 업로드
                        </Button>
                      ) : null}
                    </div>

                    <p className="mt-3 text-center text-[11px] leading-5 text-muted-foreground">
                      CRM 내부 프로필과 별도로
                      고객에게 공개될 사진입니다.
                    </p>
                  </div>
                </div>

                {/* 기본 입력 */}
                <div className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-semibold text-slate-800">
                        공개 이름
                      </label>

                      <Input
                        className="mt-2 h-11"
                        value={
                          form.displayName
                        }
                        onChange={
                          event =>
                            setField(
                              "displayName",
                              event
                                .target
                                .value
                            )
                        }
                        placeholder="예: 이재준"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-slate-800">
                        공개 직급
                      </label>

                      <Input
                        className="mt-2 h-11"
                        value={
                          form.publicPositionName
                        }
                        onChange={
                          event =>
                            setField(
                              "publicPositionName",
                              event
                                .target
                                .value
                            )
                        }
                        placeholder="예: 팀장"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-slate-800">
                      한 줄 소개
                    </label>

                    <p className="mt-1 text-xs text-muted-foreground">
                      회사 담당자 목록과 상세
                      프로필 상단에 표시됩니다.
                    </p>

                    <Input
                      className="mt-2 h-11"
                      value={
                        form.headline
                      }
                      maxLength={
                        255
                      }
                      onChange={
                        event =>
                          setField(
                            "headline",
                            event
                              .target
                              .value
                          )
                      }
                      placeholder="예: 사회복지사 전문 학습담당자"
                    />
                  </div>

                  {/* 전문 분야 */}
                  <div>
                    <label className="text-sm font-semibold text-slate-800">
                      전문 상담 분야
                    </label>

                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      담당 가능한 과정이나 강점을
                      추가해주세요. 이후 AI 담당자
                      추천에도 활용됩니다.
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {form.specialties.map(
                        (
                          specialty,
                          index
                        ) => (
                          <Badge
                            key={`${specialty}-${index}`}
                            variant="secondary"
                            className="gap-1 rounded-full px-3 py-1.5 text-xs"
                          >
                            {
                              specialty
                            }

                            <button
                              type="button"
                              onClick={() =>
                                removeSpecialty(
                                  index
                                )
                              }
                              className="ml-1 rounded-full p-0.5 hover:bg-slate-300/70"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        )
                      )}

                      {!form
                        .specialties
                        .length ? (
                        <span className="text-xs text-muted-foreground">
                          아직 등록된 전문
                          분야가 없습니다.
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-3 flex gap-2">
                      <Input
                        value={
                          specialtyInput
                        }
                        onChange={
                          event =>
                            setSpecialtyInput(
                              event
                                .target
                                .value
                            )
                        }
                        onKeyDown={
                          event => {
                            if (
                              event.key ===
                              "Enter"
                            ) {
                              event.preventDefault();
                              addSpecialty();
                            }
                          }
                        }
                        placeholder="예: 사회복지사 2급"
                      />

                      <Button
                        type="button"
                        variant="outline"
                        onClick={
                          addSpecialty
                        }
                      >
                        <Plus className="mr-1 h-4 w-4" />
                        추가
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 공개 설정 */}
          <Card className="rounded-2xl">
            <CardContent className="p-5 md:p-6">
              <SectionHeader
                icon={
                  <Sparkles className="h-5 w-5" />
                }
                title="공개 설정"
                description="개인 프로필과 회사 담당자 소개 페이지 노출 상태를 선택합니다."
              />

              <div className="mt-5 grid gap-3 lg:grid-cols-3">
                <ToggleRow
                  title="프로필 공개"
                  description="개인 공개 링크로 프로필을 열람할 수 있습니다."
                  checked={
                    form.isActive
                  }
                  onChange={
                    checked =>
                      setField(
                        "isActive",
                        checked
                      )
                  }
                />

                <ToggleRow
                  title="회사 소개에 노출"
                  description="회사 전체 담당자 소개 페이지에 내 프로필을 표시합니다."
                  checked={
                    form.showOnTeamPage
                  }
                  onChange={
                    checked =>
                      setField(
                        "showOnTeamPage",
                        checked
                      )
                  }
                />

                <ToggleRow
                  title="신규 상담 가능"
                  description="현재 신규 회원 상담을 받을 수 있는 상태로 표시합니다."
                  checked={
                    form.acceptingNewConsultations
                  }
                  onChange={
                    checked =>
                      setField(
                        "acceptingNewConsultations",
                        checked
                      )
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* 상세 소개 */}
          <Card className="rounded-2xl">
            <CardContent className="p-5 md:p-6">
              <SectionHeader
                icon={
                  <BriefcaseBusiness className="h-5 w-5" />
                }
                title="상세 소개"
                description="고객이 담당자를 선택할 때 신뢰할 수 있는 정보를 충분히 확인할 수 있도록 작성해주세요."
              />

              <div className="mt-6 space-y-5">
                <TextAreaField
                  label="자기소개"
                  value={
                    form.introduction
                  }
                  onChange={
                    value =>
                      setField(
                        "introduction",
                        value
                      )
                  }
                  placeholder="담당자로서 어떤 방식으로 상담하고 관리하는지 소개해주세요."
                  rows={6}
                />

                <div className="grid gap-5 lg:grid-cols-2">
                  <TextAreaField
                    label="주요 경력"
                    value={
                      form.careerText
                    }
                    onChange={
                      value =>
                        setField(
                          "careerText",
                          value
                        )
                    }
                    placeholder={`예)\n학점은행제 상담 경력 7년\n사회복지사·보육교사 과정 전문`}
                    rows={7}
                  />

                  <TextAreaField
                    label="수상 이력"
                    value={
                      form.awardText
                    }
                    onChange={
                      value =>
                        setField(
                          "awardText",
                          value
                        )
                    }
                    placeholder={`예)\n2025 우수상담사\n2026 상담 실적 우수상`}
                    rows={7}
                  />
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                  <TextAreaField
                    label="자격 · 교육 이력"
                    value={
                      form.qualificationText
                    }
                    onChange={
                      value =>
                        setField(
                          "qualificationText",
                          value
                        )
                    }
                    placeholder="자격증, 관련 교육, 전문분야 등을 작성해주세요."
                    rows={7}
                  />

                  <TextAreaField
                    label="상담 스타일"
                    value={
                      form.consultationStyle
                    }
                    onChange={
                      value =>
                        setField(
                          "consultationStyle",
                          value
                        )
                    }
                    placeholder="회원에게 어떤 방식으로 상담하고 관리하는지 작성해주세요."
                    rows={7}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 연락처 */}
          <Card className="rounded-2xl">
            <CardContent className="p-5 md:p-6">
              <SectionHeader
                icon={
                  <Phone className="h-5 w-5" />
                }
                title="연락 및 상담"
                description="CRM 내부 개인정보가 아니라 고객에게 공개하기로 선택한 연락 정보만 입력합니다."
              />

              <div className="mt-6 grid gap-5 lg:grid-cols-2">
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-semibold text-slate-800">
                      공개 전화번호
                    </label>

                    <Input
                      className="mt-2 h-11"
                      value={
                        form.publicPhone
                      }
                      onChange={
                        event =>
                          setField(
                            "publicPhone",
                            normalizePhoneInput(
                              event
                                .target
                                .value
                            )
                          )
                      }
                      placeholder="010-0000-0000"
                    />
                  </div>

                  <ToggleRow
                    title="전화번호 표시"
                    description="프로필에서 공개 전화번호를 보여줍니다."
                    checked={
                      form.showPhone
                    }
                    onChange={
                      checked =>
                        setField(
                          "showPhone",
                          checked
                        )
                    }
                  />
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-semibold text-slate-800">
                      상담 연결 URL
                    </label>

                    <Input
                      className="mt-2 h-11"
                      value={
                        form.consultationUrl
                      }
                      onChange={
                        event =>
                          setField(
                            "consultationUrl",
                            event
                              .target
                              .value
                          )
                      }
                      placeholder="카카오 상담 링크 또는 상담 신청 URL"
                    />
                  </div>

                  <ToggleRow
                    title="상담 버튼 표시"
                    description="공개 프로필에 상담 연결 버튼을 표시합니다."
                    checked={
                      form.showConsultationButton
                    }
                    onChange={
                      checked =>
                        setField(
                          "showConsultationButton",
                          checked
                        )
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 공개 링크 */}
          <Card className="rounded-2xl">
            <CardContent className="p-5 md:p-6">
              <SectionHeader
                icon={
                  <Link2 className="h-5 w-5" />
                }
                title="내 공개 프로필 링크"
                description="고객에게 직접 전달하거나 카카오 AI 담당자 추천에서 사용할 고유 링크입니다."
              />

              <div className="mt-5 rounded-xl border bg-slate-50 p-4">
                <div className="break-all font-mono text-sm text-slate-700">
                  {publicProfileUrl ||
                    "공개 링크를 준비하는 중입니다."}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={
                      copyPublicLink
                    }
                    disabled={
                      !publicProfileUrl
                    }
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    링크 복사
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    disabled={
                      !publicProfileUrl
                    }
                    onClick={() => {
                      if (
                        publicProfileUrl
                      ) {
                        window.open(
                          publicProfileUrl,
                          "_blank",
                          "noopener,noreferrer"
                        );
                      }
                    }}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    미리보기
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={
                      regenerateToken
                    }
                    disabled={
                      regenerateTokenMutation.isPending
                    }
                  >
                    {regenerateTokenMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}

                    새 링크 발급
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              size="lg"
              onClick={
                saveProfile
              }
              disabled={
                updateMutation.isPending
              }
            >
              {updateMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}

              변경사항 저장
            </Button>
          </div>
        </div>

        {/* 오른쪽 실시간 미리보기 */}
        <div className="xl:sticky xl:top-5 xl:self-start">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="font-bold text-slate-900">
                프로필 미리보기
              </div>

              <div className="mt-1 text-xs text-muted-foreground">
                입력 내용이 실시간으로
                반영됩니다.
              </div>
            </div>

            <Badge
              variant={
                form.isActive
                  ? "default"
                  : "secondary"
              }
            >
              {form.isActive
                ? "공개"
                : "비공개"}
            </Badge>
          </div>

          <div className="overflow-hidden rounded-[24px] border bg-white shadow-sm">
            <div className="h-24 bg-gradient-to-br from-slate-950 via-slate-800 to-slate-700" />

            <div className="px-6 pb-6">
              <div className="-mt-12 flex items-end justify-between gap-3">
                <div className="h-24 w-24 overflow-hidden rounded-2xl border-4 border-white bg-slate-100 shadow-md">
                  {currentImage ? (
                    <img
                      src={
                        currentImage
                      }
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <UserRound className="h-10 w-10 text-slate-400" />
                    </div>
                  )}
                </div>

                {form.acceptingNewConsultations ? (
                  <Badge className="mb-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                    상담 가능
                  </Badge>
                ) : (
                  <Badge
                    variant="secondary"
                    className="mb-1"
                  >
                    상담 준비중
                  </Badge>
                )}
              </div>

              <div className="mt-4">
                {companyName ? (
                  <div className="text-xs font-medium text-muted-foreground">
                    {companyName}
                  </div>
                ) : null}

                <div className="mt-1 flex items-baseline gap-2">
                  <h3 className="text-xl font-bold text-slate-950">
                    {
                      previewName
                    }
                  </h3>

                  {previewPosition ? (
                    <span className="text-sm text-muted-foreground">
                      {
                        previewPosition
                      }
                    </span>
                  ) : null}
                </div>

                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {
                    previewHeadline
                  }
                </p>
              </div>

              {form.specialties
                .length ? (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {form.specialties
                    .slice(0, 6)
                    .map(
                      (
                        item,
                        index
                      ) => (
                        <Badge
                          key={`${item}-${index}`}
                          variant="secondary"
                          className="rounded-full"
                        >
                          {
                            item
                          }
                        </Badge>
                      )
                    )}
                </div>
              ) : null}

              <div className="my-5 h-px bg-slate-100" />

              <div className="space-y-4">
                {form.careerText.trim() ? (
                  <div className="flex gap-3">
                    <BriefcaseBusiness className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />

                    <div>
                      <div className="text-xs font-semibold text-slate-700">
                        주요 경력
                      </div>

                      <div className="mt-1 line-clamp-3 whitespace-pre-line text-xs leading-5 text-muted-foreground">
                        {
                          form.careerText
                        }
                      </div>
                    </div>
                  </div>
                ) : null}

                {form.awardText.trim() ? (
                  <div className="flex gap-3">
                    <Award className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />

                    <div>
                      <div className="text-xs font-semibold text-slate-700">
                        수상 이력
                      </div>

                      <div className="mt-1 line-clamp-3 whitespace-pre-line text-xs leading-5 text-muted-foreground">
                        {
                          form.awardText
                        }
                      </div>
                    </div>
                  </div>
                ) : null}

                {form.qualificationText.trim() ? (
                  <div className="flex gap-3">
                    <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />

                    <div>
                      <div className="text-xs font-semibold text-slate-700">
                        자격 · 교육
                      </div>

                      <div className="mt-1 line-clamp-3 whitespace-pre-line text-xs leading-5 text-muted-foreground">
                        {
                          form.qualificationText
                        }
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              {(form.showPhone &&
                form.publicPhone.trim()) ||
              (form.showConsultationButton &&
                form.consultationUrl.trim()) ? (
                <div className="mt-6 grid gap-2">
                  {form.showConsultationButton &&
                  form.consultationUrl.trim() ? (
                    <Button
                      type="button"
                      className="w-full"
                      onClick={() => {
                        window.open(
                          form.consultationUrl,
                          "_blank",
                          "noopener,noreferrer"
                        );
                      }}
                    >
                      상담하기
                    </Button>
                  ) : null}

                  {form.showPhone &&
                  form.publicPhone.trim() ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        window.location.href =
                          `tel:${form.publicPhone.replace(
                            /\D/g,
                            ""
                          )}`;
                      }}
                    >
                      <Phone className="mr-2 h-4 w-4" />
                      {
                        form.publicPhone
                      }
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-3 rounded-xl border bg-slate-50 px-4 py-3 text-xs leading-5 text-muted-foreground">
            실제 공개 상세페이지는 이후
            별도 디자인으로 제작되며, 현재
            카드는 담당자에게 보여지는 주요
            정보를 빠르게 확인하기 위한
            미리보기입니다.
          </div>
        </div>
      </div>
    </div>
  );
}