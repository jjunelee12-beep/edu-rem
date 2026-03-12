import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Search, Calendar } from "lucide-react";
import { useLocation } from "wouter";
import { formatPhone } from "@/lib/format";

function formatCurrency(amount: number | string | null | undefined) {
  if (!amount) return "-";
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (isNaN(n) || n === 0) return "-";
  return new Intl.NumberFormat("ko-KR").format(n) + "원";
}

function formatDate(d: any) {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "-";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

// 예정개강월 옵션 생성 (현재 -6개월 ~ +12개월)
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

export default function SemesterList() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const [plannedMonth, setPlannedMonth] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [assigneeSearch, setAssigneeSearch] = useState("");
const [filterUnassignedPractice, setFilterUnassignedPractice] = useState(false);
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
    if (!semesters) return [];

    const term = searchTerm.trim().toLowerCase();
    const assigneeTerm = assigneeSearch.trim().toLowerCase();

    return semesters.filter((s: any) => {

	if (filterUnassignedPractice && s.practiceStatus !== "미섭외") return false;

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
  }, [semesters, searchTerm, assigneeSearch, userMap]);

  const statusBadge = (sem: any) => {
    if (sem.isCompleted) {
      return <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">결제완료</Badge>;
    }
    if (sem.actualPaymentDate) {
      return <Badge className="bg-blue-100 text-blue-700 text-[10px]">결제중</Badge>;
    }
    return <Badge className="bg-amber-100 text-amber-700 text-[10px]">예정</Badge>;
  };

  const totalPlanned = filtered.reduce(
    (sum: number, s: any) => sum + Number(s.plannedAmount || 0),
    0
  );
  const totalActual = filtered.reduce(
    (sum: number, s: any) => sum + (s.isCompleted ? Number(s.actualAmount || 0) : 0),
    0
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">학기별 예정표</h1>
        <p className="text-sm text-muted-foreground mt-1">
          전체 학기 예정/결제 리스트입니다. 예정개강월로 필터하여 2~3달 전부터 결제 안내 대상자를 확인하세요.
        </p>
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
<label className="flex items-center gap-2 text-sm cursor-pointer select-none">
  <input
    type="checkbox"
    checked={filterUnassignedPractice}
    onChange={(e) => setFilterUnassignedPractice(e.target.checked)}
  />
  미실습 섭외만
</label>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
            <p className="text-xs text-muted-foreground">결제완료 합계</p>
            <p className="text-xl font-bold text-emerald-600">{formatCurrency(totalActual)}</p>
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
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-[90px]">
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
                <th className="text-center px-3 py-2.5 font-medium text-muted-foreground w-[70px]">
                  상태
                </th>
                <th className="text-center px-3 py-2.5 font-medium text-muted-foreground w-[70px]">
                  승인
                </th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((sem: any) => (
                <tr
                  key={sem.id}
                  className="border-b hover:bg-muted/20 cursor-pointer"
                  onClick={() => setLocation(`/students/${sem.studentId}`)}
                >
                  <td className="px-3 py-2 font-mono text-sm">{sem.plannedMonth || "-"}</td>
                  <td className="px-2 py-2 text-center text-sm">{sem.semesterOrder}학기</td>
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
                  <td className="px-2 py-2 text-center text-sm">{sem.plannedSubjectCount || "-"}</td>

                  <td className="px-3 py-2 text-center">
                    {sem.hasPractice ? (
                      <Badge
                        className={
                          sem.practiceStatus === "섭외완료"
                            ? "bg-emerald-100 text-emerald-700 text-[10px]"
                            : sem.practiceStatus === "섭외중"
                              ? "bg-blue-100 text-blue-700 text-[10px]"
                              : "bg-red-100 text-red-700 text-[10px]"
                        }
                      >
                        {sem.practiceStatus || "미섭외"}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </td>

                  <td className="px-3 py-2 text-center">{statusBadge(sem)}</td>

                  <td className="px-3 py-2 text-center">
                    <Badge
                      className={
                        sem.approvalStatus === "승인"
                          ? "bg-emerald-100 text-emerald-700 text-[10px]"
                          : sem.approvalStatus === "불승인"
                            ? "bg-red-100 text-red-700 text-[10px]"
                            : "bg-amber-100 text-amber-700 text-[10px]"
                      }
                    >
                      {sem.approvalStatus || "대기"}
                    </Badge>
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
                      ? `${plannedMonth} 예정 학기가 없습니다.`
                      : "학기 데이터가 없습니다."}
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