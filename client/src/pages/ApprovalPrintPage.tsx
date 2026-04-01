import { useEffect, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { ArrowLeft, Printer } from "lucide-react";
import { getFieldSetting, type ApprovalFieldSetting } from "@/lib/approvalFieldSettings";

function getFormTypeLabel(formType: string) {
  if (formType === "attendance") return "근태";
  if (formType === "business_trip") return "출장";
  if (formType === "general") return "일반";
  return formType;
}

function getStatusLabel(status: string) {
  if (status === "pending") return "신청중";
  if (status === "approved") return "승인완료";
  if (status === "rejected") return "반려";
  if (status === "draft") return "임시저장";
  if (status === "cancelled") return "취소";
  return status;
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

function isImageFile(url?: string | null, fileName?: string | null) {
  const target = `${url || ""} ${fileName || ""}`.toLowerCase();
  return (
    target.includes(".png") ||
    target.includes(".jpg") ||
    target.includes(".jpeg") ||
    target.includes(".gif") ||
    target.includes(".webp")
  );
}

export default function ApprovalPrintPage() {
  const [, params] = useRoute("/e-approval/:id/print");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const role = user?.role ?? "";
  const isPrivileged =
    role === "admin" || role === "host" || role === "superhost";

  const id = Number(params?.id);
const printRef = useRef<HTMLDivElement | null>(null);
const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);


  const detailQuery = trpc.approval.detail.useQuery(
    { id },
    { enabled: !!id }
  );

  const data = detailQuery.data;
  const doc = data?.document;
  const lines = data?.lines ?? [];

const fieldSettings = (fieldSettingsQuery.data ?? []) as ApprovalFieldSetting[];

const detailField = getFieldSetting(fieldSettings, "attendanceDetailType", "상세 유형");
const startField = getFieldSetting(fieldSettings, "attendanceStartTime", "시작 시간");
const endField = getFieldSetting(fieldSettings, "attendanceEndTime", "종료 시간");

const destinationField = getFieldSetting(fieldSettings, "destination", "목적지");
const visitPlaceField = getFieldSetting(fieldSettings, "visitPlace", "방문처");
const companionField = getFieldSetting(fieldSettings, "companion", "동행자");

const deptField = getFieldSetting(fieldSettings, "requestDepartment", "요청 부서");
const noteField = getFieldSetting(fieldSettings, "extraNote", "추가 메모");

const { data: settings } = trpc.approval.getPrintSettings.useQuery();
const fieldSettingsQuery = trpc.approval.getFieldSettings.useQuery({
  formType: doc?.formType || "general",
});

const handleDownloadPdf = async () => {
  if (!printRef.current || !doc) {
    toast.error("PDF로 저장할 문서를 찾을 수 없습니다.");
    return;
  }

  try {
    setIsDownloadingPdf(true);

    const canvas = await html2canvas(printRef.current, {
  scale: 2,
  useCORS: true,
  backgroundColor: "#ffffff",
  logging: false,
  windowWidth: printRef.current.scrollWidth,
  windowHeight: printRef.current.scrollHeight,
  scrollX: 0,
  scrollY: 0,
});

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");

   const pageWidth = 210;
const pageHeight = 297;
const marginX = 10;
const marginY = 10;

const usableWidth = pageWidth - marginX * 2;
const usableHeight = pageHeight - marginY * 2;

const imgWidth = usableWidth;
const imgHeight = (canvas.height * imgWidth) / canvas.width;

let renderedHeight = 0;
let pageIndex = 0;

while (renderedHeight < imgHeight) {
  const positionY = marginY - renderedHeight;

  if (pageIndex > 0) {
    pdf.addPage();
  }

  pdf.addImage(
    imgData,
    "PNG",
    marginX,
    positionY,
    imgWidth,
    imgHeight,
    undefined,
    "FAST"
  );

  renderedHeight += usableHeight;
  pageIndex += 1;
}

    const safeDocNo = String(doc.documentNumber || `approval-${id}`).replace(/[^\w\-가-힣]+/g, "_");
    pdf.save(`${safeDocNo}.pdf`);
  } catch (err: any) {
    toast.error(err?.message || "PDF 저장 중 오류가 발생했습니다.");
  } finally {
    setIsDownloadingPdf(false);
  }
};

  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      @media print {
        body {
          background: white !important;
        }

        .no-print {
          display: none !important;
        }

        .print-page {
          padding: 0 !important;
          margin: 0 !important;
        }

        .print-sheet {
          box-shadow: none !important;
          border: none !important;
          margin: 0 !important;
          width: 100% !important;
          max-width: 100% !important;
        }
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  if (detailQuery.isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">출력 문서를 불러오는 중...</div>;
  }

  if (!doc) {
    return <div className="p-6 text-sm text-destructive">출력할 문서를 찾을 수 없습니다.</div>;
  }
const renderDocumentBody = () => {
  if (!doc) return null;

  if (doc.formType === "attendance") {
  return (
    <div className="overflow-hidden rounded-xl border">
      <table className="w-full border-collapse text-sm">
        <tbody>
          <tr className="border-b">
            <th className="w-40 bg-slate-50 px-4 py-3 text-left font-medium">문서 구분</th>
            <td className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{getFormTypeLabel(doc.formType)}</Badge>
                <Badge>{doc.subType}</Badge>
              </div>
            </td>
          </tr>

          <tr className="border-b">
            <th className="bg-slate-50 px-4 py-3 text-left font-medium">대상일</th>
            <td className="px-4 py-3">{doc.targetDate || "-"}</td>
          </tr>

          {detailField.isVisible && (
  <tr className="border-b">
    <th className="bg-slate-50 px-4 py-3 text-left font-medium">
      {detailField.label}
    </th>
    <td className="px-4 py-3">
      {doc.attendanceDetailType || "-"}
    </td>
  </tr>
)}

          <tr className="border-b">
            <th className="bg-slate-50 px-4 py-3 text-left font-medium">시간</th>
            <td className="px-4 py-3">
              {doc.attendanceStartTime && doc.attendanceEndTime
                ? `${doc.attendanceStartTime} ~ ${doc.attendanceEndTime}`
                : "-"}
            </td>
          </tr>

          {deptField.isVisible && (
  <tr className="border-b">
    <th className="bg-slate-50 px-4 py-3 text-left font-medium">
      {deptField.label}
    </th>
    <td className="px-4 py-3">{doc.requestDepartment || "-"}</td>
  </tr>
)}

          <tr className="border-b">
            <th className="bg-slate-50 px-4 py-3 text-left font-medium">제목</th>
            <td className="px-4 py-3 font-medium">{doc.title}</td>
          </tr>

       {deptField.isVisible && (
  <tr className="border-b">
    <th className="bg-slate-50 px-4 py-3 text-left font-medium">
      {deptField.label}
    </th>
    <td className="px-4 py-3">{doc.requestDepartment || "-"}</td>
  </tr>
)}

          <tr>
            <th className="bg-slate-50 px-4 py-3 text-left font-medium align-top">사유</th>
            <td className="px-4 py-3 whitespace-pre-wrap leading-7">
              {doc.reason || "-"}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

 if (doc.formType === "business_trip") {
  return (
    <div className="overflow-hidden rounded-xl border">
      <table className="w-full border-collapse text-sm">
        <tbody>
          <tr className="border-b">
            <th className="w-40 bg-slate-50 px-4 py-3 text-left font-medium">문서 구분</th>
            <td className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{getFormTypeLabel(doc.formType)}</Badge>
                <Badge>{doc.subType}</Badge>
              </div>
            </td>
          </tr>

          <tr className="border-b">
            <th className="bg-slate-50 px-4 py-3 text-left font-medium">출장 기간</th>
            <td className="px-4 py-3">
              {doc.startDate && doc.endDate
                ? `${doc.startDate} ~ ${doc.endDate}`
                : doc.targetDate || "-"}
            </td>
          </tr>

          {destinationField.isVisible && (
  <tr className="border-b">
    <th className="bg-slate-50 px-4 py-3 text-left font-medium">
      {destinationField.label}
    </th>
    <td className="px-4 py-3">{doc.destination || "-"}</td>
  </tr>
)}

          {visitPlaceField.isVisible && (
  <tr className="border-b">
    <th className="bg-slate-50 px-4 py-3 text-left font-medium">
      {visitPlaceField.label}
    </th>
    <td className="px-4 py-3">{doc.visitPlace || "-"}</td>
  </tr>
)}

          {companionField.isVisible && (
  <tr className="border-b">
    <th className="bg-slate-50 px-4 py-3 text-left font-medium">
      {companionField.label}
    </th>
    <td className="px-4 py-3">{doc.companion || "-"}</td>
  </tr>
)}

          <tr className="border-b">
            <th className="bg-slate-50 px-4 py-3 text-left font-medium">요청 부서</th>
            <td className="px-4 py-3">{doc.requestDepartment || "-"}</td>
          </tr>

          <tr className="border-b">
            <th className="bg-slate-50 px-4 py-3 text-left font-medium">제목</th>
            <td className="px-4 py-3 font-medium">{doc.title}</td>
          </tr>

          <tr className="border-b">
            <th className="bg-slate-50 px-4 py-3 text-left font-medium align-top">추가 메모</th>
            <td className="px-4 py-3 whitespace-pre-wrap">
              {doc.extraNote || "-"}
            </td>
          </tr>

          <tr>
            <th className="bg-slate-50 px-4 py-3 text-left font-medium align-top">출장 사유</th>
            <td className="px-4 py-3 whitespace-pre-wrap leading-7">
              {doc.reason || "-"}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

  return (
  <div className="overflow-hidden rounded-xl border">
    <table className="w-full border-collapse text-sm">
      <tbody>
        <tr className="border-b">
          <th className="w-40 bg-slate-50 px-4 py-3 text-left font-medium">문서 구분</th>
          <td className="px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{getFormTypeLabel(doc.formType)}</Badge>
              <Badge>{doc.subType}</Badge>
            </div>
          </td>
        </tr>

        <tr className="border-b">
          <th className="bg-slate-50 px-4 py-3 text-left font-medium">시행일자</th>
          <td className="px-4 py-3">
            {doc.startDate && doc.endDate
              ? `${doc.startDate} ~ ${doc.endDate}`
              : doc.targetDate || "-"}
          </td>
        </tr>

        <tr className="border-b">
          <th className="bg-slate-50 px-4 py-3 text-left font-medium">요청 부서</th>
          <td className="px-4 py-3">{doc.requestDepartment || "-"}</td>
        </tr>

        <tr className="border-b">
          <th className="bg-slate-50 px-4 py-3 text-left font-medium">제목</th>
          <td className="px-4 py-3 font-medium">{doc.title}</td>
        </tr>

        <tr className="border-b">
          <th className="bg-slate-50 px-4 py-3 text-left font-medium align-top">추가 메모</th>
          <td className="px-4 py-3 whitespace-pre-wrap">
            {doc.extraNote || "-"}
          </td>
        </tr>

        <tr>
          <th className="bg-slate-50 px-4 py-3 text-left font-medium align-top">사유</th>
          <td className="px-4 py-3 whitespace-pre-wrap leading-7">
            {doc.reason || "-"}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
);
};
  if (!isPrivileged && Number(doc.applicantUserId) !== Number(user?.id)) {
    return (
      <div className="p-4 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle>접근 권한 없음</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            본인 문서만 출력할 수 있습니다.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="print-page min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="no-print mx-auto mb-4 flex max-w-4xl items-center justify-between gap-2">
  <Button variant="outline" onClick={() => setLocation(`/e-approval/${id}`)}>
    <ArrowLeft className="mr-2 h-4 w-4" />
    상세로 돌아가기
  </Button>

  <div className="flex items-center gap-2">
    <Button
      type="button"
      variant="outline"
      onClick={handleDownloadPdf}
      disabled={isDownloadingPdf}
    >
      <Printer className="mr-2 h-4 w-4" />
      {isDownloadingPdf ? "PDF 생성 중..." : "PDF 다운로드"}
    </Button>

    <Button onClick={() => window.print()}>
      <Printer className="mr-2 h-4 w-4" />
      인쇄
    </Button>
  </div>
</div>

      <div ref={printRef}>
  <Card className="print-sheet mx-auto max-w-4xl border bg-white shadow-sm print:shadow-none">
        <CardContent className="space-y-8 p-8 md:p-10">
          {/* 제목 */}
          <div className="border-b pb-6 text-center">
  <p className="text-base font-semibold tracking-[0.2em] text-slate-600">
    {settings?.companyName || "(주)위드원 교육"}
  </p>

  <h1 className="mt-3 text-3xl font-bold tracking-wide text-slate-900">
    {settings?.documentTitle || "전자결재 문서"}
  </h1>

  <p className="mt-2 text-lg font-medium text-slate-700">
    {getFormTypeLabel(doc.formType)} 문서
  </p>

  <p className="mt-3 text-sm text-muted-foreground">
    문서번호: {doc.documentNumber}
  </p>

  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
    <Badge>{getStatusLabel(doc.status)}</Badge>
    <Badge variant="outline">
      진행률{" "}
      {(() => {
        const approved = lines.filter((l: any) => l.stepStatus === "approved").length;
        return `${approved} / ${lines.length}`;
      })()}
    </Badge>
  </div>
</div>

          {/* 상단 기본 정보 + 결재 상태 */}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="overflow-hidden rounded-xl border">
              <table className="w-full border-collapse text-sm">
                <tbody>
                  <tr className="border-b">
                    <th className="w-32 bg-slate-50 px-4 py-3 text-left font-medium">기안자</th>
                    <td className="px-4 py-3">{doc.applicantUserName || "-"}</td>
                  </tr>
                  <tr className="border-b">
                    <th className="bg-slate-50 px-4 py-3 text-left font-medium">소속</th>
                    <td className="px-4 py-3">{doc.applicantTeamName || "-"}</td>
                  </tr>
                  <tr className="border-b">
                    <th className="bg-slate-50 px-4 py-3 text-left font-medium">직급</th>
                    <td className="px-4 py-3">{doc.applicantPositionName || "-"}</td>
                  </tr>
                  <tr className="border-b">
                    <th className="bg-slate-50 px-4 py-3 text-left font-medium">기안일</th>
                    <td className="px-4 py-3">{formatDateTime(doc.createdAt)}</td>
                  </tr>
                  <tr>
                    <th className="bg-slate-50 px-4 py-3 text-left font-medium">문서번호</th>
                    <td className="px-4 py-3">{doc.documentNumber}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="overflow-hidden rounded-xl border">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="px-4 py-3 text-left">결재순서</th>
                    <th className="px-4 py-3 text-left">승인자</th>
                    <th className="px-4 py-3 text-left">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-4 text-center text-muted-foreground">
                        승인 라인이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    [...lines]
  .sort((a: any, b: any) => Number(a.stepOrder) - Number(b.stepOrder))
  .map((line: any) => (
                      <tr key={line.id} className="border-b last:border-b-0">
                        <td className="px-4 py-3">{line.stepOrder}차</td>
                        <td className="px-4 py-3">
  {line.approverName || "-"}
  {line.stepStatus === "approved" ? (
    <span className="ml-2 text-xs text-emerald-600">(승인완료)</span>
  ) : null}
  {line.stepStatus === "rejected" ? (
    <span className="ml-2 text-xs text-red-600">(반려)</span>
  ) : null}
</td>
                        <td className="px-4 py-3">
  {line.stepStatus === "pending" &&
  doc.status === "pending" &&
  Number(line.stepOrder) === Number(doc.currentStepOrder)
    ? "현재 차례"
    : getStatusLabel(line.stepStatus)}
</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

         {/* 본문 정보 */}
{renderDocumentBody()}

{doc.attachmentUrl ? (
  <div className="rounded-xl border p-4 text-sm">
    <p className="font-medium">첨부파일</p>

    <div className="mt-3 space-y-3">
      <div>
        <p className="font-medium">{doc.attachmentName || "첨부파일"}</p>
        <a
          href={doc.attachmentUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-blue-600 underline break-all"
        >
          {doc.attachmentUrl}
        </a>
      </div>

      {isImageFile(doc.attachmentUrl, doc.attachmentName) ? (
        <div className="overflow-hidden rounded-lg border bg-slate-50 p-2">
          <img
            src={doc.attachmentUrl}
            alt={doc.attachmentName || "첨부 이미지"}
            className="max-h-[420px] w-full object-contain"
          />
        </div>
      ) : null}
    </div>
  </div>
) : null}

          {/* 상태 */}
          <div className="rounded-xl border p-4 text-sm">
  <div className="flex flex-wrap items-center gap-4">
    {doc.finalApprovedAt ? (
      <span className="text-muted-foreground">
        최종 승인일: {formatDateTime(doc.finalApprovedAt)}
      </span>
    ) : null}
    {doc.rejectedAt ? (
      <span className="text-muted-foreground">
        반려일: {formatDateTime(doc.rejectedAt)}
      </span>
    ) : null}
    {!doc.finalApprovedAt && !doc.rejectedAt ? (
      <span className="text-muted-foreground">
        문서 진행 중
      </span>
    ) : null}
  </div>

            {doc.rejectedReason ? (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
                반려 사유: {doc.rejectedReason}
              </div>
            ) : null}
          </div>
{/* 결재 이력 */}
<div className="overflow-hidden rounded-xl border">
  <div className="border-b bg-slate-50 px-4 py-3 text-sm font-medium">
    결재 이력
  </div>

  <table className="w-full border-collapse text-sm">
    <thead>
      <tr className="border-b bg-slate-50">
        <th className="px-4 py-3 text-left">차수</th>
        <th className="px-4 py-3 text-left">승인자</th>
        <th className="px-4 py-3 text-left">상태</th>
        <th className="px-4 py-3 text-left">처리일시</th>
        <th className="px-4 py-3 text-left">코멘트</th>
      </tr>
    </thead>
    <tbody>
      {lines.length === 0 ? (
        <tr>
          <td colSpan={5} className="px-4 py-4 text-center text-muted-foreground">
            결재 이력이 없습니다.
          </td>
        </tr>
      ) : (
        [...lines]
          .sort((a: any, b: any) => Number(a.stepOrder) - Number(b.stepOrder))
          .map((line: any) => (
            <tr key={line.id} className="border-b last:border-b-0 align-top">
              <td className="px-4 py-3">{line.stepOrder}차</td>
              <td className="px-4 py-3">{line.approverName || "-"}</td>
              <td className="px-4 py-3">
                {line.stepStatus === "pending" &&
                doc.status === "pending" &&
                Number(line.stepOrder) === Number(doc.currentStepOrder)
                  ? "현재 차례"
                  : getStatusLabel(line.stepStatus)}
              </td>
              <td className="px-4 py-3">
                {line.actedAt ? formatDateTime(line.actedAt) : "-"}
              </td>
              <td className="px-4 py-3 whitespace-pre-wrap leading-6">
                {line.comment || "-"}
              </td>
            </tr>
          ))
      )}
    </tbody>
  </table>
</div>
          {/* 하단 서명 영역 느낌 */}
         <div className="grid gap-4 pt-8 md:grid-cols-2">
  <div className="rounded-xl border p-6 text-center">
    <p className="text-sm text-muted-foreground">
      {settings?.applicantSignLabel || "신청자 서명"}
    </p>
    <div className="mt-8 border-t border-dashed" />
    <p className="mt-3 text-xs text-muted-foreground">
      서명 / 확인
    </p>
  </div>

  <div className="rounded-xl border p-6 text-center">
    <p className="text-sm text-muted-foreground">
      {settings?.finalApproverSignLabel || "최종 승인자 서명"}
    </p>
    <div className="mt-8 border-t border-dashed" />
    <p className="mt-3 text-xs text-muted-foreground">
      서명 / 확인
    </p>
  </div>
</div>
        </CardContent>
      </Card>
    </div>
</div>
  );
}