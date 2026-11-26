
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  GraduationCap,
  Search,
  CheckCircle2,
  Loader2,
  LockKeyhole,
  AlertCircle,
  X,
} from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  portalToken: string;
  onPortalLogin: (token: string) => void;
  getDeviceToken: () => string;
};

const POSTER =
  "/images/employment-center/private-certificate-courses.png";

const formatMoney = (value: number) =>
  value.toLocaleString("ko-KR") + "원";

export default function PrivateCertificateSupportDialog({
  open,
  onOpenChange,
  portalToken,
  onPortalLogin,
  getDeviceToken,
}: Props) {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [address, setAddress] = useState("");
  const [detailAddress, setDetailAddress] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");

const [loginName, setLoginName] = useState("");
const [loginPhone, setLoginPhone] = useState("");
const [loginError, setLoginError] = useState("");

const loginMutation =
  trpc.studentPortal.login.useMutation();

const submitLogin = async (
  e: React.FormEvent
) => {
  e.preventDefault();

  if (loginMutation.isPending) return;

  setLoginError("");

  const digits = loginPhone.replace(/\D/g, "");

  if (
    loginName.trim().length < 2 ||
    digits.length < 10 ||
    digits.length > 11
  ) {
    setLoginError(
      "이름과 휴대폰 번호를 확인해주세요."
    );
    return;
  }

  try {
    const res = await loginMutation.mutateAsync({
      slug: "with-one",
      clientName: loginName.trim(),
      phone: digits,
      deviceToken: getDeviceToken(),
    });

    if (!res.success || !res.token) {
      setLoginError(
        "등록회원 정보를 확인하지 못했습니다."
      );
      return;
    }

    onPortalLogin(res.token);

    setLoginName("");
    setLoginPhone("");
    setLoginError("");

  } catch (err) {
    setLoginError(
      err instanceof Error
        ? err.message
        : "로그인 중 오류가 발생했습니다."
    );
  }
};

  const [completed, setCompleted] = useState<{
    count: number;
    totalFeeAmount: number;
  } | null>(null);

  const mastersQuery =
    trpc.privateCertificate.portalMasters.useQuery(
      { token: portalToken },
      {
        enabled: open && Boolean(portalToken),
        retry: false,
        refetchOnWindowFocus: false,
      }
    );

  const applyMutation =
    trpc.privateCertificate.portalApply.useMutation();

  const student = mastersQuery.data?.student;
  const masters = mastersQuery.data?.masters ?? [];

  useEffect(() => {
  if (!open) {
    setSearch("");
    setSelectedIds([]);
    setAddress("");
    setDetailAddress("");
    setAgreed(false);
    setError("");
    setCompleted(null);

    setLoginName("");
    setLoginPhone("");
    setLoginError("");
  }
}, [open]);

  useEffect(() => {
    if (open && student) {
      setAddress(student.address || "");
    }
  }, [open, student?.address, student?.clientName, portalToken]);

  useEffect(() => {
    setSelectedIds([]);
    setAgreed(false);
    setDetailAddress("");
    setCompleted(null);
    setError("");
  }, [portalToken]);

  const filteredMasters = masters.filter(master =>
    master.name
      .toLowerCase()
      .includes(search.trim().toLowerCase())
  );

  const selectedMasters = masters.filter(
    master =>
      selectedIds.includes(master.id) &&
      !master.alreadyRequested
  );

  const totalFeeAmount = selectedMasters.reduce(
    (sum, master) => sum + master.feeAmount,
    0
  );

  const submitting = applyMutation.isPending;

  function toggleCertificate(id: number) {
    const master = masters.find(item => item.id === id);

    if (!master || master.alreadyRequested || submitting) {
      return;
    }

    setError("");
    setAgreed(false);

    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.filter(value => value !== id)
        : prev.length < 50
          ? [...prev, id]
          : prev
    );
  }

  async function submitApplication() {
    setError("");

    if (submitting || !student || !portalToken) {
      return;
    }

    if (!selectedMasters.length) {
      setError("희망 자격증을 선택해주세요.");
      return;
    }

    if (!address.trim()) {
      setError("자격증을 수령할 주소를 입력해주세요.");
      return;
    }

    if (!agreed) {
      setError("신청 내용과 발급비를 확인해주세요.");
      return;
    }

    try {
      const result = await applyMutation.mutateAsync({
        token: portalToken,
        certificateMasterIds: selectedMasters.map(
          master => master.id
        ),
        inputAddress: address.trim(),
        detailAddress: detailAddress.trim(),
        agreed: true,
      });

      setCompleted({
        count: result.count,
        totalFeeAmount: result.totalFeeAmount,
      });

      setSelectedIds([]);
      setAgreed(false);

      void mastersQuery.refetch();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "신청 중 오류가 발생했습니다."
      );

      void mastersQuery.refetch();
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={nextOpen => {
        if (!submitting) {
          onOpenChange(nextOpen);
        }
      }}
    >
      <DialogContent
  className="!flex max-h-[92dvh] w-[calc(100%_-_24px)] max-w-[520px] flex-col !gap-0 overflow-hidden rounded-[24px] border-0 !bg-white !p-0 !text-slate-900"
  style={{
    backgroundColor: "#ffffff",
    color: "#0f172a",
    colorScheme: "light",
  }}
        onEscapeKeyDown={event => {
          if (submitting) event.preventDefault();
        }}
        onInteractOutside={event => {
          if (submitting) event.preventDefault();
        }}
      >
        <DialogHeader className="shrink-0 border-b border-slate-100 bg-white px-5 py-4 pr-12 text-left">
          <DialogTitle className="text-[17px] font-black text-slate-900">
            취업 연계 자격증 지원
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            사회복지통합지원센터 등록자 전용 서비스
          </DialogDescription>
        </DialogHeader>

        {completed ? (
          <div className="overflow-y-auto px-6 py-10 text-center">
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50">
              <CheckCircle2
                size={42}
                className="text-emerald-600"
              />
            </div>

            <h3 className="text-xl font-black">
              신청이 완료되었습니다!
            </h3>

            <p className="mt-3 text-sm leading-relaxed text-slate-500">
              신청하신 자격증 정보가 담당자에게
              전달될 수 있도록 관리센터에 등록되었습니다.
              진행 방법은 담당자 안내를 확인해주세요.
            </p>

            <div className="mt-6 space-y-3 rounded-2xl bg-slate-50 p-5 text-left">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">
                  신청 자격증
                </span>
                <strong>{completed.count}개</strong>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-slate-500">
                  신청 상태
                </span>
                <strong className="text-blue-700">
                  접수 완료
                </strong>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-slate-500">
                  결제 상태
                </span>
                <strong className="text-amber-600">
                  결제대기
                </strong>
              </div>

              <div className="flex justify-between border-t border-slate-200 pt-3">
                <span className="text-sm text-slate-500">
                  총 발급비
                </span>
                <strong className="text-lg text-blue-700">
                  {formatMoney(completed.totalFeeAmount)}
                </strong>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="mt-6 w-full rounded-xl bg-[#15365f] py-3.5 text-sm font-bold text-white"
            >
              확인
            </button>
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-4 py-5 sm:px-5">
              {/* 상단 안내 */}
              <div className="overflow-hidden rounded-[20px] bg-gradient-to-br from-[#102746] to-[#234d7d] p-5 text-white">
                <div className="mb-3 flex items-center gap-2 text-xs font-bold text-[#e8ca91]">
                  <GraduationCap size={17} />
                  등록자 전용 지원 혜택
                </div>

                <h3 className="text-[23px] font-black leading-tight text-white">
                  사회복지사 2급과 함께
                  <br />
                  취업 역량을 준비하세요
                </h3>

                <p className="mt-3 text-xs leading-relaxed text-blue-100">
                  관심 있는 민간자격과정을 선택하여
                  추가적인 직무 역량을 준비할 수 있습니다.
                </p>

                <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/20 pt-4">
                  <div>
                    <p className="text-xs text-blue-100">
                      교육비
                    </p>
                    <p className="mt-1 text-2xl font-black text-white">
                      무료
                    </p>
                  </div>

                  <div className="border-l border-white/20 pl-4">
                    <p className="text-xs text-blue-100">
                      자격증 발급비 (개당)
                    </p>
                    <p className="mt-1 text-2xl font-black text-[#f0d398]">
                      88,000원
                    </p>
                  </div>
                </div>
              </div>

              {/* 기존 자격과정 포스터 */}
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <img
                  src={POSTER}
                  alt="정식 등록 민간자격과정 안내"
                  className="block h-auto w-full object-contain"
                  loading="lazy"
                />
              </div>

              <p className="-mt-3 text-[11px] leading-relaxed text-slate-500">
                실제 신청 가능한 과정은 아래 자격증
                목록에서 확인하실 수 있습니다.
                민간자격증은 국가자격증과 다르며
                취업을 보장하지 않습니다.
              </p>

             {!portalToken ? (
  <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">

    <LockKeyhole
      size={28}
      className="mx-auto mb-3 text-blue-700"
    />

    <h4 className="text-center text-base font-black text-slate-900">
      등록자 전용 서비스입니다
    </h4>

    <p className="mt-2 text-center text-xs leading-relaxed text-slate-600">
      등록하신 이름과 연락처로 로그인하시면
      자격증을 신청하실 수 있습니다.
    </p>

    <form
      onSubmit={submitLogin}
      className="mt-5 space-y-3"
    >
      <div>
        <label className="mb-1.5 block text-xs font-bold text-slate-700">
          이름
        </label>

        <input
          value={loginName}
          onChange={e => setLoginName(e.target.value)}
          placeholder="이름을 입력해주세요"
          autoComplete="name"
          className="h-12 w-full rounded-xl border border-slate-200 !bg-white px-4 text-sm !text-slate-900 outline-none focus:border-blue-500"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-bold text-slate-700">
          연락처
        </label>

        <input
          type="tel"
          value={loginPhone}
          onChange={e => setLoginPhone(e.target.value)}
          placeholder="010-0000-0000"
          autoComplete="tel"
          className="h-12 w-full rounded-xl border border-slate-200 !bg-white px-4 text-sm !text-slate-900 outline-none focus:border-blue-500"
        />
      </div>

           {loginError && (
        <p
          role="alert"
          className="text-center text-xs font-medium text-red-600"
        >
          {loginError}
        </p>
      )}

      <button
        type="submit"
        disabled={loginMutation.isPending}
        className="h-12 w-full rounded-xl text-sm font-bold disabled:opacity-50"
        style={{
          backgroundColor: "#15365f",
          color: "#ffffff",
        }}
      >
        {loginMutation.isPending
          ? "등록자 확인 중..."
          : "등록회원 로그인"}
      </button>
    </form>
  </div>
) : mastersQuery.isLoading ? (
  <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white py-10">
    <Loader2
      size={28}
      className="animate-spin text-blue-700"
    />

    <p className="text-sm font-bold text-slate-700">
      등록자 정보를 확인하고 있습니다.
    </p>

    <p className="text-xs text-slate-500">
      잠시만 기다려주세요.
    </p>
  </div>
) : mastersQuery.isError ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex gap-2 text-sm font-bold text-amber-800">
                    <AlertCircle
                      size={18}
                      className="shrink-0"
                    />
                    {mastersQuery.error.message}
                  </div>

                  <button
                    type="button"
                    onClick={() => mastersQuery.refetch()}
                    className="mt-2 w-full py-2 text-xs font-bold text-slate-600"
                  >
                    다시 확인하기
                  </button>
                </div>
              ) : student ? (
                <>
                  {/* 신청자 정보 */}
                  <section>
                    <h4 className="mb-3 text-[15px] font-black">
                      신청자 정보
                    </h4>

                    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      {[
                        ["이름", student.clientName],
                        ["연락처", student.phone],
                        ["담당자", student.assigneeName],
                      ].map(([label, value]) => (
                        <div
                          key={label}
                          className="flex items-center justify-between gap-3 text-sm"
                        >
                          <span className="shrink-0 text-slate-500">
                            {label}
                          </span>
                          <strong className="break-all text-right text-slate-900">
                            {value || "-"}
                          </strong>
                        </div>
                      ))}
                    </div>

                    <p className="mt-2 text-[11px] text-slate-500">
                      학사관리시스템 등록 정보가 자동으로
                      반영됩니다.
                    </p>
                  </section>

                  {/* 자격증 마스터 연동 */}
                  <section>
                    <div className="mb-3 flex items-center justify-between">
                      <h4 className="text-[15px] font-black">
                        희망 자격증 선택
                      </h4>
                      <span className="text-xs font-bold text-blue-700">
                        {selectedMasters.length}개 선택
                      </span>
                    </div>

                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
                      <Search
                        size={17}
                        className="text-slate-400"
                      />
                      <input
                        value={search}
                        onChange={event =>
                          setSearch(event.target.value)
                        }
                        placeholder="자격증명 검색"
                        className="min-w-0 flex-1 bg-transparent py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                      />
                    </div>

                    <div className="mt-3 max-h-[300px] divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
                      {filteredMasters.length === 0 ? (
                        <p className="p-6 text-center text-xs text-slate-500">
                          {masters.length
                            ? "검색 결과가 없습니다."
                            : "현재 신청 가능한 자격증이 없습니다."}
                        </p>
                      ) : (
                        filteredMasters.map(master => (
                          <label
                            key={master.id}
                            className={`flex items-center gap-3 p-3.5 ${
                              master.alreadyRequested
                                ? "bg-slate-50 opacity-60"
                                : "cursor-pointer hover:bg-blue-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(
                                master.id
                              )}
                              disabled={
                                master.alreadyRequested ||
                                submitting
                              }
                              onChange={() =>
                                toggleCertificate(master.id)
                              }
                              className="h-4 w-4 shrink-0 accent-blue-700"
                            />

                            <span className="min-w-0 flex-1 text-sm font-bold text-slate-800">
                              {master.name}
                            </span>

                            <span className="shrink-0 text-xs font-medium text-slate-500">
                              {master.alreadyRequested
                                ? "신청완료"
                                : formatMoney(master.feeAmount)}
                            </span>
                          </label>
                        ))
                      )}
                    </div>

                    {selectedMasters.length > 0 && (
                      <div className="mt-3 rounded-xl bg-blue-50 p-3">
                        <p className="mb-2 text-xs font-bold text-blue-800">
                          선택한 자격증
                        </p>

                        <div className="flex flex-wrap gap-2">
                          {selectedMasters.map(master => (
                            <button
                              key={master.id}
                              type="button"
                              disabled={submitting}
                              onClick={() =>
                                toggleCertificate(master.id)
                              }
                              className="flex items-center gap-1.5 rounded-lg border border-blue-100 bg-white px-2.5 py-2 text-xs font-bold text-blue-800"
                            >
                              {master.name}
                              <X size={13} />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>

                  {/* 수령 주소 */}
                  <section>
                    <h4 className="mb-3 text-[15px] font-black">
                      자격증 수령 주소
                    </h4>

                    <div className="space-y-2">
                      <input
                        value={address}
                        maxLength={500}
                        disabled={submitting}
                        onChange={event => {
                          setAddress(event.target.value);
                          setAgreed(false);
                        }}
                        placeholder="기본 주소를 입력해주세요."
                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none focus:border-blue-500"
                      />

                      <input
                        value={detailAddress}
                        maxLength={500}
                        disabled={submitting}
                        onChange={event => {
                          setDetailAddress(event.target.value);
                          setAgreed(false);
                        }}
                        placeholder="상세 주소 (동, 호수 등)"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none focus:border-blue-500"
                      />
                    </div>

                    <p className="mt-2 text-[11px] text-slate-500">
                      실제 자격증을 수령하실 주소인지
                      확인해주세요.
                    </p>
                  </section>

                  {/* 신청 확인 */}
                  <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <h4 className="mb-2 text-sm font-black">
                      신청 전 확인사항
                    </h4>

                    <div className="space-y-1.5 text-xs leading-relaxed text-slate-600">
                      <p>· 교육비는 무료입니다.</p>
                      <p>· 자격증 발급비는 개당 88,000원입니다.</p>
                      <p>· 신청 시 자동 결제되지 않습니다.</p>
                      <p>· 신청 정보는 자격증 신청 관리에 사용됩니다.</p>
                      <p>· 세부 진행 및 발급 절차는 담당자 안내를 확인해주세요.</p>
                    </div>

                    <label className="mt-4 flex cursor-pointer items-start gap-2 border-t border-slate-200 pt-3">
                      <input
                        type="checkbox"
                        checked={agreed}
                        disabled={submitting}
                        onChange={event =>
                          setAgreed(event.target.checked)
                        }
                        className="mt-0.5 h-4 w-4 shrink-0 accent-blue-700"
                      />

                      <span className="text-xs font-bold leading-relaxed text-slate-800">
                        신청 내용과 발급비를 확인했으며,
                        신청 정보가 관리센터에 등록되는 것에
                        동의합니다.
                      </span>
                    </label>
                  </section>

                  {error && (
                    <div
                      role="alert"
                      className="rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700"
                    >
                      {error}
                    </div>
                  )}
                </>
              ) : null}
            </div>

            {/* 하단 고정 신청 영역 */}
            {student && !mastersQuery.isError && (
              <div className="shrink-0 border-t border-slate-200 bg-white px-5 pb-5 pt-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500">
                      총 자격증 발급비
                    </p>
                    <p className="mt-1 text-xs font-bold text-slate-700">
                      {selectedMasters.length}개 선택
                    </p>
                  </div>

                  <strong className="text-[23px] font-black text-blue-700">
                    {formatMoney(totalFeeAmount)}
                  </strong>
                </div>

                <button
                  type="button"
                  disabled={
                    submitting ||
                    !selectedMasters.length ||
                    !address.trim() ||
                    !agreed
                  }
                  onClick={submitApplication}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#15365f] py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#204c80] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                >
                  {submitting ? (
                    <>
                      <Loader2
                        size={17}
                        className="animate-spin"
                      />
                      신청 중입니다...
                    </>
                  ) : (
                    "자격증 신청하기"
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
