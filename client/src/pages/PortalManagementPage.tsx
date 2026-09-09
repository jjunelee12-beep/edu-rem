import {
  Check,
  Copy,
  ExternalLink,
  ImageUp,
  LayoutDashboard,
  Save,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
} from "react";

import { trpc } from "@/lib/trpc";

export default function PortalManagementPage() {
  const [copiedLink, setCopiedLink] =
    useState<"student" | "host" | null>(null);

  const [portalNameInput, setPortalNameInput] =
    useState("");

  const [companyLogoUrl, setCompanyLogoUrl] =
    useState("");

  const [isUploadingLogo, setIsUploadingLogo] =
    useState(false);

  const logoInputRef =
    useRef<HTMLInputElement | null>(null);

  const settingsQuery =
    trpc.studentPortal.settings.get.useQuery(
      undefined,
      {
        retry: false,
      }
    );

const brandingQuery =
  trpc.branding.get.useQuery(
    undefined,
    {
      retry: false,
    }
  );

const updatePortalMutation =
  trpc.studentPortal.settings.update.useMutation();

const saveBrandingMutation =
  trpc.branding.save.useMutation();

useEffect(() => {
  if (!settingsQuery.data) {
    return;
  }

  setPortalNameInput(
    String(
      settingsQuery.data.settings?.portalName ||
        "등록자 업무포탈"
    )
  );
}, [settingsQuery.data]);

useEffect(() => {
  if (!brandingQuery.data) {
    return;
  }

  setCompanyLogoUrl(
    String(
      brandingQuery.data.companyLogoUrl ||
        ""
    )
  );
}, [brandingQuery.data]);

  if (settingsQuery.isLoading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="text-sm font-medium text-slate-500">
          업무포탈 정보를 불러오고 있습니다.
        </div>
      </div>
    );
  }

  if (
    settingsQuery.isError ||
    !settingsQuery.data
  ) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <div className="font-bold text-red-700">
            업무포탈 정보를 불러오지 못했습니다.
          </div>

          <div className="mt-2 text-sm text-red-600">
            {settingsQuery.error?.message ||
              "잠시 후 다시 시도해주세요."}
          </div>

          <button
            type="button"
            onClick={() =>
              settingsQuery.refetch()
            }
            className="mt-4 rounded-xl bg-white px-4 py-2 text-sm font-bold text-red-600 shadow-sm"
          >
            다시 불러오기
          </button>
        </div>
      </div>
    );
  }

  const {
    settings,
    organizationSlug,
    portalUrl,
  } = settingsQuery.data;

  const portalName =
    String(
      settings?.portalName ||
        "등록자 업무포탈"
    ).trim();

  const hostPortalPath =
    organizationSlug
      ? `/${organizationSlug}/portal-management/community`
      : null;

  const toAbsoluteUrl = (
    value: string | null | undefined
  ) => {
    if (!value) {
      return null;
    }

    try {
      return new URL(
        value,
        window.location.origin
      ).toString();
    } catch {
      return value;
    }
  };

  const studentPortalLink =
    toAbsoluteUrl(
      portalUrl
    );

  const hostPortalLink =
    toAbsoluteUrl(
      hostPortalPath
    );

  const copyPortalLink = async (
    type: "student" | "host",
    value: string | null
  ) => {
    if (!value) {
      window.alert(
        "복사할 포탈 주소를 확인할 수 없습니다."
      );
      return;
    }

    try {
      await navigator.clipboard.writeText(
        value
      );

      setCopiedLink(
        type
      );

      window.setTimeout(
        () => {
          setCopiedLink(
            current =>
              current === type
                ? null
                : current
          );
        },
        1500
      );
    } catch {
      window.prompt(
        "아래 주소를 복사해주세요.",
        value
      );
    }
  };

const handleLogoUpload = async (
  event: React.ChangeEvent<HTMLInputElement>
) => {
  const file =
    event.target.files?.[0];

  if (!file) {
    return;
  }

  try {
    setIsUploadingLogo(true);

    const formData =
      new FormData();

    formData.append(
      "file",
      file
    );

    const response =
      await fetch(
        `${
          import.meta.env.VITE_API_BASE_URL ||
          ""
        }/api/upload`,
        {
          method: "POST",
          body: formData,
          credentials: "include",
        }
      );

    if (!response.ok) {
      throw new Error(
        "로고 업로드에 실패했습니다."
      );
    }

    const uploaded =
      await response.json();

    const uploadedUrl =
      uploaded?.fileUrl ||
      uploaded?.url ||
      "";

    if (!uploadedUrl) {
      throw new Error(
        "업로드된 로고 주소를 확인할 수 없습니다."
      );
    }

    setCompanyLogoUrl(
      uploadedUrl
    );
  } catch (error: any) {
    window.alert(
      error?.message ||
        "로고 업로드 중 오류가 발생했습니다."
    );
  } finally {
    setIsUploadingLogo(false);

    if (event.target) {
      event.target.value = "";
    }
  }
};

const handleSavePortalBranding =
  async () => {
    const nextPortalName =
      portalNameInput.trim();

    if (!nextPortalName) {
      window.alert(
        "포탈명을 입력해주세요."
      );
      return;
    }

    try {
      await updatePortalMutation.mutateAsync({
        portalName:
          nextPortalName,
      });

      const currentBranding =
        brandingQuery.data;

      await saveBrandingMutation.mutateAsync({
        companyName:
          String(
            currentBranding?.companyName ||
              "회사"
          ).trim(),

        companyLogoUrl:
          companyLogoUrl.trim() ||
          null,

        messengerSubtitle:
          String(
            currentBranding?.messengerSubtitle ||
              "사내 메신저"
          ).trim(),

        loginHeroImageUrl:
          currentBranding?.loginHeroImageUrl ||
          null,

        loginTitle:
          currentBranding?.loginTitle ||
          null,

        loginDescription:
          currentBranding?.loginDescription ||
          null,

        primaryColor:
          currentBranding?.primaryColor ||
          null,

        supportText:
          currentBranding?.supportText ||
          null,

        supportUrl:
          currentBranding?.supportUrl ||
          null,

        showPoweredByEduCanvas:
          currentBranding?.showPoweredByEduCanvas ??
          true,
      });

      await Promise.all([
        settingsQuery.refetch(),
        brandingQuery.refetch(),
      ]);

      window.alert(
        "포탈 브랜딩이 저장되었습니다."
      );
    } catch (error: any) {
      window.alert(
        error?.message ||
          "포탈 브랜딩 저장 중 오류가 발생했습니다."
      );
    }
  };

  const openStudentPortal = () => {
    if (!portalUrl) {
      window.alert(
        "등록자 포탈 주소를 확인할 수 없습니다."
      );
      return;
    }

    window.open(
      studentPortalLink || portalUrl,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const openHostPortal = () => {
    if (!hostPortalPath) {
      window.alert(
        "회사 포탈 주소를 확인할 수 없습니다."
      );
      return;
    }

    window.open(
      hostPortalLink || hostPortalPath,
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-sm font-bold text-blue-600">
            EduCanvas 업무포탈
          </div>

          <h1 className="mt-1 text-2xl font-black tracking-[-0.03em] text-slate-950">
            업무포탈 관리
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            등록회원이 이용하는 학생 포탈과
            담당자가 운영하는 Host 공용포탈을 관리합니다.
          </p>
        </div>

        <div className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-500 shadow-sm">
          <ShieldCheck size={15} className="text-emerald-500" />
          Host 전용 관리 메뉴
        </div>
      </div>

<section className="mt-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
  <div className="flex flex-col gap-5 lg:flex-row lg:items-end">
    <div className="flex-1">
      <div className="text-lg font-black text-slate-950">
        포탈 브랜딩
      </div>

      <div className="mt-1 text-sm leading-6 text-slate-500">
        등록자 업무포탈과 Host 공용포탈에
        공통으로 표시되는 포탈명과 회사 로고입니다.
      </div>

      <div className="mt-5">
        <label className="text-xs font-bold text-slate-500">
          포탈명
        </label>

        <input
          type="text"
          value={portalNameInput}
          onChange={event =>
            setPortalNameInput(
              event.target.value
            )
          }
          maxLength={150}
          placeholder="예: Educanvas"
          className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800 outline-none transition focus:border-blue-400"
        />
      </div>
    </div>

    <div className="w-full lg:w-[280px]">
      <div className="text-xs font-bold text-slate-500">
        회사 로고
      </div>

      <div className="mt-2 flex items-center gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
          {companyLogoUrl ? (
            <img
              src={companyLogoUrl}
              alt=""
              className="h-full w-full object-contain p-1"
            />
          ) : (
            <ImageUp
              size={22}
              className="text-slate-300"
            />
          )}
        </div>

        <button
          type="button"
          onClick={() =>
            logoInputRef.current?.click()
          }
          disabled={isUploadingLogo}
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
        >
          <ImageUp size={16} />

          {isUploadingLogo
            ? "업로드 중..."
            : "로고 변경"}
        </button>

        <input
          ref={logoInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleLogoUpload}
          className="hidden"
        />
      </div>
    </div>

    <button
      type="button"
      onClick={
        handleSavePortalBranding
      }
      disabled={
        updatePortalMutation.isPending ||
        saveBrandingMutation.isPending ||
        isUploadingLogo
      }
      className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-extrabold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Save size={16} />

      {updatePortalMutation.isPending ||
      saveBrandingMutation.isPending
        ? "저장 중..."
        : "브랜딩 저장"}
    </button>
  </div>
</section>

      <div className="mt-7 grid gap-4 lg:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Users size={23} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-lg font-black text-slate-950">
                  등록자 업무포탈
                </div>

                <div className="mt-1 text-sm leading-6 text-slate-500">
                  등록회원이 로그인해서 커뮤니티,
                  공지, 자료를 확인하는 모바일 중심 포탈입니다.
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-xl bg-slate-50 px-4 py-4">
              <div className="text-xs font-bold text-slate-400">
                등록자 접속 링크
              </div>

              <div className="mt-1 text-sm font-extrabold text-slate-800">
                {portalName}
              </div>

              <div className="mt-3 break-all rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold leading-5 text-slate-600">
                {studentPortalLink ||
                  "등록자 포탈 주소를 확인할 수 없습니다."}
              </div>

              <div className="mt-2 text-[11px] leading-5 text-slate-400">
                등록회원에게 전달하는 회원 전용 접속 주소입니다.
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  copyPortalLink(
                    "student",
                    studentPortalLink
                  )
                }
                disabled={!studentPortalLink}
                className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {copiedLink === "student" ? (
                  <>
                    <Check
                      size={16}
                      className="text-emerald-500"
                    />
                    복사 완료
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    링크 복사
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={openStudentPortal}
                disabled={!portalUrl}
                className="flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-extrabold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                포탈 열기
                <ExternalLink size={16} />
              </button>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white">
                <LayoutDashboard size={23} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-lg font-black text-slate-950">
                  Host 공용포탈
                </div>

                <div className="mt-1 text-sm leading-6 text-slate-500">
                  담당자가 PC에서 등록자 커뮤니티를
                  확인하고 글·공지·댓글을 운영하는 화면입니다.
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="text-xs font-bold text-slate-400">
                Host 접속 링크
              </div>

              <div className="mt-3 break-all rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold leading-5 text-slate-600">
                {hostPortalLink ||
                  "Host 포탈 주소를 확인할 수 없습니다."}
              </div>

              <div className="mt-2 text-[11px] leading-5 text-slate-400">
                CRM Host 로그인 계정 전용 주소입니다.
                회사 organizationId는 서버에서 자동 확정합니다.
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  copyPortalLink(
                    "host",
                    hostPortalLink
                  )
                }
                disabled={!hostPortalLink}
                className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {copiedLink === "host" ? (
                  <>
                    <Check
                      size={16}
                      className="text-emerald-500"
                    />
                    복사 완료
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    링크 복사
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={openHostPortal}
                disabled={!hostPortalPath}
                className="flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-extrabold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                포탈 열기
                <ExternalLink size={16} />
              </button>
            </div>
          </div>
        </section>
      </div>

      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-sm font-black text-slate-900">
          운영 구조
        </div>

        <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-4">
            <div className="font-extrabold text-slate-800">
              1. 학생
            </div>
            <div className="mt-1 leading-6 text-slate-500">
              등록자 포탈에서 게시글과 댓글을 이용합니다.
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-4">
            <div className="font-extrabold text-slate-800">
              2. Host
            </div>
            <div className="mt-1 leading-6 text-slate-500">
              공용포탈에서 공지와 게시글을 운영합니다.
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-4">
            <div className="font-extrabold text-slate-800">
              3. 동일 DB
            </div>
            <div className="mt-1 leading-6 text-slate-500">
              두 화면은 같은 커뮤니티 데이터만 공유합니다.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
