import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Search, Upload, FileText } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatPhone } from "@/lib/format";

function toISODate(v: string) {
  const s = (v ?? "").trim();
  if (!s) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const m1 = s.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (m1) {
    const y = m1[1];
    const mm = String(Number(m1[2])).padStart(2, "0");
    const dd = String(Number(m1[3])).padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  }

  const m2 = s.match(/^(\d{1,2})\s*월\s*(\d{1,2})\s*일$/);
  if (m2) {
    const now = new Date();
    const y = now.getFullYear();
    const mm = String(Number(m2[1])).padStart(2, "0");
    const dd = String(Number(m2[2])).padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  }

  return new Date().toISOString().slice(0, 10);
}

function autoResize(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

export default function Consultations() {
  const { user } = useAuth();
  const isHost = user?.role === "host";
  const isStaff = user?.role === "staff";
  const utils = trpc.useUtils();

  const { data: list, isLoading } = trpc.consultation.list.useQuery();
  const { data: usersList } = trpc.users.list.useQuery();

  const createMut = trpc.consultation.create.useMutation({
    onSuccess: () => {
      utils.consultation.list.invalidate();
      toast.success("상담 등록 완료");
    },
    onError: (e) => toast.error(e.message),
  });

  const bulkCreateMut = trpc.consultation.bulkCreate.useMutation({
    onSuccess: (data: any) => {
      utils.consultation.list.invalidate();
      toast.success(`${data?.count ?? 0}건 일괄 등록 완료`);
      setBulkPasteText("");
      setBulkPreviewRows([]);
      setShowBulkPaste(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const importCsvMut = trpc.consultation.importCsv.useMutation({
    onSuccess: (data: any) => {
      utils.consultation.list.invalidate();
      toast.success(`${data?.count ?? 0}건 CSV 임포트 완료`);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMut = trpc.consultation.update.useMutation({
    onSuccess: () => {
      utils.consultation.list.invalidate();
      utils.student.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMut = trpc.consultation.delete.useMutation({
    onSuccess: () => {
      utils.consultation.list.invalidate();
      toast.success("삭제 완료");
    },
    onError: (e) => toast.error(e.message),
  });

  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [csvHasHeader, setCsvHasHeader] = useState(true);

  const [showBulkPaste, setShowBulkPaste] = useState(false);
  const [bulkPasteText, setBulkPasteText] = useState("");
  const [bulkPreviewRows, setBulkPreviewRows] = useState<any[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhoneInput = (value: string) =>
    (value ?? "").replace(/\D/g, "").slice(0, 11);

  const getUserName = (id: number) => {
    const found = (usersList ?? []).find((u: any) => Number(u.id) === Number(id));
    return (found?.name ?? "").trim() || "-";
  };

  const [newRow, setNewRow] = useState({
    consultDate: new Date().toISOString().slice(0, 10),
    channel: "",
    clientName: "",
    phone: "",
    finalEducation: "",
    desiredCourse: "",
    notes: "",
    status: "상담중",
  });

  const fillInputsFromPaste = (text: string) => {
    const firstLine = text.replace(/\r/g, "").split("\n")[0] ?? "";
    const cols = firstLine.split("\t");

    if (cols.length < 2) return false;

    const get = (idx: number) => cols[idx] ?? "";

    const next = {
      consultDate: toISODate(String(get(0)).trim()),
      channel: String(get(1)),
      clientName: String(get(2)),
      phone: handlePhoneInput(String(get(3))),
      finalEducation: String(get(4)),
      desiredCourse: String(get(5)),
      notes: String(get(6)),
      status: newRow.status || "상담중",
    };

    const looksLikeHeader =
      String(next.consultDate).includes("상담") ||
      String(next.channel).includes("문의") ||
      String(next.clientName).includes("이름") ||
      String(next.phone).includes("연락처");

    if (looksLikeHeader) return false;

    setNewRow((prev) => ({ ...prev, ...next }));
    return true;
  };

  const parseBulkPasteText = (text: string) => {
    const lines = String(text || "")
      .replace(/\r/g, "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    return lines
      .map((line) => {
        const cols = line.split("\t");
        return {
          channel: String(cols[0] ?? "").trim(),
          clientName: String(cols[1] ?? "").trim(),
          phone: handlePhoneInput(String(cols[2] ?? "").trim()),
          finalEducation: String(cols[3] ?? "").trim(),
          desiredCourse: String(cols[4] ?? "").trim(),
          notes: String(cols[5] ?? "").trim(),
        };
      })
      .filter(
        (row) =>
          row.channel ||
          row.clientName ||
          row.phone ||
          row.finalEducation ||
          row.desiredCourse ||
          row.notes
      );
  };

  const handleBulkPreview = () => {
    if (!bulkPasteText.trim()) {
      toast.error("붙여넣은 내용이 없습니다");
      return;
    }

    const rows = parseBulkPasteText(bulkPasteText);

    if (!rows.length) {
      toast.error(
        "붙여넣기 형식을 확인하세요. 문의경로~상담내역 6열 탭 구분이어야 합니다."
      );
      return;
    }

    const first = rows[0];
    const looksLikeHeader =
      first &&
      (first.channel.includes("문의경로") ||
        first.clientName.includes("이름") ||
        first.phone.includes("연락처") ||
        first.finalEducation.includes("최종학력") ||
        first.desiredCourse.includes("희망과정") ||
        first.notes.includes("상담내역"));

    const finalRows = looksLikeHeader ? rows.slice(1) : rows;

    setBulkPreviewRows(finalRows);
    toast.success(`${finalRows.length}건 미리보기 생성`);
  };

  const handleBulkSave = () => {
    if (!bulkPreviewRows.length) {
      toast.error("먼저 미리보기를 실행하세요");
      return;
    }

    const validRows = bulkPreviewRows.filter(
      (row) => row.clientName && row.phone
    );

    if (!validRows.length) {
      toast.error("이름과 연락처가 있는 행이 없습니다");
      return;
    }

    bulkCreateMut.mutate({
      rows: validRows.map((row) => ({
        consultDate: new Date().toISOString().slice(0, 10),
        channel: row.channel,
        clientName: row.clientName,
        phone: row.phone,
        finalEducation: row.finalEducation,
        desiredCourse: row.desiredCourse,
        notes: row.notes,
        status: "상담중",
      })),
    } as any);
  };

  const handleConsultDatePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (!text || !text.includes("\t")) return;
    e.preventDefault();

    const ok = fillInputsFromPaste(text);
    if (ok) toast.success("붙여넣기 완료");
    else toast.error("형식 확인: 상담일~상담내역(7칸, 탭구분)");
  };

  const handleAdd = () => {
    if (!newRow.clientName || !newRow.phone) {
      toast.error("이름과 연락처는 필수입니다");
      return;
    }

    createMut.mutate({
      ...newRow,
      finalEducation: newRow.finalEducation ?? "",
    });

    setNewRow({
      consultDate: new Date().toISOString().slice(0, 10),
      channel: "",
      clientName: "",
      phone: "",
      finalEducation: "",
      desiredCourse: "",
      notes: "",
      status: "상담중",
    });
    setShowAdd(false);
  };

  const filtered = (list || []).filter((item: any) => {
    const matchesSearch = !search
      ? true
      : item.clientName?.toLowerCase?.().includes(search.toLowerCase()) ||
        item.phone?.includes(search) ||
        item.finalEducation?.toLowerCase?.().includes(search.toLowerCase()) ||
        item.desiredCourse?.toLowerCase?.().includes(search.toLowerCase()) ||
        item.channel?.toLowerCase?.().includes(search.toLowerCase()) ||
        item.notes?.toLowerCase?.().includes(search.toLowerCase()) ||
        item.status?.toLowerCase?.().includes(search.toLowerCase());

    const assigneeName = getUserName(Number(item.assigneeId));
    const matchesAssignee = !assigneeSearch
      ? true
      : assigneeName.toLowerCase().includes(assigneeSearch.toLowerCase());

    return matchesSearch && matchesAssignee;
  });

  const handleCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvText(text);
      setShowCsvImport(true);
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  };

  const handleCsvImport = () => {
    if (!csvText.trim()) {
      toast.error("CSV 내용이 없습니다");
      return;
    }
    importCsvMut.mutate({ csvText, hasHeader: csvHasHeader } as any);
    setCsvText("");
    setShowCsvImport(false);
  };

  const handleCellBlur = (id: number, field: string, value: any) => {
    if (!id || typeof id !== "number") return;
    if (value === undefined) return;
    updateMut.mutate({ id, [field]: value } as any);
  };

  const reassignConsultationMut = trpc.consultation.reassign.useMutation({
    onSuccess: () => {
      toast.success("담당자 변경 완료");
      utils.consultation.list.invalidate();
      utils.student.list.invalidate();
      utils.semester.listAll.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleStatusChange = (id: number, newStatus: string) => {
    if (newStatus === "등록") {
      if (
        !confirm(
          "상태를 '등록'으로 변경하면 학생관리 탭에 자동으로 이관됩니다. 계속하시겠습니까?"
        )
      )
        return;
    }
    if (!id) return;
    if (!newStatus) return;
    updateMut.mutate({ id, status: newStatus } as any);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">상담 DB</h1>
          <p className="text-sm text-muted-foreground mt-1">
            상담일 클릭 후 Ctrl+V → 상담일~상담내역(7칸) 자동 채움 (공란 유지)
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.tsv,.txt"
            className="hidden"
            onChange={handleCsvFile}
          />

          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4" /> CSV 임포트
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => setShowBulkPaste(true)}
          >
            <FileText className="h-4 w-4" /> 일괄등록
          </Button>

          <Button onClick={() => setShowAdd(true)} size="sm" className="gap-1">
            <Plus className="h-4 w-4" /> 새 상담
          </Button>
        </div>
      </div>

      <Dialog open={showCsvImport} onOpenChange={setShowCsvImport}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" /> CSV 파일 임포트
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              열 순서: 상담일,문의경로,이름,연락처,최종학력,희망과정,상담내역,상태(옵션)
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={csvHasHeader}
                onChange={(e) => setCsvHasHeader(e.target.checked)}
                className="rounded"
              />
              첫 행은 헤더 (건너뛰기)
            </label>
            <textarea
              className="w-full h-48 px-3 py-2 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary font-mono"
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="CSV 내용 미리보기..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCsvImport(false)}>
              취소
            </Button>
            <Button onClick={handleCsvImport} disabled={importCsvMut.isPending}>
              {importCsvMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : null}
              임포트
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showBulkPaste} onOpenChange={setShowBulkPaste}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" /> 상담DB 일괄등록
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              엑셀에서 아래 순서대로 복사해서 붙여넣으세요.
              <br />
              <b>문의경로 → 이름 → 연락처 → 최종학력 → 희망과정 → 상담내역</b>
            </p>

            <textarea
              className="w-full h-40 px-3 py-2 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary font-mono"
              value={bulkPasteText}
              onChange={(e) => setBulkPasteText(e.target.value)}
              placeholder={`유튜브\t김철수\t01053687965\t고등학교졸업\t사회복지사\t개발자 못하겠다`}
            />

            <div className="flex gap-2">
              <Button variant="outline" onClick={handleBulkPreview}>
                미리보기
              </Button>
              <Button
                onClick={handleBulkSave}
                disabled={bulkCreateMut.isPending || bulkPreviewRows.length === 0}
              >
                {bulkCreateMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : null}
                저장
              </Button>
            </div>

            <div className="border rounded-lg overflow-auto max-h-[320px] bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="text-left px-3 py-2">문의경로</th>
                    <th className="text-left px-3 py-2">이름</th>
                    <th className="text-left px-3 py-2">연락처</th>
                    <th className="text-left px-3 py-2">최종학력</th>
                    <th className="text-left px-3 py-2">희망과정</th>
                    <th className="text-left px-3 py-2">상담내역</th>
                  </tr>
                </thead>
                <tbody>
                  {bulkPreviewRows.length ? (
                    bulkPreviewRows.map((row, idx) => (
                      <tr key={idx} className="border-b align-top">
                        <td className="px-3 py-2">{row.channel || "-"}</td>
                        <td className="px-3 py-2">{row.clientName || "-"}</td>
                        <td className="px-3 py-2">
                          {formatPhone(row.phone) || "-"}
                        </td>
                        <td className="px-3 py-2">{row.finalEducation || "-"}</td>
                        <td className="px-3 py-2">{row.desiredCourse || "-"}</td>
                        <td className="px-3 py-2 whitespace-pre-wrap">
                          {row.notes || "-"}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={6}
                        className="text-center py-8 text-muted-foreground"
                      >
                        미리보기 데이터가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowBulkPaste(false);
                setBulkPasteText("");
                setBulkPreviewRows([]);
              }}
            >
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="이름, 연락처, 최종학력, 과정, 상담내역 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      <div className="flex items-center gap-2">
        <Input
          placeholder="담당자 검색"
          value={assigneeSearch}
          onChange={(e) => setAssigneeSearch(e.target.value)}
          className="w-[180px]"
        />
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
                <th className="text-center px-2 py-2.5 font-medium text-muted-foreground w-[50px]">
                  No.
                </th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-[120px]">
                  상담일
                </th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-[140px]">
                  문의경로
                </th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-[100px]">
                  이름
                </th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-[130px]">
                  연락처
                </th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-[110px]">
                  최종학력
                </th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-[160px]">
                  희망과정
                </th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground min-w-[280px]">
                  상담내역
                </th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-[90px]">
                  상태
                </th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-[90px]">
                  담당자
                </th>
                <th className="w-[40px]"></th>
              </tr>
            </thead>

            <tbody>
              {showAdd && (
                <tr className="border-b bg-blue-50/30 align-top">
                  <td className="px-2 py-2 text-center text-xs text-muted-foreground">
                    -
                  </td>

                  <td className="px-1 py-2">
                    <input
                      type="date"
                      className="w-full px-2 py-1.5 text-sm border rounded bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                      value={newRow.consultDate}
                      onPaste={handleConsultDatePaste}
                      onChange={(e) =>
                        setNewRow({ ...newRow, consultDate: e.target.value })
                      }
                    />
                  </td>

                  <td className="px-1 py-2">
                    <input
                      className="w-full px-2 py-1.5 text-sm border rounded bg-white focus:outline-none focus:ring-1 focus:ring-primary whitespace-nowrap"
                      placeholder="경로 입력"
                      value={newRow.channel}
                      onChange={(e) =>
                        setNewRow({ ...newRow, channel: e.target.value })
                      }
                    />
                  </td>

                  <td className="px-1 py-2">
                    <input
                      className="w-full px-2 py-1.5 text-sm border rounded bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="이름"
                      value={newRow.clientName}
                      onChange={(e) =>
                        setNewRow({ ...newRow, clientName: e.target.value })
                      }
                    />
                  </td>

                  <td className="px-1 py-2">
                    <input
                      className="w-full px-2 py-1.5 text-sm border rounded bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="01012345678"
                      value={newRow.phone}
                      onChange={(e) =>
                        setNewRow({
                          ...newRow,
                          phone: handlePhoneInput(e.target.value),
                        })
                      }
                      maxLength={11}
                    />
                  </td>

                  <td className="px-1 py-2">
                    <input
                      className="w-full px-2 py-1.5 text-sm border rounded bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="최종학력"
                      value={newRow.finalEducation}
                      onChange={(e) =>
                        setNewRow({
                          ...newRow,
                          finalEducation: e.target.value,
                        })
                      }
                    />
                  </td>

                  <td className="px-1 py-2">
                    <input
                      className="w-full px-2 py-1.5 text-sm border rounded bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="희망과정"
                      value={newRow.desiredCourse}
                      onChange={(e) =>
                        setNewRow({
                          ...newRow,
                          desiredCourse: e.target.value,
                        })
                      }
                    />
                  </td>

                  <td className="px-1 py-2">
                    <AutoGrowTextarea
                      value={newRow.notes}
                      placeholder="상담내역"
                      onChange={(v) => setNewRow({ ...newRow, notes: v })}
                      className="w-full text-sm border rounded bg-white focus:outline-none focus:ring-1 focus:ring-primary px-2 py-1.5"
                    />
                  </td>

                  <td className="px-1 py-2">
                    <input
                      className="w-full px-2 py-1.5 text-sm border rounded bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                      value={newRow.status}
                      onChange={(e) =>
                        setNewRow({ ...newRow, status: e.target.value })
                      }
                    />
                  </td>

                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                    {user?.name || "-"}
                  </td>

                  <td className="px-1 py-2">
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={handleAdd}
                      >
                        저장
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-1 text-xs text-muted-foreground"
                        onClick={() => setShowAdd(false)}
                      >
                        취소
                      </Button>
                    </div>
                  </td>
                </tr>
              )}

              {filtered.map((item: any, idx: number) => (
                <InlineRow
                  key={item.id}
                  item={item}
                  rowNum={idx + 1}
                  isHost={!!isHost}
                  isStaff={!!isStaff}
                  usersList={usersList || []}
                  getUserName={getUserName}
                  onBlur={handleCellBlur}
                  onStatusChange={handleStatusChange}
                  onDelete={(id) => {
                    if (!isHost) return;
                    if (confirm("정말 삭제하시겠습니까?"))
                      deleteMut.mutate({ id } as any);
                  }}
                  onReassign={(id, assigneeId) =>
                    reassignConsultationMut.mutate({ id, assigneeId })
                  }
                  handlePhoneInput={handlePhoneInput}
                />
              ))}

              {!filtered.length && !showAdd && (
                <tr>
                  <td
                    colSpan={11}
                    className="text-center py-8 text-muted-foreground text-sm"
                  >
                    상담 기록이 없습니다.
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

function InlineRow({
  item,
  rowNum,
  isHost,
  isStaff,
  usersList,
  getUserName,
  onBlur,
  onStatusChange,
  onDelete,
  onReassign,
  handlePhoneInput,
}: {
  item: any;
  rowNum: number;
  isHost: boolean;
  isStaff: boolean;
  usersList: any[];
  getUserName: (id: number) => string;
  onBlur: (id: number, field: string, value: string) => void;
  onStatusChange: (id: number, status: string) => void;
  onDelete: (id: number) => void;
  onReassign: (id: number, assigneeId: number) => void;
  handlePhoneInput: (v: string) => string;
}) {
  const dateStr = item.consultDate
    ? typeof item.consultDate === "string"
      ? item.consultDate.slice(0, 10)
      : new Date(item.consultDate).toISOString().slice(0, 10)
    : "";

  const isRegistered = item.status === "등록";
  const canDelete = isHost;

  return (
    <tr
      className={`border-b hover:bg-muted/20 group align-top ${
        isRegistered ? "bg-emerald-50/30" : ""
      }`}
    >
      <td className="px-2 py-2 text-center text-xs text-muted-foreground font-mono">
        {rowNum}
      </td>

      <td className="px-1 py-2">
        <EditableCell
          value={dateStr}
          onBlur={(v) => onBlur(item.id, "consultDate", v)}
          type="date"
          disabled={isStaff}
        />
      </td>

      <td className="px-1 py-2">
        <EditableCell
          value={item.channel || ""}
          onBlur={(v) => onBlur(item.id, "channel", v)}
          className="whitespace-nowrap"
          disabled={isStaff}
        />
      </td>

      <td className="px-1 py-2">
        <EditableCell
          value={item.clientName || ""}
          onBlur={(v) => onBlur(item.id, "clientName", v)}
          disabled={isStaff}
        />
      </td>

      <td className="px-1 py-2">
        <EditableCell
          value={formatPhone(item.phone)}
          onBlur={(v) => onBlur(item.id, "phone", v.replace(/\D/g, ""))}
          transform={handlePhoneInput}
          maxLength={11}
          disabled
        />
      </td>

      <td className="px-1 py-2">
        <EditableCell
          value={item.finalEducation || ""}
          onBlur={(v) => onBlur(item.id, "finalEducation", v)}
          disabled={isStaff}
        />
      </td>

      <td className="px-1 py-2">
        <EditableCell
          value={item.desiredCourse || ""}
          onBlur={(v) => onBlur(item.id, "desiredCourse", v)}
          disabled={isStaff}
        />
      </td>

      <td className="px-1 py-2">
        <InlineNotesCell
          value={item.notes || ""}
          onCommit={(v) => onBlur(item.id, "notes", v)}
        />
      </td>

      <td className="px-1 py-2">
        <StatusCell
          value={item.status || "상담중"}
          onChange={(v) => onStatusChange(item.id, v)}
        />
      </td>

      <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
        {isHost ? (
          <select
            className="text-xs border rounded px-2 py-1 bg-white"
            value={String(item.assigneeId)}
            onChange={(e) => onReassign(item.id, Number(e.target.value))}
          >
            {usersList.map((u: any) => (
              <option key={u.id} value={u.id}>
                {u.name || "이름없음"}
              </option>
            ))}
          </select>
        ) : (
          getUserName(Number(item.assigneeId))
        )}
      </td>

      <td className="px-1 py-2">
        <button
          className={`transition-opacity p-1 rounded ${
            canDelete
              ? "opacity-0 group-hover:opacity-100 hover:bg-red-50"
              : "cursor-not-allowed"
          }`}
          onClick={() => canDelete && onDelete(item.id)}
          disabled={!canDelete}
          title={canDelete ? "삭제" : "호스트만 삭제할 수 있습니다."}
        >
          <Trash2
            className={`h-3.5 w-3.5 ${
              canDelete ? "text-red-400" : "text-gray-300"
            }`}
          />
        </button>
      </td>
    </tr>
  );
}

function StatusCell({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const statuses = ["상담중", "상담완료", "등록", "보류", "미등록"];

  const statusColor = (s: string) => {
    switch (s) {
      case "등록":
        return "bg-emerald-100 text-emerald-700";
      case "상담완료":
        return "bg-blue-100 text-blue-700";
      case "보류":
        return "bg-amber-100 text-amber-700";
      case "미등록":
        return "bg-gray-200 text-gray-600";
      default:
        return "bg-indigo-100 text-indigo-700";
    }
  };

  if (editing) {
    return (
      <div className="relative">
        <select
          className="w-full px-2 py-1 text-sm border rounded bg-white focus:outline-none focus:ring-1 focus:ring-primary"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setEditing(false);
          }}
          onBlur={() => setEditing(false)}
          autoFocus
        >
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="px-1 py-1 cursor-pointer" onClick={() => setEditing(true)}>
      <Badge className={`${statusColor(value)} text-[11px] font-normal`}>
        {value}
      </Badge>
    </div>
  );
}

function EditableCell({
  value,
  onBlur,
  type = "text",
  transform,
  maxLength,
  className,
  disabled = false,
}: {
  value: string;
  onBlur: (v: string) => void;
  type?: string;
  transform?: (v: string) => string;
  maxLength?: number;
  className?: string;
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
    const next = localVal ?? "";
    if (next !== (value ?? "")) onBlur(next);
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
        className={`w-full px-2 py-1.5 text-sm border rounded bg-white text-black focus:outline-none focus:ring-1 focus:ring-primary ${
          className ?? ""
        }`}
        value={localVal}
        onChange={(e) =>
          setLocalVal(transform ? transform(e.target.value) : e.target.value)
        }
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        maxLength={maxLength}
      />
    );
  }

  return (
    <div
      className={`px-2 py-1.5 text-sm text-black rounded min-h-[32px] flex items-center ${
        disabled ? "cursor-not-allowed" : "cursor-text hover:bg-muted/30"
      } ${className ?? ""}`}
      onClick={() => {
        if (!disabled) setEditing(true);
      }}
      title={disabled ? "직원은 이 항목을 수정할 수 없습니다." : value || ""}
    >
      {value || <span className="text-muted-foreground/40">-</span>}
    </div>
  );
}

function InlineNotesCell({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setLocal(value), [value]);

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      autoResize(ref.current);
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (local !== value) onCommit(local);
  };

  if (!editing) {
    return (
      <div
        className="px-2 py-1.5 text-sm cursor-text rounded hover:bg-muted/30 min-h-[32px] whitespace-pre-wrap"
        onClick={() => setEditing(true)}
        title="클릭하여 편집"
      >
        {value ? value : <span className="text-muted-foreground/40">-</span>}
      </div>
    );
  }

  return (
    <textarea
      ref={ref}
      className="w-full text-sm border rounded bg-white focus:outline-none focus:ring-1 focus:ring-primary px-2 py-1.5 resize-none"
      value={local}
      onChange={(e) => {
        setLocal(e.target.value);
        autoResize(e.target);
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setLocal(value);
          setEditing(false);
        }
      }}
      placeholder="상담내역 입력..."
      rows={1}
    />
  );
}

function AutoGrowTextarea({
  value,
  onChange,
  className,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (ref.current) autoResize(ref.current);
  }, [value]);

  return (
    <textarea
      ref={ref}
      className={`resize-none ${className ?? ""}`}
      value={value}
      placeholder={placeholder}
      rows={1}
      onChange={(e) => {
        onChange(e.target.value);
        autoResize(e.target);
      }}
    />
  );
}