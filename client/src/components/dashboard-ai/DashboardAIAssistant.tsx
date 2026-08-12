import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import DashboardAIChatBox, {
  type DashboardAIMessage,
  type DashboardAIMessageKind,
  type DashboardAISelectedStudent,
  type DashboardAIStudent,
} from "./DashboardAIChatBox";

function nowLabel() {
  return new Date().toLocaleTimeString("ko-KR", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatChatTime(
  value:
    unknown
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "";
  }

  const date =
    new Date(
      String(value)
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return date.toLocaleTimeString(
    "ko-KR",
    {
      hour12:
        false,

      hour:
        "2-digit",

      minute:
        "2-digit",
    }
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "AI 요청을 처리하는 중 오류가 발생했습니다.";
}

function getMessageKind(response: any): DashboardAIMessageKind {
  const toolName = String(
    response?.toolName ||
      response?.data?.toolName ||
      response?.data?.tool ||
      ""
  );

if (
  response?.pendingAction ||
  response?.data
    ?.pendingAction
) {
  return "student_registration_preview";
}

if (
  response
    ?.scheduleCreateDraft ||
  response
    ?.semesterCreateDraft ||
  response
    ?.semesterCompleteDraft ||
  response
    ?.consultationUpdateDraft ||
  response
    ?.studentUpdateDraft ||
  response
    ?.data
    ?.scheduleCreateDraft ||
  response
    ?.data
    ?.semesterCreateDraft ||
  response
    ?.data
    ?.semesterCompleteDraft ||
  response
    ?.data
    ?.consultationUpdateDraft ||
  response
    ?.data
    ?.studentUpdateDraft
) {
  return "student_registration_preview";
}

if (
  response?.registrationPreview
) {
  return "student_registration_preview";
}

    if (
    toolName ===
    "student.summary"
  ) {
    return "student_summary";
  }

  if (
  toolName ===
  "student.dashboard"
) {
  return "student_dashboard";
}

if (
  toolName ===
  "practice.institutionSearch"
) {
  return "practice_institution_search";
}

if (
  toolName ===
  "practice.supportStatus"
) {
  return "practice_support_status";
}

if (
  toolName ===
  "risk.studentDetail"
) {
  return "student_risk";
}

  if (toolName === "risk.studentList") {
    return "organization_risk";
  }

  if (
    toolName === "student.search" ||
    toolName === "consultation.search" ||
    response?.mode === "search"
  ) {
    return "search_result";
  }

  if (
    toolName === "alert.missingData" ||
    response?.mode === "alert"
  ) {
    return "warning";
  }

  return "text";
}

function toDashboardAIMessage(
  row:
    any
): DashboardAIMessage {
  const allowedKinds =
  new Set<
    DashboardAIMessageKind
  >([
    "text",
    "error",
    "warning",
    "search_result",
    "student_summary",
    "student_dashboard",
    "practice_institution_search",
    "practice_support_status",
    "student_risk",
    "organization_risk",
    "student_registration_preview",
    "student_registration_result",
    "document_analysis",
  ]);

  const rawKind =
    String(
      row?.kind ||
      "text"
    );

  const kind:
    DashboardAIMessageKind =
      allowedKinds.has(
        rawKind as
          DashboardAIMessageKind
      )
        ? rawKind as
            DashboardAIMessageKind
        : "text";

  return {
    id:
      String(
        row?.id ||
        `history-${Date.now()}-${Math.random()}`
      ),

    role:
      row?.role ===
        "user"
        ? "user"
        : "assistant",

    content:
      String(
        row?.content ||
        ""
      ),

    createdAt:
      formatChatTime(
        row?.createdAt
      ),

    kind,

    data:
      row?.data &&
      typeof row.data ===
        "object"
        ? row.data
        : null,
  };
}

function collapsePendingActionMessages(
  messages:
    DashboardAIMessage[]
) {
  const latestIndexByPendingActionId =
    new Map<
      number,
      number
    >();

  messages.forEach(
    (
      message,
      index
    ) => {
      const pendingActionId =
        Number(
          message.data
            ?.pendingAction
            ?.id ||
          0
        );

      if (
        pendingActionId >
        0
      ) {
        latestIndexByPendingActionId.set(
          pendingActionId,
          index
        );
      }
    }
  );

  return messages.filter(
    (
      message,
      index
    ) => {
      const pendingActionId =
        Number(
          message.data
            ?.pendingAction
            ?.id ||
          0
        );

      if (
        pendingActionId <=
        0
      ) {
        return true;
      }

      return (
        latestIndexByPendingActionId.get(
          pendingActionId
        ) ===
        index
      );
    }
  );
}

function getOrganizationSlug(user: any) {
  return String(
    user?.organizationSlug || user?.organization?.slug || ""
  ).trim();
}

function readImageFileAsBase64(
  file: File
): Promise<string> {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      const reader =
        new FileReader();

      reader.onload = () => {
        const result =
          String(
            reader.result ||
            ""
          );

        const separatorIndex =
          result.indexOf(",");

        if (
          separatorIndex < 0
        ) {
          reject(
            new Error(
              "이미지 파일을 변환하지 못했습니다."
            )
          );

          return;
        }

        const imageBase64 =
          result
            .slice(
              separatorIndex + 1
            )
            .replace(
              /\s+/g,
              ""
            );

        if (
          !imageBase64
        ) {
          reject(
            new Error(
              "이미지 데이터가 비어 있습니다."
            )
          );

          return;
        }

        resolve(
          imageBase64
        );
      };

      reader.onerror = () => {
        reject(
          new Error(
            "이미지 파일을 읽지 못했습니다."
          )
        );
      };

      reader.readAsDataURL(
        file
      );
    }
  );
}

export default function DashboardAIAssistant() {
    const { user } = useAuth();

  const chatMutation =
    trpc.ai.chat.useMutation();

  const studentRegistrationPreviewMutation =
    trpc.ai.studentRegistrationPreview.useMutation();

const documentImportPreviewMutation =
  trpc.ai.documentImportPreview.useMutation();

  const confirmPendingActionMutation =
    trpc.ai.pendingAction.confirm.useMutation();

  const cancelPendingActionMutation =
    trpc.ai.pendingAction.cancel.useMutation();

const saveChatMessageMutation =
  trpc.ai.saveChatMessage.useMutation();

const clearChatHistoryMutation =
  trpc.ai.clearChatHistory.useMutation();

  const [messages, setMessages] = useState<DashboardAIMessage[]>([]);
  const [selectedStudent, setSelectedStudent] =
    useState<DashboardAISelectedStudent | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

 const canUseAI =
  user?.role === "staff" ||
  user?.role === "admin" ||
  user?.role === "host" ||
  user?.role === "superhost";

const chatHistoryQuery =
  trpc.ai.chatHistory.useQuery(
    {
      limit:
        500,
    },
    {
      enabled:
        canUseAI,

      refetchOnWindowFocus:
        false,

      retry:
        1,
    }
  );

/**
 * 현재 선택한 학생에게 승인 대기 중인
 * 문서 OCR Pending Action이 있는지 조회한다.
 *
 * Admin 또는 Host가 만든 OCR 초안을
 * 실제 학생 담당자가 자기 AI 화면에서
 * 불러오기 위해 사용하는 Query다.
 */
const pendingDocumentByStudentQuery =
  trpc.ai.pendingAction
    .getPendingDocumentByStudent
    .useQuery(
      {
        studentId:
          selectedStudent?.id ||
          1,
      },
            {
        enabled:
          canUseAI &&
          user?.role !==
            "superhost" &&
          Number(
            selectedStudent?.id ||
            0
          ) > 0,

        /**
         * 다른 관리자가 현재 학생의 OCR 초안을
         * 생성한 경우 담당자 화면에 자동으로 표시한다.
         *
         * 학생이 선택된 동안에만 15초 간격으로 조회한다.
         */
        refetchInterval:
          15_000,

        /**
         * 브라우저 탭이 비활성화된 동안에는
         * 불필요한 반복 조회를 하지 않는다.
         */
        refetchIntervalInBackground:
          false,

        refetchOnWindowFocus:
          true,

        retry:
          false,
      }
    );

  const scopeLabel = useMemo(() => {
  if (selectedStudent) return selectedStudent.clientName;
  if (user?.role === "staff") return "내 담당 학생";
  if (user?.role === "admin") return "소속 팀 학생";
  if (user?.role === "host") return "조직 전체";
  if (user?.role === "superhost") return "관리 대상 조직 전체";
  return "접근 가능한 CRM 데이터";
}, [selectedStudent, user?.role]);

useEffect(
  () => {
    if (
      !chatHistoryQuery
        .data
        ?.success
    ) {
      return;
    }

    const historyMessages =
      Array.isArray(
        chatHistoryQuery
          .data
          .messages
      )
        ? chatHistoryQuery
            .data
            .messages
            .map(
              toDashboardAIMessage
            )
            .filter(
              (
                message
              ) =>
                message.content
                  .trim()
                  .length >
                0
            )
        : [];

    setMessages(
  collapsePendingActionMessages(
    historyMessages
  )
);
  },
  [
    chatHistoryQuery
      .data,
  ]
);

useEffect(
  () => {
    if (
      !chatHistoryQuery
        .error
    ) {
      return;
    }

    setErrorMessage(
      getErrorMessage(
        chatHistoryQuery
          .error
      )
    );
  },
  [
    chatHistoryQuery
      .error,
  ]
);

/**
 * 선택한 학생의 OCR 승인 초안을
 * 기존 AI 메시지 카드 형식으로 화면에 표시한다.
 *
 * 이 메시지는 채팅 기록에 새로 저장하지 않는다.
 * DB의 Pending Action을 화면에 표시하기 위한
 * 임시 메시지다.
 */
useEffect(
  () => {
    const selectedStudentId =
      Number(
        selectedStudent?.id ||
        0
      );

    /**
     * 학생 선택이 해제되면
     * 서버 조회로 추가했던 임시 카드만 제거한다.
     */
    if (
      selectedStudentId <=
      0
    ) {
      setMessages(
        (
          previousMessages
        ) =>
          previousMessages.filter(
            (
              message
            ) =>
              !String(
                message.id ||
                ""
              ).startsWith(
                "pending-document-student-"
              )
          )
      );

      return;
    }

    /**
     * Query가 아직 로딩 중이면
     * 기존 카드를 먼저 지우지 않는다.
     */
        if (
      pendingDocumentByStudentQuery
        .isLoading ||
      pendingDocumentByStudentQuery
        .isFetching
    ) {
      return;
    }

    /**
     * 현재 사용자가 해당 학생의 실제 담당자가 아니면
     * 서버에서 조회 권한이 차단될 수 있다.
     *
     * 이 경우 이전 학생의 임시 승인 카드만 제거하고
     * AI 전체 오류 메시지는 표시하지 않는다.
     */
    if (
      pendingDocumentByStudentQuery
        .error
    ) {
      setMessages(
        (
          previousMessages
        ) =>
          previousMessages.filter(
            (
              message
            ) =>
              !String(
                message.id ||
                ""
              ).startsWith(
                "pending-document-student-"
              )
          )
      );

      return;
    }

    const pendingAction =
      pendingDocumentByStudentQuery
        .data
        ?.action ||
      null;

    setMessages(
      (
        previousMessages
      ) => {
        /**
         * 이전 학생에서 조회했던 임시 OCR 카드는 제거한다.
         *
         * 단, 이미 승인 결과 카드로 바뀐 메시지는
         * 삭제하지 않는다.
         */
        const withoutPreviousTemporaryCard =
          previousMessages.filter(
            (
              message
            ) => {
              const isTemporaryDocumentCard =
                String(
                  message.id ||
                  ""
                ).startsWith(
                  "pending-document-student-"
                );

              const isStillPendingPreview =
                message.kind ===
                  "student_registration_preview" &&
                String(
                  message.data
                    ?.pendingAction
                    ?.status ||
                  ""
                ) ===
                  "awaiting_confirmation";

              return !(
                isTemporaryDocumentCard &&
                isStillPendingPreview
              );
            }
          );

        if (
          !pendingAction
        ) {
          return withoutPreviousTemporaryCard;
        }

        const pendingActionId =
          Number(
            pendingAction.id ||
            0
          );

        if (
          pendingActionId <=
          0
        ) {
          return withoutPreviousTemporaryCard;
        }

        /**
         * 같은 Pending Action이 기존 채팅 기록이나
         * 현재 메시지에 이미 있으면 중복 추가하지 않는다.
         */
                const alreadyExists =
          withoutPreviousTemporaryCard.some(
            (
              message
            ) =>
              Number(
                message.data
                  ?.pendingAction
                  ?.id ||
                0
              ) ===
              pendingActionId
          );

        /**
         * 같은 Pending Action 카드가 채팅 기록에 이미 있으면
         * 카드를 새로 추가하지 않는다.
         *
         * 다만 서버에서 받은 최신 Action 상태와
         * 취소 가능 권한은 기존 카드에 다시 반영한다.
         */
        if (
          alreadyExists
        ) {
          return withoutPreviousTemporaryCard.map(
            (
              message
            ) => {
              const messagePendingActionId =
                Number(
                  message.data
                    ?.pendingAction
                    ?.id ||
                  0
                );

              if (
                messagePendingActionId !==
                pendingActionId
              ) {
                return message;
              }

              /**
               * 이미 실행·취소·실패 결과 카드로 변경된 경우에는
               * 다시 승인 대기 카드로 되돌리지 않는다.
               */
              const isPendingPreview =
                message.kind ===
                  "student_registration_preview" &&
                String(
                  message.data
                    ?.pendingAction
                    ?.status ||
                  ""
                ) ===
                  "awaiting_confirmation";

              if (
                !isPendingPreview
              ) {
                return message;
              }

              return {
                ...message,

                data: {
                  ...message.data,

                  pendingAction,

                  pendingActionCanCancel:
                    pendingDocumentByStudentQuery
                      .data
                      ?.canCancel ===
                    true,

                  pendingActionSource:
                    message.data
                      ?.pendingActionSource ||
                    "student_pending_document",
                },
              };
            }
          );
        }

        const temporaryMessage:
          DashboardAIMessage = {
          id:
            `pending-document-student-${selectedStudentId}-${pendingActionId}`,

          role:
            "assistant",

          content:
            `${selectedStudent?.clientName || "선택한 학생"} 학생에게 승인 대기 중인 문서 CRM 반영 초안이 있습니다.`,

          createdAt:
            nowLabel(),

          kind:
            "student_registration_preview",

                    data: {
            pendingAction,

            /**
             * 취소 가능 여부는 서버가
             * Pending Action 최초 생성자 ID와
             * 현재 로그인 사용자 ID를 비교해서 반환한다.
             */
            pendingActionCanCancel:
              pendingDocumentByStudentQuery
                .data
                ?.canCancel ===
              true,

            pendingActionSource:
              "student_pending_document",
          },
        };

        return collapsePendingActionMessages([
          ...withoutPreviousTemporaryCard,
          temporaryMessage,
        ]);
      }
    );
  },
  [
    selectedStudent?.id,
    selectedStudent?.clientName,
    pendingDocumentByStudentQuery
      .data,
    pendingDocumentByStudentQuery
      .isLoading,
        pendingDocumentByStudentQuery
      .isFetching,
    pendingDocumentByStudentQuery
      .error,
  ]
);

const saveSpecialChatMessage =
  async (
    message:
      DashboardAIMessage,

    options?: {
      selectedStudentId?:
        number |
        null;

      throwOnError?:
        boolean;
    }
  ) => {
    const content =
      String(
        message.content ||
        ""
      ).trim();

    if (
      !content
    ) {
      return null;
    }

    try {
      const response =
        await saveChatMessageMutation
          .mutateAsync({
            role:
              message.role,

            kind:
              message.kind ||
              "text",

            content,

            data:
              message.data &&
              typeof message.data ===
                "object"
                ? message.data
                : null,

            selectedStudentId:
              options
                ?.selectedStudentId ??
              selectedStudent
                ?.id ??
              null,
          });

      return response;
    } catch (
      error
    ) {
      console.error(
        "[AI CHAT] 특수 메시지 저장 실패",
        error
      );

      if (
        options?.throwOnError
      ) {
        throw error;
      }

      return null;
    }
  };

  const withOrgPath = (path: string) => {
    const slug = getOrganizationSlug(user);
    if (!slug) return path;
    return path === "/" ? `/${slug}` : `/${slug}${path}`;
  };

  const replacePendingActionMessage = (
    pendingActionId: number,
    updater: (
      message: DashboardAIMessage
    ) => DashboardAIMessage
  ) => {
    setMessages((prev) =>
      prev.map((message) => {
        const messagePendingActionId =
          Number(
            message.data
              ?.pendingAction
              ?.id ||
            0
          );

        if (
          messagePendingActionId !==
          pendingActionId
        ) {
          return message;
        }

        return updater(message);
      })
    );
  };

  const handleConfirmPendingAction =
  async (
    pendingActionId: number,
    expectedVersion: number
  ) => {
    setErrorMessage(null);

    try {
      const response =
        await confirmPendingActionMutation.mutateAsync({
          id:
            pendingActionId,

          expectedVersion,
        });

      const pendingAction =
        response?.pendingAction ||
        response?.action ||
        null;

      const actionType =
        String(
          response?.actionType ||
          pendingAction
            ?.actionType ||
          ""
        );

      const isDocumentImport =
        actionType.startsWith(
          "document_"
        );

const isScheduleCreate =
  actionType ===
  "schedule_create";

const isSemesterCreate =
  actionType ===
  "semester_create";

const isSemesterComplete =
  actionType ===
  "semester_complete";

const isConsultationUpdate =
  actionType ===
  "consultation_update";

const isStudentUpdate =
  actionType ===
  "student_update";

      const studentId =
        Number(
          response?.studentId ||
          pendingAction
            ?.studentId ||
          pendingAction
            ?.executionResult
            ?.studentId ||
          0
        );

const consultationId =
  Number(
    response?.consultationId ||
    pendingAction
      ?.consultationId ||
    pendingAction
      ?.executionResult
      ?.consultationId ||
    0
  );

const resultContent =
  response?.message ||
  (
    isStudentUpdate
      ? "학생 기본정보 수정이 완료되었습니다."
      : isConsultationUpdate
        ? "상담DB 정보 수정이 완료되었습니다."
        : isSemesterComplete
          ? "학생 학기 입력완료 처리가 완료되었습니다."
          : isSemesterCreate
            ? "학생 학기 생성이 완료되었습니다."
            : isScheduleCreate
              ? "일정 등록이 완료되었습니다."
              : isDocumentImport
                ? "AI 문서 분석 결과의 CRM 반영이 완료되었습니다."
                : "등록예정 학생 생성 및 과목설계 저장이 완료되었습니다."
  );

const registrationResult = {
  success:
    response?.success ===
    true,

consultationId:
  consultationId > 0
    ? consultationId
    : null,

  studentId:
    studentId > 0
      ? studentId
      : null,

scheduleId:
  Number(
    response?.scheduleId ||
    pendingAction
      ?.executionResult
      ?.scheduleId ||
    0
  ) ||
  null,

  planId:
    Number(
      response?.planId ||
      pendingAction
        ?.executionResult
        ?.planId ||
      0
    ) ||
    null,

  semesterId:
    Number(
      response?.semesterId ||
      pendingAction
        ?.executionResult
        ?.semesterId ||
      (
        Array.isArray(
          response?.semesterIds
        )
          ? response
              .semesterIds[0]
          : Array.isArray(
              pendingAction
                ?.executionResult
                ?.semesterIds
            )
            ? pendingAction
                .executionResult
                .semesterIds[0]
            : 0
      ) ||
      0
    ) ||
    null,

  semesterIds:
    Array.isArray(
      response?.semesterIds
    )
      ? response.semesterIds
      : Array.isArray(
          pendingAction
            ?.executionResult
            ?.semesterIds
        )
        ? pendingAction
            .executionResult
            .semesterIds
        : [],

  semesterOrder:
    Number(
      response?.semesterOrder ||
      pendingAction
        ?.executionResult
        ?.semesterOrder ||
      0
    ) ||
    null,

  isCompleted:
    response?.isCompleted ===
      true ||
    pendingAction
      ?.executionResult
      ?.isCompleted ===
      true,

  approvalStatus:
    String(
      response?.approvalStatus ||
      pendingAction
        ?.executionResult
        ?.approvalStatus ||
      ""
    ).trim() ||
    null,

  planSubjectIds:
    Array.isArray(
      response?.planSubjectIds
    )
      ? response.planSubjectIds
      : Array.isArray(
          pendingAction
            ?.executionResult
            ?.planSubjectIds
        )
        ? pendingAction
            .executionResult
            .planSubjectIds
        : [],

  transferSubjectIds:
    Array.isArray(
      response?.transferSubjectIds
    )
      ? response.transferSubjectIds
      : Array.isArray(
          pendingAction
            ?.executionResult
            ?.transferSubjectIds
        )
        ? pendingAction
            .executionResult
            .transferSubjectIds
        : [],

  practiceSaved:
    response?.practiceSaved ===
      true ||
    pendingAction
      ?.executionResult
      ?.practiceSaved ===
      true,

  paymentUpdated:
    response?.paymentUpdated ===
      true ||
    pendingAction
      ?.executionResult
      ?.paymentUpdated ===
      true,

  message:
    resultContent,
};

      replacePendingActionMessage(
        pendingActionId,
        (message) => ({
          ...message,

          content:
  resultContent,

          kind:
            "student_registration_result",

          data: {
            ...message.data,

            pendingAction:
              pendingAction ||
              message.data
                ?.pendingAction ||
              null,

                  registrationResult,
    },
  })
      );

await saveSpecialChatMessage(
  {
    id:
      `assistant-registration-result-${Date.now()}`,

    role:
      "assistant",

    content:
      resultContent,

    createdAt:
      nowLabel(),

    kind:
      "student_registration_result",

    data: {
      pendingAction,

      registrationResult,
    },
  },
  {
  selectedStudentId:
    studentId > 0
      ? studentId
      : pendingAction?.studentId ??
        selectedStudent?.id ??
        null,
}
);

    if (
  studentId > 0 &&
  !isDocumentImport &&
  !isSemesterCreate &&
  !isSemesterComplete &&
  !isScheduleCreate &&
  !isConsultationUpdate &&
  !isStudentUpdate
) {
        setSelectedStudent({
          id:
            studentId,

          clientName:
            `학생 #${studentId}`,

          phone:
            null,

          course:
            null,

          finalEducation:
            null,
        });
      }

      /**
       * 문서 OCR 반영이 끝나면
       * 해당 학생의 승인 대기 초안을 다시 조회한다.
       *
       * 실행 완료된 Action은 서버 조회 조건에서 제외되므로
       * 승인 대기 카드는 자동으로 사라진다.
       */
      if (
        isDocumentImport
      ) {
        await pendingDocumentByStudentQuery
          .refetch();
      }
    } catch (error) {
      const message =
        getErrorMessage(error);

      setErrorMessage(message);

      replacePendingActionMessage(
        pendingActionId,
        (currentMessage) => ({
          ...currentMessage,

          content:
            message,

          kind:
            "student_registration_preview",
        })
      );

await saveSpecialChatMessage(
  {
    id:
      `assistant-registration-error-${Date.now()}`,

    role:
      "assistant",

    content:
      message,

    createdAt:
      nowLabel(),

    kind:
      "error",

    data: {
      pendingAction: {
        id:
          pendingActionId,

        version:
          expectedVersion,
      },
    },
  },
  {
    selectedStudentId:
      selectedStudent
        ?.id ??
      null,
  }
);
    }
  };

  const handleCancelPendingAction =
    async (
      pendingActionId: number,
      expectedVersion: number
    ) => {
      setErrorMessage(null);

      try {
        const response =
          await cancelPendingActionMutation.mutateAsync({
            id:
              pendingActionId,

            expectedVersion,
          });

                const pendingAction =
          response?.action ||
          null;

const actionType =
  String(
    pendingAction
      ?.actionType ||
    ""
  );

const isDocumentImport =
  actionType.startsWith(
    "document_"
  );

const isScheduleCreate =
  actionType ===
  "schedule_create";

const isSemesterCreate =
  actionType ===
  "semester_create";

const isSemesterComplete =
  actionType ===
  "semester_complete";

const isConsultationUpdate =
  actionType ===
  "consultation_update";

const isStudentUpdate =
  actionType ===
  "student_update";

const cancelledContent =
  response?.message ||
  (
    isStudentUpdate
      ? "학생 기본정보 수정 초안이 취소되었습니다."
      : isConsultationUpdate
        ? "상담DB 수정 초안이 취소되었습니다."
        : isSemesterComplete
          ? "학생 학기 입력완료 초안이 취소되었습니다."
          : isSemesterCreate
            ? "학생 학기 생성 초안이 취소되었습니다."
            : isScheduleCreate
              ? "일정 등록 초안이 취소되었습니다."
              : isDocumentImport
                ? "문서 CRM 반영 초안이 취소되었습니다."
                : "학생 등록 초안이 취소되었습니다."
  );

const cancelledPendingAction =
  pendingAction
    ? {
        ...pendingAction,

        status:
          "cancelled",
      }
    : {
        id:
          pendingActionId,

        version:
          expectedVersion,

        actionType:
          actionType ||
          null,

        status:
          "cancelled",
      };

        replacePendingActionMessage(
          pendingActionId,
          (message) => ({
            ...message,

           content:
  cancelledContent,

            data: {
              ...message.data,

              pendingAction: {
  ...message.data
    ?.pendingAction,

  ...cancelledPendingAction,

  status:
    "cancelled",
},
            },
          })
        );

await saveSpecialChatMessage(
  {
    id:
      `assistant-registration-cancelled-${Date.now()}`,

    role:
      "assistant",

    content:
      cancelledContent,

    createdAt:
      nowLabel(),

    kind:
      "student_registration_preview",

    data: {
      pendingAction: {
        ...cancelledPendingAction,

        status:
          "cancelled",
      },
    },
  },
  {
    selectedStudentId:
      cancelledPendingAction
        ?.studentId ??
      null,
  }
);

        /**
         * 문서 OCR 초안이 취소된 경우
         * 현재 선택된 학생의 Pending Action을 다시 조회한다.
         *
         * 취소된 Action은 서버의
         * awaiting_confirmation 조회 조건에서 제외된다.
         */
        if (
          isDocumentImport
        ) {
          await pendingDocumentByStudentQuery
            .refetch();
        }
      } catch (error) {
        const message =
          getErrorMessage(error);

        setErrorMessage(message);

               replacePendingActionMessage(
          pendingActionId,
          (currentMessage) => ({
            ...currentMessage,

            content:
              message,

            kind:
              "student_registration_preview",
          })
        );

await saveSpecialChatMessage(
  {
    id:
      `assistant-registration-cancel-error-${Date.now()}`,

    role:
      "assistant",

    content:
      message,

    createdAt:
      nowLabel(),

    kind:
      "error",

    data: {
      pendingAction: {
        id:
          pendingActionId,

        version:
          expectedVersion,
      },
    },
  },
  {
    selectedStudentId:
      selectedStudent
        ?.id ??
      null,
  }
);
      }
    };

  const handleSend = async (content: string) => {
    const userMessage: DashboardAIMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content,
      createdAt: nowLabel(),
      kind: "text",
    };

    setMessages((prev) => [...prev, userMessage]);
    setErrorMessage(null);

    try {
      const response = await chatMutation.mutateAsync({
        message: content,
        selectedStudentId: selectedStudent?.id ?? undefined,
        selectedStudentName: selectedStudent?.clientName ?? undefined,
      });

            const registrationPreview =
        response
          ?.registrationPreview;

      if (
        registrationPreview
          ?.required ===
          true
      ) {
        const consultationId =
          Number(
            registrationPreview
              .consultationId ||
            0
          );

        if (consultationId <= 0) {
          const assistantMessage:
            DashboardAIMessage = {
            id:
              `assistant-${Date.now()}`,

            role:
              "assistant",

            content:
              response?.reply ||
              "등록예정 학생 생성 및 과목설계를 진행하려면 상담DB 번호가 필요합니다.",

            createdAt:
              nowLabel(),

            kind:
              "warning",

            data: {
              registrationPreview,
            },
          };

          setMessages(
            (prev) => [
              ...prev,
              assistantMessage,
            ]
          );

          return;
        }

        const previewResponse =
          await studentRegistrationPreviewMutation.mutateAsync({
            consultationId,

            message:
              registrationPreview
                .originalMessage ||
              content,

              ocrSubjects:
              [],
          });

        const registrationPendingAction =
  previewResponse
    ?.pendingAction ||
  null;

const hasRegistrationPendingAction =
  Number(
    registrationPendingAction
      ?.id ||
    0
  ) > 0;

const assistantMessage:
  DashboardAIMessage = {
  id:
    `assistant-${Date.now()}`,

  role:
    "assistant",

  content:
    previewResponse
      ?.message ||
    response?.reply ||
    (
      hasRegistrationPendingAction
        ? "학생 통합등록 미리보기가 생성되었습니다."
        : "학생 통합등록에 필요한 정보를 추가로 입력해주세요."
    ),

  createdAt:
    nowLabel(),

  /**
   * 실제 승인 초안이 있을 때만
   * 승인 카드 형태로 표시한다.
   *
   * 누락정보 수집 단계에서는
   * 일반 안내문으로 표시한다.
   */
  kind:
    hasRegistrationPendingAction
      ? "student_registration_preview"
      : "warning",

  data: {
    registrationPreview,

    pendingAction:
      registrationPendingAction,
  },
};

await saveSpecialChatMessage(
  assistantMessage,
  {
    selectedStudentId:
      registrationPendingAction
        ?.studentId ??
      selectedStudent
        ?.id ??
      null,
  }
);

        setMessages(
          (prev) => [
            ...prev,
            assistantMessage,
          ]
        );

        return;
      }

      const responseData =
  response?.data &&
  typeof response.data ===
    "object"
    ? response.data
    : {};

const assistantMessage:
  DashboardAIMessage = {
  id:
    `assistant-${Date.now()}`,

  role:
    "assistant",

  content:
    response?.reply ||
    response?.answer ||
    "응답 결과가 없습니다.",

  createdAt:
    nowLabel(),

  kind:
    getMessageKind(
      response
    ),

  data: {
    ...responseData,

    pendingAction:
      response?.pendingAction ||
      responseData
        ?.pendingAction ||
      null,

    scheduleCreateDraft:
  response
    ?.scheduleCreateDraft ||
  responseData
    ?.scheduleCreateDraft ||
  null,

semesterCreateDraft:
  response
    ?.semesterCreateDraft ||
  responseData
    ?.semesterCreateDraft ||
  null,

semesterCompleteDraft:
  response
    ?.semesterCompleteDraft ||
  responseData
    ?.semesterCompleteDraft ||
  null,

consultationUpdateDraft:
  response
    ?.consultationUpdateDraft ||
  responseData
    ?.consultationUpdateDraft ||
  null,

studentUpdateDraft:
  response
    ?.studentUpdateDraft ||
  responseData
    ?.studentUpdateDraft ||
  null,
  },
};

      setMessages(
        (prev) => [
          ...prev,
          assistantMessage,
        ]
      );
    } catch (error) {
      const message = getErrorMessage(error);
      setErrorMessage(message);
      const assistantMessage: DashboardAIMessage = {
  id:
    `assistant-error-${Date.now()}`,

  role:
    "assistant",

  content:
    message,

  createdAt:
    nowLabel(),

  kind:
    "error",
};

await saveSpecialChatMessage(
  assistantMessage
);

setMessages(
  (prev) => [
    ...prev,
    assistantMessage,
  ]
);
    }
  };

const handleAnalyzeDocument =
  async (
    file: File
  ) => {
    setErrorMessage(
      null
    );

    const allowedMimeTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

   if (
  !allowedMimeTypes.includes(
    file.type
  )
) {
  const message =
    "JPG, PNG, WEBP 이미지 파일만 분석할 수 있습니다.";

  setErrorMessage(
    message
  );

  const assistantMessage:
    DashboardAIMessage = {
    id:
      `assistant-document-error-${Date.now()}`,

    role:
      "assistant",

    content:
      message,

    createdAt:
      nowLabel(),

    kind:
      "error",
  };

  setMessages(
    (prev) => [
      ...prev,
      assistantMessage,
    ]
  );

  return;
}

    if (
  file.size >
  10 * 1024 * 1024
) {
  const message =
    "이미지 용량은 10MB 이하만 분석할 수 있습니다.";

  setErrorMessage(
    message
  );

  const assistantMessage:
    DashboardAIMessage = {
    id:
      `assistant-document-error-${Date.now()}`,

    role:
      "assistant",

    content:
      message,

    createdAt:
      nowLabel(),

    kind:
      "error",
  };

  setMessages(
    (prev) => [
      ...prev,
      assistantMessage,
    ]
  );

  return;
}

    const userMessage:
      DashboardAIMessage = {
      id:
        `user-document-${Date.now()}`,

      role:
        "user",

      content:
        selectedStudent
          ? `${selectedStudent.clientName} 학생의 이미지 문서를 분석합니다.\n파일명: ${file.name}`
          : `이미지 문서를 분석합니다.\n파일명: ${file.name}`,

      createdAt:
        nowLabel(),

      kind:
        "text",

      data: {
        fileName:
          file.name,

        fileSize:
          file.size,

        mimeType:
          file.type,
      },
    };

    setMessages(
      (prev) => [
        ...prev,
        userMessage,
      ]
    );

    try {
      const imageBase64 =
        await readImageFileAsBase64(
          file
        );

      const response =
  await chatMutation.mutateAsync({
    message:
      selectedStudent
        ? `${selectedStudent.clientName} 학생의 첨부 이미지를 분석해줘.`
        : "첨부된 이미지를 분석해줘.",

    imageAttachment: {
      fileName:
        file.name,

      mimeType:
        file.type as
          | "image/jpeg"
          | "image/png"
          | "image/webp",

      imageBase64,
    },

    selectedStudentId:
      selectedStudent
        ?.id ??
      undefined,

    selectedStudentName:
      selectedStudent
        ?.clientName ??
      undefined,
  });

const analysis =
  response?.toolResult
    ?.data ??
  response?.data
    ?.documentAnalysis ??
  response?.data
    ?.analysis ??
  null;

      if (
        !analysis
      ) {
        throw new Error(
          "AI 문서 분석 결과가 없습니다."
        );
      }

      const documentTypeLabel =
        String(
          analysis
            .documentTypeLabel ||
          analysis
            .documentType ||
          "이미지 문서"
        );

      const recommendedTargetLabel =
        String(
          analysis
            .recommendedTargetLabel ||
          analysis
            .recommendedTarget ||
          "담당자 확인 필요"
        );

      const confidence =
        Number(
          analysis
            .confidence ||
          0
        );

      const confidencePercent =
        confidence <= 1
          ? Math.round(
              confidence *
                100
            )
          : Math.round(
              confidence
            );

      const subjects =
        Array.isArray(
          analysis.subjects
        )
          ? analysis.subjects
          : [];

      const warnings =
        Array.isArray(
          analysis.warnings
        )
          ? analysis.warnings
              .map(
                (
                  warning:
                    unknown
                ) =>
                  String(
                    warning
                  ).trim()
              )
              .filter(Boolean)
          : [];

      const assistantMessage:
        DashboardAIMessage = {
        id:
          `assistant-document-${Date.now()}`,

        role:
          "assistant",

      content: [
  `**${documentTypeLabel} 분석 결과**`,
  "",
  `- 권장 반영 위치: ${recommendedTargetLabel}`,
  `- 분석 신뢰도: ${confidencePercent}%`,
  `- 추출 과목 수: ${subjects.length}개`,
  "",
  warnings.length > 0
    ? "**확인 사항**"
    : "",
  ...warnings.map(
    (
      warning:
        string
    ) =>
      `- ${warning}`
  ),
  "",
  "이 분석 결과는 아직 CRM에 저장되지 않았습니다.",
].join("\n"),

        createdAt:
          nowLabel(),

        kind:
          "document_analysis",

        data: {
          documentAnalysis:
            analysis,

          fileName:
            file.name,

          fileSize:
            file.size,

          mimeType:
            file.type,

          saved:
            response
              ?.meta
              ?.saved ===
            true,
        },
      };

      setMessages(
        (prev) => [
          ...prev,
          assistantMessage,
        ]
      );
   } catch (error) {
  const message =
    getErrorMessage(
      error
    );

  setErrorMessage(
    message
  );

  const assistantMessage:
    DashboardAIMessage = {
    id:
      `assistant-document-error-${Date.now()}`,

    role:
      "assistant",

    content:
      message,

    createdAt:
      nowLabel(),

    kind:
      "error",
  };

  await saveSpecialChatMessage(
    assistantMessage,
    {
      selectedStudentId:
        selectedStudent
          ?.id ??
        null,
    }
  );

  setMessages(
    (prev) => [
      ...prev,
      assistantMessage,
    ]
  );
}
};


const handleRequestDocumentImport =
  async (
    messageId:
      string,

    analysis:
      NonNullable<
        DashboardAIMessage["data"]
      >["documentAnalysis"]
  ) => {
    setErrorMessage(
      null
    );

    if (
      !selectedStudent
    ) {
      const message =
        "CRM에 반영할 학생을 먼저 선택해주세요.";

      setErrorMessage(
        message
      );

      return;
    }

    if (
      !analysis
    ) {
      const message =
        "문서 분석 결과를 찾을 수 없습니다.";

      setErrorMessage(
        message
      );

      return;
    }

    try {
      const response =
        await documentImportPreviewMutation
          .mutateAsync({
            studentId:
              selectedStudent.id,

            analysis,

            target:
              null,

            expiresInMinutes:
              30,
          });

      const pendingAction =
        response
          ?.pendingAction ||
        null;

      if (
        !pendingAction
      ) {
        throw new Error(
          "문서 CRM 반영 초안을 생성하지 못했습니다."
        );
      }

      const previewMessage =
        messages.find(
          (
            message
          ) =>
            message.id ===
            messageId
        );

      const updatedMessage:
        DashboardAIMessage = {
        ...(
          previewMessage || {
            id:
              `assistant-document-preview-${Date.now()}`,

            role:
              "assistant" as const,

            createdAt:
              nowLabel(),
          }
        ),

        content:
          response?.message ||
          "문서 CRM 반영 미리보기가 생성되었습니다.",

        kind:
          "student_registration_preview",

                data: {
          ...(
            previewMessage
              ?.data ||
            {}
          ),

          pendingAction,

          /**
           * 이번 요청에서 새로 생성한 초안이면
           * 현재 사용자가 취소할 수 있다.
           *
           * 서버가 기존 초안을 재사용한 경우에는
           * 생성자가 다를 수 있으므로 승인만 허용한다.
           */
                    pendingActionCanCancel:
            response?.canCancel ===
            true,

          pendingActionSource:
            response?.reused ===
              true
              ? "student_pending_document"
              : "chat",
        },
      };

      await saveSpecialChatMessage(
        updatedMessage,
        {
          selectedStudentId:
            selectedStudent.id,
        }
      );

      setMessages(
        (
          prev
        ) =>
          prev.map(
            (
              message
            ) =>
              message.id ===
                messageId
                ? updatedMessage
                : message
          )
      );
   } catch (
  error
) {
  const message =
    getErrorMessage(
      error
    );

  setErrorMessage(
    message
  );

  const assistantMessage:
    DashboardAIMessage = {
    id:
      `assistant-document-preview-error-${Date.now()}`,

    role:
      "assistant",

    content:
      message,

    createdAt:
      nowLabel(),

    kind:
      "error",
  };

  await saveSpecialChatMessage(
    assistantMessage,
    {
      selectedStudentId:
        selectedStudent
          ?.id ??
        null,
    }
  );

  setMessages(
    (
      prev
    ) => [
      ...prev,
      assistantMessage,
    ]
  );
}
  };

const handleClearChatHistory =
  async () => {
    if (
      clearChatHistoryMutation
        .isPending
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        [
          "AI 대화 기록을 전체 삭제하시겠습니까?",
          "",
          "삭제된 대화는 복구할 수 없습니다.",
          "학생·상담·CRM 데이터는 삭제되지 않습니다.",
        ].join("\n")
      );

    if (
      !confirmed
    ) {
      return;
    }

    setErrorMessage(
      null
    );

    try {
      await clearChatHistoryMutation
        .mutateAsync({});

      setMessages(
        []
      );

      setSelectedStudent(
        null
      );

      await chatHistoryQuery
        .refetch();
    } catch (
      error
    ) {
      setErrorMessage(
        getErrorMessage(
          error
        )
      );
    }
  };

  const handleSelectStudent = (
  student:
    DashboardAIStudent
) => {
  /**
   * 다른 학생을 선택할 때
   * 이전 학생에게서 조회한 임시 OCR 승인 카드를
   * 즉시 화면에서 제거한다.
   */
  setMessages(
    (
      previousMessages
    ) =>
      previousMessages.filter(
        (
          message
        ) =>
          !(
            String(
              message.id ||
              ""
            ).startsWith(
              "pending-document-student-"
            ) &&
            message.kind ===
              "student_registration_preview" &&
            String(
              message.data
                ?.pendingAction
                ?.status ||
              ""
            ) ===
              "awaiting_confirmation"
          )
      )
  );

  setSelectedStudent({
    id:
      student.id,

    clientName:
      student.clientName ||
      `학생 #${student.id}`,

    phone:
      student.phone ||
      null,

    course:
      student.course ||
      null,

    finalEducation:
      student.finalEducation ||
      null,
  });
};

  if (!canUseAI) {
    return (
      <div className="flex h-full items-center justify-center bg-[#F7F9F8] px-6 text-center">
        <div>
          <p className="text-sm font-bold text-slate-900">
            AI 업무비서를 사용할 수 없는 계정입니다.
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-500">
  Staff, Admin, Host 또는 Superhost 권한이 필요합니다.
</p>
        </div>
      </div>
    );
  }

  return (
    <DashboardAIChatBox
      scopeLabel={scopeLabel}
      messages={messages}
      selectedStudent={selectedStudent}
          isLoading={
  chatHistoryQuery.isLoading ||
  chatMutation.isPending ||
  documentImportPreviewMutation.isPending ||
  studentRegistrationPreviewMutation.isPending ||
  confirmPendingActionMutation.isPending ||
  cancelPendingActionMutation.isPending ||
  saveChatMessageMutation.isPending ||
  clearChatHistoryMutation.isPending
}
      errorMessage={
  errorMessage
}

onSend={
  handleSend
}

onAnalyzeDocument={
  user?.role ===
    "staff" ||
  user?.role ===
    "admin" ||
  user?.role ===
    "host"
    ? handleAnalyzeDocument
    : undefined
}

onRequestDocumentImport={
  user?.role ===
    "staff" ||
  user?.role ===
    "admin" ||
  user?.role ===
    "host"
    ? handleRequestDocumentImport
    : undefined
}

onSelectStudent={
  handleSelectStudent
}
      onConfirmPendingAction={
        handleConfirmPendingAction
      }

      onCancelPendingAction={
        handleCancelPendingAction
      }
onClearChatHistory={
  handleClearChatHistory
}
      onClearSelectedStudent={() => {
  setSelectedStudent(
    null
  );

  setMessages(
    (
      previousMessages
    ) =>
      previousMessages.filter(
        (
          message
        ) =>
          !(
            String(
              message.id ||
              ""
            ).startsWith(
              "pending-document-student-"
            ) &&
            message.kind ===
              "student_registration_preview" &&
            String(
              message.data
                ?.pendingAction
                ?.status ||
              ""
            ) ===
              "awaiting_confirmation"
          )
      )
  );
}}
      onOpenStudent={(studentId) => {
        window.location.href = withOrgPath(`/students/${studentId}`);
      }}
      onOpenConsultation={(consultationId) => {
  window.location.href =
    withOrgPath(
      `/consultations?consultationId=${consultationId}`
    );
}}
    />
  );
}
