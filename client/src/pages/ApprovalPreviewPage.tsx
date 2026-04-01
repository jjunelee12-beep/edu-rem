import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { ArrowLeft, Printer } from "lucide-react";
import { getFieldSetting, type ApprovalFieldSetting } from "@/lib/approvalFieldSettings";

type PreviewFormType = "attendance" | "business_trip" | "general";

type PreviewData = {
  formType: PreviewFormType;
  subType: string;
  title: string;
  reason: string;
  targetDate?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  applicantName?: string | null;
  teamName?: string | null;
  positionName?: string | null;
  attachmentName?: string | null;
  attachmentUrl?: string | null;
  createdAt?: string | null;
requestDepartment?: string | null;
extraNote?: string | null;
};

function getFormTypeLabel(formType: string) {
  if (formType === "attendance") return "근태";
  if (formType === "business_trip") return "출장";
  if (formType === "general") return "일반";
  return formType;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
}

export default function ApprovalPreviewPage() {
const fieldSettingsQuery = trpc.approval.getFieldSettings.useQuery({
  formType: previewData?.formType || "general",
});
  const [, setLocation] = useLocation();
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("approval-preview");
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as PreviewData;
      setPreviewData(parsed);
    } catch {
      setPreviewData(null);
    }
  }, []);

  const backPath = useMemo(() => {
    if (!previewData) return "/e-approval";

    if (previewData.formType === "attendance") return "/e-approval/attendance";
    if (previewData.formType === "business_trip") return "/e-approval/business-trip";
    return "/e-approval/general";
  }, [previewData]);

const fieldSettings = (fieldSettingsQuery.data ?? []) as ApprovalFieldSetting[];

const deptField = getFieldSetting(fieldSettings, "requestDepartment", "요청 부서");
const noteField = getFieldSetting(fieldSettings, "extraNote", "추가 메모");

  if (!previewData) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            미리보기 데이터가 없습니다.
          </CardContent>
        </Card>

        <Button variant="outline" onClick={() => setLocation("/e-approval")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          문서함으로
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="mx-auto mb-4 flex max-w-4xl items-center justify-between gap-2">
        <Button variant="outline" onClick={() => setLocation(backPath)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          작성 화면으로
        </Button>

        <Button onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />
          인쇄 / PDF 저장
        </Button>
      </div>

      <Card className="mx-auto max-w-4xl border bg-white shadow-sm">
        <CardContent className="space-y-8 p-8 md:p-10">
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-wide">
              {getFormTypeLabel(previewData.formType)} 전자결재 미리보기
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              저장 전 미리보기 문서
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="overflow-hidden rounded-xl border">
              <table className="w-full border-collapse text-sm">
                <tbody>
                  <tr className="border-b">
                    <th className="w-32 bg-slate-50 px-4 py-3 text-left font-medium">기안자</th>
                    <td className="px-4 py-3">{previewData.applicantName || "-"}</td>
                  </tr>
                  <tr className="border-b">
                    <th className="bg-slate-50 px-4 py-3 text-left font-medium">소속</th>
                    <td className="px-4 py-3">{previewData.teamName || "-"}</td>
                  </tr>
                  <tr className="border-b">
                    <th className="bg-slate-50 px-4 py-3 text-left font-medium">직급</th>
                    <td className="px-4 py-3">{previewData.positionName || "-"}</td>
                  </tr>
                  <tr className="border-b">
                    <th className="bg-slate-50 px-4 py-3 text-left font-medium">기안일</th>
                    <td className="px-4 py-3">{formatDateTime(previewData.createdAt)}</td>
                  </tr>
                  <tr>
                    <th className="bg-slate-50 px-4 py-3 text-left font-medium">문서번호</th>
                    <td className="px-4 py-3">저장 후 자동생성</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="overflow-hidden rounded-xl border">
              <table className="w-full border-collapse text-sm">
                <tbody>
                  <tr className="border-b">
                    <th className="w-32 bg-slate-50 px-4 py-3 text-left font-medium">문서 구분</th>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">
                          {getFormTypeLabel(previewData.formType)}
                        </Badge>
                        <Badge>{previewData.subType}</Badge>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <th className="bg-slate-50 px-4 py-3 text-left font-medium">시행일자</th>
                    <td className="px-4 py-3">
                      {formatDate(
                        previewData.targetDate ||
                          previewData.startDate ||
                          previewData.endDate
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
<div className="overflow-hidden rounded-xl border">
  <table className="w-full border-collapse text-sm">
    <tbody>
      <tr className="border-b">
        <th className="w-40 bg-slate-50 px-4 py-3 text-left font-medium">제목</th>
        <td className="px-4 py-3 font-medium">{previewData.title || "-"}</td>
      </tr>

      {deptField.isVisible && (
  <tr className="border-b">
    <th className="bg-slate-50 px-4 py-3 text-left font-medium">
      {deptField.label}
    </th>
    <td className="px-4 py-3">
      {previewData.requestDepartment || "-"}
    </td>
  </tr>
)}

      {noteField.isVisible && (
  <tr className="border-b">
    <th className="bg-slate-50 px-4 py-3 text-left font-medium align-top">
      {noteField.label}
    </th>
    <td className="px-4 py-3 whitespace-pre-wrap">
      {previewData.extraNote || "-"}
    </td>
  </tr>
)}

      <tr>
        <th className="bg-slate-50 px-4 py-3 text-left font-medium align-top">사유</th>
        <td className="px-4 py-3 whitespace-pre-wrap leading-7">
          {previewData.reason || "-"}
        </td>
      </tr>
    </tbody>
  </table>
</div>

          {previewData.attachmentUrl ? (
            <div className="rounded-xl border p-4 text-sm">
              <p className="font-medium">첨부파일</p>
              <a
                href={previewData.attachmentUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-primary underline"
              >
                {previewData.attachmentName || "첨부파일 열기"}
              </a>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}