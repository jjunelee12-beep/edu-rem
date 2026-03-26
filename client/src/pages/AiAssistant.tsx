import { useMemo, useState } from "react";
import { Sparkles, Database, Search, BellRing, ShieldAlert } from "lucide-react";

import { AIChatBox, type Message, type QuickAction } from "@/components/AIChatBox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/_core/hooks/useAuth";

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

function buildAssistantReply(userText: string) {
  const text = userText.trim();

  if (!text) {
    return "입력된 내용이 없습니다.";
  }

  if (text.includes("이재준") && text.includes("찾아")) {
    return [
      "### 조회 요청 분석",
      "- 검색어: `이재준`",
      "- 대상: 학생/상담 DB 통합 검색",
      "",
      "현재는 UI 데모 상태라 실제 DB 조회 대신 예시 응답을 반환합니다.",
      "",
      "#### 추후 연결할 동작",
      "1. `student.list` 또는 전용 `ai.searchStudent` 호출",
      "2. 이름/전화번호/과정 기준 검색",
      "3. 결과 카드 반환",
      "4. 상세페이지 이동 버튼 제공",
    ].join("\n");
  }

  if (text.includes("누락") || text.includes("결제")) {
    return [
      "### 누락 / 결제 알림 분석",
      "- 결제일 누락",
      "- 결제금액 누락",
      "- 담당자 미지정",
      "- 승인대기 지연",
      "",
      "이 기능은 규칙기반 검사 + AI 요약 구조로 붙이면 가장 안전합니다.",
    ].join("\n");
  }

  if (text.includes("전적대") || text.includes("과목 입력")) {
    return [
      "### 전적대 과목 입력 요청",
      "AI는 **서버 코드 수정 없이** 허용된 입력 액션만 실행하도록 설계해야 합니다.",
      "",
      "허용 예시:",
      "- 전적대 과목 추가",
      "- 첨부파일 등록",
      "- 메모 입력",
      "",
      "금지 예시:",
      "- 스키마 변경",
      "- DB 삭제",
      "- 기존 데이터 임의 수정",
    ].join("\n");
  }

  if (text.includes("오류") || text.includes("로그")) {
    return [
      "### 오류 로그 분석",
      "추천 방식:",
      "- `CRM-AI-001` 같은 에러코드 체계 생성",
      "- 서버/프론트 공통 logger 구성",
      "- 사용자/페이지/액션/입력값/에러메시지 저장",
      "",
      "그 후 AI가 해당 로그를 읽고 원인을 요약해주는 흐름이 좋습니다.",
    ].join("\n");
  }

  return [
    "### AI CRM 응답",
    `입력 내용: \`${text}\``,
    "",
    "현재 이 페이지는 **CRM AI UI 기본 연결용 데모**입니다.",
    "",
    "가능한 방향:",
    "- 학생/상담 자연어 검색",
    "- 누락/결제 알림 요약",
    "- 전적대 과목 입력",
    "- 관리자용 오류 로그 분석",
  ].join("\n");
}

export default function AIAssistant() {
  const { user } = useAuth();

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
      { label: "학생 찾기", prompt: "학생 이름으로 검색해줘" },
      { label: "상담 찾기", prompt: "상담 DB에서 검색해줘" },
      { label: "누락 확인", prompt: "입력 누락 항목 점검해줘" },
      { label: "결제 확인", prompt: "오늘 결제 관련 항목 보여줘" },
      { label: "오류 분석", prompt: "최근 오류로그 분석해줘" },
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
      await new Promise((resolve) => setTimeout(resolve, 700));

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: buildAssistantReply(content),
        createdAt: nowTimeLabel(),
        kind: "text",
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("[AIAssistant] send failed:", error);

      const failMessage: Message = {
        id: `assistant-error-${Date.now()}`,
        role: "assistant",
        content: "메시지 처리 중 오류가 발생했습니다.",
        createdAt: nowTimeLabel(),
        kind: "error",
      };

      setMessages((prev) => [...prev, failMessage]);
      setErrorMessage("AI 응답 처리 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
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
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
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
            </div>
          </CardContent>
        </Card>
      </div>

      <AIChatBox
        messages={messages}
        onSendMessage={handleSendMessage}
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