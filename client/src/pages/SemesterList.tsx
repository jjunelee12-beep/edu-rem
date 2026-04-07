import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Search, Calendar } from "lucide-react";
import { useLocation } from "wouter";
import { formatPhone } from "@/lib/format";
import { toast } from "sonner";
import { getSocket } from "@/lib/socket";

function formatCurrency(amount: number | string | null | undefined) {
  if (!amount) return "-";
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (isNaN(n) || n === 0) return "-";
  return new Intl.NumberFormat("ko-KR").format(n) + "원";
}

function getMonthOptions() {
  const options: string[] = [];
  const now = new Date();

  for (let i = -6; i <= 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    options.push(val);
  }

  return options;
}

function getCurrentMonthKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export default function SemesterList() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const [plannedMonth, setPlannedMonth] = useState(getCurrentMonthKey());
  const [searchTerm, setSearchTerm] = useState("");
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [filterUnassignedPractice, setFilterUnassignedPractice] = useState(false);
  const [filterPaymentPlanned, setFilterPaymentPlanned] = useState(false);
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<string>("all");
  const [filterSemesterOrder, setFilterSemesterOrder] = useState<string>("all");

  const { data: allUsers } = trpc.users.list.useQuery();
  const { data: semesters, isLoading } = trpc.semester.listAll.useQuery({
    plannedMonth: plannedMonth || undefined,
  });

  const isAdmin = user?.role === "admin" || user?.role === "host";

  const userMap = useMemo(
    () => new Map(allUsers?.map((u: any) => [u.id, u.name || "이름없음"]) ?? []),
    [allUsers]
  );

  const monthOptions = useMemo(() => getMonthOptions(), []);

  const filtered = useMemo(() => {
    const rows = semesters ? [...semesters] : [];
    const term = searchTerm.trim().toLowerCase();
    const assigneeTerm = assigneeSearch.trim().toLowerCase();

    return rows.filter((s: any) => {
      if (filterUnassignedPractice && s.practiceStatus !== "미섭외") return false;

      if (
        filterPaymentPlanned &&
        filterPaymentStatus === "all" &&
        (s.isCompleted || s.actualPaymentDate)
      ) {
        return false;
      }

      if (
        filterSemesterOrder !== "all" &&
        String(s.semesterOrder) !== String(filterSemesterOrder)
      ) {
        return false;
      }

      if (filterPaymentStatus === "unpaid" && (s.isCompleted || s.actualPaymentDate)) {
        return false;
      }

      if (filterPaymentStatus === "progress" && (!s.actualPaymentDate || s.isCompleted)) {
        return false;
      }

      if (filterPaymentStatus === "done" && !s.isCompleted) {
        return false;
      }

      // 승인 완료 학생만 표시
      if (s.approvalStatus !== "승인") return false;

      const assigneeName = (userMap.get(s.assigneeId) || "").toLowerCase();

      const matchesSearch =
        !term ||
        s.clientName?.toLowerCase().includes(term) ||
        s.phone?.includes(term) ||
        s.course?.toLowerCase().includes(term) ||
        s.plannedInstitution?.toLowerCase().includes(term) ||
        s.actualInstitution?.toLowerCase().includes(term);

      const matchesAssignee = !assigneeTerm || assigneeName.includes(assigneeTerm);

      return matchesSearch && matchesAssignee;
    });
  }, [
    semesters,
    searchTerm,
    assigneeSearch,
    filterUnassignedPractice,
    filterPaymentPlanned,
    filterSemesterOrder,
    filterPaymentStatus,
    userMap,
  ]);

  const unpaidList = useMemo(() => {
    return filtered.filter((s: any) => !s.isCompleted && !s.actualPaymentDate);
  }, [filtered]);

  const unpaidGroupedByAssignee = useMemo(() => {
    const map = new Map<
      number,
      {
        assigneeId: number;
        assigneeName: string;
        count: number;
        students: any[];
      }
    >();

    unpaidList.forEach((row: any) => {
      const assigneeId = Number(row.assigneeId || 0);
      const assigneeName = userMap.get(assigneeId) || "미지정";

      if (!map.has(assigneeId)) {
        map.set(assigneeId, {
          assigneeId,
          assigneeName,
          count: 0,
          students: [],
        });
      }

      const current = map.get(assigneeId)!;
      current.count += 1;
      current.students.push(row);
    });

    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [unpaidList, userMap]);

  const statusBadge = (sem: any) => {
    if (sem.isCompleted) {
      return (
        <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">
          결제완료
        </Badge>
      );
    }

    if (sem.actualPaymentDate) {
      return (
        <Badge className="bg-blue-100 text-blue-700 text-[10px]">
          결제등록
        </Badge>
      );
    }

    return (
      <Badge className="bg-amber-100 text-amber-700 text-[10px]">
        미결제
      </Badge>
    );
  };

  const totalPlanned = useMemo(() => {
    return filtered.reduce((sum: number, s: any) => sum + Number(s.plannedAmount || 0), 0);
  }, [filtered]);

  const totalCompleted = useMemo(() => {
    return filtered.reduce(
      (sum: number, s: any) => sum + (s.isCompleted ? Number(s.actualAmount || 0) : 0),
      0
    );
  }, [filtered]);

  const totalApprovedRefund = useMemo(() => {
    const refundMap = new Map<number, number>();

    filtered.forEach((s: any) => {
      const studentId = Number(s.studentId);
      const refundAmount = Number(s.approvedRefundAmount || 0);

      if (!refundMap.has(studentId)) {
        refundMap.set(studentId, refundAmount);
      }
    });

    return Array.from(refundMap.values()).reduce((sum, v) => sum + v, 0);
  }, [filtered]);

  const totalNetPaid = useMemo(() => {
    return Math.max(totalCompleted - totalApprovedRefund, 0);
  }, [totalCompleted, totalApprovedRefund]);

  const copyUnpaidList = async () => {
    if (!unpaidList.length) {
      toast.error("현재 조건에서 미결제 대상자가 없습니다.");
      return;
    }

    const text = unpaidList
      .map(
        (s: any) =>
          [
            `${s.clientName || "-"}`,
            `${formatPhone(s.phone) || "-"}`,
            `${s.semesterOrder || "-"}학기`,
            `${s.plannedMonth || "-"}`,
            `${s.course || "-"}`,
            `${userMap.get(s.assigneeId) || "-"}`,
          ].join(" / ")
      )
      .join("\n");

    try {
      await navigator.clipboard.writeText(text);
      toast.success(`미결제 ${unpaidList.length}건이 클립보드에 복사되었습니다.`);
    } catch {
      toast.error("복사에 실패했습니다.");
    }
  };

  const sendPaymentReminder = () => {
    if (!unpaidList.length) {
      toast.error("현재 조건에서 미결제 대상자가 없습니다.");
      return;
    }

    const ok = window.confirm(
      `현재 조건의 미결제 ${unpaidList.length}건에 대해 알림 전송 요청을 보냅니다. 계속하시겠습니까?`
    );
    if (!ok) return;

    try {
      const socket = getSocket();
      socket.emit("payment:reminder", {
        studentIds: unpaidList.map((s: any) => Number(s.studentId)),
        plannedMonth,
        semesterOrder:
          filterSemesterOrder === "all" ? null : Number(filterSemesterOrder),
      });

      toast.success(`미결제 ${unpaidList.length}건 알림 전송 요청 완료`);
    } catch (e: any) {
      toast.error(e?.message || "알림 전송 요청 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">학기별 예정표</h1>
        <p className="text-sm text-muted-foreground mt-1">
          승인 완료된 학생의 학기별 예정/결제 리스트입니다. 예정개강월 기준으로 2학기, 3학기 등 기존담 대상자를 확인하고, 누가 결제완료/결제등록/미결제 상태인지 구분할 수 있습니다.
        </p>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
        이 화면은 승인 완료된 학생만 표시됩니다. 미결제 대상자 자동 추출과 알림 전송은 현재 필터 조건 기준으로 동작합니다.
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <select
            className="text-sm border rounded px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-primary"
            value={plannedMonth}
            onChange={(e) => setPlannedMonth(e.target.value)}
          >
            <option value="">전체 기간</option>
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="relative max-w-sm flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="학생명, 연락처, 과정, 교육원 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        {isAdmin && (
          <Input
            placeholder="담당자 검색"
            value={assigneeSearch}
            onChange={(e) => setAssigneeSearch(e.target.value)}
            className="w-[180px] h-9"
          />
        )}
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={filterUnassignedPractice}
            onChange={(e) => setFilterUnassignedPractice(e.target.checked)}
          />
          미실습 섭외만
        </label>

        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={filterPaymentPlanned}
            onChange={(e) => setFilterPaymentPlanned(e.target.checked)}
          />
          결제 예정만
        </label>

        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">학기:</label>
          <select
            className="text-sm border rounded px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-primary"
            value={filterSemesterOrder}
            onChange={(e) => setFilterSemesterOrder(e.target.value)}
          >
            <option value="all">전체 학기</option>
            <option value="1">1학기</option>
            <option value="2">2학기</option>
            <option value="3">3학기</option>
            <option value="4">4학기</option>
            <option value="5">5학기</option>
            <option value="6">6학기</option>
            <option value="7">7학기</option>
            <option value="8">8학기</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">결제상태:</label>
          <select
            className="text-sm border rounded px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-primary"
            value={filterPaymentStatus}
            onChange={(e) => setFilterPaymentStatus(e.target.value)}
          >
            <option value="all">전체</option>
            <option value="unpaid">미결제</option>
            <option value="progress">결제등록</option>
            <option value="done">결제완료</option>
          </select>
        </div>

        <button
          type="button"
          className="px-3 py-1.5 text-sm rounded bg-slate-900 text-white hover:bg-slate-800"
          onClick={copyUnpaidList}
        >
          미결제 리스트 복사 ({unpaidList.length})
        </button>

        <button
          type="button"
          className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
          onClick={sendPaymentReminder}
        >
          미결제 알림 보내기
        </button>
      </div>

      {!!unpaidGroupedByAssignee.length && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {unpaidGroupedByAssignee.map((group) => (
            <Card key={group.assigneeId} className="border-0 shadow-sm">
              <CardContent className="pt-4 pb-3 px-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{group.assigneeName}</p>
                  <Badge className="bg-red-100 text-red-700">
                    미결제 {group.count}건
                  </Badge>
                </div>

                <div className="space-y-1">
                  {group.students.slice(0, 5).map((s: any) => (
                    <div
                      key={s.id}
                      className="text-xs text-muted-foreground flex items-center justify-between gap-2"
                    >
                      <span className="truncate">
                        {s.clientName} / {s.semesterOrder}학기
                      </span>
                      <span>{formatPhone(s.phone) || "-"}</span>
                    </div>
                  ))}

                  {group.students.length > 5 && (
                    <div className="text-xs text-muted-foreground">
                      외 {group.students.length - 5}건
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">총 건수</p>
            <p className="text-xl font-bold">
              {filtered.length}
              <span className="text-sm font-normal text-muted-foreground ml-1">건</span>
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">예정금액 합계</p>
            <p className="text-xl font-bold">{formatCurrency(totalPlanned)}</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">승인 환불 합계</p>
            <p className="text-xl font-bold text-red-600">
              {totalApprovedRefund > 0 ? `-${formatCurrency(totalApprovedRefund)}` : "-"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">실수납 합계</p>
            <p className="text-xl font-bold text-emerald-600">
              {formatCurrency(totalNetPaid)}
            </p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-[90px]">
                  예정개강월
                </th>
                <th className="text-center px-2 py-2.5 font-medium text-muted-foreground w-[50px]">
                  학기
                </th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-[80px]">
                  학생명
                </th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-[110px]">
                  연락처
                </th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-[120px]">
                  과정
                </th>
                {isAdmin && (
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-[90px]">
                    담당자
                  </th>
                )}
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-[100px]">
                  교육원(예정)
                </th>
                <th className="text-right px-3 py-2.5 font-medium text-muted-foreground w-[100px]">
                  예정금액
                </th>
                <th className="text-center px-2 py-2.5 font-medium text-muted-foreground w-[50px]">
                  과목수
                </th>
                <th className="text-center px-3 py-2.5 font-medium text-muted-foreground w-[70px]">
                  실습
                </th>
                <th className="text-center px-3 py-2.5 font-medium text-muted-foreground w-[100px]">
                  결제일
                </th>
                <th className="text-center px-3 py-2.5 font-medium text-muted-foreground w-[80px]">
                  상태
                </th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((sem: any) => (
                <tr
                  key={sem.id}
                  className={`border-b hover:bg-muted/20 cursor-pointer ${
                    !sem.isCompleted ? "bg-amber-50/20" : ""
                  }`}
                  onClick={() => setLocation(`/students/${sem.studentId}`)}
                >
                  <td className="px-3 py-2 font-mono text-sm">{sem.plannedMonth || "-"}</td>

                  <td className="px-2 py-2 text-center">
                    <Badge className="bg-violet-100 text-violet-700 text-[10px]">
                      {sem.semesterOrder}학기
                    </Badge>
                  </td>

                  <td className="px-3 py-2 font-medium text-sm text-primary hover:underline">
                    {sem.clientName || "-"}
                  </td>

                  <td className="px-3 py-2 text-muted-foreground text-sm">
                    {formatPhone(sem.phone) || "-"}
                  </td>

                  <td className="px-3 py-2 text-sm">{sem.course || "-"}</td>

                  {isAdmin && (
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {userMap.get(sem.assigneeId) || "-"}
                    </td>
                  )}

                  <td className="px-3 py-2 text-sm">{sem.plannedInstitution || "-"}</td>

                  <td className="px-3 py-2 text-right font-medium text-sm">
                    {formatCurrency(sem.plannedAmount)}
                  </td>

                  <td className="px-2 py-2 text-center text-sm">
                    {sem.plannedSubjectCount || "-"}
                  </td>

                  <td className="px-3 py-2 text-center">
                    {sem.hasPractice ? (
                      sem.practiceStatus === "섭외완료" ? (
                        <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">
                          섭외완료
                        </Badge>
                      ) : sem.practiceStatus === "섭외중" ? (
                        <Badge className="bg-blue-100 text-blue-700 text-[10px]">
                          섭외중
                        </Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-700 text-[10px]">
                          미섭외
                        </Badge>
                      )
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </td>

                  <td className="px-3 py-2 text-center text-sm">
                    {sem.actualPaymentDate
                      ? String(sem.actualPaymentDate).slice(0, 10)
                      : "-"}
                  </td>

                  <td className="px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {sem.isCompleted && (
                        <span className="text-emerald-600 font-bold text-xs">✔</span>
                      )}
                      {statusBadge(sem)}
                    </div>
                  </td>
                </tr>
              ))}

              {!filtered.length && (
                <tr>
                  <td
                    colSpan={isAdmin ? 12 : 11}
                    className="text-center py-8 text-muted-foreground text-sm"
                  >
                    {plannedMonth
                      ? `${plannedMonth} 조건에 맞는 예정 학기가 없습니다.`
                      : "조건에 맞는 학기 데이터가 없습니다."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}