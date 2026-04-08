import { useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Upload, X } from "lucide-react";
import { getFieldSetting, type ApprovalFieldSetting } from "@/lib/approvalFieldSettings";

const attendanceTypes = ["연차", "지각", "결근", "반차", "조퇴", "병가"] as const;

export default function ApprovalAttendancePage() {
const fieldSettingsQuery = trpc.approval.getFieldSettings.useQuery({
  formType: "attendance",
});
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const today = useMemo(() => {
    const now = new Date();
    return now.toISOString().slice(0, 10);
  }, []);

  const [form, setForm] = useState({
  targetDate: today,
  subType: "연차",
  title: "",
  reason: "",

  attendanceDetailType: "",
  attendanceStartTime: "",
  attendanceEndTime: "",
  requestDepartment: "",
  extraNote: "",
});
const fieldSettings = (fieldSettingsQuery.data ?? []) as ApprovalFieldSetting[];

const detailField = getFieldSetting(fieldSettings, "attendanceDetailType", "상세 유형");
const startField = getFieldSetting(fieldSettings, "attendanceStartTime", "시작 시간");
const endField = getFieldSetting(fieldSettings, "attendanceEndTime", "종료 시간");
const deptField = getFieldSetting(fieldSettings, "requestDepartment", "요청 부서");
const noteField = getFieldSetting(fieldSettings, "extraNote", "추가 메모");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function uploadSingleFile(file: File) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    if (!response.ok) {
      let message = "파일 업로드에 실패했습니다.";
      try {
        const json = await response.json();
        message = json?.message || message;
      } catch {
        // ignore
      }
      throw new Error(message);
    }

    const json = await response.json();

    if (!json?.success || !json?.fileUrl) {
      throw new Error("파일 업로드 응답이 올바르지 않습니다.");
    }

    return {
      fileName: json.fileName as string,
      fileUrl: json.fileUrl as string,
    };
  }

  const createMutation = trpc.approval.create.useMutation({
    onSuccess: () => {
      toast.success("근태 신청이 완료되었습니다.");
      setLocation("/e-approval");
    },
    onError: (err) => {
      toast.error(err.message || "신청 중 오류 발생");
    },
  });

  const handleSubmit = async () => {
if (detailField.isRequired && !form.attendanceDetailType.trim()) {
  toast.error(`${detailField.label} 항목은 필수입니다.`);
  return;
}

if (startField.isRequired && !form.attendanceStartTime.trim()) {
  toast.error(`${startField.label} 항목은 필수입니다.`);
  return;
}

if (endField.isRequired && !form.attendanceEndTime.trim()) {
  toast.error(`${endField.label} 항목은 필수입니다.`);
  return;
}

if (deptField.isRequired && !form.requestDepartment.trim()) {
  toast.error(`${deptField.label} 항목은 필수입니다.`);
  return;
}

if (noteField.isRequired && !form.extraNote.trim()) {
  toast.error(`${noteField.label} 항목은 필수입니다.`);
  return;
}   

 if (!form.title.trim()) {
      toast.error("제목을 입력하세요.");
      return;
    }

    try {
      let attachmentName = uploadedFileName;
      let attachmentUrl = uploadedFileUrl;

      if (selectedFile && !uploadedFileUrl) {
        setIsUploading(true);
        const uploaded = await uploadSingleFile(selectedFile);
        attachmentName = uploaded.fileName;
        attachmentUrl = uploaded.fileUrl;
        setUploadedFileName(uploaded.fileName);
        setUploadedFileUrl(uploaded.fileUrl);
      }

      createMutation.mutate({
  formType: "attendance",
  subType: form.subType,
  title: form.title.trim(),
  reason: form.reason?.trim() || null,

  targetDate: form.targetDate,

  // 🔥 추가
  attendanceDetailType: form.attendanceDetailType || null,
  attendanceStartTime: form.attendanceStartTime || null,
  attendanceEndTime: form.attendanceEndTime || null,

  requestDepartment: form.requestDepartment || null,
  extraNote: form.extraNote || null,

  attachmentName: attachmentName || null,
  attachmentUrl: attachmentUrl || null,
});
    } catch (err: any) {
      toast.error(err?.message || "첨부 업로드 중 오류가 발생했습니다.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">전자결재 - 근태 신청</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          연차 / 지각 / 결근 / 반차 / 조퇴 / 병가 신청서를 작성합니다.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>근태 전자결재 양식</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <Label>기안자</Label>
              <Input value={user?.name ?? ""} disabled />
            </div>

            <div className="space-y-2">
              <Label>소속</Label>
              <Input value={(user as any)?.teamName ?? ""} disabled />
            </div>

            <div className="space-y-2">
              <Label>기안일</Label>
              <Input value={today} disabled />
            </div>

            <div className="space-y-2">
              <Label>문서번호</Label>
              <Input value="자동생성 예정" disabled />
            </div>
          </div>

     <div className="grid gap-4 md:grid-cols-2">
  <div className="space-y-2">
    <Label>시행일자</Label>
    <Input
      type="date"
      value={form.targetDate}
      onChange={(e) =>
        setForm((prev) => ({ ...prev, targetDate: e.target.value }))
      }
    />
  </div>

  <div className="space-y-2">
    <Label>근태 구분</Label>
    <Select
      value={form.subType}
      onValueChange={(value) =>
        setForm((prev) => ({ ...prev, subType: value }))
      }
    >
      <SelectTrigger>
        <SelectValue placeholder="근태 종류 선택" />
      </SelectTrigger>
      <SelectContent>
        {attendanceTypes.map((type) => (
          <SelectItem key={type} value={type}>
            {type}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
</div>
<div className="grid gap-4 md:grid-cols-3">
  {detailField.isVisible && (
    <div className="space-y-2">
      <Label>
        {detailField.label}
        {detailField.isRequired && " *"}
      </Label>
      <Input
        value={form.attendanceDetailType}
        onChange={(e) =>
          setForm((prev) => ({
            ...prev,
            attendanceDetailType: e.target.value,
          }))
        }
      />
    </div>
  )}

  {startField.isVisible && (
    <div className="space-y-2">
      <Label>
        {startField.label}
        {startField.isRequired && " *"}
      </Label>
      <Input
  type="time"
  value={form.attendanceStartTime}
  onChange={(e) =>
    setForm((prev) => ({
      ...prev,
      attendanceStartTime: e.target.value,
    }))
  }
/>
    </div>
  )}

  {endField.isVisible && (
    <div className="space-y-2">
      <Label>
        {endField.label}
        {endField.isRequired && " *"}
      </Label>
      <Input
  type="time"
  value={form.attendanceEndTime}
  onChange={(e) =>
    setForm((prev) => ({
      ...prev,
      attendanceEndTime: e.target.value,
    }))
  }
/>
    </div>
  )}
</div>

{deptField.isVisible && (
  <div className="space-y-2">
    <Label>
      {deptField.label}
      {deptField.isRequired && " *"}
    </Label>
    <Input
      value={form.requestDepartment}
      onChange={(e) =>
        setForm((prev) => ({
          ...prev,
          requestDepartment: e.target.value,
        }))
      }
    />
  </div>
)}

{noteField.isVisible && (
  <div className="space-y-2">
    <Label>
      {noteField.label}
      {noteField.isRequired && " *"}
    </Label>
    <Textarea
      value={form.extraNote}
      onChange={(e) =>
        setForm((prev) => ({
          ...prev,
          extraNote: e.target.value,
        }))
      }
    />
  </div>
)}

          <div className="space-y-2">
            <Label>제목</Label>
            <Input
              placeholder="예: 병가 신청서 / 반차 신청서"
              value={form.title}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, title: e.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label>사유</Label>
            <Textarea
              rows={8}
              placeholder="사유를 입력하세요."
              value={form.reason}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, reason: e.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label>첨부파일 / 이미지</Label>
            <Input
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setSelectedFile(file);
                setUploadedFileName(null);
                setUploadedFileUrl(null);
              }}
            />

            {selectedFile ? (
              <div className="flex items-center justify-between rounded-lg border bg-slate-50 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {uploadedFileUrl ? "업로드 준비 완료" : "저장 시 업로드"}
                  </p>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedFile(null);
                    setUploadedFileName(null);
                    setUploadedFileUrl(null);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={createMutation.isPending || isUploading}
            >
              {isUploading ? (
                <Upload className="mr-2 h-4 w-4" />
              ) : (
                <FileText className="mr-2 h-4 w-4" />
              )}
              {isUploading
                ? "첨부 업로드 중..."
                : createMutation.isPending
                ? "저장 중..."
                : "신청서 저장"}
            </Button>

            <Button
  type="button"
  variant="outline"
  onClick={() => {
    sessionStorage.setItem(
      "approval-preview",
      JSON.stringify({
        formType: "attendance",
        subType: form.subType,
        title: form.title,
        reason: form.reason,
        targetDate: form.targetDate,
        applicantName: user?.name ?? "",
        teamName: (user as any)?.teamName ?? "",
        positionName: (user as any)?.positionName ?? "",
        attachmentName: uploadedFileName ?? selectedFile?.name ?? null,
        attachmentUrl: uploadedFileUrl ?? null,
        createdAt: new Date().toISOString(),
attendanceDetailType: form.attendanceDetailType,
attendanceStartTime: form.attendanceStartTime,
attendanceEndTime: form.attendanceEndTime,

requestDepartment: form.requestDepartment,
extraNote: form.extraNote,
      })
    );

    setLocation("/e-approval/preview");
  }}
>
  미리보기
</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}