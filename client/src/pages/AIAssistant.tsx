import { useMemo, useState } from "react";
import {
  Sparkles,
  Database,
  Search,
  BellRing,
  ShieldAlert,
  UserCheck,
} from "lucide-react";

import {
  AIChatBox,
  type Message,
  type QuickAction,
  type SelectedStudentContext,
} from "@/components/AIChatBox";
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
  const studentCount = response.students?.length ?? 0;
  const consultationCount = response.consultations?.length ?? 0;
  const hasAny = studentCount > 0 || consultationCount > 0;

  return {
    id: `assistant-search-${Date.now()}`,
    role: "assistant",
    content: hasAny
      ? [
          `검색어 **"${query}"** 기준으로 확인했어요.`,
          "",
          `- 학생 ${studentCount}건`,
          `- 상담 ${consultationCount}건`,
          "",
          "아래 결과에서 학생을 선택하면 전적대 입력이나 플랜 입력으로 바로 이어갈 수 있어요.",
        ].join("\n")
      : `검색어 **"${query}"** 기준으로 찾은 결과가 없어요.`,
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
  const paymentDateMissingCount =
    response.summary?.paymentDateMissingCount ?? 0;
  const paymentAmountMissingCount =
    response.summary?.paymentAmountMissingCount ?? 0;
  const consultationAssigneeMissingCount =
    response.summary?.consultationAssigneeMissingCount ?? 0;
  const practiceUnassignedCount =
    response.summary?.practiceUnassignedCount ?? 0;

  const totalIssueCount =
    paymentDateMissingCount +
    paymentAmountMissingCount +
    consultationAssigneeMissingCount +
    practiceUnassignedCount;

  return {
    id: `assistant-alert-${Date.now()}`,
    role: "assistant",
    content:
      totalIssueCount === 0
        ? [
            `**${title}**`,
            "",
            "확인해봤어요. 현재 눈에 띄는 누락 항목은 없습니다.",
            "",
            `- 결제일 누락: ${paymentDateMissingCount}건`,
            `- 결제금액 누락: ${paymentAmountMissingCount}건`,
            `- 담당자 미지정 상담: ${consultationAssigneeMissingCount}건`,
            `- 실습 미섭외: ${practiceUnassignedCount}건`,
          ].join("\n")
        : [
            `**${title}**`,
            "",
            "점검 결과를 정리했어요.",
            "",
            `- 결제일 누락: ${paymentDateMissingCount}건`,
            `- 결제금액 누락: ${paymentAmountMissingCount}건`,
            `- 담당자 미지정 상담: ${consultationAssigneeMissingCount}건`,
            `- 실습 미섭외: ${practiceUnassignedCount}건`,
            "",
            "원하면 누락 항목 기준으로 다시 검색해서 바로 보여드릴게요.",
          ].join("\n"),
    createdAt: nowTimeLabel(),
    kind: "warning",
  };
}

function parseActionPromptWithStudentKeyword(text: string):
  | {
      action: "create_transfer_subject" | "create_plan_semester";
      studentKeyword: string;
      subjectName: string;
      category: "전공" | "교양" | "일반";
      semesterNo?: number;
    }
  | null {
  const trimmed = text.trim();

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

function parseActionPromptUsingSelectedStudent(
  text: string,
  selectedStudent: SelectedStudentContext | null
):
  | {
      action: "create_transfer_subject" | "create_plan_semester";
      studentKeyword: string;
      subjectName: string;
      category: "전공" | "교양" | "일반";
      semesterNo?: number;
      selectedStudentId?: number;
    }
  | null {
  if (!selectedStudent) return null;

  const trimmed = text.trim();

  const transferPatterns = [
    /^전적대(?:에)?\s+(.+?)\s+(전공|교양|일반)(?:으로)?\s*(입력해줘|등록해줘|추가해줘|넣어줘|추가)?$/,
    /^(.+?)\s+(전공|교양|일반)(?:으로)?\s*전적대(?:에)?\s*(입력해줘|등록해줘|추가해줘|넣어줘|추가)?$/,
  ];

  for (const pattern of transferPatterns) {
    const match = trimmed.match(pattern);
    if (match) {
      return {
        action: "create_transfer_subject",
        studentKeyword: selectedStudent.clientName,
        selectedStudentId: selectedStudent.id,
        subjectName: match[1].trim(),
        category: match[2] as "전공" | "교양" | "일반",
      };
    }
  }

  const planPatterns = [
    /^(\d+)학기(?:에)?\s+(.+?)\s+(전공|교양|일반)(?:으로)?\s*(넣어줘|입력해줘|등록해줘|추가해줘|추가)?$/,
    /^플랜\s+(\d+)학기(?:에)?\s+(.+?)\s+(전공|교양|일반)(?:으로)?\s*(넣어줘|입력해줘|등록해줘|추가해줘|추가)?$/,
  ];

  for (const pattern of planPatterns) {
    const match = trimmed.match(pattern);
    if (match) {
      return {
        action: "create_plan_semester",
        studentKeyword: selectedStudent.clientName,
        selectedStudentId: selectedStudent.id,
        semesterNo: Number(match[1]),
        subjectName: match[2].trim(),
        category: match[3] as "전공" | "교양" | "일반",
      };
    }
  }

  return null;
}
function parsePracticeRecommendPrompt(
  text: string,
  selectedStudent: SelectedStudentContext | null
):
  | {
      action: "recommend_practice_place";
      studentKeyword: string;
      selectedStudentId?: number;
    }
  | null {
  if (!selectedStudent) return null;

  const trimmed = text.trim();
  const compact = trimmed.replace(/\s+/g, "");

  const hasPractice = compact.includes("실습");
  const hasRecommend =
    compact.includes("가까운") ||
    compact.includes("추천") ||
    compact.includes("교육원") ||
    compact.includes("기관");

  if (!hasPractice || !hasRecommend) return null;

  return {
    action: "recommend_practice_place",
    studentKeyword: selectedStudent.clientName,
    selectedStudentId: selectedStudent.id,
  };
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

const saveLearningMutation = trpc.ai.saveLearning.useMutation();
const createTransferSubjectBatchDraftMutation =
  trpc.ai.createTransferSubjectBatchDraft.useMutation();

const saveTransferSubjectBatchMutation =
  trpc.ai.saveTransferSubjectBatch.useMutation();
const uploadTranscriptImageMutation =
  trpc.ai.uploadTranscriptImage.useMutation();

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome-1",
      role: "assistant",
      content: [
        "안녕하세요. **CRM AI 작업도우미**입니다.",
        "",
        "제가 도와드릴 수 있는 작업은 다음과 같아요.",
        "- 학생 / 상담 검색",
        "- 누락 / 결제 점검",
        "- 전적대 과목 입력 보조",
        "- 우리 플랜 입력 보조",
        "- 오류 로그 분석",
        "",
        "학생을 먼저 선택해두면 전적대 입력이나 플랜 입력을 더 빠르게 이어갈 수 있어요.",
      ].join("\n"),
      createdAt: nowTimeLabel(),
      kind: "text",
    },
  ]);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadingLabel, setLoadingLabel] = useState("AI가 요청을 처리하고 있어요...");

  const [quickSearchType, setQuickSearchType] = useState<"student" | "consultation" | null>(null);
  const [quickSearchKeyword, setQuickSearchKeyword] = useState("");

  const [selectedStudent, setSelectedStudent] =
    useState<SelectedStudentContext | null>(null);

  const [transferTarget, setTransferTarget] = useState<{ id: number; name?: string } | null>(null);
  const [planTarget, setPlanTarget] = useState<{ id: number; name?: string } | null>(null);

  const [transferSubjectName, setTransferSubjectName] = useState("");
  const [transferCategory, setTransferCategory] = useState<"전공" | "교양" | "일반">("전공");

  const [planSemesterNo, setPlanSemesterNo] = useState(1);
  const [planSubjectName, setPlanSubjectName] = useState("");
  const [planCategory, setPlanCategory] = useState<"전공" | "교양" | "일반">("전공");

  const [actionCandidates, setActionCandidates] = useState<
    {
      id: number;
      clientName?: string;
      phone?: string;
      course?: string;
      status?: string;
      institution?: string;
      finalEducation?: string;
    }[]
  >([]);

  const [pendingAction, setPendingAction] = useState<
  | {
      action:
        | "create_transfer_subject"
        | "create_plan_semester"
        | "recommend_practice_place";
      studentKeyword: string;
      subjectName?: string;
      category?: "전공" | "교양" | "일반";
      semesterNo?: number;
      selectedStudentId?: number;
    }
  | null
>(null);

const [transferBatchTarget, setTransferBatchTarget] = useState<{
  id: number;
  name?: string;
} | null>(null);

const [transferBatchText, setTransferBatchText] = useState("");

const [transferBatchDraft, setTransferBatchDraft] = useState<
  | {
      studentId: number;
      clientName?: string;
      schoolName?: string;
      rows: {
        subjectName: string;
        category: "전공" | "교양" | "일반";
        requirementType?: "전공필수" | "전공선택" | "교양" | "일반" | null;
        credits: number;
        sortOrder: number;
      }[];
    }
  | null
>(null);
const [transcriptImage, setTranscriptImage] = useState<File | null>(null);

  const suggestedPrompts = useMemo(
  () => [
    "이재준 찾아줘",
    "오늘 결제 누락된 학생 보여줘",
    "실습 미섭외 학생 정리해줘",
    "전적대에 사회복지학개론 전공으로 입력해줘",
    "1학기에 사회복지조사론 전공으로 넣어줘",
    "가까운 실습기관 추천해줘",
"전적대 과목 일괄 입력 초안 만들어줘",
  ],
  []
);

  const quickActions = useMemo<QuickAction[]>(
    () => [
      {
        key: "student_search",
        label: "학생 조회",
        prompt: "학생 이름으로 검색해줘",
        runImmediately: true,
      },
      {
        key: "consultation_search",
        label: "상담 조회",
        prompt: "상담 DB에서 검색해줘",
        runImmediately: true,
      },
      {
        key: "alerts_missing",
        label: "누락 점검",
        prompt: "입력 누락 항목 점검해줘",
        runImmediately: true,
      },
      {
        key: "alerts_payment",
        label: "결제 점검",
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

  const canUseAI =
    user?.role === "host" || user?.role === "admin" || user?.role === "superhost";

  const resetLoadingLabel = () => {
    setLoadingLabel("AI가 요청을 처리하고 있어요...");
  };

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
      const parsedAction =
  parseActionPromptWithStudentKeyword(content) ||
  parseActionPromptUsingSelectedStudent(content, selectedStudent) ||
  parsePracticeRecommendPrompt(content, selectedStudent);

      if (parsedAction) {
        setLoadingLabel(
  parsedAction.action === "create_transfer_subject"
    ? "전적대 입력 요청을 해석하고 있어요..."
    : parsedAction.action === "create_plan_semester"
    ? "플랜 입력 요청을 해석하고 있어요..."
    : "가까운 실습교육원과 기관을 찾고 있어요..."
);

        const previewResponse = await runActionMutation.mutateAsync(parsedAction);

        if (previewResponse.needsSelection) {
          setPendingAction(parsedAction);
          setActionCandidates(previewResponse.candidates ?? []);

          const assistantMessage: Message = {
            id: `assistant-select-${Date.now()}`,
            role: "assistant",
            content:
              previewResponse.message ||
              "동일하거나 비슷한 학생이 여러 명 있어서 먼저 대상을 선택해야 해요.",
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

        if (previewResponse.student?.id) {
          setSelectedStudent({
            id: previewResponse.student.id,
            clientName:
              previewResponse.student.name ||
              previewResponse.student.clientName ||
              parsedAction.studentKeyword,
            phone: previewResponse.student.phone || null,
            course: previewResponse.student.course || null,
            finalEducation: previewResponse.student.finalEducation || null,
          });
        }
	if (parsedAction.action === "recommend_practice_place") {

	setPendingAction(null);
setActionCandidates([]);
setTransferBatchTarget(null);
setTransferBatchDraft(null);

  const assistantMessage: Message = {
    id: `assistant-practice-${Date.now()}`,
    role: "assistant",
    content:
      previewResponse.message ||
      "실습 추천 결과를 불러오지 못했습니다.",
    createdAt: nowTimeLabel(),
    kind: "action_result",
  };

  setMessages((prev) => [...prev, assistantMessage]);
  return;
}

        setPendingAction({
          ...parsedAction,
          selectedStudentId: previewResponse.student?.id ?? parsedAction.selectedStudentId,
          studentKeyword:
            previewResponse.student?.name ||
            previewResponse.student?.clientName ||
            parsedAction.studentKeyword,
        });

        const assistantMessage: Message = {
          id: `assistant-confirm-${Date.now()}`,
          role: "assistant",
          content:
            parsedAction.action === "create_transfer_subject"
              ? [
                  "전적대 입력 요청을 확인했어요.",
                  "",
                  `- 학생: ${previewResponse.student?.name || previewResponse.student?.clientName || parsedAction.studentKeyword}`,
                  `- 작업: 전적대 과목 입력`,
                  `- 과목명: ${parsedAction.subjectName}`,
                  `- 구분: ${parsedAction.category}`,
                  "",
                  "내용이 맞다면 아래 **확인 후 실행** 버튼을 눌러주세요.",
                ].join("\n")
              : [
                  "플랜 입력 요청을 확인했어요.",
                  "",
                  `- 학생: ${previewResponse.student?.name || previewResponse.student?.clientName || parsedAction.studentKeyword}`,
                  `- 작업: 우리 플랜 입력`,
                  `- 학기: ${parsedAction.semesterNo}학기`,
                  `- 과목명: ${parsedAction.subjectName}`,
                  `- 구분: ${parsedAction.category}`,
                  "",
                  "내용이 맞다면 아래 **확인 후 실행** 버튼을 눌러주세요.",
                ].join("\n"),
          createdAt: nowTimeLabel(),
          kind: "warning",
        };

        setMessages((prev) => [...prev, assistantMessage]);
        return;
      }

      setLoadingLabel("질문을 분석하고 CRM 데이터를 확인하고 있어요...");

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
      resetLoadingLabel();
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
        setLoadingLabel(
          action.key === "alerts_missing"
            ? "누락 항목을 점검하고 있어요..."
            : "결제 관련 항목을 점검하고 있어요..."
        );

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
        setLoadingLabel("오류 로그를 분석하고 있어요...");

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
      resetLoadingLabel();
    }
  };

  const handleConfirmPendingAction = async () => {
    if (!pendingAction) return;

    setErrorMessage(null);
    setIsLoading(true);

    try {
      setLoadingLabel(
  pendingAction.action === "create_transfer_subject"
    ? "전적대 과목을 입력하고 있어요..."
    : pendingAction.action === "create_plan_semester"
    ? "우리 플랜 과목을 입력하고 있어요..."
    : "실습 추천을 불러오고 있어요..."
);

      const actionResponse = await runActionMutation.mutateAsync(pendingAction);
	
	if (pendingAction.action === "create_transfer_subject") {
  await saveLearningMutation.mutateAsync({
    learningType: "transfer_subject_input",
    inputText: `${pendingAction.studentKeyword} 전적대 ${pendingAction.subjectName || ""} ${pendingAction.category || ""}`,
    normalizedKey: `transfer_subject|${pendingAction.category || ""}`,
    targetStudentId: actionResponse.student?.id,
    targetStudentName: actionResponse.student?.name || actionResponse.student?.clientName,
    payload: {
      request: pendingAction,
      result: actionResponse,
    },
    isApproved: true,
  });
}

if (pendingAction.action === "create_plan_semester") {
  await saveLearningMutation.mutateAsync({
    learningType: "plan_semester_input",
    inputText: `${pendingAction.studentKeyword} ${pendingAction.semesterNo || 0}학기 ${pendingAction.subjectName || ""} ${pendingAction.category || ""}`,
    normalizedKey: `plan_semester|${pendingAction.semesterNo || 0}|${pendingAction.category || ""}`,
    targetStudentId: actionResponse.student?.id,
    targetStudentName: actionResponse.student?.name || actionResponse.student?.clientName,
    payload: {
      request: pendingAction,
      result: actionResponse,
    },
    isApproved: true,
  });
}	

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
      resetLoadingLabel();
    }
  };

  const handleCancelPendingAction = () => {
    if (!pendingAction) return;

    setMessages((prev) => [
      ...prev,
      {
        id: `assistant-cancel-${Date.now()}`,
        role: "assistant",
        content: "입력 요청을 취소했어요.",
        createdAt: nowTimeLabel(),
        kind: "text",
      },
    ]);

    setPendingAction(null);
    setActionCandidates([]);
  };

const handleCreateTransferBatchDraft = async () => {
  if (!transferBatchTarget) return;
  if (!transferBatchText.trim()) {
    setErrorMessage("전적대 과목 목록을 입력해주세요.");
    return;
  }

  setErrorMessage(null);
setTransferBatchDraft(null);
  setIsLoading(true);
  setLoadingLabel("전적대 과목 일괄 초안을 만들고 있어요...");

  try {
    const response = await createTransferSubjectBatchDraftMutation.mutateAsync({
      studentId: transferBatchTarget.id,
      rawText: transferBatchText,
      schoolName: "전적대",
    });

    setTransferBatchDraft({
      studentId: transferBatchTarget.id,
      clientName: transferBatchTarget.name,
      schoolName: response.schoolName,
      rows: response.rows,
    });

    setMessages((prev) => [
      ...prev,
      {
        id: `assistant-transfer-batch-draft-${Date.now()}`,
        role: "assistant",
        content: [
          `${transferBatchTarget.name || `학생 #${transferBatchTarget.id}`} 님의 전적대 과목 일괄 초안을 만들었어요.`,
          "",
          `- 초안 과목 수: ${response.rows.length}건`,
          "아래 표를 확인한 뒤 일괄 저장할 수 있어요.",
        ].join("\n"),
        createdAt: nowTimeLabel(),
        kind: "action_result",
      },
    ]);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "전적대 일괄 초안 생성 중 오류가 발생했습니다.";
    setErrorMessage(message);
  } finally {
    setIsLoading(false);
    resetLoadingLabel();
  }
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
      setLoadingLabel(
        quickSearchType === "student"
          ? "학생 데이터를 조회하고 있어요..."
          : "상담 데이터를 조회하고 있어요..."
      );

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
      resetLoadingLabel();
    }
  };

const handleSaveTransferBatch = async () => {
  if (!transferBatchTarget || !transferBatchDraft?.rows?.length) return;

  setErrorMessage(null);
  setIsLoading(true);
  setLoadingLabel("전적대 과목을 일괄 저장하고 있어요...");

  try {
    const result = await saveTransferSubjectBatchMutation.mutateAsync({
      studentId: transferBatchTarget.id,
      schoolName: transferBatchDraft.schoolName || "전적대",
      rows: transferBatchDraft.rows,
    });

    await saveLearningMutation.mutateAsync({
      learningType: "transfer_subject_batch",
      inputText: `${transferBatchTarget.name || `학생 #${transferBatchTarget.id}`} 전적대 과목 일괄 입력`,
      normalizedKey: "transfer_subject_batch|default",
      targetStudentId: transferBatchTarget.id,
      targetStudentName: transferBatchTarget.name,
      payload: {
        rows: transferBatchDraft.rows,
      },
      isApproved: true,
    });

    setMessages((prev) => [
      ...prev,
      {
        id: `assistant-transfer-batch-save-${Date.now()}`,
        role: "assistant",
        content: [
          `${transferBatchTarget.name || `학생 #${transferBatchTarget.id}`} 님의 전적대 과목 일괄 저장을 완료했어요.`,
          "",
          `- 저장 건수: ${result.count}건`,
        ].join("\n"),
        createdAt: nowTimeLabel(),
        kind: "action_result",
      },
    ]);

    setTransferBatchDraft(null);
    setTransferBatchText("");
setTransferBatchTarget(null);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "전적대 일괄 저장 중 오류가 발생했습니다.";
    setErrorMessage(message);
  } finally {
    setIsLoading(false);
    resetLoadingLabel();
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

    const findCandidate = (id: number) =>
      actionCandidates.find((item) => item.id === id);

    if (action.type === "start_transfer_subject") {
      const found = findCandidate(action.id);

      setTransferTarget({ id: action.id, name: action.name });
      setTransferSubjectName("");
      setTransferCategory("전공");

setTransferBatchTarget({ id: action.id, name: action.name });
setTransferBatchDraft(null);
setTransferBatchText("");

      setSelectedStudent({
        id: action.id,
        clientName: action.name || found?.clientName || `학생 #${action.id}`,
        phone: found?.phone || null,
        course: found?.course || null,
        finalEducation: found?.finalEducation || null,
      });

      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-transfer-target-${Date.now()}`,
          role: "assistant",
          content: `${action.name || `학생 #${action.id}`} 님을 작업 대상으로 선택했어요. 이제 전적대 과목명을 입력하면 바로 이어서 처리할 수 있어요.`,
          createdAt: nowTimeLabel(),
          kind: "action_result",
        },
      ]);
      return;
    }

    if (action.type === "start_plan_semester") {
      const found = findCandidate(action.id);

      setPlanTarget({ id: action.id, name: action.name });
      setPlanSemesterNo(1);
      setPlanSubjectName("");
      setPlanCategory("전공");

      setSelectedStudent({
        id: action.id,
        clientName: action.name || found?.clientName || `학생 #${action.id}`,
        phone: found?.phone || null,
        course: found?.course || null,
        finalEducation: found?.finalEducation || null,
      });

      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-plan-target-${Date.now()}`,
          role: "assistant",
          content: `${action.name || `학생 #${action.id}`} 님을 작업 대상으로 선택했어요. 이제 학기와 과목을 지정해서 플랜 입력을 이어갈 수 있어요.`,
          createdAt: nowTimeLabel(),
          kind: "action_result",
        },
      ]);
      return;
    }

    if (action.type === "select_student_for_pending_action") {
      const found = findCandidate(action.id);

      setSelectedStudent({
        id: action.id,
        clientName: action.name || found?.clientName || `학생 #${action.id}`,
        phone: found?.phone || null,
        course: found?.course || null,
        finalEducation: found?.finalEducation || null,
      });

      if (!pendingAction) {
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-student-selected-${Date.now()}`,
            role: "assistant",
	content: `${action.name || `학생 #${action.id}`} 님을 현재 작업 대상으로 선택했어요. 이제 전적대 입력, 플랜 입력, 실습 추천을 이어서 할 수 있어요.`,
            createdAt: nowTimeLabel(),
            kind: "action_result",
          },
        ]);
        return;
      }

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
          content: `${action.name || `학생 #${action.id}`} 선택을 확인했어요. 아래 **확인 후 실행** 버튼을 누르면 바로 처리할게요.`,
          createdAt: nowTimeLabel(),
          kind: "warning",
        },
      ]);

      setActionCandidates([]);
      return;
    }
  };

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

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">AI 작업도우미</h1>
            <Badge variant="secondary" className="rounded-full">
              Beta
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            CRM 데이터 조회, 누락 점검, 전적대 입력 보조, 플랜 입력 보조, 오류 분석을 자연어로 처리합니다.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="size-4" />
          <span>{user?.name || user?.username || "사용자"} 님으로 접속 중</span>
        </div>
      </div>

      {selectedStudent && (
        <Card className="rounded-2xl border-primary/20 bg-primary/5">
          <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-primary/10 p-2 text-primary">
                <UserCheck className="size-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">
                  현재 선택 학생: {selectedStudent.clientName}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  연락처: {selectedStudent.phone || "-"} / 과정:{" "}
                  {selectedStudent.course || "-"} / 최종학력:{" "}
                  {selectedStudent.finalEducation || "-"}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => {
  setSelectedStudent(null);
  setTransferTarget(null);
  setPlanTarget(null);
  setPendingAction(null);
  setActionCandidates([]);
  setTransferBatchTarget(null);
  setTransferBatchDraft(null);
  setTransferBatchText("");
setTranscriptImage(null);
}}
            >
              선택 해제
            </Button>
          </CardContent>
        </Card>
      )}

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
              <p className="text-sm font-semibold">전적대 / 플랜 입력</p>
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
              onChange={(e) =>
                setPlanCategory(e.target.value as "전공" | "교양" | "일반")
              }
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
	await saveLearningMutation.mutateAsync({
  learningType: "plan_semester_input",
  inputText: `${planTarget.name || `학생 #${planTarget.id}`} ${planSemesterNo}학기 ${planSubjectName} ${planCategory}`,
  normalizedKey: `plan_semester|${planSemesterNo}|${planCategory}`,
  targetStudentId: planTarget.id,
  targetStudentName: planTarget.name,
  payload: {
    studentId: planTarget.id,
    semesterNo: planSemesterNo,
    subjectName: planSubjectName,
    category: planCategory,
  },
  isApproved: true,
});

                    setMessages((prev) => [
                      ...prev,
                      {
                        id: `assistant-plan-${Date.now()}`,
                        role: "assistant",
                        content: [
                          `${planTarget.name || `학생 #${planTarget.id}`} 님의 플랜 입력을 완료했어요.`,
                          "",
                          `- 학기: ${planSemesterNo}학기`,
                          `- 과목명: ${planSubjectName}`,
                          `- 구분: ${planCategory}`,
                        ].join("\n"),
                        createdAt: nowTimeLabel(),
                        kind: "action_result",
                      },
                    ]);

                    setPlanTarget(null);
                    setPlanSubjectName("");
                    setPlanSemesterNo(1);
	setActionCandidates([]);
                  } catch (error) {
                    const message =
                      error instanceof Error
                        ? error.message
                        : "플랜 입력 중 오류가 발생했습니다.";
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
	setActionCandidates([]);
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
              onChange={(e) =>
                setTransferCategory(e.target.value as "전공" | "교양" | "일반")
              }
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
	await saveLearningMutation.mutateAsync({
  learningType: "transfer_subject_input",
  inputText: `${transferTarget.name || `학생 #${transferTarget.id}`} 전적대 ${transferSubjectName} ${transferCategory}`,
  normalizedKey: `transfer_subject|${transferCategory}`,
  targetStudentId: transferTarget.id,
  targetStudentName: transferTarget.name,
  payload: {
    studentId: transferTarget.id,
    subjectName: transferSubjectName,
    category: transferCategory,
    credits: 3,
  },
  isApproved: true,
});

                    setMessages((prev) => [
                      ...prev,
                      {
                        id: `assistant-transfer-${Date.now()}`,
                        role: "assistant",
                        content: [
                          `${transferTarget.name || `학생 #${transferTarget.id}`} 님의 전적대 과목 입력을 완료했어요.`,
                          "",
                          `- 과목명: ${transferSubjectName}`,
                          `- 구분: ${transferCategory}`,
                          `- 학점: 3`,
                        ].join("\n"),
                        createdAt: nowTimeLabel(),
                        kind: "action_result",
                      },
                    ]);

                    setTransferTarget(null);
                    setTransferSubjectName("");
	setActionCandidates([]);
                  } catch (error) {
                    const message =
                      error instanceof Error
                        ? error.message
                        : "전적대 입력 중 오류가 발생했습니다.";
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
	setActionCandidates([]);
                }}
              >
                닫기
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

{transferBatchTarget && (
  <Card className="rounded-2xl border-primary/20">
    <CardHeader>
      <CardTitle className="text-base">
        전적대 과목 일괄 입력 · {transferBatchTarget.name || `학생 #${transferBatchTarget.id}`}
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-3">
      <textarea
        className="min-h-[160px] w-full rounded-md border bg-background px-3 py-2 text-sm"
        value={transferBatchText}
        onChange={(e) => setTransferBatchText(e.target.value)}
        placeholder={`예:\n사회복지학개론\n인간행동과사회환경\n사회복지조사론`}
      />
	<input
  type="file"
  accept="image/*"
  onChange={(e) => {
    const file = e.target.files?.[0];
    if (file) setTranscriptImage(file);
  }}
/>

      <div className="flex items-center gap-2">
        <Button
          onClick={() => void handleCreateTransferBatchDraft()}
          disabled={!transferBatchText.trim() || isLoading}
        >
          초안 만들기
        </Button>
	<Button
  disabled={!transcriptImage || isLoading}
  onClick={async () => {
  if (!transcriptImage || !transferBatchTarget) return;

  setErrorMessage(null);
  setIsLoading(true);
  setLoadingLabel("성적표 이미지 분석 중...");
  setTransferBatchDraft(null);

  try {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        try {
          const result = reader.result as string;
          const encoded = result.split(",")[1];
          if (!encoded) {
            reject(new Error("이미지 데이터를 읽지 못했습니다."));
            return;
          }
          resolve(encoded);
        } catch (err) {
          reject(err);
        }
      };

      reader.onerror = () => reject(new Error("파일 읽기에 실패했습니다."));
      reader.readAsDataURL(transcriptImage);
    });

    const res = await uploadTranscriptImageMutation.mutateAsync({
      studentId: transferBatchTarget.id,
      imageBase64: base64,
    });

    setTransferBatchDraft({
      studentId: transferBatchTarget.id,
      clientName: transferBatchTarget.name,
      schoolName: "전적대",
      rows: res.rows,
    });
	setTranscriptImage(null);

    setMessages((prev) => [
      ...prev,
      {
        id: `assistant-ocr-${Date.now()}`,
        role: "assistant",
        content: [
          "성적표 이미지를 분석했어요.",
          "",
          `- 인식된 과목 수: ${res.rows.length}건`,
          "확인 후 일괄 저장을 눌러주세요.",
        ].join("\n"),
        createdAt: nowTimeLabel(),
        kind: "action_result",
      },
    ]);
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "이미지 분석 실패";
    setErrorMessage(message);
  } finally {
    setIsLoading(false);
    resetLoadingLabel();
  }
}}
>
  📷 성적표 자동 인식
</Button>

        <Button
          variant="outline"
          onClick={() => {
            setTransferBatchTarget(null);
            setTransferBatchText("");
            setTransferBatchDraft(null);
	setActionCandidates([]);
	setTranscriptImage(null);
          }}
        >
          닫기
        </Button>
      </div>

      {transferBatchDraft?.rows?.length ? (
        <div className="rounded-lg border">
          <div className="grid grid-cols-4 gap-2 border-b bg-muted/40 px-3 py-2 text-xs font-medium">
            <div>과목명</div>
            <div>구분</div>
            <div>세부구분</div>
            <div>학점</div>
          </div>

          <div className="max-h-[260px] overflow-auto">
            {transferBatchDraft.rows.map((row, idx) => (
              <div
                key={`${row.subjectName}-${idx}`}
                className="grid grid-cols-4 gap-2 border-b px-3 py-2 text-sm"
              >
                <div>{row.subjectName}</div>
                <div>{row.category}</div>
                <div>{row.requirementType || "-"}</div>
                <div>{row.credits}</div>
              </div>
            ))}
          </div>

          <div className="p-3">
            <Button
              onClick={() => void handleSaveTransferBatch()}
              disabled={isLoading}
            >
              일괄 저장
            </Button>
          </div>
        </div>
      ) : null}
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
) : pendingAction.action === "create_plan_semester" ? (
  <>
    <p>학생: {pendingAction.studentKeyword}</p>
    <p>작업: 우리 플랜 입력</p>
    <p>학기: {pendingAction.semesterNo}학기</p>
    <p>과목명: {pendingAction.subjectName}</p>
    <p>구분: {pendingAction.category}</p>
  </>
) : (
  <>
    <p>학생: {pendingAction.studentKeyword}</p>
    <p>작업: 실습 추천</p>
    <p>선택 학생 기준으로 가까운 실습교육원 / 기관을 조회합니다.</p>
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
        loadingLabel={loadingLabel}
        selectedStudent={selectedStudent}
        onClearSelectedStudent={() => {
          setSelectedStudent(null);
          setTransferTarget(null);
          setPlanTarget(null);
	setPendingAction(null);
setActionCandidates([]);
	setTransferBatchTarget(null);
setTransferBatchText("");
setTransferBatchDraft(null);
setTranscriptImage(null);
        }}
	placeholder="예: OOO 찾아줘 / 전적대에 사회복지학개론 전공으로 입력해줘 / 1학기에 사회복지조사론 전공으로 넣어줘 / 가까운 실습기관 추천해줘 / 전적대 과목 여러 개 초안 만들어줘"
        emptyStateMessage="CRM AI 작업도우미를 시작해보세요."
        quickActions={quickActions}
        suggestedPrompts={suggestedPrompts}
        allowImageUpload
        height="720px"
      />
    </div>
  );
}