import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  formatDate,
  formatTime,
  formatDateTime,
  toDateTimeLocalValue,
} from "@/lib/datetime";

function formatWorkMinutes(minutes?: number | null) {
  const m = Number(minutes || 0);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}시간 ${mm}분`;
}

function escapeCsv(value: unknown) {
  const str = String(value ?? "");
  if (str.includes('"') || str.includes(",") || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export default function AttendancePage() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();

  const canViewAll = user?.role === "host" || user?.role === "superhost";
  const canViewTeam = user?.role === "admin";
  const canManageAttendance = canViewAll || canViewTeam;
  const canManageLogs = user?.role === "host" || user?.role === "superhost";

  const [searchName, setSearchName] = useState("");
  const [statusFilter, setStatusFilter] = useState("전체");
  const [dateFilter, setDateFilter] = useState("");

  const [editingRow, setEditingRow] = useState<any | null>(null);
  const [editClockIn, setEditClockIn] = useState("");
  const [editClockOut, setEditClockOut] = useState("");
  const [editReason, setEditReason] = useState("");

  const { data: todayRow, isLoading: todayLoading } =
    trpc.attendance.today.useQuery();

  const { data: records = [], isLoading: listLoading } =
    trpc.attendance.list.useQuery();

  const { data: adjustmentLogs = [], isLoading: logsLoading } =
    trpc.attendance.adjustmentLogs.useQuery(
      {},
      {
        enabled: !!canManageLogs,
      }
    );

  const clockInMutation = trpc.attendance.clockIn.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.attendance.today.invalidate(),
        utils.attendance.list.invalidate(),
      ]);
    },
    onError: (err) => {
      alert(err.message || "출근 처리 중 오류가 발생했습니다.");
    },
  });

  const clockOutMutation = trpc.attendance.clockOut.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.attendance.today.invalidate(),
        utils.attendance.list.invalidate(),
      ]);
    },
    onError: (err) => {
      alert(err.message || "퇴근 처리 중 오류가 발생했습니다.");
    },
  });

  const updateByManagerMutation = trpc.attendance.updateByManager.useMutation({
    onSuccess: async () => {
      setEditingRow(null);
      setEditClockIn("");
      setEditClockOut("");
      setEditReason("");

      await Promise.all([
        utils.attendance.today.invalidate(),
        utils.attendance.list.invalidate(),
        utils.attendance.adjustmentLogs.invalidate(),
      ]);
    },
    onError: (err) => {
      alert(err.message || "근태 수정 중 오류가 발생했습니다.");
    },
  });

  const roleText = useMemo(() => {
    if (user?.role === "superhost") return "슈퍼호스트";
    if (user?.role === "host") return "호스트";
    if (user?.role === "admin") return "관리자";
    return "직원";
  }, [user?.role]);

  const openEditModal = (row: any) => {
    setEditingRow(row);
    setEditClockIn(toDateTimeLocalValue(row?.clockInAt));
    setEditClockOut(toDateTimeLocalValue(row?.clockOutAt));
    setEditReason("");
  };

  const filteredRecords = useMemo(() => {
    return (records as any[]).filter((row: any) => {
      const rowName = String(row.name || "").toLowerCase();
      const rowStatus = String(row.status || "");
      const rowDate = String(row.workDate || "").slice(0, 10);

      const matchName = !searchName.trim()
        ? true
        : rowName.includes(searchName.trim().toLowerCase());

      const matchStatus =
        statusFilter === "전체" ? true : rowStatus === statusFilter;

      const matchDate = !dateFilter ? true : rowDate === dateFilter;

      return matchName && matchStatus && matchDate;
    });
  }, [records, searchName, statusFilter, dateFilter]);

  const summary = useMemo(() => {
    const total = filteredRecords.length;
    const working = filteredRecords.filter(
      (r: any) => r.status === "근무중"
    ).length;
    const done = filteredRecords.filter(
      (r: any) => r.status === "퇴근완료"
    ).length;
    const late = filteredRecords.filter(
      (r: any) => r.status === "지각" || !!r.isLate
    ).length;
    const earlyLeave = filteredRecords.filter(
      (r: any) => r.status === "조퇴" || !!r.isEarlyLeave
    ).length;
    const absent = filteredRecords.filter(
      (r: any) => r.status === "결근"
    ).length;
    const trip = filteredRecords.filter(
      (r: any) => r.status === "출장"
    ).length;
    const halfDay = filteredRecords.filter(
      (r: any) => r.status === "반차"
    ).length;
    const annual = filteredRecords.filter(
      (r: any) => r.status === "연차"
    ).length;
    const sick = filteredRecords.filter(
      (r: any) => r.status === "병가"
    ).length;

    return {
      total,
      working,
      done,
      late,
      earlyLeave,
      absent,
      trip,
      halfDay,
      annual,
      sick,
    };
  }, [filteredRecords]);

  const filteredLogs = useMemo(() => {
    return (adjustmentLogs as any[]).filter((row: any) => {
      const matchName = !searchName.trim()
        ? true
        : String(row.targetUserName || "")
            .toLowerCase()
            .includes(searchName.trim().toLowerCase());

      const matchDate = !dateFilter
        ? true
        : String(row.createdAt || "").slice(0, 10) === dateFilter;

      return matchName && matchDate;
    });
  }, [adjustmentLogs, searchName, dateFilter]);

  const downloadCsv = () => {
    if (!canManageAttendance) return;

    const headers = [
      "이름",
      "아이디",
      "전화번호",
      "팀",
      "직급",
      "근무일",
      "출근",
      "퇴근",
      "근무시간",
      "상태",
      "지각여부",
      "지각분",
      "조퇴여부",
      "조퇴분",
      "자동퇴근",
      "휴가유형",
      "비고",
    ];

    const rows = filteredRecords.map((row: any) => [
      row.name || "",
      row.username || "",
      row.phone || "",
      row.teamName || row.team || "",
      row.positionName || row.position || "",
      row.workDate ? formatDate(row.workDate) : "",
      row.clockInAt ? formatTime(row.clockInAt) : "",
      row.clockOutAt ? formatTime(row.clockOutAt) : "",
      formatWorkMinutes(row.workMinutes),
      row.status || "",
      row.isLate ? "Y" : "N",
      row.lateMinutes ?? 0,
      row.isEarlyLeave ? "Y" : "N",
      row.earlyLeaveMinutes ?? 0,
      row.isAutoClockOut ? "Y" : "N",
      row.leaveType || "",
      row.note || "",
    ]);

    const csv = [
      headers.map(escapeCsv).join(","),
      ...rows.map((row) => row.map(escapeCsv).join(",")),
    ].join("\n");

    const bom = "\uFEFF";
    const blob = new Blob([bom + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);

    const today = new Date();
    const fileName = `attendance_${today.getFullYear()}-${String(
      today.getMonth() + 1
    ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}.csv`;

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-bold">근태 관리</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {user?.name} · {roleText}
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => clockInMutation.mutate()}
                disabled={!!todayRow?.clockInAt || clockInMutation.isPending}
              >
                출근
              </Button>

              <Button
                variant="outline"
                onClick={() => clockOutMutation.mutate()}
                disabled={
                  !todayRow?.clockInAt ||
                  !!todayRow?.clockOutAt ||
                  clockOutMutation.isPending
                }
              >
                퇴근
              </Button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs text-muted-foreground">오늘 날짜</p>
              <p className="mt-1 text-sm font-semibold">
                {todayRow?.workDate ? formatDate(todayRow.workDate) : "-"}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs text-muted-foreground">출근 시간</p>
              <p className="mt-1 text-sm font-semibold">
                {formatTime(todayRow?.clockInAt)}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs text-muted-foreground">퇴근 시간</p>
              <p className="mt-1 text-sm font-semibold">
                {formatTime(todayRow?.clockOutAt)}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs text-muted-foreground">근무 시간</p>
              <p className="mt-1 text-sm font-semibold">
                {formatWorkMinutes(todayRow?.workMinutes)}
              </p>
            </div>
          </div>

          <div className="mt-4 text-sm text-muted-foreground">
            상태: {todayRow?.status || "출근전"}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-bold">
                {canViewAll
                  ? "전체 근태기록부"
                  : canViewTeam
                  ? "팀 근태기록부"
                  : "내 근태기록부"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {canViewAll
                  ? "호스트 / 슈퍼호스트는 전체 직원 기록을 볼 수 있습니다."
                  : canViewTeam
                  ? "관리자는 자기 팀 직원 기록만 조회하고 수정할 수 있습니다."
                  : "직원은 본인 기록만 조회할 수 있습니다."}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Input
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                placeholder="이름 검색"
              />

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 rounded-md border bg-white px-3 text-sm"
              >
                <option value="전체">전체 상태</option>
                <option value="출근전">출근전</option>
                <option value="근무중">근무중</option>
                <option value="퇴근완료">퇴근완료</option>
                <option value="지각">지각</option>
                <option value="조퇴">조퇴</option>
                <option value="병가">병가</option>
                <option value="연차">연차</option>
                <option value="출장">출장</option>
                <option value="반차">반차</option>
                <option value="결근">결근</option>
              </select>

              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              />
            </div>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs text-muted-foreground">조회 건수</p>
              <p className="mt-1 text-lg font-bold">{summary.total}</p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs text-muted-foreground">근무중</p>
              <p className="mt-1 text-lg font-bold">{summary.working}</p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs text-muted-foreground">퇴근완료</p>
              <p className="mt-1 text-lg font-bold">{summary.done}</p>
            </div>

            <div className="rounded-2xl bg-red-50 p-4">
              <p className="text-xs text-muted-foreground">지각</p>
              <p className="mt-1 text-lg font-bold text-red-600">
                {summary.late}
              </p>
            </div>

            <div className="rounded-2xl bg-amber-50 p-4">
              <p className="text-xs text-muted-foreground">조퇴</p>
              <p className="mt-1 text-lg font-bold text-amber-600">
                {summary.earlyLeave}
              </p>
            </div>

            <div className="rounded-2xl bg-rose-50 p-4">
              <p className="text-xs text-muted-foreground">결근</p>
              <p className="mt-1 text-lg font-bold text-rose-600">
                {summary.absent}
              </p>
            </div>
          </div>

          <div className="mb-4 flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setSearchName("");
                setStatusFilter("전체");
                setDateFilter("");
              }}
            >
              필터 초기화
            </Button>

            {canManageAttendance ? (
              <Button onClick={downloadCsv}>CSV 다운로드</Button>
            ) : null}

            {canViewAll ? (
              <Button
                variant="secondary"
                onClick={() => setLocation("/attendance/view")}
              >
                열람
              </Button>
            ) : null}
          </div>

          {todayLoading || listLoading ? (
            <div className="text-sm text-muted-foreground">불러오는 중...</div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              조건에 맞는 기록이 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1320px] border-collapse">
                <thead>
                  <tr className="border-b bg-slate-50 text-left text-sm">
                    {canManageAttendance ? (
                      <th className="px-3 py-3">이름</th>
                    ) : null}
                    {canManageAttendance ? (
                      <th className="px-3 py-3">아이디</th>
                    ) : null}
                    {canManageAttendance ? (
                      <th className="px-3 py-3">전화번호</th>
                    ) : null}
                    {canManageAttendance ? (
                      <th className="px-3 py-3">팀</th>
                    ) : null}
                    {canManageAttendance ? (
                      <th className="px-3 py-3">직급</th>
                    ) : null}
                    <th className="px-3 py-3">근무일</th>
                    <th className="px-3 py-3">출근</th>
                    <th className="px-3 py-3">퇴근</th>
                    <th className="px-3 py-3">근무시간</th>
                    <th className="px-3 py-3">상태</th>
                    {canManageAttendance ? (
                      <th className="px-3 py-3">관리</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((row: any) => (
                    <tr key={row.id} className="border-b text-sm">
                      {canManageAttendance ? (
                        <td className="px-3 py-3 font-medium">{row.name}</td>
                      ) : null}
                      {canManageAttendance ? (
                        <td className="px-3 py-3">{row.username || "-"}</td>
                      ) : null}
                      {canManageAttendance ? (
                        <td className="px-3 py-3">{row.phone || "-"}</td>
                      ) : null}
                      {canManageAttendance ? (
                        <td className="px-3 py-3">
                          {row.teamName || row.team || "-"}
                        </td>
                      ) : null}
                      {canManageAttendance ? (
                        <td className="px-3 py-3">
                          {row.positionName || row.position || "-"}
                        </td>
                      ) : null}
                      <td className="px-3 py-3">{formatDate(row.workDate)}</td>
                      <td className="px-3 py-3">
                        {formatTime(row.clockInAt)}
                      </td>
                      <td className="px-3 py-3">
                        {formatTime(row.clockOutAt)}
                      </td>
                      <td className="px-3 py-3">
                        {formatWorkMinutes(row.workMinutes)}
                      </td>
                      <td className="px-3 py-3">
                        {row.status}
                        {row.isLate ? (
                          <span className="ml-2 text-xs text-red-500">
                            (지각 {row.lateMinutes}분)
                          </span>
                        ) : null}
                        {row.isEarlyLeave ? (
                          <span className="ml-2 text-xs text-orange-500">
                            (조퇴 {row.earlyLeaveMinutes}분)
                          </span>
                        ) : null}
                      </td>
                      {canManageAttendance ? (
                        <td className="px-3 py-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditModal(row)}
                          >
                            수정
                          </Button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {canManageAttendance && editingRow ? (
        <Card>
          <CardContent className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">근태 수정</h3>
                <p className="text-sm text-muted-foreground">
                  {editingRow.name} · {formatDate(editingRow.workDate)}
                </p>
              </div>

              <Button
                variant="ghost"
                onClick={() => {
                  setEditingRow(null);
                  setEditClockIn("");
                  setEditClockOut("");
                  setEditReason("");
                }}
              >
                닫기
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  출근 시간
                </label>
                <Input
                  type="datetime-local"
                  value={editClockIn}
                  onChange={(e) => setEditClockIn(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  퇴근 시간
                </label>
                <Input
                  type="datetime-local"
                  value={editClockOut}
                  onChange={(e) => setEditClockOut(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  수정 사유
                </label>
                <Input
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="예: 외근으로 수동 보정"
                />
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <Button
                onClick={() =>
                  updateByManagerMutation.mutate({
                    attendanceId: Number(editingRow.id),
                    clockInAt: editClockIn || null,
                    clockOutAt: editClockOut || null,
                    reason: editReason || null,
                  })
                }
                disabled={updateByManagerMutation.isPending}
              >
                저장
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  setEditingRow(null);
                  setEditClockIn("");
                  setEditClockOut("");
                  setEditReason("");
                }}
              >
                취소
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {canViewAll ? (
        <Card>
          <CardContent className="p-5">
            <div className="mb-4">
              <h3 className="text-base font-bold">근태 수정 로그</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                관리자 수정 이력을 확인할 수 있습니다.
              </p>
            </div>

            {logsLoading ? (
              <div className="text-sm text-muted-foreground">
                로그 불러오는 중...
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                수정 로그가 없습니다.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1600px] border-collapse">
                  <thead>
                    <tr className="border-b bg-slate-50 text-left text-sm">
                      <th className="px-3 py-3">수정일시</th>
                      <th className="px-3 py-3">대상자</th>
                      <th className="px-3 py-3">대상자 아이디</th>
                      <th className="px-3 py-3">대상자 전화번호</th>
                      <th className="px-3 py-3">수정자</th>
                      <th className="px-3 py-3">처리유형</th>
                      <th className="px-3 py-3">수정 전 상태</th>
                      <th className="px-3 py-3">수정 후 상태</th>
                      <th className="px-3 py-3">수정 전 출근</th>
                      <th className="px-3 py-3">수정 전 퇴근</th>
                      <th className="px-3 py-3">수정 후 출근</th>
                      <th className="px-3 py-3">수정 후 퇴근</th>
                      <th className="px-3 py-3">사유</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map((row: any) => (
                      <tr key={row.id} className="border-b text-sm">
                        <td className="px-3 py-3">
                          {formatDateTime(row.createdAt)}
                        </td>
                        <td className="px-3 py-3 font-medium">
                          {row.targetUserName || "-"}
                        </td>
                        <td className="px-3 py-3">
                          {row.targetUserUsername || "-"}
                        </td>
                        <td className="px-3 py-3">
                          {row.targetUserPhone || "-"}
                        </td>
                        <td className="px-3 py-3">
                          {row.actorUserName || "-"}
                        </td>
                        <td className="px-3 py-3">
                          {row.actionType || "-"}
                        </td>
                        <td className="px-3 py-3">
                          {row.beforeStatus || "-"}
                        </td>
                        <td className="px-3 py-3">
                          {row.afterStatus || "-"}
                        </td>
                        <td className="px-3 py-3">
                          {row.beforeClockInAt
                            ? formatDateTime(row.beforeClockInAt)
                            : "-"}
                        </td>
                        <td className="px-3 py-3">
                          {row.beforeClockOutAt
                            ? formatDateTime(row.beforeClockOutAt)
                            : "-"}
                        </td>
                        <td className="px-3 py-3">
                          {row.afterClockInAt
                            ? formatDateTime(row.afterClockInAt)
                            : "-"}
                        </td>
                        <td className="px-3 py-3">
                          {row.afterClockOutAt
                            ? formatDateTime(row.afterClockOutAt)
                            : "-"}
                        </td>
                        <td className="px-3 py-3">
                          {row.note || row.reason || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}