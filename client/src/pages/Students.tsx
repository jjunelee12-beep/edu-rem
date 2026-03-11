import { useState, useRef, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Eye, Search, Loader2, Trash2, Filter } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { formatPhone } from "@/lib/format";

function formatCurrency(amount: number) {
  if (!amount || amount === 0) return "-";
  return new Intl.NumberFormat("ko-KR").format(amount) + "원";
}

function formatDate(d: any) {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "-";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function Students() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { data: students, isLoading } = trpc.student.list.useQuery();
  const { data: allUsers } = trpc.users.list.useQuery();

  const updateMut = trpc.student.update.useMutation({
    onSuccess: () => utils.student.list.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  const deleteMut = trpc.student.delete.useMutation({
    onSuccess: () => {
      utils.student.list.invalidate();
      toast.success("삭제 완료");
    },
    onError: (e) => toast.error(e.message),
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filterApproval, setFilterApproval] = useState<string>("all");
  const [filterAssignee, setFilterAssignee] = useState<string>("all");
  const [filterPractice, setFilterPractice] = useState(false);

  const isAdmin = user?.role === "admin" || user?.role === "host";
  const isHost = user?.role === "host";

  const userMap = useMemo(
    () => new Map(allUsers?.map((u: any) => [u.id, u.name || "이름없음"]) ?? []),
    [allUsers]
  );

  const handlePhoneInput = (v: string) => v.replace(/\D/g, "").slice(0, 11);

  const filtered = useMemo(() => {
    return (students || []).filter((s: any) => {
      if (!showCompleted && s.status === "종료") return false;
      if (filterApproval !== "all" && s.approvalStatus !== filterApproval) return false;
      if (filterAssignee !== "all" && String(s.assigneeId) !== filterAssignee) return false;
      if (filterPractice && !(s.hasPractice && s.practiceStatus !== "섭외완료")) return false;

      const term = searchTerm.trim().toLowerCase();
      const assigneeTerm = assigneeSearch.trim().toLowerCase();
      const assigneeName = (userMap.get(s.assigneeId) || "").toLowerCase();

      const matchesSearch =
        !term ||
        s.clientName?.toLowerCase().includes(term) ||
        s.phone?.includes(term) ||
        s.course?.toLowerCase().includes(term) ||
        s.institution?.toLowerCase().includes(term);

      const matchesAssignee = !assigneeTerm || assigneeName.includes(assigneeTerm);

      return matchesSearch && matchesAssignee;
    });
  }, [
    students,
    showCompleted,
    filterApproval,
    filterAssignee,
    filterPractice,
    searchTerm,
    assigneeSearch,
    userMap,
  ]);

  const handleCellBlur = (id: number, field: string, value: string) => {
    const payload: any = { id };

    if (field === "subjectCount" || field === "totalSemesters") {
      payload[field] = value ? parseInt(value) : undefined;
    } else {
      payload[field] = value;
    }

    updateMut.mutate(payload);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">학생 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">
            상담 DB에서 상태를 "등록"으로 변경하면 자동으로 이관됩니다. 셀 클릭으로 바로 편집 가능합니다.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="h-4 w-4" /> 필터
        </Button>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative max-w-sm flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="이름, 연락처, 과정, 교육원 검색..."
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

        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <Checkbox
            checked={showCompleted}
            onCheckedChange={(v) => setShowCompleted(!!v)}
          />
          종료 학생 포함
        </label>
      </div>

      {showFilters && (
        <div className="border rounded-lg p-4 bg-muted/20 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground">승인상태:</label>
            <select
              className="text-sm border rounded px-2 py-1 bg-white"
              value={filterApproval}
              onChange={(e) => setFilterApproval(e.target.value)}
            >
              <option value="all">전체</option>
              <option value="대기">대기</option>
              <option value="승인">승인</option>
              <option value="불승인">불승인</option>
            </select>
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-muted-foreground">담당자:</label>
              <select
                className="text-sm border rounded px-2 py-1 bg-white"
                value={filterAssignee}
                onChange={(e) => setFilterAssignee(e.target.value)}
              >
                <option value="all">전체</option>
                {allUsers?.map((u: any) => (
                  <option key={u.id} value={String(u.id)}>
                    {u.name || "이름없음"}
                  </option>
                ))}
              </select>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <Checkbox
              checked={filterPractice}
              onCheckedChange={(v) => setFilterPractice(!!v)}
            />
            실습 미섭외만
          </label>

          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => {
              setFilterApproval("all");
              setFilterAssignee("all");
              setFilterPractice(false);
              setAssigneeSearch("");
            }}
          >
            필터 초기화
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-center px-2 py-2.5 font-medium text-muted-foreground w-[50px]">
                  No.
                </th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-[80px]">
                  이름
                </th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-[110px]">
                  연락처
                </th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-[120px]">
                  등록과정
                </th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-[90px]">
                  교육원
                </th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-[100px]">
                  개강날짜
                </th>
                <th className="text-right px-3 py-2.5 font-medium text-muted-foreground w-[110px]">
                  총 결제예정
                </th>
                <th className="text-right px-3 py-2.5 font-medium text-muted-foreground w-[110px]">
                  수납금액
                </th>
                <th className="text-center px-3 py-2.5 font-medium text-muted-foreground w-[60px]">
                  상태
                </th>
                <th className="text-center px-3 py-2.5 font-medium text-muted-foreground w-[60px]">
                  승인
                </th>
                {isAdmin && (
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-[90px]">
                    담당자
                  </th>
                )}
                <th className="w-[70px]"></th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((s: any, idx: number) => (
                <StudentInlineRow
                  key={s.id}
                  item={s}
                  rowNum={idx + 1}
                  isAdmin={!!isAdmin}
                  isHost={!!isHost}
                  userMap={userMap}
                  onBlur={handleCellBlur}
                  onDetail={(id) => setLocation(`/students/${id}`)}
                  onDelete={(id) => {
                    if (!isHost) return;
                    if (confirm("정말 삭제하시겠습니까?")) deleteMut.mutate({ id });
                  }}
                  handlePhoneInput={handlePhoneInput}
                />
              ))}

              {!filtered.length && (
                <tr>
                  <td
                    colSpan={isAdmin ? 12 : 11}
                    className="text-center py-8 text-muted-foreground text-sm"
                  >
                    {showCompleted
                      ? "학생 기록이 없습니다."
                      : "등록 중인 학생이 없습니다. (종료 학생 포함 체크박스를 확인하세요)"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">총 {filtered.length}명 표시</p>
    </div>
  );
}

function StudentInlineRow({
  item,
  rowNum,
  isAdmin,
  isHost,
  userMap,
  onBlur,
  onDetail,
  onDelete,
  handlePhoneInput,
}: {
  item: any;
  rowNum: number;
  isAdmin: boolean;
  isHost: boolean;
  userMap: Map<number, string>;
  onBlur: (id: number, field: string, value: string) => void;
  onDetail: (id: number) => void;
  onDelete: (id: number) => void;
  handlePhoneInput: (v: string) => string;
}) {
  const isCompleted = item.status === "종료";
  const totalRequired = Number(item.totalRequired || 0);
  const paidAmount = Number(item.paidAmount || 0);
  const canDelete = isHost;

  const approvalColor = (s: string) => {
    switch (s) {
      case "승인":
        return "bg-emerald-100 text-emerald-700";
      case "불승인":
        return "bg-red-100 text-red-700";
      default:
        return "bg-amber-100 text-amber-700";
    }
  };

  return (
    <tr className={`border-b hover:bg-muted/20 group ${isCompleted ? "bg-gray-50" : ""}`}>
      <td className="px-2 py-1.5 text-center text-xs text-muted-foreground font-mono">
        {rowNum}
      </td>

      <td className="px-1 py-0.5">
        <EditableCell
          value={item.clientName || ""}
          onBlur={(v) => onBlur(item.id, "clientName", v)}
          disabled
        />
      </td>

      <td className="px-1 py-0.5">
        <EditableCell
          value={formatPhone(item.phone)}
          onBlur={(v) => onBlur(item.id, "phone", v.replace(/\D/g, ""))}
          transform={handlePhoneInput}
          maxLength={11}
          disabled
        />
      </td>

      <td className="px-1 py-0.5">
        <EditableCell
          value={item.course || ""}
          onBlur={(v) => onBlur(item.id, "course", v)}
          disabled
        />
      </td>

      <td className="px-1 py-0.5">
        <EditableCell
          value={item.institution || ""}
          onBlur={(v) => onBlur(item.id, "institution", v)}
          disabled
        />
      </td>

      <td className="px-3 py-1.5 text-sm text-black">{formatDate(item.startDate)}</td>
      <td className="px-3 py-1.5 text-sm text-right font-medium text-black">
        {formatCurrency(totalRequired)}
      </td>
      <td className="px-3 py-1.5 text-sm text-right font-medium text-emerald-600">
        {formatCurrency(paidAmount)}
      </td>

      <td className="px-2 py-1.5 text-center">
        <Badge
          className={
            item.status === "종료"
              ? "bg-gray-200 text-gray-600 text-[10px]"
              : "bg-emerald-100 text-emerald-700 text-[10px]"
          }
        >
          {item.status || "등록"}
        </Badge>
      </td>

      <td className="px-2 py-1.5 text-center">
        <Badge className={`${approvalColor(item.approvalStatus)} text-[10px]`}>
          {item.approvalStatus || "대기"}
        </Badge>
      </td>

      {isAdmin && (
        <td className="px-3 py-1.5 text-xs text-muted-foreground">
          {userMap.get(item.assigneeId) || "-"}
        </td>
      )}

      <td className="px-1 py-0.5">
        <div className="flex items-center gap-0.5">
          <button
            className="p-1 hover:bg-muted rounded transition-colors"
            onClick={() => onDetail(item.id)}
          >
            <Eye className="h-3.5 w-3.5 text-muted-foreground" />
          </button>

          <button
            className={`p-1 rounded transition-opacity ${
              canDelete
                ? "opacity-0 group-hover:opacity-100 hover:bg-red-50"
                : "cursor-not-allowed"
            }`}
            onClick={() => canDelete && onDelete(item.id)}
            disabled={!canDelete}
            title={canDelete ? "삭제" : "호스트만 삭제할 수 있습니다."}
          >
            <Trash2
              className={`h-3.5 w-3.5 ${canDelete ? "text-red-400" : "text-gray-300"}`}
            />
          </button>
        </div>
      </td>
    </tr>
  );
}

function EditableCell({
  value,
  onBlur,
  type = "text",
  transform,
  maxLength,
  disabled = false,
}: {
  value: string;
  onBlur: (v: string) => void;
  type?: string;
  transform?: (v: string) => string;
  maxLength?: number;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [localVal, setLocalVal] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalVal(value);
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if (type !== "date") inputRef.current.select();
    }
  }, [editing, type]);

  const handleBlur = () => {
    setEditing(false);
    if (localVal !== value) onBlur(localVal);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
    if (e.key === "Escape") {
      setLocalVal(value);
      setEditing(false);
    }
  };

  if (editing && !disabled) {
    return (
      <input
        ref={inputRef}
        type={type}
        className="w-full px-2 py-1.5 text-sm border rounded bg-white text-black focus:outline-none focus:ring-1 focus:ring-primary"
        value={localVal}
        onChange={(e) =>
          setLocalVal(transform ? transform(e.target.value) : e.target.value)
        }
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        maxLength={maxLength}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <div
      className={`px-2 py-1.5 text-sm text-black rounded min-h-[32px] flex items-center ${
        disabled ? "cursor-not-allowed" : "cursor-text hover:bg-muted/30"
      }`}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) setEditing(true);
      }}
      title={disabled ? "이 항목은 수정할 수 없습니다." : value || ""}
    >
      {value || <span className="text-muted-foreground/40">-</span>}
    </div>
  );
}