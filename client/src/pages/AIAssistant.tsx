import { useMemo, useState } from "react";
import { Sparkles, Database, Search, BellRing, ShieldAlert } from "lucide-react";

import { AIChatBox, type Message, type QuickAction } from "@/components/AIChatBox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function nowTimeLabel() {
  const now = new Date();
  return now.toLocaleString("ko-KR", {
    hour12: false,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildSearchResultMessage(query: string, response: any): Message {
  return {
    id: `assistant-search-${Date.now()}`,
    role: "assistant",
    content:
      response.students?.length || response.consultations?.length
        ? `검색어 "${query}" 기준 결과입니다.`
        : `검색어 "${query}" 기준 결과가 없습니다.`,
    createdAt: nowTimeLabel(),
    kind: "search_result",
    searchResults: {
      students:
        response.students?.map((item: any) => ({
          id: item.id,
          type: "student" as const,
          clientName: item.clientName,
          phone: item.phone,
          course: item.course,
          status: item.status,
          institution: item.institution,
        })) ?? [],
      consultations:
        response.consultations?.map((item: any) => ({
          id: item.id,
          type: "consultation" as const,
          clientName: item.clientName,
          phone: item.phone,
          desiredCourse: item.desiredCourse,
          status: item.status,
        })) ?? [],
    },
  };
}


function buildAlertsMessage(response: any, title: string): Message {
  const lines = [
    `${title}`,
    "",
    `결제일 누락: ${response.summary?.paymentDateMissingCount ?? 0}건`,
    `결제금액 누락: ${response.summary?.paymentAmountMissingCount ?? 0}건`,
    `담당자 미지정 상담: ${response.summary?.consultationAssigneeMissingCount ?? 0}건`,
    `실습 미섭외: ${response.summary?.practiceUnassignedCount ?? 0}건`,
  ];

  return {
    id: `assistant-alert-${Date.now()}`,
    role: "assistant",
    content: lines.join("\n"),
    createdAt: nowTimeLabel(),
    kind: "warning",
  };
}
function parseActionPrompt(text: string):
  | {
      action: "create_transfer_subject" | "create_plan_semester";
      studentKeyword: string;
      subjectName: string;
      category: "전공" | "교양" | "일반";
      semesterNo?: number;
    }
  | null {
  const trimmed = text.trim();

  const category: "전공" | "교양" | "일반" =
    trimmed.includes("교양")
      ? "교양"
      : trimmed.includes("일반")
      ? "일반"
      : "전공";

  const transferPatterns = [
  /^(.+?)\s+전적대\s+(.+?)\s+(전공|교양|일반)(?:으로)?\s*(입력해줘|등록해줘|추가해줘|넣어줘|추가)?$/,
  /^(.+?)\s+학생?\s+전적대(?:에)?\s+(.+?)\s+(전공|교양|일반)(?:으로)?\s*(입력해줘|등록해줘|추가해줘|넣어줘|추가)?$/,
  /^(.+?)\s+(.+?)\s+전적대\s+(전공|교양|일반)(?:으로)?\s*(입력해줘|등록해줘|추가해줘|넣어줘|추가)?$/,
];

for (const pattern of transferPatterns) {
  const match = trimmed.match(pattern);
  if (match) {
    return {
      action: "create_transfer_subject",
      studentKeyword: match[1].trim(),
      subjectName: match[2].trim(),
      category: match[3] as "전공" | "교양" | "일반",
    };
  }
}


 const planPatterns = [
  /^(.+?)\s+(\d+)학기(?:에)?\s+(.+?)\s+(전공|교양|일반)(?:으로)?\s*(넣어줘|입력해줘|등록해줘|추가해줘|추가)?$/,
  /^(.+?)\s+학생?\s+(\d+)학기\s+플랜(?:에)?\s+(.+?)\s+(전공|교양|일반)(?:으로)?\s*(넣어줘|입력해줘|등록해줘|추가해줘|추가)?$/,
  /^(.+?)\s+(\d+)학기\s+(.+?)\s+(전공|교양|일반)(?:으로)?\s*(플랜에)?\s*(넣어줘|입력해줘|등록해줘|추가해줘|추가)?$/,
  /^(.+?)\s+플랜\s+(\d+)학기(?:에)?\s+(.+?)\s+(전공|교양|일반)(?:으로)?\s*(넣어줘|입력해줘|등록해줘|추가해줘|추가)?$/,
];

for (const pattern of planPatterns) {
  const match = trimmed.match(pattern);
  if (match) {
    return {
      action: "create_plan_semester",
      studentKeyword: match[1].trim(),
      semesterNo: Number(match[2]),
      subjectName: match[3].trim(),
      category: match[4] as "전공" | "교양" | "일반",
    };
  }
}
  return null;
}

export default function AIAssistant() {
  const { user } = useAuth();
const bootstrapQuery = trpc.ai.bootstrap.useQuery(undefined, {
  enabled:
    user?.role === "admin" ||
    user?.role === "host" ||
    user?.role === "superhost",
});

const chatMutation = trpc.ai.chat.useMutation();
const createTransferSubjectMutation = trpc.ai.createTransferSubject.useMutation();
const createPlanSemesterMutation = trpc.ai.createPlanSemester.useMutation();
const runActionMutation = trpc.ai.runAction.useMutation();
const searchMutation = trpc.ai.search.useMutation();
const alertsQuery = trpc.ai.alerts.useQuery(undefined, {
  enabled:
    user?.role === "admin" ||
    user?.role === "host" ||
    user?.role === "superhost",
});
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome-1",
      role: "assistant",
      content: [
        "안녕하세요. CRM AI 도우미입니다.",
        "",
        "가능한 작업 예시:",
        "- 학생/상담 검색",
        "- 누락/결제 점검",
        "- 전적대 과목 입력 요청 해석",
        "- 오류코드/로그 분석",
        "",
        "현재는 **UI 연결용 1차 버전**입니다.",
      ].join("\n"),
      createdAt: nowTimeLabel(),
      kind: "text",
    },
  ]);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
const [quickSearchType, setQuickSearchType] = useState<"student" | "consultation" | null>(null);
const [transferTarget, setTransferTarget] = useState<{ id: number; name?: string } | null>(null);
const [planTarget, setPlanTarget] = useState<{ id: number; name?: string } | null>(null);

const [transferSubjectName, setTransferSubjectName] = useState("");
const [transferCategory, setTransferCategory] = useState<"전공" | "교양" | "일반">("전공");

const [planSemesterNo, setPlanSemesterNo] = useState(1);
const [planSubjectName, setPlanSubjectName] = useState("");
const [planCategory, setPlanCategory] = useState<"전공" | "교양" | "일반">("전공");
const [actionCandidates, setActionCandidates] = useState<
  { id: number; clientName?: string; phone?: string; course?: string; status?: string; institution?: string }[]
>([]);
const [pendingAction, setPendingAction] = useState<
  | {
      action: "create_transfer_subject" | "create_plan_semester";
      studentKeyword: string;
      subjectName: string;
      category: "전공" | "교양" | "일반";
      semesterNo?: number;
selectedStudentId?: number;
    }
  | null
>(null);
const [quickSearchKeyword, setQuickSearchKeyword] = useState("");
  const suggestedPrompts = useMemo(
    () => [
      "이재준 찾아줘",
      "오늘 결제 누락된 학생 보여줘",
      "실습 미섭외 학생 정리해줘",
      "전적대 과목 입력 요청 구조 짜줘",
      "최근 오류로그 분석해줘",
    ],
    []
  );

 const quickActions = useMemo<QuickAction[]>(
  () => [
    {
      key: "student_search",
      label: "학생 찾기",
      prompt: "학생 이름으로 검색해줘",
      runImmediately: true,
    },
    {
      key: "consultation_search",
      label: "상담 찾기",
      prompt: "상담 DB에서 검색해줘",
      runImmediately: true,
    },
    {
      key: "alerts_missing",
      label: "누락 확인",
      prompt: "입력 누락 항목 점검해줘",
      runImmediately: true,
    },
    {
      key: "alerts_payment",
      label: "결제 확인",
      prompt: "오늘 결제 관련 항목 보여줘",
      runImmediately: true,
    },
    {
      key: "error_analysis",
      label: "오류 분석",
      prompt: "최근 오류로그 분석해줘",
      runImmediately: true,
    },
  ],
  []
);
const handleSendMessage = async (content: string, files?: File[]) => {
  setErrorMessage(null);

  const userMessage: Message = {
    id: `user-${Date.now()}`,
    role: "user",
    content: content || (files?.length ? "[파일만 첨부됨]" : ""),
    createdAt: nowTimeLabel(),
    attachments: files?.map((file) => ({
      id: `${file.name}-${file.size}`,
      name: file.name,
      type: file.type,
      size: file.size,
      url: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
    })),
  };

  setMessages((prev) => [...prev, userMessage]);
  setIsLoading(true);

  try {
    const parsedAction = parseActionPrompt(content);

    if (parsedAction) {
      const previewResponse = await runActionMutation.mutateAsync(parsedAction);

      if (previewResponse.needsSelection) {
        setPendingAction(parsedAction);
        setActionCandidates(previewResponse.candidates ?? []);

        const assistantMessage: Message = {
          id: `assistant-select-${Date.now()}`,
          role: "assistant",
          content: previewResponse.message || "대상 학생을 선택해주세요.",
          createdAt: nowTimeLabel(),
          kind: "search_result",
          searchResults: {
            students: (previewResponse.candidates ?? []).map((item: any) => ({
              id: item.id,
              type: "student" as const,
              clientName: item.clientName,
              phone: item.phone,
              course: item.course,
              status: item.status,
              institution: item.institution,
            })),
          },
        };

        setMessages((prev) => [...prev, assistantMessage]);
        return;
      }

      setPendingAction({
        ...parsedAction,
        selectedStudentId: previewResponse.student?.id,
      });

      const assistantMessage: Message = {
        id: `assistant-confirm-${Date.now()}`,
        role: "assistant",
        content:
          parsedAction.action === "create_transfer_subject"
            ? [
                "입력 전 확인이 필요합니다.",
                "",
                `학생: ${previewResponse.student?.name || parsedAction.studentKeyword}`,
                `작업: 전적대 과목 입력`,
                `과목명: ${parsedAction.subjectName}`,
                `구분: ${parsedAction.category}`,
                "",
                "아래 확인 버튼을 누르면 입력합니다.",
              ].join("\n")
            : [
                "입력 전 확인이 필요합니다.",
                "",
                `학생: ${previewResponse.student?.name || parsedAction.studentKeyword}`,
                `작업: 우리 플랜 입력`,
                `학기: ${parsedAction.semesterNo}학기`,
                `과목명: ${parsedAction.subjectName}`,
                `구분: ${parsedAction.category}`,
                "",
                "아래 확인 버튼을 누르면 입력합니다.",
              ].join("\n"),
        createdAt: nowTimeLabel(),
        kind: "warning",
      };

      setMessages((prev) => [...prev, assistantMessage]);
      return;
    }

    const response = await chatMutation.mutateAsync({
      message: content,
    });

    const assistantMessage: Message = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: response.answer || "응답이 없습니다.",
      createdAt: nowTimeLabel(),
      kind:
        response.mode === "search"
          ? "search_result"
          : response.mode === "alert"
          ? "warning"
          : "text",
      searchResults:
        response.mode === "search"
          ? {
              students:
                response.data?.students?.map((item: any) => ({
                  id: item.id,
                  type: "student" as const,
                  clientName: item.clientName,
                  phone: item.phone,
                  course: item.course,
                  status: item.status,
                  institution: item.institution,
                })) ?? [],
              consultations:
                response.data?.consultations?.map((item: any) => ({
                  id: item.id,
                  type: "consultation" as const,
                  clientName: item.clientName,
                  phone: item.phone,
                  desiredCourse: item.desiredCourse,
                  status: item.status,
                })) ?? [],
            }
          : undefined,
    };

    setMessages((prev) => [...prev, assistantMessage]);
  } catch (error) {
    console.error("[AIAssistant] send failed:", error);

    const message =
      error instanceof Error
        ? error.message
        : "AI 응답 처리 중 오류가 발생했습니다.";

    const failMessage: Message = {
      id: `assistant-error-${Date.now()}`,
      role: "assistant",
      content: message,
      createdAt: nowTimeLabel(),
      kind: "error",
    };

    setMessages((prev) => [...prev, failMessage]);
    setErrorMessage(message);
  } finally {
    setIsLoading(false);
  }
};

const handleQuickAction = async (action: QuickAction) => {
  setErrorMessage(null);

  if (action.key === "student_search") {
    setQuickSearchType("student");
    setQuickSearchKeyword("");
    return;
  }

  if (action.key === "consultation_search") {
    setQuickSearchType("consultation");
    setQuickSearchKeyword("");
    return;
  }

  const userMessage: Message = {
    id: `user-${Date.now()}`,
    role: "user",
    content: action.prompt,
    createdAt: nowTimeLabel(),
  };

  setMessages((prev) => [...prev, userMessage]);
  setIsLoading(true);

  try {
    if (action.key === "alerts_missing" || action.key === "alerts_payment") {
      const response = await alertsQuery.refetch();

      if (response.data) {
        const assistantMessage = buildAlertsMessage(
          response.data,
          action.key === "alerts_missing" ? "누락 점검 결과" : "결제 점검 결과"
        );
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        throw new Error("알림 데이터를 불러오지 못했습니다.");
      }

      return;
    }

    if (action.key === "error_analysis") {
      const response = await chatMutation.mutateAsync({
        message: action.prompt,
      });

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response.answer || "응답이 없습니다.",
        createdAt: nowTimeLabel(),
        kind:
          response.mode === "search"
            ? "search_result"
            : response.mode === "alert"
            ? "warning"
            : "text",
        searchResults:
          response.mode === "search"
            ? {
                students:
                  response.data?.students?.map((item: any) => ({
                    id: item.id,
                    type: "student" as const,
                    clientName: item.clientName,
                    phone: item.phone,
                    course: item.course,
                    status: item.status,
                    institution: item.institution,
                  })) ?? [],
                consultations:
                  response.data?.consultations?.map((item: any) => ({
                    id: item.id,
                    type: "consultation" as const,
                    clientName: item.clientName,
                    phone: item.phone,
                    desiredCourse: item.desiredCourse,
                    status: item.status,
                  })) ?? [],
              }
            : undefined,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      return;
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "빠른 실행 중 오류가 발생했습니다.";

    const failMessage: Message = {
      id: `assistant-error-${Date.now()}`,
      role: "assistant",
      content: message,
      createdAt: nowTimeLabel(),
      kind: "error",
    };

    setMessages((prev) => [...prev, failMessage]);
    setErrorMessage(message);
  } finally {
    setIsLoading(false);
  }
};

const handleConfirmPendingAction = async () => {
  if (!pendingAction) return;

  setErrorMessage(null);
  setIsLoading(true);

  try {
    const actionResponse = await runActionMutation.mutateAsync(pendingAction);

    const assistantMessage: Message = {
      id: `assistant-action-${Date.now()}`,
      role: "assistant",
      content: actionResponse.message,
      createdAt: nowTimeLabel(),
      kind: "action_result",
    };

    setMessages((prev) => [...prev, assistantMessage]);
    setPendingAction(null);
    setActionCandidates([]);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "입력 실행 중 오류가 발생했습니다.";

    const failMessage: Message = {
      id: `assistant-error-${Date.now()}`,
      role: "assistant",
      content: message,
      createdAt: nowTimeLabel(),
      kind: "error",
    };

    setMessages((prev) => [...prev, failMessage]);
    setErrorMessage(message);
  } finally {
    setIsLoading(false);
  }
};

const handleCancelPendingAction = () => {
  if (!pendingAction) return;

  setMessages((prev) => [
    ...prev,
    {
      id: `assistant-cancel-${Date.now()}`,
      role: "assistant",
      content: "입력 요청이 취소되었습니다.",
      createdAt: nowTimeLabel(),
      kind: "text",
    },
  ]);

  setPendingAction(null);
  setActionCandidates([]);
};

const handleQuickSearchSubmit = async () => {
  const keyword = quickSearchKeyword.trim();
  if (!keyword || !quickSearchType) return;

  setErrorMessage(null);

  const userMessage: Message = {
    id: `user-${Date.now()}`,
    role: "user",
    content:
      quickSearchType === "student"
        ? `학생 찾기: ${keyword}`
        : `상담 찾기: ${keyword}`,
    createdAt: nowTimeLabel(),
  };

  setMessages((prev) => [...prev, userMessage]);
  setIsLoading(true);

  try {
    const response = await searchMutation.mutateAsync({
      query: keyword,
    });

    const assistantMessage = buildSearchResultMessage(keyword, response);
    setMessages((prev) => [...prev, assistantMessage]);

    setQuickSearchKeyword("");
    setQuickSearchType(null);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "검색 중 오류가 발생했습니다.";

    const failMessage: Message = {
      id: `assistant-error-${Date.now()}`,
      role: "assistant",
      content: message,
      createdAt: nowTimeLabel(),
      kind: "error",
    };

    setMessages((prev) => [...prev, failMessage]);
    setErrorMessage(message);
  } finally {
    setIsLoading(false);
  }
};

const handleSearchResultAction = async (
  action:
    | { type: "open_student"; id: number }
    | { type: "open_consultation"; id: number }
    | { type: "start_transfer_subject"; id: number; name?: string }
    | { type: "start_plan_semester"; id: number; name?: string }
    | { type: "select_student_for_pending_action"; id: number; name?: string }
) => {
  if (action.type === "open_student") {
    window.location.href = `/students/${action.id}`;
    return;
  }

  if (action.type === "open_consultation") {
    window.location.href = `/consultations`;
    return;
  }

  if (action.type === "start_transfer_subject") {
    setTransferTarget({ id: action.id, name: action.name });
    setTransferSubjectName("");
    setTransferCategory("전공");
    return;
  }

  if (action.type === "start_plan_semester") {
    setPlanTarget({ id: action.id, name: action.name });
    setPlanSemesterNo(1);
    setPlanSubjectName("");
    setPlanCategory("전공");
    return;
  }

  if (action.type === "select_student_for_pending_action") {
    if (!pendingAction) return;

    setPendingAction((prev) =>
      prev
        ? {
            ...prev,
            selectedStudentId: action.id,
            studentKeyword: action.name || prev.studentKeyword,
          }
        : prev
    );

    setMessages((prev) => [
      ...prev,
      {
        id: `assistant-select-confirm-${Date.now()}`,
        role: "assistant",
        content: `${action.name || `학생 #${action.id}`} 선택 완료. 아래 확인 버튼을 눌러 실행해주세요.`,
        createdAt: nowTimeLabel(),
        kind: "warning",
      },
    ]);

    setActionCandidates([]);
    return;
  }
};

  const canUseAI =
    user?.role === "host" || user?.role === "admin" || user?.role === "superhost";

  if (!canUseAI) {
    return (
      <div className="space-y-6 p-6">
        <Card className="border-destructive/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="size-5" />
              접근 권한 없음
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            이 페이지는 host / admin / superhost 전용입니다.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
{quickSearchType && (
  <Card className="rounded-2xl border-primary/20">
    <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
      <div className="min-w-[120px] text-sm font-medium">
        {quickSearchType === "student" ? "학생 검색" : "상담 검색"}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      </div>

      <Input
        value={quickSearchKeyword}
        onChange={(e) => setQuickSearchKeyword(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            void handleQuickSearchSubmit();
          }
        }}
        placeholder={
          quickSearchType === "student"
            ? "학생 이름 또는 전화번호 입력"
            : "상담 이름 또는 전화번호 입력"
        }
      />

      <div className="flex items-center gap-2">
        <Button
          onClick={() => void handleQuickSearchSubmit()}
          disabled={!quickSearchKeyword.trim() || isLoading}
        >
          검색
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setQuickSearchKeyword("");
            setQuickSearchType(null);
          }}
          disabled={isLoading}
        >
          닫기
        </Button>
      </div>
    </CardContent>
  </Card>
)}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">AI 상담 페이지</h1>
            <Badge variant="secondary" className="rounded-full">
              Beta
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            CRM 데이터 조회, 누락/결제 알림 요약, 전적대 입력 보조, 오류 로그 분석용 AI 페이지
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="size-4" />
          <span>{user?.name || user?.username || "사용자"} 님으로 접속 중</span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="rounded-2xl">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-xl bg-primary/10 p-2 text-primary">
              <Search className="size-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">자연어 검색</p>
              <p className="text-sm font-semibold">학생 / 상담 조회</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-xl bg-primary/10 p-2 text-primary">
              <BellRing className="size-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">알림 분석</p>
              <p className="text-sm font-semibold">누락 / 결제 점검</p>
		<p className="mt-1 text-[11px] text-muted-foreground">
  {alertsQuery.data
    ? `결제일 누락 ${alertsQuery.data.summary.paymentDateMissingCount}건`
    : "누락/결제 현황 불러오는 중"}
</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-xl bg-primary/10 p-2 text-primary">
              <Database className="size-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">입력 보조</p>
              <p className="text-sm font-semibold">전적대 / 메모 입력</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-xl bg-primary/10 p-2 text-primary">
              <ShieldAlert className="size-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">보안 정책</p>
              <p className="text-sm font-semibold">조회 + 허용된 입력만</p>
<p className="mt-1 text-[11px] text-muted-foreground">
  {bootstrapQuery.data?.capabilities
    ? `전적대 입력 ${bootstrapQuery.data.capabilities.canCreateTransferSubject ? "허용" : "차단"}`
    : "권한 정보 불러오는 중"}
</p>
            </div>
          </CardContent>
        </Card>
      </div>
{planTarget && (
  <Card className="rounded-2xl border-primary/20">
    <CardHeader>
      <CardTitle className="text-base">
        우리 플랜 입력 · {planTarget.name || `학생 #${planTarget.id}`}
      </CardTitle>
    </CardHeader>
    <CardContent className="flex flex-col gap-3 md:flex-row md:items-center">
      <Input
        type="number"
        value={planSemesterNo}
        onChange={(e) => setPlanSemesterNo(Number(e.target.value || 1))}
        placeholder="학기"
      />

      <Input
        value={planSubjectName}
        onChange={(e) => setPlanSubjectName(e.target.value)}
        placeholder="과목명 입력"
      />

      <select
        value={planCategory}
        onChange={(e) => setPlanCategory(e.target.value as "전공" | "교양" | "일반")}
        className="h-10 rounded-md border bg-background px-3 text-sm"
      >
        <option value="전공">전공</option>
        <option value="교양">교양</option>
        <option value="일반">일반</option>
      </select>

      <div className="flex items-center gap-2">
        <Button
          disabled={!planSubjectName.trim() || createPlanSemesterMutation.isPending}
          onClick={async () => {
            try {
              await createPlanSemesterMutation.mutateAsync({
                studentId: planTarget.id,
                semesterNo: planSemesterNo,
                subjectName: planSubjectName,
                category: planCategory,
              });

              setMessages((prev) => [
                ...prev,
                {
                  id: `assistant-plan-${Date.now()}`,
                  role: "assistant",
                  content: `우리 플랜 과목 "${planSubjectName}" 입력이 완료되었습니다.`,
                  createdAt: nowTimeLabel(),
                  kind: "action_result",
                },
              ]);

              setPlanTarget(null);
              setPlanSubjectName("");
              setPlanSemesterNo(1);
            } catch (error) {
              const message =
                error instanceof Error ? error.message : "플랜 입력 중 오류가 발생했습니다.";
              setErrorMessage(message);
            }
          }}
        >
          입력
        </Button>

        <Button
          variant="outline"
          onClick={() => {
            setPlanTarget(null);
            setPlanSubjectName("");
            setPlanSemesterNo(1);
          }}
        >
          닫기
        </Button>
      </div>
    </CardContent>
  </Card>
)}
	{transferTarget && (
  <Card className="rounded-2xl border-primary/20">
    <CardHeader>
      <CardTitle className="text-base">
        전적대 과목 입력 · {transferTarget.name || `학생 #${transferTarget.id}`}
      </CardTitle>
    </CardHeader>
    <CardContent className="flex flex-col gap-3 md:flex-row md:items-center">
      <Input
        value={transferSubjectName}
        onChange={(e) => setTransferSubjectName(e.target.value)}
        placeholder="과목명 입력"
      />

      <select
        value={transferCategory}
        onChange={(e) => setTransferCategory(e.target.value as "전공" | "교양" | "일반")}
        className="h-10 rounded-md border bg-background px-3 text-sm"
      >
        <option value="전공">전공</option>
        <option value="교양">교양</option>
        <option value="일반">일반</option>
      </select>

      <div className="flex items-center gap-2">
        <Button
          disabled={!transferSubjectName.trim() || createTransferSubjectMutation.isPending}
          onClick={async () => {
            try {
              await createTransferSubjectMutation.mutateAsync({
                studentId: transferTarget.id,
                subjectName: transferSubjectName,
                category: transferCategory,
                credits: 3,
              });

              setMessages((prev) => [
                ...prev,
                {
                  id: `assistant-transfer-${Date.now()}`,
                  role: "assistant",
                  content: `전적대 과목 "${transferSubjectName}" 입력이 완료되었습니다.`,
                  createdAt: nowTimeLabel(),
                  kind: "action_result",
                },
              ]);

              setTransferTarget(null);
              setTransferSubjectName("");
            } catch (error) {
              const message =
                error instanceof Error ? error.message : "전적대 입력 중 오류가 발생했습니다.";
              setErrorMessage(message);
            }
          }}
        >
          입력
        </Button>

        <Button
          variant="outline"
          onClick={() => {
            setTransferTarget(null);
            setTransferSubjectName("");
          }}
        >
          닫기
        </Button>
      </div>
    </CardContent>
  </Card>
)}
{pendingAction && (
  <Card className="rounded-2xl border-amber-200 bg-amber-50/50">
    <CardHeader>
      <CardTitle className="text-base">AI 입력 확인</CardTitle>
    </CardHeader>
    <CardContent className="space-y-3">
      <div className="text-sm text-muted-foreground">
        {pendingAction.action === "create_transfer_subject" ? (
          <>
            <p>학생: {pendingAction.studentKeyword}</p>
            <p>작업: 전적대 과목 입력</p>
            <p>과목명: {pendingAction.subjectName}</p>
            <p>구분: {pendingAction.category}</p>
          </>
        ) : (
          <>
            <p>학생: {pendingAction.studentKeyword}</p>
            <p>작업: 우리 플랜 입력</p>
            <p>학기: {pendingAction.semesterNo}학기</p>
            <p>과목명: {pendingAction.subjectName}</p>
            <p>구분: {pendingAction.category}</p>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          onClick={() => void handleConfirmPendingAction()}
          disabled={isLoading}
        >
          확인 후 실행
        </Button>
        <Button
          variant="outline"
          onClick={handleCancelPendingAction}
          disabled={isLoading}
        >
          취소
        </Button>
      </div>
    </CardContent>
  </Card>
)}

      <AIChatBox
        messages={messages}
        onSendMessage={handleSendMessage}
        onQuickAction={handleQuickAction}
	        onSearchResultAction={handleSearchResultAction}
        isLoading={isLoading}
        errorMessage={errorMessage}
        placeholder="예: 이재준 찾아줘 / 오늘 결제 누락 학생 보여줘 / 전적대 과목 입력 구조 짜줘"
        emptyStateMessage="CRM AI 도우미를 시작해보세요."
        quickActions={quickActions}
        suggestedPrompts={suggestedPrompts}
        allowImageUpload
        height="720px"
      />
    </div>
  );
}