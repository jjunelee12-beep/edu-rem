import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import SaasAdminGuard from "@/components/saas/SaasAdminGuard";

const STATUS_OPTIONS = [
  { value: "all", label: "전체" },
  { value: "new", label: "신규" },
  { value: "contacted", label: "연락완료" },
  { value: "qualified", label: "검토중" },
  { value: "closed", label: "종료" },
  { value: "spam", label: "스팸" },
] as const;

const INQUIRY_TYPE_LABEL: Record<string, string> = {
  beta: "베타 신청",
  demo: "데모 문의",
  pricing: "요금 문의",
  contact: "일반 문의",
};

function formatDate(value: any) {
  if (!value) return "-";

  try {
    return new Date(value).toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul",
    });
  } catch {
    return String(value);
  }
}

export default function SaasInquiriesPage() {
  const [status, setStatus] =
    useState<(typeof STATUS_OPTIONS)[number]["value"]>("all");

  const [editingMemoId, setEditingMemoId] = useState<number | null>(null);
  const [memoDraft, setMemoDraft] = useState("");

  const utils = trpc.useUtils();

  const inquiriesQuery = trpc.saas.listSaasInquiries.useQuery({
    status,
  });

  const updateMutation = trpc.saas.updateSaasInquiry.useMutation({
    onSuccess: async () => {
      await utils.saas.listSaasInquiries.invalidate();
      setEditingMemoId(null);
      setMemoDraft("");
    },
  });

  const inquiries = inquiriesQuery.data || [];

  const summary = useMemo(() => {
    const result = {
      total: inquiries.length,
      new: 0,
      contacted: 0,
      qualified: 0,
      closed: 0,
      spam: 0,
    };

    for (const item of inquiries as any[]) {
      const key = String(item.status || "new") as keyof typeof result;
      if (key in result && key !== "total") {
        result[key] += 1;
      }
    }

    return result;
  }, [inquiries]);

  return (
  <SaasAdminGuard>
    <div className="space-y-6 p-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-bold text-slate-400">Superhost</p>
          <h1 className="text-2xl font-extrabold text-slate-900">
            SaaS 문의 관리
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            홈페이지 베타 신청/문의 데이터를 고객사 상담DB와 완전 분리해서 관리합니다.
          </p>
        </div>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as any)}
          className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        <SummaryCard title="전체" value={summary.total} />
        <SummaryCard title="신규" value={summary.new} />
        <SummaryCard title="연락완료" value={summary.contacted} />
        <SummaryCard title="검토중" value={summary.qualified} />
        <SummaryCard title="종료/스팸" value={summary.closed + summary.spam} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-extrabold">문의 목록</h2>
        </div>

        {inquiriesQuery.isLoading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            불러오는 중...
          </div>
        ) : inquiries.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            문의가 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold text-slate-500">
                <tr>
                  <th className="px-4 py-3">접수일</th>
                  <th className="px-4 py-3">유형</th>
                  <th className="px-4 py-3">상태</th>
                  <th className="px-4 py-3">회사/담당자</th>
                  <th className="px-4 py-3">연락처</th>
                  <th className="px-4 py-3">문의내용</th>
                  <th className="px-4 py-3">메모</th>
                  <th className="px-4 py-3">관리</th>
                </tr>
              </thead>

              <tbody>
                {(inquiries as any[]).map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="whitespace-nowrap px-4 py-4 text-slate-600">
                      {formatDate(item.createdAt)}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4">
                      {INQUIRY_TYPE_LABEL[item.inquiryType] ||
                        item.inquiryType ||
                        "-"}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4">
                      <select
                        value={item.status || "new"}
                        onChange={(e) =>
                          updateMutation.mutate({
                            id: Number(item.id),
                            status: e.target.value as any,
                          })
                        }
                        className="rounded-xl border border-slate-300 bg-white px-2 py-2 text-xs font-bold"
                        disabled={updateMutation.isPending}
                      >
                        {STATUS_OPTIONS.filter((option) => option.value !== "all").map(
                          (option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          )
                        )}
                      </select>
                    </td>

                    <td className="px-4 py-4">
                      <div className="font-extrabold text-slate-900">
                        {item.companyName || "-"}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {item.clientName || "-"}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        {item.businessType || "-"}
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-4 py-4">
                      <div className="font-bold">{item.phone || "-"}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {item.email || "-"}
                      </div>
                    </td>

                    <td className="max-w-[260px] px-4 py-4">
                      <pre className="whitespace-pre-wrap break-words font-sans text-xs leading-5 text-slate-600">
                        {item.message || "-"}
                      </pre>
                      <div className="mt-2 text-[11px] text-slate-400">
                        {item.source || "homepage"} · {item.pagePath || "-"}
                      </div>
                    </td>

                    <td className="max-w-[260px] px-4 py-4">
                      {editingMemoId === Number(item.id) ? (
                        <textarea
                          value={memoDraft}
                          onChange={(e) => setMemoDraft(e.target.value)}
                          className="min-h-[90px] w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                          placeholder="내부 메모"
                        />
                      ) : (
                        <pre className="whitespace-pre-wrap break-words font-sans text-xs leading-5 text-slate-600">
                          {item.memo || "-"}
                        </pre>
                      )}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4">
                      {editingMemoId === Number(item.id) ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              updateMutation.mutate({
                                id: Number(item.id),
                                memo: memoDraft,
                              })
                            }
                            disabled={updateMutation.isPending}
                            className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                          >
                            저장
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMemoId(null);
                              setMemoDraft("");
                            }}
                            className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold"
                          >
                            취소
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingMemoId(Number(item.id));
                            setMemoDraft(item.memo || "");
                          }}
                          className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold"
                        >
                          메모
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
        </div>
  </SaasAdminGuard>
);
}

function SummaryCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold text-slate-400">{title}</p>
      <p className="mt-2 text-2xl font-extrabold text-slate-900">{value}</p>
    </div>
  );
}