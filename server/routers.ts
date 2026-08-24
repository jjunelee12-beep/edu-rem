import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import {
  publicProcedure,
  protectedProcedure,
  adminProcedure,
  hostProcedure,
superHostProcedure,
  router,
} from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { getOrganizationLimitStatus, getOrganizationFeatureFlags } from "./saasdb";
import { buildSettlementPayslipExcel } from "./_core/settlement-payslip-excel";
import { buildSettlementSalesSummaryExcel } from "./_core/settlement-sales-summary-excel";
import { buildOrganizationExcelExport } from "./_core/organization-excel-export";
import { emitLiveNotification } from "./_core/live-notifications";
import { publicLeadRouter } from "./publicLead.router";
import bcrypt from "bcryptjs";
import { smsRouter } from "./_core/sms.router";
import Tesseract from "tesseract.js";
import OpenAI from "openai";
import {
  createHash,
  randomBytes,
} from "node:crypto";
import { attendanceRouter } from "./attendance.router";
import { noticeRouter } from "./routes/notice.router";
import { scheduleRouter } from "./routes/schedule.router";
import { approvalRouter } from "./routes/approval.router";
import { privateCertificateMasterRouter } from "./routes/privateCertificateMaster";
import { subjectCatalogRouter } from "./routes/subjectCatalog";
import { FEATURE_FLAGS } from "./_core/featureFlags";
import { saasRouter } from "./saas.router";
import {
  uploadPrivateJsonObject,
  createPrivateDownloadUrl,
  readPrivateTextObject,
} from "./_core/objectStorage";
import { maskPersonalData, maskPersonalDataList } from "./_core/privacy";
import { sendVerificationEmail } from "./_core/mail";
import { throwAppError } from "./_core/appError";
import { ERROR_CODES } from "./_core/errorCodes";

import {
  updateAdministrativeProcedure,
} from "./administrative-procedure.service";

import {
  createStudentAiManagementRecord,
} from "./student-ai-management.service";

import { buildAiContext } from "./ai/ai-context";
import {
  assertCanAccessStudent,
  assertCanWriteStudent,
} from "./ai/ai-permission";
import {
  executeAiTool,
  listRegisteredAiTools,
} from "./ai/ai-tool-registry";

import type {
  AiDocumentAnalysisResult,
  ConsultationSearchToolOutput,
  MissingDataAlertToolOutput,
  StudentSearchToolOutput,
} from "./ai/ai.types";

import {
  runAiAssistant,
} from "./ai/ai-runner";
import {
  cancelAiPendingAction,
} from "./ai/ai-pending-action-cancel-service";

import {
  prepareAiPendingActionForConfirmation,
} from "./ai/ai-pending-action-confirm-guard";

import {
  dispatchAiPendingActionConfirmation,
} from "./ai/ai-pending-action-confirm-dispatcher";

import {
  buildStudentRegistrationDraft,
} from "./ai/student-registration-draft";

import {
  analyzeAiDocument,
} from "./ai/document-analysis";

import {
  buildDocumentImportDraft,
} from "./ai/document-import-draft";

import {
  resolveQualificationRiskCourseKey,
} from "./ai/risk-rules/qualification-risk-analyzer";

import {
  analyzeStudentDetailRisk,
} from "./ai/ai-risk-engine";

import {
  resolveDegreeRequirement,
} from "./ai/risk-rules/degree-requirement-resolver";

import {
  resolveNileRecognizedSubjects,
} from "./nile/nile-recognized-subject-resolver";

async function applyNileClassificationToUniversityTranscript(
  params: {
    student:
      any;

    analysis:
      AiDocumentAnalysisResult;
  }
): Promise<AiDocumentAnalysisResult> {
  const {
    student,
    analysis,
  } = params;


  /**
   * 대학·전문대 성적증명서만
   * NILE 공식 학위영역 판정을 수행한다.
   *
   * 교육원 수강내역 / 결제문서는
   * 기존 OCR 분류를 그대로 유지한다.
   */
  if (
    analysis.documentType !==
    "university_transcript"
  ) {
    return analysis;
  }


  const courseName =
    String(
      student?.course ||
      ""
    ).trim();


  const finalEducation =
    String(
      student?.finalEducation ||
      ""
    ).trim();


  const courseKey =
    resolveQualificationRiskCourseKey(
      courseName
    );


  if (
    courseKey ===
    "unknown"
  ) {
    return {
      ...analysis,

      warnings:
        Array.from(
          new Set([
            ...(
              analysis.warnings ||
              []
            ),

            "학생의 희망과정을 NILE 공식 전공과 연결하지 못해 전적대 과목의 전공·교양·일반 판정을 보류했습니다.",
          ])
        ),
    };
  }


  if (
    !finalEducation
  ) {
    return {
      ...analysis,

      warnings:
        Array.from(
          new Set([
            ...(
              analysis.warnings ||
              []
            ),

            "학생의 최종학력이 없어 목표 학위경로를 확정할 수 없으므로 전적대 과목의 NILE 판정을 보류했습니다.",
          ])
        ),
    };
  }


  const degreeRequirement =
    resolveDegreeRequirement({
      courseKey,

      finalEducation,
    });


  /**
   * 원본 OCR 배열 위치를 반드시 보존한다.
   *
   * 동일한 과목명이 여러 번 존재할 수 있으므로
   * 과목명 Map으로 합치지 않는다.
   */
  const candidates =
    (
      analysis.subjects ||
      []
    )
      .map(
        (
          subject,
          index
        ) => {
          const subjectName =
            String(
              subject
                .subjectName
                ?.value ||
              ""
            ).trim();


          const credits =
            Number(
              subject
                .credits
                ?.value ||
              0
            );


          return {
            originalIndex:
              index,

            subject: {
              subjectName,

              credits:
                Number.isFinite(
                  credits
                ) &&
                credits > 0
                  ? credits
                  : 0,

              /**
               * 대학 원래 학습구분은
               * 목표 학점은행제 전공 판정에 사용하지 않는다.
               */
              category:
                null,

              requirementType:
                null,
            },
          };
        }
      )
      .filter(
        item =>
          item
            .subject
            .subjectName
            .length >= 2
      );


  if (
    candidates.length ===
    0
  ) {
    return analysis;
  }


  try {
    const nileRecognition =
      await resolveNileRecognizedSubjects({
        courseKey,

        degreeRequirement,

        subjects:
          candidates.map(
            item =>
              item.subject
          ),
      });


    if (
      !nileRecognition.canResolve
    ) {
      return {
        ...analysis,

        warnings:
          Array.from(
            new Set([
              ...(
                analysis.warnings ||
                []
              ),

              ...(
                nileRecognition
                  .warnings ||
                []
              ),
            ])
          ),
      };
    }


    const nextSubjects =
      [
        ...(
          analysis.subjects ||
          []
        ),
      ];


    nileRecognition
      .subjects
      .forEach(
        (
          resolvedSubject,
          resolvedIndex
        ) => {
          const candidate =
            candidates[
              resolvedIndex
            ];


          if (
            !candidate
          ) {
            return;
          }


          const originalSubject =
            nextSubjects[
              candidate.originalIndex
            ];


          if (
            !originalSubject
          ) {
            return;
          }


          const category =
            resolvedSubject.category;


          const requirementType =
            resolvedSubject
              .requirementType;


          if (
            category !== "전공" &&
            category !== "교양" &&
            category !== "일반"
          ) {
            return;
          }


          if (
            requirementType !==
              "전공필수" &&
            requirementType !==
              "전공선택" &&
            requirementType !==
              "교양" &&
            requirementType !==
              "일반"
          ) {
            return;
          }


          nextSubjects[
            candidate.originalIndex
          ] = {
            ...originalSubject,

            category: {
              ...originalSubject
                .category,

              value:
                category,

              confidence:
                1,

              confidenceLevel:
                "high",

              status:
                "confirmed",

              warning:
                resolvedSubject
                  .classificationReason,
            },

            requirementType: {
              ...originalSubject
                .requirementType,

              value:
                requirementType,

              confidence:
                1,

              confidenceLevel:
                "high",

              status:
                "confirmed",

              warning:
                resolvedSubject
                  .classificationReason,
            },

            warnings:
              Array.from(
                new Set([
                  ...(
                    originalSubject
                      .warnings ||
                    []
                  ),

                  resolvedSubject
                    .classificationReason,
                ])
              ),
          };
        }
      );


    return {
      ...analysis,

      subjects:
        nextSubjects,

      warnings:
        Array.from(
          new Set([
            ...(
              analysis.warnings ||
              []
            ),

            ...(
              nileRecognition
                .warnings ||
              []
            ),
          ])
        ),
    };
  } catch (
    error
  ) {
    /**
     * NILE DB가 일시적으로 없거나
     * 공식 Master 동기화 전이어도
     * OCR 결과 자체를 잃어버리면 안 된다.
     *
     * 분류값은 null 상태로 남아서
     * document-import-draft의 canConfirm=false
     * 방어 로직이 작동한다.
     */
    return {
      ...analysis,

      warnings:
        Array.from(
          new Set([
            ...(
              analysis.warnings ||
              []
            ),

            error instanceof
              Error
              ? `NILE 공식 과목 판정을 완료하지 못했습니다: ${error.message}`
              : "NILE 공식 과목 판정을 완료하지 못했습니다.",
          ])
        ),
    };
  }
}

function isAdminOrHost(user: any) {
  return (
    user?.role === "admin" ||
    user?.role === "host"
  );
}

function isHost(user: any) {
  return user?.role === "host";
}

function isAdmin(user: any) {
  return user?.role === "admin";
}

async function getExternalRequestAssignee(params: {
  currentUser: any;
  organizationId: number;
  assigneeId: number;
}) {
  const {
    currentUser,
    organizationId,
    assigneeId,
  } = params;

  if (!isAdminOrHost(currentUser)) {
    throwAppError(
      ERROR_CODES.PERMISSION_DENIED,
      "관리자 또는 호스트만 신규 요청을 등록할 수 있습니다.",
      403
    );
  }

  const assignee =
    await db.getAssignableUserById({
      organizationId,
      userId: Number(assigneeId),
    });

  if (!assignee) {
    throwAppError(
      ERROR_CODES.DATA_NOT_FOUND,
      "지정할 담당자를 찾을 수 없습니다.",
      404
    );
  }

  /**
   * Host는 같은 회사 전체 직원을 지정할 수 있다.
   */
  if (isHost(currentUser)) {
    return assignee;
  }

  /**
   * Admin은 자기 팀 구성원만 지정할 수 있다.
   */
  const currentUserId =
    Number(currentUser?.id || 0);

  const teamMemberIds =
    await db.getUserTeamMemberIds(
      currentUserId,
      {
        organizationId,
      }
    );

  const allowedUserIds =
    new Set(
      [
        currentUserId,
        ...(teamMemberIds || []).map(Number),
      ].filter(
        (id) =>
          Number.isFinite(id) &&
          id > 0
      )
    );

  if (
    !allowedUserIds.has(
      Number(assignee.id)
    )
  ) {
    throwAppError(
      ERROR_CODES.PERMISSION_DENIED,
      "관리자는 자기 팀 소속 담당자만 지정할 수 있습니다.",
      403
    );
  }

  return assignee;
}

function assertExternalRequestEditable(params: {
  currentUser: any;
}) {
  const {
    currentUser,
  } = params;

  if (!currentUser) {
    throwAppError(
      ERROR_CODES.AUTH_REQUIRED,
      "로그인이 필요합니다.",
      401
    );
  }

  if (isAdminOrHost(currentUser)) {
    return;
  }

  throwAppError(
    ERROR_CODES.PERMISSION_DENIED,
    "관리자 또는 호스트만 단독 요청을 수정하거나 삭제할 수 있습니다.",
    403
  );
}

const WITHONE_ORGANIZATION_ID = 1;
const WITHONE_ASSIGNEE_ID = 7;

const WITHONE_LANDING_CHANNEL = "위드원교육 랜딩페이지";
const WITHONE_LANDING_COURSE = "사회복지사 2급";

function normalizePublicLandingPhone(value: unknown) {
  return String(value ?? "")
    .replace(/\D/g, "")
    .slice(0, 11);
}

function getCtxOrganizationId(ctx: any) {
  const organizationId = Number(
    ctx?.organizationId ??
      ctx?.user?.organizationId ??
      ctx?.user?.organization_id ??
      ctx?.user?.organization?.id ??
      ctx?.session?.organizationId ??
      ctx?.session?.user?.organizationId ??
      0
  );

  if (!Number.isFinite(organizationId) || organizationId <= 0) {
    throwAppError(
      ERROR_CODES.ORGANIZATION_REQUIRED,
      "organizationId is required",
      400
    );
  }

  return organizationId;
}

const PRACTICE_SUPPORT_TEMP_ALLOWED_USERS = [
  { organizationId: 1, userId: 15 },
];

function isPracticeSupportTempAllowedUser(user: any) {
  return PRACTICE_SUPPORT_TEMP_ALLOWED_USERS.some(
    (row) =>
      Number(row.organizationId) === Number(user?.organizationId || 0) &&
      Number(row.userId) === Number(user?.id || 0)
  );
}

function isPracticeSupportManager(user: any) {
  return (
    isPracticeSupportTempAllowedUser(user) ||
    user?.role === "admin" ||
    user?.role === "host"
  );
}

function assertPracticeSupportEditable(params: {
  currentUser: any;
  student: any;
}) {
  const { currentUser, student } = params;

  if (!currentUser) {
    throwAppError(
      ERROR_CODES.AUTH_REQUIRED,
      "로그인이 필요합니다.",
      401
    );
  }

  if (isPracticeSupportManager(currentUser)) {
    return;
  }

  if (
    Number(student?.assigneeId || 0) ===
    Number(currentUser.id || 0)
  ) {
    return;
  }

  throwAppError(
    ERROR_CODES.PERMISSION_DENIED,
    "실습배정지원센터는 담당자, 관리자 또는 호스트만 수정할 수 있습니다.",
    403
  );
}

function canManageOwnFormOrHigher(currentUser: any, targetAssigneeId?: number | null) {
  if (!currentUser) return false;

  if (currentUser.role === "host") {
    return true;
  }

  return Number(currentUser.id) === Number(targetAssigneeId);
}

function assertCanManageOwnFormOrHigher(currentUser: any, targetAssigneeId?: number | null) {
  if (!currentUser) {
    throwAppError(
  ERROR_CODES.AUTH_REQUIRED,
  "로그인이 필요합니다.",
  401
);
  }

  if (!canManageOwnFormOrHigher(currentUser, targetAssigneeId)) {
    throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "본인 페이지 또는 호스트만 수정할 수 있습니다.",
  403
);
  }
}

function assertStudentEditable(params: {
  currentUser: any;
  student: any;
}) {
  const { currentUser, student } = params;

 if (!currentUser) {
  throwAppError(
    ERROR_CODES.AUTH_REQUIRED,
    "로그인이 필요합니다.",
    401
  );
}

  if (currentUser.role === "host") {
  return true;
}

  if (
    Number(student?.assigneeId || 0) ===
    Number(currentUser.id)
  ) {
    return true;
  }

  throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "해당 학생은 담당자 또는 호스트만 수정할 수 있습니다.",
  403
);
}

function normalizeAuditJson(value: any) {
  if (value === undefined) return null;
  if (value === null) return null;

  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

function buildAuditDiff(beforeValue: any, afterValue: any) {
  const beforeObj = beforeValue || {};
  const afterObj = afterValue || {};

  const keys = Array.from(
    new Set([
      ...Object.keys(beforeObj),
      ...Object.keys(afterObj),
    ])
  );

  const diff: Record<string, any> = {};

  for (const key of keys) {
    const beforeRaw = beforeObj[key];
    const afterRaw = afterObj[key];

    const beforeText = JSON.stringify(beforeRaw ?? null);
    const afterText = JSON.stringify(afterRaw ?? null);

    if (beforeText !== afterText) {
      diff[key] = {
        before: beforeRaw ?? null,
        after: afterRaw ?? null,
      };
    }
  }

  return diff;
}

async function writeStudentAuditLog(params: {
  ctx: any;
  studentId: number;
  entityType: string;
  entityId?: number | null;
  action: "create" | "update" | "delete" | "restore" | "complete" | "uncomplete";
  title: string;
  beforeJson?: any;
  afterJson?: any;
}) {
  const organizationId = Number((params.ctx.user as any)?.organizationId || 0);

  if (!organizationId) {
    throwAppError(
  ERROR_CODES.ORGANIZATION_REQUIRED,
  "organizationId is required",
  400
);
  }

  await db.createStudentAuditLog({
    organizationId,
    studentId: Number(params.studentId),

    entityType: params.entityType,
    entityId: params.entityId ?? null,
    action: params.action,
    title: params.title,

    beforeJson: normalizeAuditJson(params.beforeJson),
    afterJson: normalizeAuditJson(params.afterJson),
    diffJson: buildAuditDiff(params.beforeJson, params.afterJson),

    actorUserId: Number(params.ctx.user.id),
    actorName:
      String((params.ctx.user as any)?.name || (params.ctx.user as any)?.username || "").trim() ||
      null,
    actorRole: String((params.ctx.user as any)?.role || "").trim() || null,

    ipAddress: null,
    userAgent: null,
  } as any);
}

function isSuperhost(user: any) {
  return user?.role === "superhost";
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function assertAiAssistantEnabled(
  organizationId: number
) {
  const normalizedOrganizationId =
    Number(organizationId || 0);

  if (
    !Number.isFinite(
      normalizedOrganizationId
    ) ||
    normalizedOrganizationId <= 0
  ) {
    throwAppError(
      ERROR_CODES.ORGANIZATION_REQUIRED,
      "organizationId is required",
      400
    );
  }

  const features =
    await getOrganizationFeatureFlags(
      normalizedOrganizationId
    );

  if (
    features.allowAiAssistant !== true
  ) {
    throwAppError(
      ERROR_CODES.PERMISSION_DENIED,
      "AI 업무비서 기능이 비활성화되어 있습니다.",
      403
    );
  }

  return features;
}

async function assertKakaoAiEnabled(
  organizationId: number
) {
  const normalizedOrganizationId =
    Number(organizationId || 0);

  if (
    !Number.isFinite(
      normalizedOrganizationId
    ) ||
    normalizedOrganizationId <= 0
  ) {
    throwAppError(
      ERROR_CODES.ORGANIZATION_REQUIRED,
      "organizationId is required",
      400
    );
  }

  const features =
    await getOrganizationFeatureFlags(
      normalizedOrganizationId
    );

  if (
    features.allowKakaoAi !== true
  ) {
    throwAppError(
      ERROR_CODES.PERMISSION_DENIED,
      "카카오 AI 기능이 비활성화되어 있습니다.",
      403
    );
  }

  return features;
}

async function createRequestAiContext(params: {
  ctx: any;
  targetOrganizationId?: number | null;
}) {
  const aiContext =
    await buildAiContext({
      user: params.ctx.user,

      /**
       * 일반 사용자는 이 값을 넘겨도 세션 organizationId가 사용된다.
       * Superhost만 선택한 회사 ID가 적용된다.
       */
      targetOrganizationId:
        params.targetOrganizationId ?? null,
    });

  /**
   * AI 업무비서는 회사별 SaaS 활성화 기능이다.
   *
   * 프론트 메뉴 노출 여부와 별개로
   * 서버에서 반드시 다시 검사한다.
   *
   * false인 회사는 AI Context 이후의
   * 조회 / 분석 / Tool 실행 / Pending Action /
   * 채팅 / Work Session 기능을 사용할 수 없다.
   */
  await assertAiAssistantEnabled(
    aiContext.organizationId
  );

  return aiContext;
}

function throwAiToolError(result: {
  success: boolean;
  error?: {
    code?: string;
    message?: string;
  };
}) {
  if (result.success) return;

  const code =
    result.error?.code ||
    "AI_TOOL_EXECUTION_FAILED";

  const status =
    code === "AI_PERMISSION_DENIED"
      ? 403
      : code === "AI_TARGET_NOT_FOUND"
        ? 404
        : code === "AI_INVALID_INPUT"
          ? 400
          : 500;

  throwAppError(
    code as any,
    result.error?.message ||
      "AI 기능 실행 중 오류가 발생했습니다.",
    status
  );
}

function getStudentRegistrationMissingFieldPriority(
  field:
    string
): number {
  const normalized =
    String(
      field ||
      ""
    ).trim();

  if (
    normalized.includes(
      "최종학력"
    )
  ) {
    return 10;
  }

  if (
    normalized.includes(
      "희망과정"
    ) ||
    normalized.includes(
      "과정"
    )
  ) {
    return 20;
  }

  if (
    normalized.includes(
      "학기 구분"
    ) ||
    normalized.includes(
      "학기구분"
    )
  ) {
    return 30;
  }

  if (
    normalized.includes(
      "개강월"
    ) ||
    normalized.includes(
      "시작월"
    )
  ) {
    return 40;
  }

  if (
    normalized.includes(
      "교육원"
    ) ||
    normalized.includes(
      "수강처"
    )
  ) {
    return 50;
  }

  if (
    normalized.includes(
      "과목 수"
    ) ||
    normalized.includes(
      "과목수"
    )
  ) {
    return 60;
  }

  if (
    normalized.includes(
      "과목명"
    ) ||
    normalized.includes(
      "과목"
    )
  ) {
    return 70;
  }

  if (
    normalized.includes(
      "예정금액"
    ) ||
    normalized.includes(
      "예정 금액"
    )
  ) {
    return 80;
  }

  if (
    normalized.includes(
      "결제금액"
    ) ||
    normalized.includes(
      "결제 금액"
    )
  ) {
    return 90;
  }

  if (
    normalized.includes(
      "결제일"
    ) ||
    normalized.includes(
      "결제 날짜"
    )
  ) {
    return 100;
  }

  if (
    normalized.includes(
      "주소"
    )
  ) {
    return 110;
  }

  if (
    normalized.includes(
      "실습"
    )
  ) {
    return 120;
  }

  if (
    normalized.includes(
      "학위"
    )
  ) {
    return 130;
  }

  return 1000;
}

function sortStudentRegistrationMissingFields(
  values:
    string[]
): string[] {
  return values
    .map(
      (
        value,
        index
      ) => ({
        value:
          String(
            value ||
            ""
          ).trim(),

        index,

        priority:
          getStudentRegistrationMissingFieldPriority(
            value
          ),
      })
    )
    .filter(
      (
        item
      ) =>
        Boolean(
          item.value
        )
    )
    .sort(
      (
        left,
        right
      ) =>
        left.priority -
          right.priority ||
        left.index -
          right.index
    )
    .map(
      (
        item
      ) =>
        item.value
    );
}

/**
 * 학생 통합등록 초안의 누락 필드를
 * AI 채팅에서 바로 이어서 입력할 수 있는
 * 자연어 안내문으로 변환한다.
 */
function buildStudentRegistrationMissingMessage(params: {
  missingFields:
    unknown;

  preservePreviousAction:
    boolean;
}): string {
  const normalizedMissingFields =
    Array.isArray(
      params.missingFields
    )
      ? Array.from(
          new Set(
            params.missingFields
              .map(
                (
                  value
                ) =>
                  String(
                    value ||
                    ""
                  ).trim()
              )
              .filter(
                Boolean
              )
          )
        )
      : [];

  const missingFields =
    sortStudentRegistrationMissingFields(
      normalizedMissingFields
    );

  const prefix =
    params.preservePreviousAction
      ? "수정하신 내용은 확인했습니다. 다만 아직 누락된 정보가 있어 기존 승인 초안은 유지했습니다."
      : "등록예정 학생 전환과 학기·과목설계를 진행하겠습니다. 아래 정보를 알려주세요.";

  if (
    missingFields.length ===
      0
  ) {
    return prefix;
  }

  const primaryFields =
    missingFields.slice(
      0,
      7
    );

  const remainingFields =
    missingFields.slice(
      primaryFields.length
    );

  const lines:
    string[] = [
      prefix,
      "",
      ...primaryFields.map(
        (
          field
        ) =>
          `- ${field}`
      ),
  ];

  if (
    remainingFields.length >
      0
  ) {
    lines.push(
      "",
      `먼저 위 ${primaryFields.length}개 정보를 보내주시면 확인 후 나머지 ${remainingFields.length}개 정보를 이어서 안내하겠습니다.`
    );
  } else {
    lines.push(
      "",
      "한 번에 모두 보내셔도 되고, 알고 계신 내용부터 나누어 보내셔도 됩니다."
    );
  }

  lines.push(
    "",
    "보내주신 내용은 이전 등록정보와 합쳐서 계속 진행합니다."
  );

  return lines.join(
    "\n"
  );
}

function cleanTransferRows(rows: any[]) {
  return (rows || [])
    .filter((row) => row && row.subjectName)
    .map((row, idx) => ({
      subjectName: String(row.subjectName || "").trim(),
      category:
        row.category === "교양" || row.category === "일반"
          ? row.category
          : "전공",
      requirementType:
        row.requirementType === "전공필수" ||
        row.requirementType === "전공선택" ||
        row.requirementType === "교양" ||
        row.requirementType === "일반"
          ? row.requirementType
          : row.category === "교양"
          ? "교양"
          : "전공선택",
      credits: Number(row.credits) > 0 ? Number(row.credits) : 3,
      sortOrder: idx,
    }))
    .filter((row) => row.subjectName.length >= 2);
}

/**
 * 학생 통합등록 미리보기에 전달할
 * 앞으로 수강할 우리플랜 과목
 *
 * planSemesters 테이블에 저장할 대상이다.
 * organizationId, assigneeId, userId 등
 * 권한 관련 값은 프론트에서 받지 않는다.
 */
const studentRegistrationPlanSubjectSchema =
  z.object({
    semesterNo:
      z.number()
        .int()
        .positive()
        .max(20)
        .optional()
        .nullable(),

    subjectName:
      z.string()
        .trim()
        .min(
          2,
          "과목명은 2자 이상이어야 합니다."
        )
        .max(200),

    category:
      z.enum([
        "전공",
        "교양",
        "일반",
      ])
        .optional()
        .nullable(),

    requirementType:
      z.enum([
        "전공필수",
        "전공선택",
        "교양",
        "일반",
      ])
        .optional()
        .nullable(),

    credits:
      z.number()
        .int()
        .positive()
        .max(30)
        .optional()
        .nullable(),

    isConfirmed:
      z.boolean()
        .optional()
        .nullable(),
  });

/**
 * 학생 통합등록 미리보기에 전달할 OCR 과목
 *
 * organizationId, assigneeId, userId 등
 * 권한 관련 값은 프론트에서 받지 않는다.
 */
const studentRegistrationOcrSubjectSchema =
  z.object({
    semesterNo: z
      .number()
      .int()
      .positive()
      .max(20)
      .optional()
      .nullable(),

    schoolName:
      z.string()
        .trim()
        .max(
          200,
          "학교명은 200자를 초과할 수 없습니다."
        )
        .optional()
        .nullable(),

    subjectName: z
      .string()
      .trim()
      .min(
        2,
        "과목명은 2자 이상이어야 합니다."
      )
      .max(200),

    category: z
      .enum([
        "전공",
        "교양",
        "일반",
      ])
      .optional()
      .nullable(),

    requirementType: z
      .enum([
        "전공필수",
        "전공선택",
        "교양",
        "일반",
      ])
      .optional()
      .nullable(),

    credits: z
      .number()
      .int()
      .positive()
      .max(30)
      .optional()
      .nullable(),

    isConfirmed: z
      .boolean()
      .optional()
      .nullable(),
  });

/**
 * AI 범용 문서 분석 입력
 *
 * 이 입력은 이미지 분석만 수행하며
 * DB 등록이나 수정은 실행하지 않는다.
 */
const aiDocumentAnalysisInputSchema =
  z.object({
    /**
     * 현재 선택된 학생
     *
     * 학생을 선택하지 않고 문서만
     * 분석하는 경우 null 또는 생략 가능
     */
    studentId:
      z.number()
        .int()
        .positive()
        .optional()
        .nullable(),

    /**
     * 이미지 형식
     */
    mimeType:
      z.enum([
        "image/jpeg",
        "image/png",
        "image/webp",
      ]),

    /**
     * 사용자에게 표시할 파일명
     */
    fileName:
      z.string()
        .trim()
        .min(
          1,
          "파일명이 필요합니다."
        )
        .max(
          255,
          "파일명은 255자를 초과할 수 없습니다."
        ),

    /**
     * data URL 접두사를 제거한
     * 순수 Base64 이미지
     */
    imageBase64:
      z.string()
        .min(
          100,
          "분석할 이미지가 없습니다."
        )
        .max(
          14_000_000,
          "이미지 용량이 너무 큽니다."
        ),

    /**
     * Superhost가 회사를 선택해서
     * 점검할 때만 사용한다.
     *
     * 일반 사용자는 이 값을 보내도
     * 로그인 세션의 organizationId가 사용된다.
     */
    targetOrganizationId:
      z.number()
        .int()
        .positive()
        .optional()
        .nullable(),
  });

const aiDocumentConfidenceLevelSchema =
  z.enum([
    "high",
    "medium",
    "low",
  ]);

const aiDocumentFieldStatusSchema =
  z.enum([
    "extracted",
    "confirmed",
    "edited",
  ]);

function createAiDocumentExtractedFieldSchema<
  T extends z.ZodTypeAny
>(
  valueSchema: T
) {
  return z.object({
    value:
      valueSchema
        .nullable(),

    confidence:
      z.number()
        .min(0)
        .max(1),

    confidenceLevel:
      aiDocumentConfidenceLevelSchema,

    status:
      aiDocumentFieldStatusSchema,

    warning:
      z.string()
        .max(1000)
        .nullable(),
  });
}

const aiDocumentExtractedSubjectSchema =
  z.object({
    rowId:
      z.string()
        .trim()
        .min(1)
        .max(200),

    selected:
      z.boolean(),

    subjectName:
      createAiDocumentExtractedFieldSchema(
        z.string()
          .trim()
          .max(200)
      ),

    credits:
      createAiDocumentExtractedFieldSchema(
        z.number()
          .min(0)
          .max(30)
      ),

    grade:
      createAiDocumentExtractedFieldSchema(
        z.string()
          .trim()
          .max(100)
      ),

    category:
      createAiDocumentExtractedFieldSchema(
        z.enum([
          "전공",
          "교양",
          "일반",
        ])
      ),

    requirementType:
      createAiDocumentExtractedFieldSchema(
        z.enum([
          "전공필수",
          "전공선택",
          "교양",
          "일반",
        ])
      ),

    semesterNo:
      createAiDocumentExtractedFieldSchema(
        z.number()
          .int()
          .positive()
          .max(20)
      ),

    rawText:
      z.string()
        .max(5000)
        .nullable(),

    warnings:
      z.array(
        z.string()
          .trim()
          .min(1)
          .max(1000)
      )
        .max(50),
  });

const aiDocumentAnalysisResultSchema =
  z.object({
    analysisId:
      z.string()
        .trim()
        .min(1)
        .max(200),

    documentType:
      z.enum([
        "university_transcript",
        "education_enrollment",
        "education_payment",
        "education_enrollment_and_payment",
        "unknown",
      ]),

    documentTypeLabel:
      z.string()
        .trim()
        .min(1)
        .max(200),

    recommendedTarget:
      z.enum([
        "plan",
        "transfer",
        "payment",
        "plan_and_payment",
        "analysis_only",
      ]),

    recommendedTargetLabel:
      z.string()
        .trim()
        .min(1)
        .max(200),

    confidence:
      z.number()
        .min(0)
        .max(1),

    confidenceLevel:
      aiDocumentConfidenceLevelSchema,

    institutionName:
      createAiDocumentExtractedFieldSchema(
        z.string()
          .trim()
          .max(300)
      ),

    studentName:
      createAiDocumentExtractedFieldSchema(
        z.string()
          .trim()
          .max(200)
      ),

    courseName:
      createAiDocumentExtractedFieldSchema(
        z.string()
          .trim()
          .max(300)
      ),

    semesterLabel:
      createAiDocumentExtractedFieldSchema(
        z.string()
          .trim()
          .max(200)
      ),

    startDate:
      createAiDocumentExtractedFieldSchema(
        z.string()
          .trim()
          .max(100)
      ),

    endDate:
      createAiDocumentExtractedFieldSchema(
        z.string()
          .trim()
          .max(100)
      ),

    paymentAmount:
      createAiDocumentExtractedFieldSchema(
        z.number()
          .min(0)
          .max(1_000_000_000)
      ),

    paymentStatus:
      createAiDocumentExtractedFieldSchema(
        z.enum([
          "결제완료",
          "결제예정",
          "미결제",
          "부분환불",
          "전액환불",
          "취소",
        ])
      ),

    paidAt:
      createAiDocumentExtractedFieldSchema(
        z.string()
          .trim()
          .max(100)
      ),

    subjects:
      z.array(
        aiDocumentExtractedSubjectSchema
      )
        .max(
          200,
          "문서 과목은 최대 200개까지 처리할 수 있습니다."
        ),

    rawText:
      z.string()
        .max(
          100_000,
          "문서 원문이 너무 깁니다."
        ),

    warnings:
      z.array(
        z.string()
          .trim()
          .min(1)
          .max(1000)
      )
        .max(100),

    requiredConfirmations:
      z.array(
        z.string()
          .trim()
          .min(1)
          .max(1000)
      )
        .max(100),

    analyzedAt:
      z.string()
        .trim()
        .min(1)
        .max(100),
  });

const aiChatMessageRoleSchema =
  z.enum([
    "user",
    "assistant",
  ]);

const aiChatMessageKindSchema =
  z.enum([
    "text",
    "error",
    "warning",
    "search_result",
    "student_summary",
    "student_dashboard",
    "student_risk",
    "organization_risk",
    "student_registration_preview",
    "student_registration_result",
    "document_analysis",
  ]);

const aiChatMessageDataSchema =
  z.record(
    z.string(),
    z.unknown()
  )
    .optional()
    .nullable();

const aiSaveChatMessageInputSchema =
  z.object({
    role:
      aiChatMessageRoleSchema,

    kind:
      aiChatMessageKindSchema
        .optional()
        .default(
          "text"
        ),

    content:
      z.string()
        .trim()
        .min(
          1,
          "저장할 대화 내용이 없습니다."
        )
        .max(
          100_000,
          "AI 대화 내용이 너무 깁니다."
        ),

    data:
      aiChatMessageDataSchema,

    selectedStudentId:
      z.number()
        .int()
        .positive()
        .optional()
        .nullable(),

    targetOrganizationId:
      z.number()
        .int()
        .positive()
        .optional()
        .nullable(),
  });

function parseAiChatMessageData(
  value:
    unknown
): Record<string, unknown> | null {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  if (
    typeof value ===
      "object" &&
    !Array.isArray(
      value
    )
  ) {
    return value as
      Record<
        string,
        unknown
      >;
  }

  try {
    const parsed =
      JSON.parse(
        String(
          value
        )
      );

    if (
      parsed &&
      typeof parsed ===
        "object" &&
      !Array.isArray(
        parsed
      )
    ) {
      return parsed;
    }

    return null;
  } catch {
    return null;
  }
}

function toAiChatPublicMessage(
  row:
    any
) {
  return {
    id:
      `db-${Number(
        row.id
      )}`,

    databaseId:
      Number(
        row.id
      ),

    role:
      row.role ===
        "assistant"
        ? "assistant"
        : "user",

    content:
      String(
        row.content ||
        ""
      ),

    kind:
      String(
        row.kind ||
        "text"
      ),

    data:
      parseAiChatMessageData(
        row.messageDataJson
      ),

    selectedStudentId:
      row.selectedStudentId ===
        null ||
      row.selectedStudentId ===
        undefined
        ? null
        : Number(
            row.selectedStudentId
          ),

    createdAt:
      row.createdAt ??
      null,
  };
}

function getAiChatKindFromResult(
  result:
    any
) {
  const toolName =
    String(
      result?.toolName ||
      result?.data
        ?.toolName ||
      result?.data
        ?.tool ||
      ""
    );

  if (
    result?.registrationPreview
  ) {
    return "student_registration_preview" as const;
  }

    if (
    toolName ===
    "student.summary"
  ) {
    return "student_summary" as const;
  }

  if (
    toolName ===
    "student.dashboard"
  ) {
    return "student_dashboard" as const;
  }

  if (
    toolName ===
    "risk.studentDetail"
  ) {
    return "student_risk" as const;
  }

  if (
    toolName ===
    "risk.studentList"
  ) {
    return "organization_risk" as const;
  }

  if (
    toolName ===
      "student.search" ||
    toolName ===
      "consultation.search"
  ) {
    return "search_result" as const;
  }

  if (
  toolName ===
  "alert.missingData"
) {
  return "warning" as const;
}

if (
  toolName ===
  "document.analysis"
) {
  return "document_analysis" as const;
}

return "text" as const;
}

const aiDocumentImportPreviewInputSchema =
  z.object({
    studentId:
      z.number()
        .int()
        .positive(),

    analysis:
      aiDocumentAnalysisResultSchema,

    /**
     * AI 추천 위치를 그대로 사용하면 생략한다.
     *
     * 담당자가 카드에서 반영 위치를 바꿀 경우
     * 선택값을 전달한다.
     */
    target:
      z.enum([
        "plan",
        "transfer",
        "payment",
        "plan_and_payment",
      ])
        .optional()
        .nullable(),

    /**
     * Superhost 확장용이다.
     *
     * 현재 Staff 단계에서는 전달하지 않는다.
     */
    targetOrganizationId:
      z.number()
        .int()
        .positive()
        .optional()
        .nullable(),

    expiresInMinutes:
      z.number()
        .int()
        .min(5)
        .max(24 * 60)
        .optional(),
  });

const publicFormUiConfigSchema = z.object({
  title: z.string().optional().default(""),
  subtitle: z.string().optional().default(""),
  logoUrl: z.string().optional().default(""),
  heroImageUrl: z.string().optional().default(""),
  primaryColor: z.string().optional().default("#5fc065"),
  submitButtonText: z.string().optional().default("1:1 맞춤 상담 받기"),
  agreementText: z.string().optional().default("개인정보 수집 및 이용에 동의합니다."),
  layoutType: z.enum(["card", "bottomSheet"]).optional().default("card"),

  fields: z
    .array(
      z.object({
        fieldKey: z.string().min(1),
        label: z.string().optional().default(""),
        placeholder: z.string().optional().default(""),
        required: z.boolean().optional().default(false),
        hidden: z.boolean().optional().default(false),
        order: z.number().optional().default(0),
        type: z.enum(["text", "phone", "select", "textarea", "checkbox"]),
        options: z
          .array(
            z.object({
              label: z.string(),
              value: z.string(),
            })
          )
          .optional(),
      })
    )
    .optional()
    .default([]),

  mapping: z.record(z.string(), z.string()).optional().default({}),
  description: z.string().optional().default(""),
  tags: z.string().optional().default(""),
  isPinned: z.boolean().optional().default(false),
  lastUsedAt: z.string().optional().default(""),

  canvas: z
    .object({
      enabled: z.boolean().optional().default(false),
      width: z.number().optional().default(1080),
      height: z.number().optional().default(1920),
      backgroundColor: z.string().optional().default("#ffffff"),
      elements: z.array(z.any()).optional().default([]),
    })
    .optional(),
});

function normalizeSubjectCatalogName(
  value: unknown
) {
  return String(
    value ?? ""
  )
    .trim()
    .replace(
      /\s+/g,
      ""
    )
    .replace(
      /[()（）[\]·ㆍ.,_-]/g,
      ""
    )
    .toLowerCase();
}

async function buildRegistrationPlanSubjectsFromCatalog(params: {
  organizationId:
    number;

  courseName:
    string | null | undefined;
}) {
  const normalizedCourseName =
    normalizeSubjectCatalogName(
      params.courseName
    );

  if (
    !normalizedCourseName
  ) {
    return [];
  }

  const catalogs =
    await db.listSubjectCatalogs({
      organizationId:
        params.organizationId,

      activeOnly:
        true,
    });

  const matchedCatalog =
    catalogs.find(
      (catalog: any) =>
        normalizeSubjectCatalogName(
          catalog.name
        ) ===
        normalizedCourseName
    );

  if (
    !matchedCatalog
  ) {
    return [];
  }

  const catalogItems =
    await db.listSubjectCatalogItems({
      organizationId:
        params.organizationId,

      catalogId:
        Number(
          matchedCatalog.id
        ),

      activeOnly:
        true,
    });

  return catalogItems
    .map(
      (item: any) => ({
        semesterNo:
          Number(
            item.semesterNo ||
            1
          ),

        subjectName:
          String(
            item.subjectName ||
            ""
          ).trim(),

        category:
          item.category,

        requirementType:
          item.requirementType,

        credits:
          Number(
            item.credits ||
            3
          ),

        isConfirmed:
          true,
      })
    )
    .filter(
      (item: any) =>
        item.subjectName
          .length >= 2
    );
}

async function assertOrganizationFeatureEnabled(
  organizationId: number,
  featureKey:
    | "allowBackup"
    | "allowAuditLog"
    | "allowMessenger"
    | "allowPracticeCenter"
    | "allowSettlementReport"
    | "allowPrivateCertificate",
  message: string
) {
  const features = await getOrganizationFeatureFlags(organizationId);

  if (!features[featureKey]) {
    throwAppError(
  ERROR_CODES.INVALID_REQUEST,
  message,
  400
);
  }
}

function normalizeCreditSubjectName(value: any) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[ⅠⅡⅢⅣⅤ]/g, "")
    .toLowerCase();
}

function getRequirementKey(requirementType: any) {
  const value = String(requirementType || "").trim();

  if (value === "전공필수") return "majorRequired";
  if (value === "전공선택") return "majorElective";
  if (value === "교양") return "liberal";
  if (value === "일반") return "general";

  return "majorElective";
}

function buildCreditSummaryResult(params: {
  student: any;
  plan: any;
  rule: any;
  planSemesters: any[];
  transferSubjects: any[];
  extraItems: any[];
}) {
  const rule = params.rule || null;

  const allItems = [
    ...(params.planSemesters || []).map((row: any) => ({
      source: "plan",
      sourceLabel: "우리플랜",
      subjectName: row.subjectName,
      requirementType: row.planRequirementType || row.planCategory || "전공선택",
      category: row.planCategory || "전공",
      credits: Number(row.credits || 0),
      isExcluded: false,
      raw: row,
    })),

    ...(params.transferSubjects || []).map((row: any) => ({
      source: "transfer",
      sourceLabel: "전적대",
      subjectName: row.subjectName,
      requirementType: row.transferRequirementType || row.transferCategory || "전공선택",
      category: row.transferCategory || "전공",
      credits: Number(row.credits || 0),
      isExcluded: false,
      raw: row,
    })),

    ...(params.extraItems || []).map((row: any) => ({
      source: row.sourceType || "manual",
      sourceLabel: "추가입력",
      subjectName: row.subjectName,
      requirementType: row.requirementType,
      category: row.category,
      credits: Number(row.credits || 0),
      isExcluded: Boolean(row.isExcluded),
      raw: row,
    })),
  ].filter((row) => !row.isExcluded);

  const categories: any = {
    majorRequired: {
      label: "전공필수",
      requiredSubjects: Number(rule?.requiredMajorRequiredSubjects || 0),
      requiredCredits: Number(rule?.requiredMajorRequiredCredits || 0),
      currentSubjects: 0,
      currentCredits: 0,
      remainingSubjects: 0,
      remainingCredits: 0,
      status: "normal",
    },
    majorElective: {
      label: "전공선택",
      requiredSubjects: Number(rule?.requiredMajorElectiveSubjects || 0),
      requiredCredits: Number(rule?.requiredMajorElectiveCredits || 0),
      currentSubjects: 0,
      currentCredits: 0,
      remainingSubjects: 0,
      remainingCredits: 0,
      status: "normal",
    },
    liberal: {
      label: "교양",
      requiredSubjects: Number(rule?.requiredLiberalSubjects || 0),
      requiredCredits: Number(rule?.requiredLiberalCredits || 0),
      currentSubjects: 0,
      currentCredits: 0,
      remainingSubjects: 0,
      remainingCredits: 0,
      status: "normal",
    },
    general: {
      label: "일반",
      requiredSubjects: Number(rule?.requiredGeneralSubjects || 0),
      requiredCredits: Number(rule?.requiredGeneralCredits || 0),
      currentSubjects: 0,
      currentCredits: 0,
      remainingSubjects: 0,
      remainingCredits: 0,
      status: "normal",
    },
  };

  for (const item of allItems) {
    const key = getRequirementKey(item.requirementType);
    categories[key].currentSubjects += item.subjectName ? 1 : 0;
    categories[key].currentCredits += Number(item.credits || 0);
  }

  const alerts: any[] = [];

  for (const key of Object.keys(categories)) {
    const row = categories[key];

    row.remainingSubjects = Math.max(row.requiredSubjects - row.currentSubjects, 0);
    row.remainingCredits = Math.max(row.requiredCredits - row.currentCredits, 0);

    if (row.remainingSubjects > 0 || row.remainingCredits > 0) {
      row.status = "shortage";
      alerts.push({
        level: "danger",
        title: `${row.label} 부족`,
        message: `${row.label} 기준 ${row.requiredSubjects}과목 / ${row.requiredCredits}학점 중 현재 ${row.currentSubjects}과목 / ${row.currentCredits}학점입니다.`,
      });
    }

    const allowOver =
      key === "majorElective"
        ? Boolean(rule?.allowMajorElectiveOver)
        : key === "liberal"
        ? Boolean(rule?.allowLiberalOver)
        : key === "general"
        ? Boolean(rule?.allowGeneralOver)
        : false;

    if (!allowOver && row.requiredSubjects > 0 && row.currentSubjects > row.requiredSubjects) {
      row.status = "exceeded";
      alerts.push({
        level: "warning",
        title: `${row.label} 초과`,
        message: `${row.label} 기준은 ${row.requiredSubjects}과목인데 현재 ${row.currentSubjects}과목입니다.`,
      });
    }
  }

  if (rule?.duplicateCheckEnabled !== false) {
    const map = new Map<string, any[]>();

    for (const item of allItems) {
      const key = normalizeCreditSubjectName(item.subjectName);
      if (!key) continue;

      map.set(key, [...(map.get(key) || []), item]);
    }

    for (const [, rows] of map.entries()) {
      if (rows.length >= 2) {
        alerts.push({
          level: "warning",
          title: "중복 과목 확인",
          message: `${rows[0].subjectName} 과목이 ${rows.length}건 등록되어 있습니다.`,
        });
      }
    }
  }

  const requiredTotalCredits = Number(rule?.requiredTotalCredits || 0);
  const currentCredits = allItems.reduce(
    (sum, row) => sum + Number(row.credits || 0),
    0
  );
  const remainingCredits = Math.max(requiredTotalCredits - currentCredits, 0);
  const progressRate =
    requiredTotalCredits > 0
      ? Math.min(Math.round((currentCredits / requiredTotalCredits) * 100), 100)
      : 0;

  if (!rule) {
    alerts.unshift({
      level: "info",
      title: "요약 기준 미설정",
      message: "과정별 학점 기준을 먼저 설정해야 정확한 부족/초과 검증이 가능합니다.",
    });
  } else if (remainingCredits > 0) {
    alerts.unshift({
      level: "danger",
      title: "총 학점 부족",
      message: `총 ${requiredTotalCredits}학점 기준 현재 ${currentCredits}학점으로 ${remainingCredits}학점 부족합니다.`,
    });
  } else {
    alerts.unshift({
      level: "success",
      title: "총 학점 충족",
      message: `총 ${requiredTotalCredits}학점 기준 현재 ${currentCredits}학점입니다.`,
    });
  }

  return {
    requiredTotalCredits,
    currentCredits,
    remainingCredits,
    progressRate,
    categories,
    alerts,
    items: allItems,
  };
}

async function cancelAiPendingActionForCurrentUser(
  params: {
    ctx:
      any;

    pendingActionId:
      number;

    /**
     * 승인 카드 버튼에서는 프론트가 알고 있는
     * 버전을 전달한다.
     *
     * 자연어 취소에서는 생략하고
     * 서버가 현재 DB 버전을 다시 조회한다.
     */
    expectedVersion?:
      number |
      null;

    targetOrganizationId?:
      number |
      null;
  }
) {
  /**
   * 웹 CRM Session
   * → 기존 공통 AiUserContext 생성.
   *
   * 이 부분만 웹 전용이다.
   *
   * 이후 실제 Pending Action 취소는
   * 채널 독립적인 공통 서비스를 사용한다.
   */
  const aiContext =
    await createRequestAiContext({
      ctx:
        params.ctx,

      targetOrganizationId:
        params.targetOrganizationId ??
        null,
    });

  const cancelled =
    await cancelAiPendingAction({
      context:
        aiContext,

      pendingActionId:
        params.pendingActionId,

      expectedVersion:
        params.expectedVersion ??
        null,
    });

  return {
    success:
      cancelled.success,

    /**
     * 기존 웹 프론트는 Public DTO를 사용하므로
     * Router 경계에서만 변환한다.
     */
    action:
      toAiPendingActionPublicResult(
        cancelled.pendingAction
      ),

    message:
      cancelled.message,

    workSession:
      cancelled.workSession,

    aiContext:
      cancelled.aiContext,
  };
}

async function replacePreviousAiPendingActionIfNeeded(
  params: {
    ctx: any;

    isPendingActionRevision:
      boolean;

    previousPendingActionId:
      number;

    previousPendingActionType:
      string;

    expectedActionType:
      string;

    newPendingActionId:
      number;

    targetOrganizationId?:
      number |
      null;
  }
) {
  if (
    !params.isPendingActionRevision ||
    params.previousPendingActionType !==
      params.expectedActionType ||
    !Number.isFinite(
      params.previousPendingActionId
    ) ||
    params.previousPendingActionId <=
      0 ||
    params.previousPendingActionId ===
      params.newPendingActionId
  ) {
    return null;
  }

  return cancelAiPendingActionForCurrentUser({
    ctx:
      params.ctx,

    pendingActionId:
      Math.floor(
        params.previousPendingActionId
      ),

    expectedVersion:
      null,

    targetOrganizationId:
      params.targetOrganizationId ??
      null,
  });
}

async function confirmAiPendingActionForCurrentUser(
  params: {
    ctx:
      any;

    pendingActionId:
      number;

    /**
     * 승인 카드에서는 현재 클라이언트가 알고 있는
     * Pending Action version을 전달한다.
     *
     * 자연어 승인에서는 null이어도 되며
     * 서버 Guard가 실제 DB 상태를 다시 확인한다.
     */
    expectedVersion?:
      number |
      null;

    /**
     * Superhost의 회사 전환 실행에만 사용한다.
     *
     * 일반 사용자는 세션의 organizationId가
     * 최종 기준이 된다.
     */
    targetOrganizationId?:
      number |
      null;
  }
) {
  /**
   * 1.
   * 현재 HTTP 요청의 실제 AI Context를
   * 서버 로그인 세션 기준으로 생성한다.
   *
   * 프론트에서 organizationId / userId / role을
   * 직접 전달받아 신뢰하지 않는다.
   */
  const aiContext =
    await createRequestAiContext({
      ctx:
        params.ctx,

      targetOrganizationId:
        params.targetOrganizationId ??
        null,
    });

  /**
   * 2.
   * 실제 Action을 실행하기 전에
   * Pending Action 공통 보안 검사를 수행한다.
   *
   * 여기서 검사되는 항목:
   *
   * - Pending Action ID
   * - 회사 범위
   * - AI 쓰기 권한
   * - 최초 요청자
   * - OCR 대상 학생 권한
   * - Pending Action 상태
   * - expectedVersion 충돌
   *
   * 이 검사를 통과한 결과만
   * Dispatcher로 전달한다.
   */
  const confirmation =
    await prepareAiPendingActionForConfirmation({
      pendingActionId:
        params.pendingActionId,

      expectedVersion:
        params.expectedVersion ??
        null,

      aiContext,

      actorName:
        aiContext.userName ||
        String(
          (params.ctx.user as any)
            ?.name ||
          (params.ctx.user as any)
            ?.username ||
          ""
        ).trim() ||
        null,
    });

  /**
   * 3.
   * 공통 보안 검사가 끝난 Pending Action을
   * Action별 Confirm Service로 분배한다.
   *
   * Router는 이제 실행 세부사항을 알 필요가 없다.
   */
  return dispatchAiPendingActionConfirmation({
    aiContext,

    confirmation,
  });
}

export const appRouter = router({
  system: systemRouter,
  leadForm: publicLeadRouter,
  sms: smsRouter,
saas: saasRouter,

withOneLanding: router({
  submit: publicProcedure
    .input(
      z.object({
        clientName: z
          .string()
          .trim()
          .min(1, "이름을 입력해주세요.")
          .max(100),

        phone: z
          .string()
          .trim()
          .min(1, "연락처를 입력해주세요.")
          .max(30),

        finalEducation: z
          .string()
          .trim()
          .max(100)
          .optional()
          .default(""),

        consultationTime: z
          .string()
          .trim()
          .max(100)
          .optional()
          .default(""),

        privacyAgreed: z.literal(true, {
          errorMap: () => ({
            message: "개인정보 수집 및 이용에 동의해주세요.",
          }),
        }),
      })
    )
    .mutation(async ({ input }) => {
      const phone = normalizePublicLandingPhone(input.phone);

      if (phone.length < 10 || phone.length > 11) {
        throwAppError(
          ERROR_CODES.INVALID_REQUEST,
          "올바른 연락처를 입력해주세요.",
          400
        );
      }

      const notesParts: string[] = [];

      if (input.consultationTime?.trim()) {
        notesParts.push(
          `상담 가능 시간: ${input.consultationTime.trim()}`
        );
      }

      const id = await db.createConsultation({
        organizationId: WITHONE_ORGANIZATION_ID,
        assigneeId: WITHONE_ASSIGNEE_ID,

        consultDate: new Date(),

        channel: WITHONE_LANDING_CHANNEL,
        clientName: input.clientName.trim(),
        phone,

        finalEducation:
          input.finalEducation?.trim() || "",

        desiredCourse: WITHONE_LANDING_COURSE,

        notes: notesParts.join("\n"),

        status: "상담중",
      } as any);

      return {
        success: true,
        id,
        message:
          "상담 신청이 완료되었습니다. 담당자가 신청 내용을 확인한 후 순차적으로 연락드리고 있습니다. 감사합니다.",
      };
    }),
}),

monitoring: router({
  organizationSummary: superHostProcedure.query(async () => {
    return db.getOrganizationMonitoringSummary();
  }),

  organizationDetail: superHostProcedure
    .input(
      z.object({
        organizationId: z.number(),
      })
    )
    .query(async ({ input }) => {
      return db.getOrganizationMonitoringDetail({
        organizationId: input.organizationId,
      });
    }),

  organizationApiErrors: superHostProcedure
    .input(
      z.object({
        organizationId: z.number(),
        limit: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      return db.listOrganizationApiErrorLogs({
        organizationId: input.organizationId,
        limit: input.limit ?? 100,
      });
    }),

  organizationApiErrorSummary: superHostProcedure
    .input(
      z.object({
        organizationId: z.number(),
        days: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      return db.getOrganizationApiErrorSummary({
        organizationId: input.organizationId,
        days: input.days ?? 7,
      });
    }),

systemHealth: superHostProcedure.query(async () => {
  return db.getSystemHealthStatus();
}),
}),

organizationFeatures: protectedProcedure.query(async ({ ctx }) => {
  const organizationId = getCtxOrganizationId(ctx);

  if (!organizationId) {
    throwAppError(
  ERROR_CODES.ORGANIZATION_REQUIRED,
  "organizationId is required",
  400
);
  }

  return getOrganizationFeatureFlags(organizationId);
}),

kakaoAi: router({
  settings: router({
    get: hostProcedure.query(
      async ({ ctx }) => {
        const organizationId =
          getCtxOrganizationId(ctx);

        /**
         * Superhost에서 해당 회사에
         * 카카오 AI 상품을 허용한 경우에만
         * Host가 설정 화면에 접근할 수 있다.
         */
        await assertKakaoAiEnabled(
          organizationId
        );

        return db.getKakaoAiSettings({
          organizationId,
        });
      }
    ),

    update: hostProcedure
      .input(
        z.object({
          enabled: z
            .boolean()
            .optional(),

          newConsultationEnabled: z
            .boolean()
            .optional(),

          registeredStudentEnabled: z
            .boolean()
            .optional(),

          ocrEnabled: z
            .boolean()
            .optional(),

          practiceSupportEnabled: z
            .boolean()
            .optional(),

          assigneeRecommendationEnabled: z
            .boolean()
            .optional(),

          aiDisplayName: z
            .string()
            .trim()
            .min(
              1,
              "AI 표시 이름을 입력해주세요."
            )
            .max(
              100,
              "AI 표시 이름은 100자를 초과할 수 없습니다."
            )
            .optional(),

          welcomeMessage: z
            .string()
            .trim()
            .max(
              5000,
              "첫 인사말은 5000자를 초과할 수 없습니다."
            )
            .nullable()
            .optional(),

          defaultGuideMessage: z
            .string()
            .trim()
            .max(
              10000,
              "기본 상담 안내는 10000자를 초과할 수 없습니다."
            )
            .nullable()
            .optional(),

          consultationHoursMessage: z
            .string()
            .trim()
            .max(
              5000,
              "상담 가능 시간 안내는 5000자를 초과할 수 없습니다."
            )
            .nullable()
            .optional(),

companyIntroduction: z
  .string()
  .trim()
  .max(
    10000,
    "회사 소개는 10000자를 초과할 수 없습니다."
  )
  .nullable()
  .optional(),

companyBenefits: z
  .string()
  .trim()
  .max(
    10000,
    "회사 공통 혜택은 10000자를 초과할 수 없습니다."
  )
  .nullable()
  .optional(),

salesPoints: z
  .string()
  .trim()
  .max(
    10000,
    "상담 강조 포인트는 10000자를 초과할 수 없습니다."
  )
  .nullable()
  .optional(),

registeredAiBenefits: z
  .string()
  .trim()
  .max(
    10000,
    "등록회원 AI 혜택은 10000자를 초과할 수 없습니다."
  )
  .nullable()
  .optional(),

classManagementPolicy: z
  .string()
  .trim()
  .max(
    10000,
    "수업 진행 정책은 10000자를 초과할 수 없습니다."
  )
  .nullable()
  .optional(),

practicePolicy: z
  .string()
  .trim()
  .max(
    10000,
    "실습 지원 정책은 10000자를 초과할 수 없습니다."
  )
  .nullable()
  .optional(),

administrativeSupportPolicy: z
  .string()
  .trim()
  .max(
    10000,
    "행정절차 지원 정책은 10000자를 초과할 수 없습니다."
  )
  .nullable()
  .optional(),

consultationPolicy: z
  .string()
  .trim()
  .max(
    10000,
    "상담 정책은 10000자를 초과할 수 없습니다."
  )
  .nullable()
  .optional(),

          priceDisclosureEnabled: z
            .boolean()
            .optional(),

priceGuide: z
  .string()
  .trim()
  .max(
    10000,
    "비용 안내 기준은 10000자를 초과할 수 없습니다."
  )
  .nullable()
  .optional(),

          kakaoBotId: z
            .string()
            .trim()
            .max(
              191,
              "카카오 Bot ID는 191자를 초과할 수 없습니다."
            )
            .nullable()
            .optional(),
        })
      )
      .mutation(
        async ({
          ctx,
          input,
        }) => {
          const organizationId =
            getCtxOrganizationId(ctx);

          await assertKakaoAiEnabled(
            organizationId
          );

          return db.updateKakaoAiSettings({
            organizationId,

            userId:
              Number(
                ctx.user?.id || 0
              ),

            enabled:
              input.enabled,

            newConsultationEnabled:
              input.newConsultationEnabled,

            registeredStudentEnabled:
              input.registeredStudentEnabled,

            ocrEnabled:
              input.ocrEnabled,

            practiceSupportEnabled:
              input.practiceSupportEnabled,

            assigneeRecommendationEnabled:
              input.assigneeRecommendationEnabled,

            aiDisplayName:
              input.aiDisplayName,

            welcomeMessage:
              input.welcomeMessage,

            defaultGuideMessage:
              input.defaultGuideMessage,

consultationHoursMessage:
  input.consultationHoursMessage,

companyIntroduction:
  input.companyIntroduction,

companyBenefits:
  input.companyBenefits,

salesPoints:
  input.salesPoints,

registeredAiBenefits:
  input.registeredAiBenefits,

classManagementPolicy:
  input.classManagementPolicy,

practicePolicy:
  input.practicePolicy,

administrativeSupportPolicy:
  input.administrativeSupportPolicy,

consultationPolicy:
  input.consultationPolicy,

            priceDisclosureEnabled:
              input.priceDisclosureEnabled,

priceGuide:
  input.priceGuide,

kakaoBotId:
  input.kakaoBotId,
                    });
        }
      ),

    regenerateWebhookToken:
      hostProcedure.mutation(
        async ({ ctx }) => {
          const organizationId =
            getCtxOrganizationId(ctx);

          await assertKakaoAiEnabled(
            organizationId
          );

          const userId =
            Number(
              (ctx.user as any)?.id || 0
            );

          if (
            !Number.isFinite(userId) ||
            userId <= 0
          ) {
            throwAppError(
              ERROR_CODES.AUTH_REQUIRED,
              "로그인이 필요합니다.",
              401
            );
          }

          /**
           * 32 bytes = 256-bit random token.
           *
           * hex 인코딩 결과는 64자이며
           * URL path에 그대로 사용할 수 있다.
           */
          const webhookToken =
            randomBytes(32).toString(
              "hex"
            );

          const webhookTokenHash =
            createHash("sha256")
              .update(
                webhookToken,
                "utf8"
              )
              .digest("hex");

          await db.updateKakaoAiWebhookTokenHash(
            {
              organizationId,
              userId,
              webhookTokenHash,
            }
          );

          return {
            organizationId,

            /**
             * 원본 토큰은 이 응답에서만 반환한다.
             * DB에는 SHA-256 hash만 존재한다.
             */
            webhookToken,

            webhookPath:
              `/api/kakao-ai/skill/${organizationId}/${webhookToken}`,
          };
        }
      ),
    }),
}),

staffProfile: router({
  /**
   * 내 담당자 공개 프로필
   *
   * 프로필이 아직 없으면
   * 최초 접근 시 자동 생성한다.
   */
  my: router({
    get: protectedProcedure.query(
      async ({ ctx }) => {
        const organizationId =
          getCtxOrganizationId(ctx);

        const userId =
          Number(
            (ctx.user as any)?.id ||
            0
          );

        if (
          !Number.isFinite(userId) ||
          userId <= 0
        ) {
          throwAppError(
            ERROR_CODES.AUTH_REQUIRED,
            "로그인이 필요합니다.",
            401
          );
        }

        return db.ensureStaffPublicProfile({
          organizationId,
          userId,
          createdBy:
            userId,
        });
      }
    ),

    update: protectedProcedure
      .input(
        z.object({
          isActive:
            z.boolean().optional(),

          showOnTeamPage:
            z.boolean().optional(),

          recommendationEnabled:
            z.boolean().optional(),

          acceptingNewConsultations:
            z.boolean().optional(),

          profileImageUrl:
            z
              .string()
              .trim()
              .max(1000)
              .nullable()
              .optional(),

          displayName:
            z
              .string()
              .trim()
              .max(100)
              .nullable()
              .optional(),

          publicPositionName:
            z
              .string()
              .trim()
              .max(100)
              .nullable()
              .optional(),

          headline:
            z
              .string()
              .trim()
              .max(255)
              .nullable()
              .optional(),

          introduction:
            z
              .string()
              .trim()
              .max(10000)
              .nullable()
              .optional(),

          careerText:
            z
              .string()
              .trim()
              .max(10000)
              .nullable()
              .optional(),

          awardText:
            z
              .string()
              .trim()
              .max(10000)
              .nullable()
              .optional(),

          qualificationText:
            z
              .string()
              .trim()
              .max(10000)
              .nullable()
              .optional(),

          consultationStyle:
            z
              .string()
              .trim()
              .max(10000)
              .nullable()
              .optional(),

          specialties:
            z
              .array(
                z
                  .string()
                  .trim()
                  .min(1)
                  .max(100)
              )
              .max(30)
              .optional(),

          publicPhone:
            z
              .string()
              .trim()
              .max(50)
              .nullable()
              .optional(),

          showPhone:
            z.boolean().optional(),

          consultationUrl:
            z
              .string()
              .trim()
              .max(1000)
              .nullable()
              .optional(),

          showConsultationButton:
            z.boolean().optional(),

          recommendationPriority:
            z
              .number()
              .int()
              .min(0)
              .max(100000)
              .optional(),

          sortOrder:
            z
              .number()
              .int()
              .min(0)
              .max(100000)
              .optional(),
        })
      )
      .mutation(
        async ({
          ctx,
          input,
        }) => {
          const organizationId =
            getCtxOrganizationId(ctx);

          const userId =
            Number(
              (ctx.user as any)?.id ||
              0
            );

          if (
            !Number.isFinite(userId) ||
            userId <= 0
          ) {
            throwAppError(
              ERROR_CODES.AUTH_REQUIRED,
              "로그인이 필요합니다.",
              401
            );
          }

          return db.updateStaffPublicProfile({
            organizationId,
            userId,
            updatedBy:
              userId,
            values:
              input,
          });
        }
      ),

    /**
     * 개인 공개 URL 재발급
     *
     * 실행 즉시 기존 URL Token은
     * 더 이상 사용할 수 없다.
     */
    regenerateToken:
      protectedProcedure.mutation(
        async ({ ctx }) => {
          const organizationId =
            getCtxOrganizationId(ctx);

          const userId =
            Number(
              (ctx.user as any)?.id ||
              0
            );

          if (
            !Number.isFinite(userId) ||
            userId <= 0
          ) {
            throwAppError(
              ERROR_CODES.AUTH_REQUIRED,
              "로그인이 필요합니다.",
              401
            );
          }

          return db.regenerateStaffPublicProfileToken({
            organizationId,
            userId,
            updatedBy:
              userId,
          });
        }
      ),
  }),

  /**
   * 회사 담당자 소개 페이지 설정
   *
   * 조회:
   * 로그인한 회사 구성원
   *
   * 수정:
   * Host만 가능
   */
  teamPage: router({
    get: protectedProcedure.query(
      async ({ ctx }) => {
        const organizationId =
          getCtxOrganizationId(ctx);

        return db.getStaffTeamPageSettings({
          organizationId,
        });
      }
    ),

    update: hostProcedure
      .input(
        z.object({
          enabled:
            z.boolean().optional(),

          title:
            z
              .string()
              .trim()
              .max(255)
              .nullable()
              .optional(),

          description:
            z
              .string()
              .trim()
              .max(10000)
              .nullable()
              .optional(),

          staffSectionTitle:
            z
              .string()
              .trim()
              .max(255)
              .nullable()
              .optional(),

          staffSectionDescription:
            z
              .string()
              .trim()
              .max(10000)
              .nullable()
              .optional(),

footerIntroduction:
  z
    .string()
    .trim()
    .max(10000)
    .nullable()
    .optional(),
        })
      )
      .mutation(
        async ({
          ctx,
          input,
        }) => {
          const organizationId =
            getCtxOrganizationId(ctx);

          const userId =
            Number(
              (ctx.user as any)?.id ||
              0
            );

          if (
            !Number.isFinite(userId) ||
            userId <= 0
          ) {
            throwAppError(
              ERROR_CODES.AUTH_REQUIRED,
              "로그인이 필요합니다.",
              401
            );
          }

          return db.saveStaffTeamPageSettings({
            organizationId,
            updatedBy:
              userId,
            values:
              input,
          });
        }
      ),
  }),

  /**
   * 카카오 AI가 사용할
   * 담당자 추천 후보 목록
   *
   * 외부 공개 API가 아니다.
   */
    recommendation: router({
    /**
     * 카카오 AI 담당자 추천 후보 목록
     *
     * 실제 추천을 발생시키지 않으며
     * 추천 횟수도 증가시키지 않는다.
     */
    candidates:
      protectedProcedure.query(
        async ({ ctx }) => {
          const organizationId =
            getCtxOrganizationId(ctx);

          await assertKakaoAiEnabled(
            organizationId
          );

          return db.listRecommendedStaffProfiles({
            organizationId,
          });
        }
      ),

    /**
     * 카카오 AI 신규 고객 담당자 자동 추천
     *
     * 고객 희망과정 / 상담내용을 기준으로
     * 실제 담당자 1명을 선택한다.
     *
     * 추천이 확정되면 DB 내부에서
     * recommendationCount + 1
     * lastRecommendedAt 갱신까지 처리한다.
     */
    recommend:
      protectedProcedure
        .input(
          z.object({
            desiredCourse:
              z
                .string()
                .trim()
                .max(300)
                .optional()
                .nullable(),

            consultationText:
              z
                .string()
                .trim()
                .max(10000)
                .optional()
                .nullable(),
          })
        )
        .mutation(
          async ({
            ctx,
            input,
          }) => {
            const organizationId =
              getCtxOrganizationId(ctx);

            /**
             * 카카오 AI 기능이 활성화된
             * 회사에서만 추천 엔진을 사용할 수 있다.
             */
            await assertKakaoAiEnabled(
              organizationId
            );

            const recommended =
              await db.recommendStaffProfile({
                organizationId,

                desiredCourse:
                  input.desiredCourse ??
                  null,

                consultationText:
                  input.consultationText ??
                  null,
              });

            if (!recommended) {
              return {
                success: false as const,

                reason:
                  "NO_AVAILABLE_STAFF" as const,

                profile:
                  null,
              };
            }

            return {
              success: true as const,

              reason:
                null,

              profile:
                recommended,
            };
          }
        ),
  }),

/**
 * Host 담당자 추천 관리
 *
 * 담당자 공개 프로필의
 * 회사 운영값만 관리한다.
 *
 * 자기소개 / 경력 / 연락처 등
 * 담당자 개인 작성 영역은 수정하지 않는다.
 */
management: router({
  /**
   * 회사 소속 담당자 전체 목록
   *
   * 프로필 미등록 직원도 포함한다.
   */
  list:
    hostProcedure.query(
      async ({ ctx }) => {
        const organizationId =
          getCtxOrganizationId(ctx);

        return db.listStaffRecommendationManagement({
          organizationId,
        });
      }
    ),

  /**
   * 담당자 추천 운영 설정 변경
   */
  update:
    hostProcedure
      .input(
        z.object({
          userId:
            z
              .number()
              .int()
              .positive(),

          recommendationEnabled:
            z
              .boolean()
              .optional(),

          showOnTeamPage:
            z
              .boolean()
              .optional(),

          recommendationPriority:
            z
              .number()
              .int()
              .min(0)
              .max(20)
              .optional(),

          sortOrder:
            z
              .number()
              .int()
              .min(0)
              .max(100000)
              .optional(),
        })
      )
      .mutation(
        async ({
          ctx,
          input,
        }) => {
          const organizationId =
            getCtxOrganizationId(ctx);

          const userId =
            Number(
              (ctx.user as any)?.id ||
              0
            );

          if (
            !Number.isFinite(userId) ||
            userId <= 0
          ) {
            throwAppError(
              ERROR_CODES.AUTH_REQUIRED,
              "로그인이 필요합니다.",
              401
            );
          }

          return db.updateStaffRecommendationManagement({
            organizationId,

            userId:
              input.userId,

            updatedBy:
              userId,

            values: {
              recommendationEnabled:
                input.recommendationEnabled,

              showOnTeamPage:
                input.showOnTeamPage,

              recommendationPriority:
                input.recommendationPriority,

              sortOrder:
                input.sortOrder,
            },
          });
        }
      ),
}),

  /**
   * 로그인 없이 접근하는 공개 API
   */
  public: router({
    /**
     * 담당자 개인 공개 URL
     */
    getByToken:
      publicProcedure
        .input(
          z.object({
            token:
              z
                .string()
                .trim()
                .min(1)
                .max(191),
          })
        )
        .query(
  async ({ input }) => {
    const profile =
      await db.getStaffPublicProfileByToken(
        input.token
      );

    if (!profile) {
      return null;
    }

    const organizationId =
      await db.getStaffPublicProfileOrganizationIdByToken(
        input.token
      );

    if (!organizationId) {
      return null;
    }

    const branding =
      await db.getBrandingSettings({
        organizationId,
      });

    return {
      branding: {
        companyName:
          branding?.companyName ??
          null,

        companyLogoUrl:
          branding?.companyLogoUrl ??
          null,
      },

      profile,
    };
  }
),

    /**
     * 회사 담당자 소개 페이지.
     *
     * 현재 단계에서는 organizationId로 조회한다.
     * 이후 회사 slug가 확정되면
     * slug 기반 URL로 교체할 수 있다.
     */
    companyTeamPage:
      publicProcedure
        .input(
          z.object({
            organizationId:
              z
                .number()
                .int()
                .positive(),
          })
        )
        .query(
          async ({ input }) => {
            const settings =
              await db.getStaffTeamPageSettings({
                organizationId:
                  input.organizationId,
              });

            if (
              !settings ||
              settings.enabled !== true
            ) {
              return null;
            }

            const profiles =
  await db.listPublicStaffProfiles({
    organizationId:
      input.organizationId,
  });

const branding =
  await db.getBrandingSettings({
    organizationId:
      input.organizationId,
  });

return {
  branding: {
    companyName:
      branding?.companyName ??
      null,

    companyLogoUrl:
      branding?.companyLogoUrl ??
      null,
  },

  settings,
  profiles,
};
          }
        ),
  }),
}),


backup: router({
  exportExcel: hostProcedure.mutation(async ({ ctx }) => {
    if ((ctx.user as any)?.role === "superhost") {
      throwAppError(
  ERROR_CODES.SUPERHOST_REQUIRED,
  "슈퍼호스트는 회사 엑셀 백업을 다운로드할 수 없습니다.",
  403
);
    }

    const organizationId = getCtxOrganizationId(ctx);

    if (!organizationId) {
      throwAppError(
  ERROR_CODES.ORGANIZATION_REQUIRED,
  "organizationId is required",
  400
);
    }

    const features = await getOrganizationFeatureFlags(organizationId);

    if (!features.allowBackup) {
      throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "현재 회사는 백업 기능을 사용할 수 없습니다.",
  403
);
    }

    const exported = await buildOrganizationExcelExport({
      organizationId,
      requestedBy: Number(ctx.user.id),
    });

    await db.createAuditLog({
      organizationId,
      actorUserId: Number(ctx.user.id),
      actorRole: String((ctx.user as any)?.role || ""),
      action: "organization.excel_export.download",
      targetType: "organization",
      targetId: organizationId,
      memo: `회사 데이터 엑셀 내보내기: ${exported.fileName}`,
    } as any);

    return {
      success: true,
      fileName: exported.fileName,
      mimeType: exported.mimeType,
      base64: exported.base64,
    };
  }),
  list: hostProcedure
    .input(
      z
        .object({
          limit: z.number().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
  if ((ctx.user as any)?.role === "superhost") {
    throwAppError(
  ERROR_CODES.SUPERHOST_REQUIRED,
  "슈퍼호스트는 회사 백업 원문을 조회할 수 없습니다.",
  403
);
  }

  const organizationId = getCtxOrganizationId(ctx);

  if (!organizationId) {
    throwAppError(
  ERROR_CODES.ORGANIZATION_REQUIRED,
  "organizationId is required",
  400
);
  }

const features = await getOrganizationFeatureFlags(organizationId);

if (!features.allowBackup) {
  throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "현재 회사는 백업/복구 기능을 사용할 수 없습니다.",
  403
);
}

  return db.listOrganizationBackups({
    organizationId,
    limit: input?.limit ?? 30,
  });
}),

downloadUrl: hostProcedure
  .input(
    z.object({
      id: z.number(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    if ((ctx.user as any)?.role === "superhost") {
      throwAppError(
  ERROR_CODES.SUPERHOST_REQUIRED,
  "슈퍼호스트는 회사 백업 파일을 다운로드할 수 없습니다.",
  403
);
    }

    const organizationId = getCtxOrganizationId(ctx);

    if (!organizationId) {
      throwAppError(
  ERROR_CODES.ORGANIZATION_REQUIRED,
  "organizationId is required",
  400
);
    }

    const features = await getOrganizationFeatureFlags(organizationId);

    if (!features.allowBackup) {
      throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "현재 회사는 백업/복구 기능을 사용할 수 없습니다.",
  403
);
    }

    const backup = await db.getOrganizationBackupById(input.id, {
      organizationId,
    });

    if (!backup) {
      throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "백업 파일을 찾을 수 없습니다.",
  404
);
    }

    if (!backup.fileKey) {
      throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "다운로드 가능한 백업 파일이 없습니다.",
  404
);
    }

    const url = await createPrivateDownloadUrl({
      key: String(backup.fileKey),
      expiresInSeconds: 60 * 5,
    });

await db.createAuditLog({
  organizationId,
  actorUserId: Number(ctx.user.id),
  actorRole: String((ctx.user as any)?.role || ""),
  action: "organization.backup.download",
  targetType: "organization_backup",
  targetId: Number(input.id),
  memo: `회사 백업 다운로드 URL 발급: backupId=${input.id}`,
} as any);

    return {
      success: true,
      url,
      expiresInSeconds: 60 * 5,
    };
  }),

  create: hostProcedure
  .input(
    z
      .object({
        backupType: z
          .enum(["manual", "auto", "restore_snapshot"])
          .optional(),
      })
      .optional()
  )
  .mutation(async ({ ctx, input }) => {
    const organizationId = getCtxOrganizationId(ctx);

if ((ctx.user as any)?.role === "superhost") {
  throwAppError(
  ERROR_CODES.SUPERHOST_REQUIRED,
  "슈퍼호스트는 회사 백업 원문을 생성할 수 없습니다.",
  403
);
}

    if (!organizationId) {
      throwAppError(
  ERROR_CODES.ORGANIZATION_REQUIRED,
  "organizationId is required",
  400
);
    }

const features = await getOrganizationFeatureFlags(organizationId);

if (!features.allowBackup) {
  throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "현재 회사는 백업/복구 기능을 사용할 수 없습니다.",
  403
);
}

const limitStatus = await getOrganizationLimitStatus(organizationId);

if (limitStatus.exceeded.storage) {
  throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  `저장공간 제한을 초과했습니다. 현재 ${limitStatus.usage.storageUsedMb}MB / 제한 ${limitStatus.limits.maxStorageMb}MB`,
  403
);
}

    const backupId = await db.createOrganizationBackupRecord({
      organizationId,
      requestedBy: Number(ctx.user.id),
      backupType: input?.backupType ?? "manual",
    });

    try {
      const exported = await db.exportOrganizationBackupData({
        organizationId,
        requestedBy: Number(ctx.user.id),
	actorRole: String((ctx.user as any)?.role || ""),
      });

const backupKey = `organization-backups/${organizationId}/${exported.fileName}`;

await uploadPrivateJsonObject({
  key: backupKey,
  json: exported.json,
});

      await db.markOrganizationBackupCompleted({
        id: Number(backupId),
        organizationId,
        fileUrl: null,
fileKey: backupKey,
        fileSizeBytes: exported.fileSizeBytes,
        tableCount: exported.tableCount,
        rowCount: exported.rowCount,
      });

      await db.createAuditLog({
        organizationId,
        actorUserId: Number(ctx.user.id),
        actorRole: String((ctx.user as any)?.role || ""),
        action: "organization.backup.create",
        targetType: "organization_backup",
        targetId: Number(backupId),
        memo: `회사 백업 생성: ${exported.fileName}`,
      } as any);

      return {
  success: true,
  id: Number(backupId),
  fileName: exported.fileName,
  fileSizeBytes: exported.fileSizeBytes,
  tableCount: exported.tableCount,
  rowCount: exported.rowCount,
};
    } catch (error: any) {
      await db.markOrganizationBackupFailed({
        id: Number(backupId),
        organizationId,
        errorMessage: error?.message || "백업 생성 실패",
      });

      throw error;
    }
  }),

  previewRestore: hostProcedure
  .input(
    z.object({
      backupId: z.number().int().positive(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const organizationId = getCtxOrganizationId(ctx);

    if ((ctx.user as any)?.role === "superhost") {
      throwAppError(
  ERROR_CODES.SUPERHOST_REQUIRED,
  "슈퍼호스트는 회사 백업 원문을 검증할 수 없습니다.",
  403
);
    }

    if (!organizationId) {
      throwAppError(
  ERROR_CODES.ORGANIZATION_REQUIRED,
  "organizationId is required",
  400
);
    }

    const features = await getOrganizationFeatureFlags(organizationId);

    if (!features.allowBackup) {
      throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "현재 회사는 백업/복구 기능을 사용할 수 없습니다.",
  403
);
    }

    const backup = await db.getOrganizationBackupById(input.backupId, {
  organizationId,
});

    if (!backup) {
      throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "백업을 찾을 수 없습니다.",
  404
);
    }

    if (backup.status === "deleted") {
      throwAppError(
  ERROR_CODES.INVALID_REQUEST,
  "삭제된 백업은 복구할 수 없습니다.",
  400
);
    }

    if (!backup.fileKey) {
      throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "백업 파일 경로가 없습니다.",
  404
);
    }

    const backupText = await readPrivateTextObject({
  key: String(backup.fileKey),
});

    let parsed: any = null;

    try {
      parsed = JSON.parse(backupText);
    } catch {
      throwAppError(
  ERROR_CODES.RESTORE_FAILED,
  "백업 파일 형식이 올바르지 않습니다.",
  400
);
    }

    if (parsed?.app !== "Edu-CRM") {
      throwAppError(
  ERROR_CODES.RESTORE_FAILED,
  "Edu-CRM 백업 파일이 아닙니다.",
  400
);
    }

    if (parsed?.backupType !== "organization_full") {
      throwAppError(
  ERROR_CODES.RESTORE_FAILED,
  "지원하지 않는 백업 유형입니다.",
  400
);
    }

    if (Number(parsed?.organizationId) !== Number(organizationId)) {
      throwAppError(
  ERROR_CODES.RESTORE_FAILED,
  "다른 회사의 백업 파일은 복구할 수 없습니다.",
  403
);
    }

    const tables = parsed?.tables || {};
    const tableNames = Object.keys(tables);

    let rowCount = 0;

    for (const tableName of tableNames) {
      const rows = tables[tableName];
      if (Array.isArray(rows)) {
        rowCount += rows.length;
      }
    }

    return {
      success: true,
      backupId: input.backupId,
      organizationId,
      backupOrganizationId: Number(parsed.organizationId),
      organizationName: parsed?.organization?.name || "",
      organizationSlug: parsed?.organization?.slug || "",
      createdAt: parsed?.createdAt || null,
      tableCount: tableNames.length,
      rowCount,
      tables: tableNames.map((tableName) => ({
        tableName,
        rowCount: Array.isArray(tables[tableName])
          ? tables[tableName].length
          : 0,
      })),
    };
  }),

    restore: hostProcedure
    .input(
      z.object({
        backupId: z.number(),
        confirmText: z.string().min(1),
restoreReason: z.string().min(1).max(300),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = getCtxOrganizationId(ctx);

if ((ctx.user as any)?.role === "superhost") {
  throwAppError(
  ERROR_CODES.SUPERHOST_REQUIRED,
  "슈퍼호스트는 회사 백업 원문을 복구할 수 없습니다.",
  403
);
}

      if (!organizationId) {
        throwAppError(
  ERROR_CODES.ORGANIZATION_REQUIRED,
  "organizationId is required",
  400
);
      }

const features = await getOrganizationFeatureFlags(organizationId);

if (!features.allowBackup) {
  throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "현재 회사는 백업/복구 기능을 사용할 수 없습니다.",
  403
);
}

      if (input.confirmText !== "복구합니다") {
        throwAppError(
  ERROR_CODES.INVALID_REQUEST,
  "복구 확인 문구가 일치하지 않습니다.",
  400
);
      }

      const backupRecord = await db.getOrganizationBackupById(input.backupId, {
  organizationId,
});

if (!backupRecord) {
  throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "백업 파일을 찾을 수 없습니다.",
  404
);
}

if (!backupRecord.fileKey) {
  throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "백업 파일 경로가 없습니다.",
  404
);
}

let parsed: any = null;
let backupText = "";

try {
  backupText = await readPrivateTextObject({
    key: String(backupRecord.fileKey),
  });

  parsed = JSON.parse(backupText);
} catch {
  throwAppError(
  ERROR_CODES.RESTORE_FAILED,
  "백업 파일 형식이 올바르지 않습니다.",
  400
);
}

      if (parsed?.app !== "Edu-CRM") {
        throwAppError(
  ERROR_CODES.RESTORE_FAILED,
  "Edu-CRM 백업 파일이 아닙니다.",
  400
);
      }

      if (parsed?.backupType !== "organization_full") {
        throwAppError(
  ERROR_CODES.RESTORE_FAILED,
  "지원하지 않는 백업 유형입니다.",
  400
);
      }

     if (Number(parsed?.organizationId) !== Number(organizationId)) {
  throwAppError(
  ERROR_CODES.RESTORE_FAILED,
  "다른 회사의 백업 파일은 복구할 수 없습니다.",
  403
);
}

const restoreLimitStatus = await getOrganizationLimitStatus(organizationId);

if (restoreLimitStatus.exceeded.storage) {
  throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  `저장공간 제한을 초과했습니다. 현재 ${restoreLimitStatus.usage.storageUsedMb}MB / 제한 ${restoreLimitStatus.limits.maxStorageMb}MB`,
  403
);
}

const snapshotBackupId = await db.createOrganizationBackupRecord({
  organizationId,
  requestedBy: Number(ctx.user.id),
  backupType: "restore_snapshot",
});

const snapshotExported = await db.exportOrganizationBackupData({
  organizationId,
  requestedBy: Number(ctx.user.id),
  actorRole: String((ctx.user as any)?.role || ""),
});

const snapshotKey = `organization-backups/${organizationId}/restore-snapshots/${snapshotExported.fileName}`;

await uploadPrivateJsonObject({
  key: snapshotKey,
  json: snapshotExported.json,
});

await db.markOrganizationBackupCompleted({
  id: Number(snapshotBackupId),
  organizationId,
  fileUrl: null,
  fileKey: snapshotKey,
  fileSizeBytes: snapshotExported.fileSizeBytes,
  tableCount: snapshotExported.tableCount,
  rowCount: snapshotExported.rowCount,
});

const restored = await db.restoreOrganizationBackupData({
  organizationId,
  backup: parsed,
  restoredBy: Number(ctx.user.id),
  actorRole: String((ctx.user as any)?.role || ""),
});

      await db.markOrganizationBackupRestored({
  id: Number(snapshotBackupId),
  organizationId,
  restoredBy: Number(ctx.user.id),
  restoreReason: input.restoreReason,
});

      await db.createAuditLog({
        organizationId,
        actorUserId: Number(ctx.user.id),
        actorRole: String((ctx.user as any)?.role || ""),
        action: "organization.backup.restore",
        targetType: "organization_backup",
        targetId: Number(snapshotBackupId),
        memo: `회사 백업 복구 완료: ${restored.restoredTableCount}개 테이블 / ${restored.restoredRowCount}개 데이터 / 사유: ${input.restoreReason}`,
      } as any);

      return {
        success: true,
        previewOnly: false,
        message: "백업 복구가 완료되었습니다.",
        tableCount: restored.restoredTableCount,
        rowCount: restored.restoredRowCount,
      };
    }),
}),

audit: router({
  list: hostProcedure
    .input(
      z
        .object({
          organizationId: z.number().optional(),
          action: z.string().optional(),
          actorUserId: z.number().optional(),
          targetType: z.string().optional(),
          limit: z.number().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const isSuperhostUser = (ctx.user as any)?.role === "superhost";

      const organizationId = isSuperhostUser
        ? input?.organizationId
        : Number((ctx.user as any)?.organizationId || 0);

      if (!isSuperhostUser && !organizationId) {
        throwAppError(
  ERROR_CODES.ORGANIZATION_REQUIRED,
  "organizationId is required",
  400
);
      }

if (!isSuperhostUser) {
  await assertOrganizationFeatureEnabled(
    organizationId,
    "allowAuditLog",
    "현재 회사는 감사로그 기능을 사용할 수 없습니다."
  );
}

      return db.listAuditLogs({
        organizationId,
        isSuperhost: isSuperhostUser,
        action: input?.action,
        actorUserId: input?.actorUserId,
        targetType: input?.targetType,
        limit: input?.limit ?? 100,
      });
    }),
}),

studentAudit: router({
  list: protectedProcedure
    .input(
      z.object({
        studentId: z.number(),
        limit: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const organizationId = getCtxOrganizationId(ctx);

      if (!organizationId) {
        throwAppError(
  ERROR_CODES.ORGANIZATION_REQUIRED,
  "organizationId is required",
  400
);
      }

      const student = await db.getStudent(input.studentId, {
        organizationId,
      });

      if (!student) {
        throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "학생을 찾을 수 없습니다.",
  404
);
      }
      return db.listStudentAuditLogs({
        organizationId,
        studentId: input.studentId,
        limit: input.limit ?? 100,
      });
    }),
}),

approvalHistory: router({
  detail: protectedProcedure
    .input(
      z.object({
        type: z.enum(["semester", "refund"]),
        id: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      const organizationId = getCtxOrganizationId(ctx);

      if (!organizationId) {
        throwAppError(
          ERROR_CODES.ORGANIZATION_REQUIRED,
          "organizationId is required",
          400
        );
      }

      if (input.type === "semester") {
        return db.getSemesterApprovalHistoryDetail({
          organizationId,
          id: input.id,
        });
      }

      return db.getRefundApprovalHistoryDetail({
        organizationId,
        id: input.id,
      });
    }),
}),

attendance: attendanceRouter,
notice: noticeRouter,
schedule: scheduleRouter,
  approval: approvalRouter,
privateCertificateMaster: privateCertificateMasterRouter,
subjectCatalog: subjectCatalogRouter,

creditSummary: router({
  rules: router({
    list: protectedProcedure
      .input(
        z
          .object({
            activeOnly: z.boolean().optional(),
          })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        const organizationId = getCtxOrganizationId(ctx);

        return db.listCreditSummaryRules({
          organizationId,
          activeOnly: input?.activeOnly ?? false,
        });
      }),

    create: protectedProcedure
      .input(
        z.object({
  studentId: z.number(),
  courseName: z.string().optional().nullable(),
          finalEducation: z.string().optional().nullable(),

          requiredTotalCredits: z.number().min(0).optional(),

          requiredMajorRequiredSubjects: z.number().min(0).optional(),
          requiredMajorElectiveSubjects: z.number().min(0).optional(),
          requiredLiberalSubjects: z.number().min(0).optional(),
          requiredGeneralSubjects: z.number().min(0).optional(),

          requiredMajorRequiredCredits: z.number().min(0).optional(),
          requiredMajorElectiveCredits: z.number().min(0).optional(),
          requiredLiberalCredits: z.number().min(0).optional(),
          requiredGeneralCredits: z.number().min(0).optional(),

          allowMajorElectiveOver: z.boolean().optional(),
          allowLiberalOver: z.boolean().optional(),
          allowGeneralOver: z.boolean().optional(),
          duplicateCheckEnabled: z.boolean().optional(),

          isActive: z.boolean().optional(),
          memo: z.string().optional().nullable(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const organizationId = getCtxOrganizationId(ctx);

        const student = await db.getStudent(input.studentId, {
  organizationId,
});

if (!student) {
  throwAppError(
    ERROR_CODES.DATA_NOT_FOUND,
    "학생을 찾을 수 없습니다.",
    404
  );
}

assertStudentEditable({
  currentUser: ctx.user,
  student,
});

        const id = await db.createCreditSummaryRule({
          organizationId,
studentId: Number(input.studentId),
courseName: input.courseName?.trim() || null,
finalEducation: input.finalEducation?.trim() || null,

          requiredTotalCredits: input.requiredTotalCredits ?? 0,

          requiredMajorRequiredSubjects: input.requiredMajorRequiredSubjects ?? 0,
          requiredMajorElectiveSubjects: input.requiredMajorElectiveSubjects ?? 0,
          requiredLiberalSubjects: input.requiredLiberalSubjects ?? 0,
          requiredGeneralSubjects: input.requiredGeneralSubjects ?? 0,

          requiredMajorRequiredCredits: input.requiredMajorRequiredCredits ?? 0,
          requiredMajorElectiveCredits: input.requiredMajorElectiveCredits ?? 0,
          requiredLiberalCredits: input.requiredLiberalCredits ?? 0,
          requiredGeneralCredits: input.requiredGeneralCredits ?? 0,

          allowMajorElectiveOver: input.allowMajorElectiveOver ?? false,
          allowLiberalOver: input.allowLiberalOver ?? true,
          allowGeneralOver: input.allowGeneralOver ?? true,
          duplicateCheckEnabled: input.duplicateCheckEnabled ?? true,

          isActive: input.isActive ?? true,
          memo: input.memo?.trim() || null,

          createdBy: Number(ctx.user.id),
          updatedBy: Number(ctx.user.id),
        } as any);

        return { success: true, id };
      }),

    update: protectedProcedure
      .input(
  z.object({
    id: z.number(),
    studentId: z.number(),

    courseName: z.string().optional().nullable(),
          finalEducation: z.string().optional().nullable(),

          requiredTotalCredits: z.number().min(0).optional(),

          requiredMajorRequiredSubjects: z.number().min(0).optional(),
          requiredMajorElectiveSubjects: z.number().min(0).optional(),
          requiredLiberalSubjects: z.number().min(0).optional(),
          requiredGeneralSubjects: z.number().min(0).optional(),

          requiredMajorRequiredCredits: z.number().min(0).optional(),
          requiredMajorElectiveCredits: z.number().min(0).optional(),
          requiredLiberalCredits: z.number().min(0).optional(),
          requiredGeneralCredits: z.number().min(0).optional(),

          allowMajorElectiveOver: z.boolean().optional(),
          allowLiberalOver: z.boolean().optional(),
          allowGeneralOver: z.boolean().optional(),
          duplicateCheckEnabled: z.boolean().optional(),

          isActive: z.boolean().optional(),
          memo: z.string().optional().nullable(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const organizationId = getCtxOrganizationId(ctx);

        const student = await db.getStudent(input.studentId, {
  organizationId,
});

if (!student) {
  throwAppError(
    ERROR_CODES.DATA_NOT_FOUND,
    "학생을 찾을 수 없습니다.",
    404
  );
}

assertStudentEditable({
  currentUser: ctx.user,
  student,
});

        const data: any = {
          updatedBy: Number(ctx.user.id),
        };

        if (input.studentId !== undefined) data.studentId = Number(input.studentId);

if (input.courseName !== undefined)
  data.courseName = input.courseName?.trim() || null;
        if (input.finalEducation !== undefined)
          data.finalEducation = input.finalEducation?.trim() || null;

        if (input.requiredTotalCredits !== undefined)
          data.requiredTotalCredits = input.requiredTotalCredits;

        if (input.requiredMajorRequiredSubjects !== undefined)
          data.requiredMajorRequiredSubjects = input.requiredMajorRequiredSubjects;
        if (input.requiredMajorElectiveSubjects !== undefined)
          data.requiredMajorElectiveSubjects = input.requiredMajorElectiveSubjects;
        if (input.requiredLiberalSubjects !== undefined)
          data.requiredLiberalSubjects = input.requiredLiberalSubjects;
        if (input.requiredGeneralSubjects !== undefined)
          data.requiredGeneralSubjects = input.requiredGeneralSubjects;

        if (input.requiredMajorRequiredCredits !== undefined)
          data.requiredMajorRequiredCredits = input.requiredMajorRequiredCredits;
        if (input.requiredMajorElectiveCredits !== undefined)
          data.requiredMajorElectiveCredits = input.requiredMajorElectiveCredits;
        if (input.requiredLiberalCredits !== undefined)
          data.requiredLiberalCredits = input.requiredLiberalCredits;
        if (input.requiredGeneralCredits !== undefined)
          data.requiredGeneralCredits = input.requiredGeneralCredits;

        if (input.allowMajorElectiveOver !== undefined)
          data.allowMajorElectiveOver = input.allowMajorElectiveOver;
        if (input.allowLiberalOver !== undefined)
          data.allowLiberalOver = input.allowLiberalOver;
        if (input.allowGeneralOver !== undefined)
          data.allowGeneralOver = input.allowGeneralOver;
        if (input.duplicateCheckEnabled !== undefined)
          data.duplicateCheckEnabled = input.duplicateCheckEnabled;

        if (input.isActive !== undefined) data.isActive = input.isActive;
        if (input.memo !== undefined) data.memo = input.memo?.trim() || null;

        const updated = await db.updateCreditSummaryRule(input.id, data, {
          organizationId,
        });

        return { success: true, data: updated };
      }),

    delete: protectedProcedure
      .input(
        z.object({
          id: z.number(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const organizationId = getCtxOrganizationId(ctx);

        if (!isAdminOrHost(ctx.user)) {
          throwAppError(
            ERROR_CODES.PERMISSION_DENIED,
            "관리자 또는 호스트만 요약 기준을 삭제할 수 있습니다.",
            403
          );
        }

        await db.deleteCreditSummaryRule({
          id: input.id,
          organizationId,
        });

        return { success: true };
      }),
  }),

administrativeProcedures: router({
  list: protectedProcedure
    .input(
      z.object({
        studentId: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      const organizationId =
        getCtxOrganizationId(ctx);

      const student =
        await db.getStudent(
          input.studentId,
          {
            organizationId,
          }
        );

      if (!student) {
        throwAppError(
          ERROR_CODES.DATA_NOT_FOUND,
          "학생을 찾을 수 없습니다.",
          404
        );
      }

      if (
        !isAdminOrHost(ctx.user) &&
        Number(student.assigneeId) !==
          Number(ctx.user.id)
      ) {
        throwAppError(
          ERROR_CODES.PERMISSION_DENIED,
          "권한이 없습니다.",
          403
        );
      }

      return db.getStudentAdministrativeProcedures({
        organizationId,
        studentId:
          input.studentId,
      });
    }),

  upsert: protectedProcedure
    .input(
      z.object({
        studentId:
          z.number(),

        procedureType:
          z.enum([
            "learner_registration",
            "credit_recognition",
            "degree_application",
            "qualification_application",
          ]),

        status:
          z.enum([
            "not_started",
            "in_progress",
            "completed",
            "review_required",
          ]),

        reportedDate:
          z.string()
            .optional()
            .nullable(),

        evidenceSummary:
          z.string()
            .optional()
            .nullable(),

        referenceType:
          z.string()
            .optional()
            .nullable(),

        referenceId:
          z.string()
            .optional()
            .nullable(),

        memo:
          z.string()
            .optional()
            .nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId =
        getCtxOrganizationId(ctx);

      const student =
        await db.getStudent(
          input.studentId,
          {
            organizationId,
          }
        );

      if (!student) {
        throwAppError(
          ERROR_CODES.DATA_NOT_FOUND,
          "학생을 찾을 수 없습니다.",
          404
        );
      }

      assertStudentEditable({
        currentUser:
          ctx.user,

        student,
      });

      const result =
  await updateAdministrativeProcedure({
    organizationId,

    studentId:
      input.studentId,

    procedureType:
      input.procedureType,

    status:
      input.status,

    /**
     * 이 API는 CRM 담당자 전용 경로.
     */
    sourceType:
      "STAFF",

    actorUserId:
      Number(
        ctx.user.id
      ),

    reportedDate:
      input.reportedDate ??
      null,

    evidenceSummary:
      input.evidenceSummary ??
      null,

    referenceType:
      input.referenceType ??
      null,

    referenceId:
      input.referenceId ??
      null,

    memo:
      input.memo ??
      null,
  });

const before =
  result.before;

const updated =
  result.data;

      /**
       * 실제 학생 정보 변경이므로
       * 기존 studentAuditLogs에 기록한다.
       */
      if (
  result.changed
) {
  await writeStudentAuditLog({
    ctx,

    studentId:
      input.studentId,

    entityType:
      "administrative_procedure",

    entityId:
      Number(
        (updated as any)?.id ||
        (before as any)?.id ||
        0
      ) || null,

    action:
      before
        ? "update"
        : "create",

    title:
      "행정절차 상태 변경",

    beforeJson:
      before,

    afterJson:
      updated,
  });
}

      return {
        success:
          true,

        data:
          updated,
      };
    }),
}),

aiManagement: router({
  notes: protectedProcedure
    .input(
      z.object({
        studentId: z.number(),
        status: z
          .enum([
            "info",
            "action_required",
            "in_progress",
            "resolved",
            "dismissed",
          ])
          .optional()
          .nullable(),
        limit: z.number().min(1).max(200).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const organizationId =
        getCtxOrganizationId(ctx);

      const student =
        await db.getStudent(
          input.studentId,
          {
            organizationId,
          }
        );

      if (!student) {
        throwAppError(
          ERROR_CODES.DATA_NOT_FOUND,
          "학생을 찾을 수 없습니다.",
          404
        );
      }

      if (
        !isAdminOrHost(ctx.user) &&
        Number(student.assigneeId) !==
          Number(ctx.user.id)
      ) {
        throwAppError(
          ERROR_CODES.PERMISSION_DENIED,
          "권한이 없습니다.",
          403
        );
      }

      return db.listStudentAiNotes({
        organizationId,
        studentId:
          input.studentId,
        status:
          input.status ??
          null,
        limit:
          input.limit ??
          50,
      });
    }),

  events: protectedProcedure
    .input(
      z.object({
        studentId:
          z.number(),

        unreadOnly:
          z.boolean()
            .optional(),

        limit:
          z.number()
            .min(1)
            .max(200)
            .optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const organizationId =
        getCtxOrganizationId(ctx);

      const student =
        await db.getStudent(
          input.studentId,
          {
            organizationId,
          }
        );

      if (!student) {
        throwAppError(
          ERROR_CODES.DATA_NOT_FOUND,
          "학생을 찾을 수 없습니다.",
          404
        );
      }

      if (
        !isAdminOrHost(ctx.user) &&
        Number(student.assigneeId) !==
          Number(ctx.user.id)
      ) {
        throwAppError(
          ERROR_CODES.PERMISSION_DENIED,
          "권한이 없습니다.",
          403
        );
      }

      const events =
        await db.listStudentAiEvents({
          organizationId,
          studentId:
            input.studentId,
          unreadOnly:
            input.unreadOnly ??
            false,
          limit:
            input.limit ??
            50,
        });

      const unreadCount =
        await db.countUnreadStudentAiEvents({
          organizationId,
          studentId:
            input.studentId,
        });

      return {
        events,
        unreadCount,
      };
    }),

  updateNoteStatus: protectedProcedure
    .input(
      z.object({
        studentId:
          z.number(),

        noteId:
          z.number(),

        status:
          z.enum([
            "info",
            "action_required",
            "in_progress",
            "resolved",
            "dismissed",
          ]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId =
        getCtxOrganizationId(ctx);

      const student =
        await db.getStudent(
          input.studentId,
          {
            organizationId,
          }
        );

      if (!student) {
        throwAppError(
          ERROR_CODES.DATA_NOT_FOUND,
          "학생을 찾을 수 없습니다.",
          404
        );
      }

      assertStudentEditable({
        currentUser:
          ctx.user,
        student,
      });

      const updated =
        await db.updateStudentAiNoteStatus({
          organizationId,
          studentId:
            input.studentId,
          noteId:
            input.noteId,
          status:
            input.status,
          updatedBy:
            Number(ctx.user.id),
        });

      if (!updated) {
        throwAppError(
          ERROR_CODES.DATA_NOT_FOUND,
          "AI 관리 메모를 찾을 수 없습니다.",
          404
        );
      }

      return {
        success:
          true,
        data:
          updated,
      };
    }),

  markEventRead: protectedProcedure
    .input(
      z.object({
        studentId:
          z.number(),

        eventId:
          z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId =
        getCtxOrganizationId(ctx);

      const student =
        await db.getStudent(
          input.studentId,
          {
            organizationId,
          }
        );

      if (!student) {
        throwAppError(
          ERROR_CODES.DATA_NOT_FOUND,
          "학생을 찾을 수 없습니다.",
          404
        );
      }

      if (
        !isAdminOrHost(ctx.user) &&
        Number(student.assigneeId) !==
          Number(ctx.user.id)
      ) {
        throwAppError(
          ERROR_CODES.PERMISSION_DENIED,
          "권한이 없습니다.",
          403
        );
      }

      const updated =
        await db.markStudentAiEventRead({
          organizationId,
          studentId:
            input.studentId,
          eventId:
            input.eventId,
          readBy:
            Number(ctx.user.id),
        });

      if (!updated) {
        throwAppError(
          ERROR_CODES.DATA_NOT_FOUND,
          "AI 업데이트 이벤트를 찾을 수 없습니다.",
          404
        );
      }

      const unreadCount =
        await db.countUnreadStudentAiEvents({
          organizationId,
          studentId:
            input.studentId,
        });

      return {
        success:
          true,
        data:
          updated,
        unreadCount,
      };
    }),

  markAllEventsRead: protectedProcedure
    .input(
      z.object({
        studentId:
          z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId =
        getCtxOrganizationId(ctx);

      const student =
        await db.getStudent(
          input.studentId,
          {
            organizationId,
          }
        );

      if (!student) {
        throwAppError(
          ERROR_CODES.DATA_NOT_FOUND,
          "학생을 찾을 수 없습니다.",
          404
        );
      }

      if (
        !isAdminOrHost(ctx.user) &&
        Number(student.assigneeId) !==
          Number(ctx.user.id)
      ) {
        throwAppError(
          ERROR_CODES.PERMISSION_DENIED,
          "권한이 없습니다.",
          403
        );
      }

      return db.markAllStudentAiEventsRead({
        organizationId,
        studentId:
          input.studentId,
        readBy:
          Number(ctx.user.id),
      });
    }),

  /**
   * CRM 담당자가 직접 AI 관리 메모를 만드는 경로.
   *
   * 카카오 AI / SYSTEM_AI는 이 mutation을 사용하지 않는다.
   * 각각 서버 내부 Service에서 sourceType을 고정하여 호출한다.
   */
  createStaffNote: protectedProcedure
    .input(
      z.object({
        studentId:
          z.number(),

        noteType:
          z.enum([
            "administrative",
            "practice",
            "schedule",
            "subject",
            "degree",
            "qualification",
            "document",
            "risk",
            "learning_plan",
            "general",
          ]),

        aiSummary:
          z.string()
            .min(1),

        inquirySummary:
          z.string()
            .optional()
            .nullable(),

        actionSummary:
          z.string()
            .optional()
            .nullable(),

        notifyStaff:
          z.boolean()
            .optional(),

        eventType:
          z.enum([
            "administrative_status_changed",
            "document_submitted",
            "practice_condition_changed",
            "schedule_changed",
            "risk_changed",
            "important_note_created",
            "learning_plan_changed",
            "other",
          ])
            .optional(),

        eventSeverity:
          z.enum([
            "info",
            "warning",
            "important",
          ])
            .optional(),

        eventTitle:
          z.string()
            .optional()
            .nullable(),

        eventMessage:
          z.string()
            .optional()
            .nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId =
        getCtxOrganizationId(ctx);

      const student =
        await db.getStudent(
          input.studentId,
          {
            organizationId,
          }
        );

      if (!student) {
        throwAppError(
          ERROR_CODES.DATA_NOT_FOUND,
          "학생을 찾을 수 없습니다.",
          404
        );
      }

      assertStudentEditable({
        currentUser:
          ctx.user,
        student,
      });

      return createStudentAiManagementRecord({
        organizationId,
        studentId:
          input.studentId,

        /**
         * 외부 입력으로 sourceType을 받지 않는다.
         */
        sourceType:
          "STAFF",

        noteType:
          input.noteType,

        aiSummary:
          input.aiSummary,

        inquirySummary:
          input.inquirySummary ??
          null,

        actionSummary:
          input.actionSummary ??
          null,

        actorUserId:
          Number(ctx.user.id),

        notifyStaff:
          input.notifyStaff ??
          false,

        eventType:
          input.eventType,

        eventSeverity:
          input.eventSeverity,

        eventTitle:
          input.eventTitle ??
          null,

        eventMessage:
          input.eventMessage ??
          null,
      });
    }),
}),

  student: router({
    getSummary: protectedProcedure
      .input(
        z.object({
          studentId: z.number(),
          ruleId: z.number().optional().nullable(),
        })
      )
      .query(async ({ ctx, input }) => {
        const organizationId = getCtxOrganizationId(ctx);

        const student = await db.getStudent(input.studentId, {
          organizationId,
        });

        if (!student) {
          throwAppError(
            ERROR_CODES.DATA_NOT_FOUND,
            "학생을 찾을 수 없습니다.",
            404
          );
        }

        if (!isAdminOrHost(ctx.user) && Number(student.assigneeId) !== Number(ctx.user.id)) {
          throwAppError(
            ERROR_CODES.PERMISSION_DENIED,
            "권한이 없습니다.",
            403
          );
        }

        const plan = await db.getPlan(input.studentId, {
          organizationId,
        });

        const planSemesters = await db.listPlanSemesters(input.studentId, {
          organizationId,
        });

        const transferSubjects = await db.listTransferSubjects(input.studentId, {
          organizationId,
        });

        const extraItems = await db.listStudentCreditSummaryItems({
          organizationId,
          studentId: input.studentId,
        });

const administrativeProcedures =
  await db.getStudentAdministrativeProcedures({
    organizationId,
    studentId:
      input.studentId,
  });

const aiNotes =
  await db.listStudentAiNotes({
    organizationId,
    studentId:
      input.studentId,
    limit:
      50,
  });

const aiEvents =
  await db.listStudentAiEvents({
    organizationId,
    studentId:
      input.studentId,
    limit:
      50,
  });

const unreadAiEventCount =
  await db.countUnreadStudentAiEvents({
    organizationId,
    studentId:
      input.studentId,
  });

let rule: any = null;

        if (input.ruleId) {
          rule = await db.getCreditSummaryRuleById({
            id: input.ruleId,
            organizationId,
          });
        }

        if (!rule) {
          rule = await db.findCreditSummaryRule({
  organizationId,
  studentId: input.studentId,
});
        }

        /**
 * 기존 학점요약 계산결과.
 *
 * 현재 StudentCreditSummaryPage가 아직
 * 기존 summary.categories / alerts 구조를 사용하고 있으므로
 * 공통엔진 화면 전환이 끝날 때까지 유지한다.
 *
 * 이후 AI 학점요약 UI가 공통엔진 결과로 완전히 전환되면
 * buildCreditSummaryResult 및 수동 Rule 구조를 단계적으로 제거한다.
 */
const legacySummary =
  buildCreditSummaryResult({
    student,
    plan,
    rule,
    planSemesters,
    transferSubjects,
    extraItems,
  });

/**
 * ─────────────────────────────
 * AI 학점요약 공통엔진
 * ─────────────────────────────
 *
 * 학생 상세페이지의 원본 데이터를 기준으로
 *
 * - 학점
 * - 인정과목
 * - 자격요건
 * - 학위요건
 * - 남은과목
 * - 학기계획
 * - 행정절차
 * - 실습
 * - 위험도
 * - 종합 학업요약
 *
 * 을 공통엔진에서 다시 계산한다.
 *
 * 중요한 원칙:
 *
 * 상세페이지 = 사람이 관리하는 원본
 * AI 학점요약 = 원본을 읽어 자동 분석하는 영역
 *
 * 여기서는 상세페이지 원본을 수정하지 않는다.
 */
const aiContext =
  await buildAiContext({
    user:
      ctx.user,

    /**
     * 일반 직원은 buildAiContext 내부에서
     * 자신의 organizationId로 고정된다.
     *
     * Superhost인 경우 현재 CRM에서 선택된
     * organizationId를 분석 대상으로 사용한다.
     */
    targetOrganizationId:
      organizationId,
  });

const engine =
  await analyzeStudentDetailRisk({
    context:
      aiContext,

    studentId:
      input.studentId,
  });

return {
  /**
   * 기존 화면 호환용 데이터.
   */
  student,
  plan,
  rule,
  planSemesters,
  transferSubjects,
  extraItems,

  /**
   * 기존 StudentCreditSummaryPage가 사용하는 값.
   *
   * 프론트 전환 완료 전까지 유지한다.
   */
  summary:
    legacySummary,

  /**
   * 신규 AI 학점요약 공통엔진 결과.
   *
   * 이후 학점요약 페이지 / 등록자 AI /
   * 담당자 AI 모두 이 결과를 공통으로 사용한다.
   */
  engine,

  /**
   * 프론트와 다른 AI Tool에서 자주 사용하는 값을
   * 최상위에서도 바로 접근할 수 있도록 제공한다.
   */
  academicSummary:
    engine.academicSummary,

  requirements:
    engine.requirements,

  subjectPlan:
    engine.subjectPlan,

  semesterPlan:
    engine.semesterPlan,

  administrativeTimeline:
    engine.administrativeTimeline,

/**
 * 실제 행정절차 진행상태.
 *
 * administrativeTimeline:
 * 공통엔진이 계산한 예상 일정
 *
 * administrativeProcedures:
 * 담당자 / 카카오 AI / 시스템 AI가
 * 확인한 실제 진행상태
 */
administrativeProcedures,

/**
 * AI 학습관리 기록.
 *
 * aiNotes:
 * 의미 있는 학생 관리 메모
 *
 * aiEvents:
 * 담당자 확인용 업데이트 이벤트
 *
 * unreadAiEventCount:
 * "AI 업데이트 N" 배지 숫자
 */
aiNotes,

aiEvents,

unreadAiEventCount,

  issues:
    engine.issues,

  riskSummary:
    engine.summary,
};
      }),

    createItem: protectedProcedure
      .input(
        z.object({
          studentId: z.number(),
          sourceType: z
            .enum(["manual", "transfer", "certificate", "exam", "recognized", "etc"])
            .optional(),
          subjectName: z.string().optional().nullable(),
          institutionName: z.string().optional().nullable(),
          semesterLabel: z.string().optional().nullable(),
          category: z.enum(["전공", "교양", "일반"]),
          requirementType: z.enum(["전공필수", "전공선택", "교양", "일반"]),
          credits: z.number().min(0).max(100),
          isCompleted: z.boolean().optional(),
          isExcluded: z.boolean().optional(),
          memo: z.string().optional().nullable(),
          sortOrder: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const organizationId = getCtxOrganizationId(ctx);

        const student = await db.getStudent(input.studentId, {
          organizationId,
        });

        if (!student) {
          throwAppError(
            ERROR_CODES.DATA_NOT_FOUND,
            "학생을 찾을 수 없습니다.",
            404
          );
        }

        assertStudentEditable({
          currentUser: ctx.user,
          student,
        });

        const id = await db.createStudentCreditSummaryItem({
          organizationId,
          studentId: input.studentId,
          sourceType: input.sourceType ?? "manual",
          subjectName: input.subjectName?.trim() || null,
          institutionName: input.institutionName?.trim() || null,
          semesterLabel: input.semesterLabel?.trim() || null,
          category: input.category,
          requirementType: input.requirementType,
          credits: input.credits,
          isCompleted: input.isCompleted ?? true,
          isExcluded: input.isExcluded ?? false,
          memo: input.memo?.trim() || null,
          sortOrder: input.sortOrder ?? 0,
          createdBy: Number(ctx.user.id),
          updatedBy: Number(ctx.user.id),
        } as any);

        return { success: true, id };
      }),

    updateItem: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          studentId: z.number(),

          sourceType: z
            .enum(["manual", "transfer", "certificate", "exam", "recognized", "etc"])
            .optional(),
          subjectName: z.string().optional().nullable(),
          institutionName: z.string().optional().nullable(),
          semesterLabel: z.string().optional().nullable(),
          category: z.enum(["전공", "교양", "일반"]).optional(),
          requirementType: z.enum(["전공필수", "전공선택", "교양", "일반"]).optional(),
          credits: z.number().min(0).max(100).optional(),
          isCompleted: z.boolean().optional(),
          isExcluded: z.boolean().optional(),
          memo: z.string().optional().nullable(),
          sortOrder: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const organizationId = getCtxOrganizationId(ctx);

        const student = await db.getStudent(input.studentId, {
          organizationId,
        });

        if (!student) {
          throwAppError(
            ERROR_CODES.DATA_NOT_FOUND,
            "학생을 찾을 수 없습니다.",
            404
          );
        }

        assertStudentEditable({
          currentUser: ctx.user,
          student,
        });

        const beforeItem = await db.getStudentCreditSummaryItemById({
          id: input.id,
          organizationId,
        });

        if (!beforeItem || Number(beforeItem.studentId) !== Number(input.studentId)) {
          throwAppError(
            ERROR_CODES.DATA_NOT_FOUND,
            "요약 추가 과목을 찾을 수 없습니다.",
            404
          );
        }

        const data: any = {
          updatedBy: Number(ctx.user.id),
        };

        if (input.sourceType !== undefined) data.sourceType = input.sourceType;
        if (input.subjectName !== undefined)
          data.subjectName = input.subjectName?.trim() || null;
        if (input.institutionName !== undefined)
          data.institutionName = input.institutionName?.trim() || null;
        if (input.semesterLabel !== undefined)
          data.semesterLabel = input.semesterLabel?.trim() || null;
        if (input.category !== undefined) data.category = input.category;
        if (input.requirementType !== undefined)
          data.requirementType = input.requirementType;
        if (input.credits !== undefined) data.credits = input.credits;
        if (input.isCompleted !== undefined) data.isCompleted = input.isCompleted;
        if (input.isExcluded !== undefined) data.isExcluded = input.isExcluded;
        if (input.memo !== undefined) data.memo = input.memo?.trim() || null;
        if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;

        const updated = await db.updateStudentCreditSummaryItem(input.id, data, {
          organizationId,
        });

        return { success: true, data: updated };
      }),

    deleteItem: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          studentId: z.number(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const organizationId = getCtxOrganizationId(ctx);

        const student = await db.getStudent(input.studentId, {
          organizationId,
        });

        if (!student) {
          throwAppError(
            ERROR_CODES.DATA_NOT_FOUND,
            "학생을 찾을 수 없습니다.",
            404
          );
        }

        assertStudentEditable({
          currentUser: ctx.user,
          student,
        });

        const beforeItem = await db.getStudentCreditSummaryItemById({
          id: input.id,
          organizationId,
        });

        if (!beforeItem || Number(beforeItem.studentId) !== Number(input.studentId)) {
          throwAppError(
            ERROR_CODES.DATA_NOT_FOUND,
            "요약 추가 과목을 찾을 수 없습니다.",
            404
          );
        }

        await db.deleteStudentCreditSummaryItem({
          id: input.id,
          organizationId,
        });

        return { success: true };
      }),
  }),
}),

  privateCertificate: router({
    list: protectedProcedure
      .input(
        z
          .object({
            assigneeId: z.number().optional(),
          })
          .optional()
      )
     .query(async ({ ctx, input }) => {
  const organizationId = getCtxOrganizationId(ctx);

  await assertOrganizationFeatureEnabled(
    organizationId,
    "allowPrivateCertificate",
    "현재 회사는 민간자격증 기능을 사용할 수 없습니다."
  );

  const assigneeId = isAdminOrHost(ctx.user)
  ? input?.assigneeId
  : Number(ctx.user.id);

  const rows = await db.listPrivateCertificateRequests(assigneeId, {
  organizationId,
});

return isSuperhost(ctx.user) ? maskPersonalDataList(rows as any[]) : rows;
}),

    listByStudent: protectedProcedure
      .input(
        z.object({
          studentId: z.number(),
        })
      )
      .query(async ({ ctx, input }) => {
  const organizationId = getCtxOrganizationId(ctx);

  await assertOrganizationFeatureEnabled(
    organizationId,
    "allowPrivateCertificate",
    "현재 회사는 민간자격증 기능을 사용할 수 없습니다."
  );

  const student = await db.getStudent(input.studentId, {
    organizationId,
  });
        if (!student) return [];
        const rows = await db.listPrivateCertificateRequestsByStudent(input.studentId, {
  organizationId,
});

return isSuperhost(ctx.user) ? maskPersonalDataList(rows as any[]) : rows;
      }),

    create: protectedProcedure
      .input(
        z.object({
          studentId: z.number(),
          assigneeId: z.number(),
          clientName: z.string().min(1),
          phone: z.string().min(1),
          assigneeName: z.string().optional().nullable(),
          privateCertificateMasterId: z.number().optional().nullable(),
          certificateName: z.string().min(1),
          inputAddress: z.string().optional().nullable(),
          note: z.string().optional().nullable(),
          requestStatus: z
            .enum(["요청", "안내완료", "입금대기", "입금확인", "진행중", "완료", "취소"])
            .optional(),
          feeAmount: z.string().optional(),
	freelancerInputAmount: z.string().optional(),
          paymentStatus: z.enum(["결제대기", "결제", "환불", "취소"]).optional(),
          paidAt: z.string().optional().nullable(),
          attachmentName: z.string().optional().nullable(),
          attachmentUrl: z.string().optional().nullable(),
        })
      )
      .mutation(async ({ ctx, input }) => {
  const organizationId = getCtxOrganizationId(ctx);

  await assertOrganizationFeatureEnabled(
    organizationId,
    "allowPrivateCertificate",
    "현재 회사는 민간자격증 기능을 사용할 수 없습니다."
  );

  const student = await db.getStudent(input.studentId, {
    organizationId,
  });
        if (!student) throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "학생을 찾을 수 없습니다.",
  404
);

        assertStudentEditable({
  currentUser: ctx.user,
  student,
});

          const id = await db.createPrivateCertificateRequest({
 organizationId,
          studentId: input.studentId,
          assigneeId: input.assigneeId,
          clientName: input.clientName.trim(),
          phone: input.phone.trim(),
          assigneeName: input.assigneeName?.trim() || null,
          privateCertificateMasterId: input.privateCertificateMasterId ?? null,
          certificateName: input.certificateName.trim(),
          inputAddress: input.inputAddress?.trim() || null,
          note: input.note ?? null,
          requestStatus: input.requestStatus ?? "요청",
          feeAmount: input.feeAmount ?? "0",
          freelancerInputAmount: input.freelancerInputAmount ?? "0",
          paymentStatus: input.paymentStatus ?? "결제대기",
          paidAt: input.paidAt ? new Date(input.paidAt) : null,
          attachmentName: input.attachmentName?.trim() || null,
          attachmentUrl: input.attachmentUrl?.trim() || null,
        } as any);

const createdRequest = await db.getPrivateCertificateRequest(Number(id), {
  organizationId,
});

await writeStudentAuditLog({
  ctx,
  studentId: Number(input.studentId),
  entityType: "private_certificate",
  entityId: Number(id),
  action: "create",
  title: "민간자격증 요청 생성",
  beforeJson: null,
  afterJson: createdRequest,
});

        return { success: true, id };
      }),

    createExternal: protectedProcedure
      .input(
        z.object({
          assigneeId:
            z.number()
              .int()
              .positive(),

          clientName:
            z.string()
              .trim()
              .min(
                1,
                "이름을 입력해주세요."
              )
              .max(100),

          phone:
            z.string()
              .trim()
              .min(
                1,
                "연락처를 입력해주세요."
              )
              .max(30),

          privateCertificateMasterId:
            z.number()
              .int()
              .positive()
              .optional()
              .nullable(),

          certificateName:
            z.string()
              .trim()
              .max(255)
              .optional()
              .nullable(),

          inputAddress:
            z.string()
              .trim()
              .max(500)
              .optional()
              .nullable(),

          detailAddress:
            z.string()
              .trim()
              .max(500)
              .optional()
              .nullable(),

          note:
            z.string()
              .max(5000)
              .optional()
              .nullable(),

          requestStatus:
            z.enum([
              "요청",
              "안내완료",
              "입금대기",
              "입금확인",
              "진행중",
              "완료",
              "취소",
            ])
              .optional(),

          feeAmount:
            z.string()
              .optional(),

          freelancerInputAmount:
            z.string()
              .optional(),

          paymentStatus:
            z.enum([
              "결제대기",
              "결제",
              "환불",
              "취소",
            ])
              .optional(),

          paidAt:
            z.string()
              .optional()
              .nullable(),

          attachmentName:
            z.string()
              .optional()
              .nullable(),

          attachmentUrl:
            z.string()
              .optional()
              .nullable(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const organizationId =
          getCtxOrganizationId(ctx);

        await assertOrganizationFeatureEnabled(
          organizationId,
          "allowPrivateCertificate",
          "현재 회사는 민간자격증 기능을 사용할 수 없습니다."
        );

        const assignee =
          await getExternalRequestAssignee({
            currentUser: ctx.user,
            organizationId,
            assigneeId:
              input.assigneeId,
          });

        const normalizedPhone =
          input.phone.replace(
            /\D/g,
            ""
          );

        if (
          normalizedPhone.length < 10 ||
          normalizedPhone.length > 11
        ) {
          throwAppError(
            ERROR_CODES.INVALID_REQUEST,
            "올바른 연락처를 입력해주세요.",
            400
          );
        }

        const id =
          await db.createPrivateCertificateExternalRequest({
            organizationId,

            assigneeId:
              Number(assignee.id),

            createdBy:
              Number(ctx.user.id),

            updatedBy:
              Number(ctx.user.id),

            clientName:
              input.clientName.trim(),

            phone:
              normalizedPhone,

            assigneeName:
              String(
                assignee.name || ""
              ).trim() || null,

            privateCertificateMasterId:
              input.privateCertificateMasterId ??
              null,

            certificateName:
              input.certificateName?.trim() ||
              null,

            inputAddress:
              input.inputAddress?.trim() ||
              null,

            detailAddress:
              input.detailAddress?.trim() ||
              null,

            note:
              input.note?.trim() ||
              null,

            requestStatus:
              input.requestStatus ??
              "요청",

            feeAmount:
              input.feeAmount ??
              "0",

            freelancerInputAmount:
              input.freelancerInputAmount ??
              "0",

            paymentStatus:
              input.paymentStatus ??
              "결제대기",

            paidAt:
              input.paidAt
                ? new Date(
                    input.paidAt
                  )
                : null,

            refundStatus:
              "없음",

            refundAmount:
              "0",

            attachmentName:
              input.attachmentName?.trim() ||
              null,

            attachmentUrl:
              input.attachmentUrl?.trim() ||
              null,
          } as any);

                return {
          success: true,
          id: Number(id),
          sourceType:
            "external" as const,
        };
      }),

    addCertificate:
      protectedProcedure
        .input(
          z.object({
            id:
              z.number()
                .int()
                .positive(),

            sourceType:
              z.enum([
                "student",
                "external",
              ]),

            privateCertificateMasterId:
              z.number()
                .int()
                .positive(),

            certificateName:
              z.string()
                .trim()
                .min(
                  1,
                  "자격증명을 선택해주세요."
                )
                .max(255),
          })
        )
        .mutation(
          async ({
            ctx,
            input,
          }) => {
            const organizationId =
              getCtxOrganizationId(
                ctx
              );

            await assertOrganizationFeatureEnabled(
              organizationId,
              "allowPrivateCertificate",
              "현재 회사는 민간자격증 기능을 사용할 수 없습니다."
            );

            if (
              !isAdminOrHost(
                ctx.user
              )
            ) {
              throwAppError(
                ERROR_CODES.PERMISSION_DENIED,
                "관리자 또는 호스트만 민간자격증 과정을 추가할 수 있습니다.",
                403
              );
            }

            if (
              input.sourceType ===
              "external"
            ) {
              const beforeRequest =
                await db.getPrivateCertificateExternalRequest(
                  input.id,
                  {
                    organizationId,
                  }
                );

              if (!beforeRequest) {
                throwAppError(
                  ERROR_CODES.DATA_NOT_FOUND,
                  "기존 민간자격증 요청을 찾을 수 없습니다.",
                  404
                );
              }

              assertExternalRequestEditable({
                currentUser:
                  ctx.user,
              });
            } else {
              const beforeRequest =
                await db.getPrivateCertificateRequest(
                  input.id,
                  {
                    organizationId,
                  }
                );

              if (!beforeRequest) {
                throwAppError(
                  ERROR_CODES.DATA_NOT_FOUND,
                  "기존 민간자격증 요청을 찾을 수 없습니다.",
                  404
                );
              }

              const student =
                await db.getStudent(
                  beforeRequest.studentId,
                  {
                    organizationId,
                  }
                );

              if (!student) {
                throwAppError(
                  ERROR_CODES.DATA_NOT_FOUND,
                  "학생을 찾을 수 없습니다.",
                  404
                );
              }

              assertStudentEditable({
                currentUser:
                  ctx.user,

                student,
              });
            }

            const result =
              await db.addPrivateCertificateToExistingRequest({
                organizationId,

                requestId:
                  input.id,

                sourceType:
                  input.sourceType,

                privateCertificateMasterId:
                  input.privateCertificateMasterId,

                certificateName:
                  input.certificateName,

                actorUserId:
                  Number(
                    ctx.user.id
                  ),
              });

            if (
              input.sourceType ===
              "student"
            ) {
              const createdRequest =
                await db.getPrivateCertificateRequest(
                  Number(
                    result.id
                  ),
                  {
                    organizationId,
                  }
                );

              const originalRequest =
                await db.getPrivateCertificateRequest(
                  input.id,
                  {
                    organizationId,
                  }
                );

              if (
                originalRequest
              ) {
                await writeStudentAuditLog({
                  ctx,

                  studentId:
                    Number(
                      originalRequest.studentId
                    ),

                  entityType:
                    "private_certificate",

                  entityId:
                    Number(
                      result.id
                    ),

                  action:
                    "create",

                  title:
                    "민간자격증 과정 추가",

                  beforeJson:
                    null,

                  afterJson:
                    createdRequest,
                });
              }
            }

            return {
              success:
                true,

              id:
                Number(
                  result.id
                ),

              sourceType:
                result.sourceType,
            };
          }
        ),

        update: protectedProcedure
      .input(
        z.object({
          id:
            z.number()
              .int()
              .positive(),

          sourceType:
            z.enum([
              "student",
              "external",
            ])
              .optional()
              .default("student"),

          assigneeId:
            z.number()
              .int()
              .positive()
              .optional(),

          assigneeName:
            z.string()
              .optional()
              .nullable(),

          privateCertificateMasterId:
            z.number()
              .optional()
              .nullable(),

          certificateName:
            z.string()
              .optional()
              .nullable(),

          inputAddress:
            z.string()
              .optional()
              .nullable(),

          detailAddress:
            z.string()
              .optional()
              .nullable(),

          note:
            z.string()
              .optional()
              .nullable(),

          requestStatus:
            z.enum([
              "요청",
              "안내완료",
              "입금대기",
              "입금확인",
              "진행중",
              "완료",
              "취소",
            ])
              .optional(),

          feeAmount:
            z.string()
              .optional(),

          freelancerInputAmount:
            z.string()
              .optional(),

          paymentStatus:
            z.enum([
              "결제대기",
              "결제",
              "환불",
              "취소",
            ])
              .optional(),

          paidAt:
            z.string()
              .optional()
              .nullable(),

          attachmentName:
            z.string()
              .optional()
              .nullable(),

          attachmentUrl:
            z.string()
              .optional()
              .nullable(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const organizationId =
          getCtxOrganizationId(ctx);

        await assertOrganizationFeatureEnabled(
          organizationId,
          "allowPrivateCertificate",
          "현재 회사는 민간자격증 기능을 사용할 수 없습니다."
        );

                const data: any = {};

        if (
          input.assigneeId !==
          undefined
        ) {
          /**
           * 단독 직접등록 건의 담당자 변경은
           * Admin 또는 Host만 가능하며
           * 서버에서 회사·팀 범위를 다시 검사한다.
           */
          if (
            input.sourceType ===
            "external"
          ) {
            const assignee =
              await getExternalRequestAssignee({
                currentUser:
                  ctx.user,

                organizationId,

                assigneeId:
                  input.assigneeId,
              });

            data.assigneeId =
              Number(assignee.id);

            data.assigneeName =
              String(
                assignee.name || ""
              ).trim() || null;
          } else {
            /**
             * 기존 학생 연동 요청은
             * 기존 동작을 유지한다.
             *
             * 담당 Staff가 수정할 때 프론트에서
             * 기존 assigneeId를 함께 보내더라도
             * 신규등록 전용 권한검사를 적용하지 않는다.
             */
            data.assigneeId =
              Number(
                input.assigneeId
              );
          }
        }

        if (
          input.assigneeName !==
          undefined &&
          !(
            input.sourceType ===
              "external" &&
            input.assigneeId !==
              undefined
          )
        ) {
          data.assigneeName =
            input.assigneeName?.trim() ||
            null;
        }

        if (
          input.privateCertificateMasterId !==
          undefined
        ) {
          data.privateCertificateMasterId =
            input.privateCertificateMasterId ??
            null;
        }

        if (
          input.certificateName !==
          undefined
        ) {
          data.certificateName =
            input.certificateName?.trim() ||
            null;
        }

        if (
          input.inputAddress !==
          undefined
        ) {
          data.inputAddress =
            input.inputAddress?.trim() ||
            null;
        }

        if (
          input.detailAddress !==
          undefined
        ) {
          data.detailAddress =
            input.detailAddress?.trim() ||
            null;
        }

        if (
          input.note !==
          undefined
        ) {
          data.note =
            input.note?.trim() ||
            null;
        }

        if (
          input.requestStatus !==
          undefined
        ) {
          data.requestStatus =
            input.requestStatus;
        }

        if (
          input.feeAmount !==
          undefined
        ) {
          data.feeAmount =
            input.feeAmount;
        }

        if (
          input.freelancerInputAmount !==
          undefined
        ) {
          data.freelancerInputAmount =
            input.freelancerInputAmount;
        }

        if (
          input.paymentStatus !==
          undefined
        ) {
          data.paymentStatus =
            input.paymentStatus;
        }

        if (
          input.paidAt !==
          undefined
        ) {
          data.paidAt =
            input.paidAt
              ? new Date(
                  input.paidAt
                )
              : null;
        }

        if (
          input.attachmentName !==
          undefined
        ) {
          data.attachmentName =
            input.attachmentName?.trim() ||
            null;
        }

        if (
          input.attachmentUrl !==
          undefined
        ) {
          data.attachmentUrl =
            input.attachmentUrl?.trim() ||
            null;
        }

        if (
          Object.keys(data).length ===
          0
        ) {
          throwAppError(
            ERROR_CODES.INVALID_REQUEST,
            "수정할 값이 없습니다.",
            400
          );
        }

        /**
         * 단독 직접등록 데이터
         */
        if (
          input.sourceType ===
          "external"
        ) {
          const beforeRequest =
            await db.getPrivateCertificateExternalRequest(
              input.id,
              {
                organizationId,
              }
            );

          if (!beforeRequest) {
            throwAppError(
              ERROR_CODES.DATA_NOT_FOUND,
              "민간자격증 요청을 찾을 수 없습니다.",
              404
            );
          }

          assertExternalRequestEditable({
  currentUser:
    ctx.user,
});

          data.updatedBy =
            Number(ctx.user.id);

          await db.updatePrivateCertificateExternalRequest(
            input.id,
            data,
            {
              organizationId,
            }
          );

          return {
            success: true,
            sourceType:
              "external" as const,
          };
        }

        /**
         * 기존 학생 연동 데이터
         */
        const beforeRequest =
          await db.getPrivateCertificateRequest(
            input.id,
            {
              organizationId,
            }
          );

        if (!beforeRequest) {
          throwAppError(
            ERROR_CODES.DATA_NOT_FOUND,
            "민간자격증 요청을 찾을 수 없습니다.",
            404
          );
        }

        const student =
          await db.getStudent(
            beforeRequest.studentId,
            {
              organizationId,
            }
          );

        if (!student) {
          throwAppError(
            ERROR_CODES.DATA_NOT_FOUND,
            "학생을 찾을 수 없습니다.",
            404
          );
        }

        assertStudentEditable({
          currentUser:
            ctx.user,
          student,
        });

        /**
         * 기존 테이블에는 detailAddress가 없을 수 있으므로 제외
         */
        delete data.detailAddress;
        delete data.updatedBy;

        await db.updatePrivateCertificateRequest(
          input.id,
          data,
          {
            organizationId,
          }
        );

        const afterRequest =
          await db.getPrivateCertificateRequest(
            input.id,
            {
              organizationId,
            }
          );

        await writeStudentAuditLog({
          ctx,

          studentId:
            Number(student.id),

          entityType:
            "private_certificate",

          entityId:
            Number(input.id),

          action:
            "update",

          title:
            "민간자격증 요청 수정",

          beforeJson:
            beforeRequest,

          afterJson:
            afterRequest,
        });

        return {
          success: true,
          sourceType:
            "student" as const,
        };
      }),

        delete: protectedProcedure
      .input(
        z.object({
          id:
            z.number()
              .int()
              .positive(),

          sourceType:
            z.enum([
              "student",
              "external",
            ])
              .optional()
              .default("student"),
        })
      )
      .mutation(async ({
        input,
        ctx,
      }) => {
        const organizationId =
          getCtxOrganizationId(ctx);

        await assertOrganizationFeatureEnabled(
          organizationId,
          "allowPrivateCertificate",
          "현재 회사는 민간자격증 기능을 사용할 수 없습니다."
        );

        if (
          input.sourceType ===
          "external"
        ) {
          const beforeRequest =
            await db.getPrivateCertificateExternalRequest(
              input.id,
              {
                organizationId,
              }
            );

          if (!beforeRequest) {
            throwAppError(
              ERROR_CODES.DATA_NOT_FOUND,
              "민간자격증 요청을 찾을 수 없습니다.",
              404
            );
          }

          assertExternalRequestEditable({
  currentUser:
    ctx.user,
});

          await db.deletePrivateCertificateExternalRequest(
            input.id,
            {
              organizationId,
            }
          );

          return {
            success: true,
            sourceType:
              "external" as const,
          };
        }

        const beforeRequest =
          await db.getPrivateCertificateRequest(
            input.id,
            {
              organizationId,
            }
          );

        if (!beforeRequest) {
          throwAppError(
            ERROR_CODES.DATA_NOT_FOUND,
            "민간자격증 요청을 찾을 수 없습니다.",
            404
          );
        }

        const student =
          await db.getStudent(
            beforeRequest.studentId,
            {
              organizationId,
            }
          );

        if (!student) {
          throwAppError(
            ERROR_CODES.DATA_NOT_FOUND,
            "학생을 찾을 수 없습니다.",
            404
          );
        }

        assertStudentEditable({
          currentUser:
            ctx.user,
          student,
        });

        await db.deletePrivateCertificateRequest(
          input.id,
          {
            organizationId,
          }
        );

        await writeStudentAuditLog({
          ctx,

          studentId:
            Number(student.id),

          entityType:
            "private_certificate",

          entityId:
            Number(input.id),

          action:
            "delete",

          title:
            "민간자격증 요청 삭제",

          beforeJson:
            beforeRequest,

          afterJson:
            null,
        });

        return {
          success: true,
          sourceType:
            "student" as const,
        };
      }),


    requestRefund: protectedProcedure
      .input(
        z.object({
          requestId: z.number(),
          refundAmount: z.string(),
          refundReason: z.string().optional().nullable(),
        })
      )
     .mutation(async ({ ctx, input }) => {
  const organizationId = getCtxOrganizationId(ctx);

  await assertOrganizationFeatureEnabled(
    organizationId,
    "allowPrivateCertificate",
    "현재 회사는 민간자격증 기능을 사용할 수 없습니다."
  );

  await db.requestPrivateCertificateRefund({
    organizationId,
          requestId: input.requestId,
          refundAmount: input.refundAmount,
          refundReason: input.refundReason ?? null,
        });

        return { success: true };
      }),

    approveRefund: protectedProcedure
      .input(
        z.object({
          requestId: z.number(),
        })
      )
      .mutation(async ({ ctx, input }) => {
  const organizationId = getCtxOrganizationId(ctx);

  await assertOrganizationFeatureEnabled(
    organizationId,
    "allowPrivateCertificate",
    "현재 회사는 민간자격증 기능을 사용할 수 없습니다."
  );

  if (!isAdminOrHost(ctx.user)) {
    throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "관리자 또는 호스트만 환불 승인할 수 있습니다.",
  403
);
  }

  await db.approvePrivateCertificateRefund({
    organizationId,
          requestId: input.requestId,
          approvedBy: Number(ctx.user.id),
        });

        return { success: true };
      }),
  }),

  practiceSupport: router({
    list: protectedProcedure
  .input(
    z
      .object({
        assigneeId: z.number().optional(),
        month: z.string().optional(),
        status: z.enum(["전체", "미섭외", "섭외중", "섭외완료"]).optional(),
        search: z.string().optional(),
      })
      .optional()
  )
  .query(async ({ ctx, input }) => {
  const organizationId = getCtxOrganizationId(ctx);

  await assertOrganizationFeatureEnabled(
    organizationId,
    "allowPracticeCenter",
    "현재 회사는 실습배정지원센터 기능을 사용할 수 없습니다."
  );

  const assigneeId = isPracticeSupportManager(ctx.user)
  ? input?.assigneeId
  : Number(ctx.user.id);

  const rows = await db.listPracticeSupportRequests({
  organizationId,
  assigneeId,
  month: input?.month,
  status: input?.status,
  search: input?.search,
});

return isSuperhost(ctx.user) ? maskPersonalDataList(rows as any[]) : rows;
  }),

    listByStudent: protectedProcedure
      .input(
        z.object({
          studentId: z.number(),
        })
      )
      .query(async ({ ctx, input }) => {
  const organizationId = getCtxOrganizationId(ctx);

  await assertOrganizationFeatureEnabled(
    organizationId,
    "allowPracticeCenter",
    "현재 회사는 실습배정지원센터 기능을 사용할 수 없습니다."
  );

  const student = await db.getStudent(input.studentId, {
    organizationId,
  });
        if (!student) return [];
       const rows = await db.listPracticeSupportRequestsByStudent(input.studentId, {
  organizationId,
});

return isSuperhost(ctx.user) ? maskPersonalDataList(rows as any[]) : rows;
      }),

        get: protectedProcedure
      .input(
        z.object({
          id:
            z.number()
              .int()
              .positive(),

          sourceType:
            z.enum([
              "student",
              "external",
            ])
              .optional()
              .default("student"),
        })
      )
      .query(async ({
        input,
        ctx,
      }) => {
        const organizationId =
          getCtxOrganizationId(ctx);

        await assertOrganizationFeatureEnabled(
          organizationId,
          "allowPracticeCenter",
          "현재 회사는 실습배정지원센터 기능을 사용할 수 없습니다."
        );

        const row =
          input.sourceType ===
          "external"
            ? await db.getPracticeSupportExternalRequest(
                input.id,
                {
                  organizationId,
                }
              )
            : await db.getPracticeSupportRequest(
                input.id,
                {
                  organizationId,
                }
              );

        return isSuperhost(ctx.user) &&
          row
          ? maskPersonalData(
              row as any
            )
          : row;
      }),

    create: protectedProcedure
      .input(
        z.object({
          studentId: z.number(),
          semesterId: z.number().optional().nullable(),
          assigneeId: z.number(),
          clientName: z.string().min(1),
          phone: z.string().min(1),
          assigneeName: z.string().optional().nullable(),
          managerName: z.string().optional().nullable(),
          course: z.string().min(1),
         inputAddress: z.string().optional().nullable(),
detailAddress: z.string().optional().nullable(),
practiceSemesterLabel: z.string().max(50).optional().nullable(),
practiceHours: z.number().optional().nullable(),
practiceDate: z.string().optional().nullable(),
includeEducationCenter: z.boolean().optional(),
          includePracticeInstitution: z.boolean().optional(),
          coordinationStatus: z.enum(["미섭외", "섭외중", "섭외완료"]).optional(),
          feeAmount: z.string().optional(),
          paymentStatus: z.enum(["미결제", "결제", "환불"]).optional(),
          paidAt: z.string().optional().nullable(),
          note: z.string().optional().nullable(),
          attachmentName: z.string().optional().nullable(),
          attachmentUrl: z.string().optional().nullable(),
        })
      )
      .mutation(async ({ ctx, input }) => {
  const organizationId = getCtxOrganizationId(ctx);

  await assertOrganizationFeatureEnabled(
    organizationId,
    "allowPracticeCenter",
    "현재 회사는 실습배정지원센터 기능을 사용할 수 없습니다."
  );

  const student = await db.getStudent(input.studentId, {
    organizationId,
  });

        if (!student) throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "학생을 찾을 수 없습니다.",
  404
);

        assertStudentEditable({
  currentUser: ctx.user,
  student,
});

         const id = await db.createPracticeSupportRequest({
  organizationId,
  studentId: input.studentId,
          semesterId: input.semesterId ?? null,
          assigneeId: input.assigneeId,
          clientName: input.clientName.trim(),
          phone: input.phone.trim(),
          assigneeName: input.assigneeName?.trim() || null,
          managerName: input.managerName?.trim() || null,
          course: input.course.trim(),
          inputAddress: input.inputAddress?.trim() || null,
detailAddress: input.detailAddress?.trim() || null,
practiceSemesterLabel:
  input.practiceSemesterLabel?.trim() || null,
practiceHours: input.practiceHours ?? null,
practiceDate: input.practiceDate ?? null,
includeEducationCenter: input.includeEducationCenter ?? true,
          includePracticeInstitution: input.includePracticeInstitution ?? true,
          coordinationStatus: input.coordinationStatus ?? "미섭외",
          feeAmount: input.feeAmount ?? "0",
          paymentStatus: input.paymentStatus ?? "미결제",
          paidAt: input.paidAt ? new Date(input.paidAt) : null,
          note: input.note ?? null,
          attachmentName: input.attachmentName?.trim() || null,
          attachmentUrl: input.attachmentUrl?.trim() || null,
        } as any);

const createdRequest = await db.getPracticeSupportRequest(Number(id), {
  organizationId,
});

await writeStudentAuditLog({
  ctx,
  studentId: Number(input.studentId),
  entityType: "practice_support",
  entityId: Number(id),
  action: "create",
  title: "실습 요청 생성",
  beforeJson: null,
  afterJson: createdRequest,
});

        return { success: true, id };
      }),

    createExternal: protectedProcedure
      .input(
        z.object({
          assigneeId:
            z.number()
              .int()
              .positive(),

          clientName:
            z.string()
              .trim()
              .min(
                1,
                "이름을 입력해주세요."
              )
              .max(100),

          phone:
            z.string()
              .trim()
              .min(
                1,
                "연락처를 입력해주세요."
              )
              .max(30),

          course:
            z.string()
              .trim()
              .max(200)
              .optional()
              .nullable(),

          inputAddress:
            z.string()
              .trim()
              .max(500)
              .optional()
              .nullable(),

          detailAddress:
            z.string()
              .trim()
              .max(500)
              .optional()
              .nullable(),

          practiceSemesterLabel:
            z.string()
              .trim()
              .max(50)
              .optional()
              .nullable(),

          practiceHours:
            z.number()
              .int()
              .min(0)
              .optional()
              .nullable(),

          practiceDate:
            z.string()
              .optional()
              .nullable(),

          includeEducationCenter:
            z.boolean()
              .optional(),

          includePracticeInstitution:
            z.boolean()
              .optional(),

          coordinationStatus:
            z.enum([
              "미섭외",
              "섭외중",
              "섭외완료",
            ])
              .optional(),

          feeAmount:
            z.string()
              .optional(),

          paymentStatus:
            z.enum([
              "미결제",
              "결제",
              "환불",
            ])
              .optional(),

          paidAt:
            z.string()
              .optional()
              .nullable(),

          note:
            z.string()
              .max(5000)
              .optional()
              .nullable(),

          attachmentName:
            z.string()
              .optional()
              .nullable(),

          attachmentUrl:
            z.string()
              .optional()
              .nullable(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const organizationId =
          getCtxOrganizationId(ctx);

        await assertOrganizationFeatureEnabled(
          organizationId,
          "allowPracticeCenter",
          "현재 회사는 실습배정지원센터 기능을 사용할 수 없습니다."
        );

        const assignee =
          await getExternalRequestAssignee({
            currentUser:
              ctx.user,

            organizationId,

            assigneeId:
              input.assigneeId,
          });

        const normalizedPhone =
          input.phone.replace(
            /\D/g,
            ""
          );

        if (
          normalizedPhone.length < 10 ||
          normalizedPhone.length > 11
        ) {
          throwAppError(
            ERROR_CODES.INVALID_REQUEST,
            "올바른 연락처를 입력해주세요.",
            400
          );
        }

        const id =
          await db.createPracticeSupportExternalRequest({
            organizationId,

            assigneeId:
              Number(assignee.id),

            createdBy:
              Number(ctx.user.id),

            updatedBy:
              Number(ctx.user.id),

            clientName:
              input.clientName.trim(),

            phone:
              normalizedPhone,

            assigneeName:
              String(
                assignee.name || ""
              ).trim() || null,

            managerName:
              null,

            course:
              input.course?.trim() ||
              null,

            inputAddress:
              input.inputAddress?.trim() ||
              null,

            detailAddress:
              input.detailAddress?.trim() ||
              null,

            practiceSemesterLabel:
              input.practiceSemesterLabel?.trim() ||
              null,

            practiceHours:
              input.practiceHours ??
              null,

            practiceDate:
              input.practiceDate?.trim() ||
              null,

            includeEducationCenter:
              input.includeEducationCenter ??
              true,

            includePracticeInstitution:
              input.includePracticeInstitution ??
              true,

            coordinationStatus:
              input.coordinationStatus ??
              "미섭외",

            feeAmount:
              input.feeAmount ??
              "0",

            paymentStatus:
              input.paymentStatus ??
              "미결제",

            paidAt:
              input.paidAt
                ? new Date(
                    input.paidAt
                  )
                : null,

            refundStatus:
              "없음",

            refundAmount:
              "0",

            note:
              input.note?.trim() ||
              null,

            attachmentName:
              input.attachmentName?.trim() ||
              null,

            attachmentUrl:
              input.attachmentUrl?.trim() ||
              null,
          } as any);

        return {
          success: true,
          id: Number(id),
          sourceType:
            "external" as const,
        };
      }),

    update: protectedProcedure
      .input(
                z.object({
          id: z.number(),

          sourceType:
            z.enum([
              "student",
              "external",
            ])
              .optional()
              .default("student"),

          semesterId: z.number().optional().nullable(),
          assigneeId: z.number().optional(),
          clientName:
  z.string()
    .trim()
    .min(1)
    .max(100)
    .optional(),

phone:
  z.string()
    .trim()
    .min(10)
    .max(30)
    .optional(),
          assigneeName: z.string().optional().nullable(),
          managerName: z.string().optional().nullable(),
          course:
  z.string()
    .trim()
    .max(200)
    .optional()
    .nullable(),
         inputAddress: z.string().optional().nullable(),
detailAddress: z.string().optional().nullable(),
practiceSemesterLabel: z.string().max(50).optional().nullable(),
practiceHours: z.number().optional().nullable(),
practiceDate: z.string().optional().nullable(),
includeEducationCenter: z.boolean().optional(),
          includePracticeInstitution: z.boolean().optional(),
          coordinationStatus: z.enum(["미섭외", "섭외중", "섭외완료"]).optional(),
          feeAmount: z.string().optional(),
          paymentStatus: z.enum(["미결제", "결제", "환불"]).optional(),
          paidAt: z.string().optional().nullable(),
          note: z.string().optional().nullable(),
          attachmentName: z.string().optional().nullable(),
          attachmentUrl: z.string().optional().nullable(),

selectedEducationCenterId: z.number().optional().nullable(),
selectedEducationCenterName: z.string().optional().nullable(),
selectedEducationCenterAddress: z.string().optional().nullable(),
selectedEducationCenterDistanceKm: z.string().optional().nullable(),

selectedPracticeInstitutionId: z.number().optional().nullable(),
selectedPracticeInstitutionName: z.string().optional().nullable(),
selectedPracticeInstitutionAddress: z.string().optional().nullable(),
selectedPracticeInstitutionDistanceKm: z.string().optional().nullable(),
        })
      )
          .mutation(async ({ ctx, input }) => {
 const organizationId = getCtxOrganizationId(ctx);

  await assertOrganizationFeatureEnabled(
    organizationId,
    "allowPracticeCenter",
    "현재 회사는 실습배정지원센터 기능을 사용할 수 없습니다."
  );

const beforeRequest =
  input.sourceType ===
  "external"
    ? await db.getPracticeSupportExternalRequest(
        input.id,
        {
          organizationId,
        }
      )
    : await db.getPracticeSupportRequest(
        input.id,
        {
          organizationId,
        }
      );

if (!beforeRequest) {
  throwAppError(
    ERROR_CODES.DATA_NOT_FOUND,
    "실습 요청을 찾을 수 없습니다.",
    404
  );
}

let student: any = null;

if (
  input.sourceType ===
  "external"
) {
  assertExternalRequestEditable({
  currentUser:
    ctx.user,
});
} else {
  student =
    await db.getStudent(
      (beforeRequest as any)
        .studentId,
      {
        organizationId,
      }
    );

  if (!student) {
    throwAppError(
      ERROR_CODES.DATA_NOT_FOUND,
      "학생을 찾을 수 없습니다.",
      404
    );
  }

  assertPracticeSupportEditable({
    currentUser:
      ctx.user,
    student,
  });
}

const data: any = {};

        if (input.semesterId !== undefined) data.semesterId = input.semesterId ?? null;
        if (input.assigneeId !== undefined) data.assigneeId = input.assigneeId;
        if (input.clientName !== undefined) data.clientName = input.clientName.trim();
        if (
  input.phone !== undefined
) {
  const normalizedPhone =
    input.phone.replace(/\D/g, "");

  if (
    normalizedPhone.length < 10 ||
    normalizedPhone.length > 11
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "올바른 연락처를 입력해주세요.",
      400
    );
  }

  data.phone =
    normalizedPhone;
}
        if (input.assigneeName !== undefined) data.assigneeName = input.assigneeName?.trim() || null;
        if (input.managerName !== undefined) data.managerName = input.managerName?.trim() || null;
        if (input.course !== undefined) {
  data.course =
    input.course?.trim() ||
    null;
}
if (
  input.sourceType !== "external" &&
  data.course === null
) {
  throwAppError(
    ERROR_CODES.INVALID_REQUEST,
    "학생 연동 실습 요청의 과정은 비워둘 수 없습니다.",
    400
  );
}
        if (input.inputAddress !== undefined) data.inputAddress = input.inputAddress?.trim() || null;
        if (input.detailAddress !== undefined) data.detailAddress = input.detailAddress?.trim() || null;
if (input.practiceSemesterLabel !== undefined) {
  data.practiceSemesterLabel =
    input.practiceSemesterLabel?.trim() || null;
}
        if (input.practiceHours !== undefined) data.practiceHours = input.practiceHours ?? null;
if (input.practiceDate !== undefined)
  data.practiceDate = input.practiceDate ?? null;
        if (input.includeEducationCenter !== undefined) data.includeEducationCenter = input.includeEducationCenter;
        if (input.includePracticeInstitution !== undefined)
          data.includePracticeInstitution = input.includePracticeInstitution;
        if (input.coordinationStatus !== undefined) data.coordinationStatus = input.coordinationStatus;
        if (input.feeAmount !== undefined) data.feeAmount = input.feeAmount;
        if (input.paymentStatus !== undefined) data.paymentStatus = input.paymentStatus;
        if (input.paidAt !== undefined) data.paidAt = input.paidAt ? new Date(input.paidAt) : null;
        if (input.note !== undefined) data.note = input.note ?? null;
        if (input.attachmentName !== undefined) data.attachmentName = input.attachmentName?.trim() || null;
        if (input.attachmentUrl !== undefined) data.attachmentUrl = input.attachmentUrl?.trim() || null;

if (input.selectedEducationCenterId !== undefined) {
  data.selectedEducationCenterId = input.selectedEducationCenterId ?? null;
}
if (input.selectedEducationCenterName !== undefined) {
  data.selectedEducationCenterName =
    input.selectedEducationCenterName?.trim() || null;
}
if (input.selectedEducationCenterAddress !== undefined) {
  data.selectedEducationCenterAddress =
    input.selectedEducationCenterAddress?.trim() || null;
}
if (input.selectedEducationCenterDistanceKm !== undefined) {
  data.selectedEducationCenterDistanceKm =
    input.selectedEducationCenterDistanceKm?.trim() || null;
}

if (input.selectedPracticeInstitutionId !== undefined) {
  data.selectedPracticeInstitutionId =
    input.selectedPracticeInstitutionId ?? null;
}
if (input.selectedPracticeInstitutionName !== undefined) {
  data.selectedPracticeInstitutionName =
    input.selectedPracticeInstitutionName?.trim() || null;
}
if (input.selectedPracticeInstitutionAddress !== undefined) {
  data.selectedPracticeInstitutionAddress =
    input.selectedPracticeInstitutionAddress?.trim() || null;
}
if (input.selectedPracticeInstitutionDistanceKm !== undefined) {
  data.selectedPracticeInstitutionDistanceKm =
    input.selectedPracticeInstitutionDistanceKm?.trim() || null;
}

if (Object.keys(data).length === 0) {
  throwAppError(
  ERROR_CODES.INVALID_REQUEST,
  "수정할 값이 없습니다.",
  400
);
}

        if (
  input.sourceType ===
  "external"
) {
  /**
   * 단독 테이블에는 semesterId가 없다.
   */
  delete data.semesterId;

  data.updatedBy =
    Number(ctx.user.id);

  await db.updatePracticeSupportExternalRequest(
    input.id,
    data,
    {
      organizationId,
    }
  );

  return {
    success: true,
    sourceType:
      "external" as const,
  };
}

await db.updatePracticeSupportRequest(
  input.id,
  data,
  {
    organizationId,
  }
);

const afterRequest =
  await db.getPracticeSupportRequest(
    input.id,
    {
      organizationId,
    }
  );

await writeStudentAuditLog({
  ctx,

  studentId:
    Number(student.id),

  entityType:
    "practice_support",

  entityId:
    Number(input.id),

  action:
    "update",

  title:
    "실습 요청 수정",

  beforeJson:
    beforeRequest,

  afterJson:
    afterRequest,
});

return {
  success: true,
  sourceType:
    "student" as const,
};
      }),

        delete: protectedProcedure
      .input(
        z.object({
          id:
            z.number()
              .int()
              .positive(),

          sourceType:
            z.enum([
              "student",
              "external",
            ])
              .optional()
              .default("student"),
        })
      )
      .mutation(async ({
        input,
        ctx,
      }) => {
        const organizationId =
          getCtxOrganizationId(ctx);

        await assertOrganizationFeatureEnabled(
          organizationId,
          "allowPracticeCenter",
          "현재 회사는 실습배정지원센터 기능을 사용할 수 없습니다."
        );

        if (
          input.sourceType ===
          "external"
        ) {
          const beforeRequest =
            await db.getPracticeSupportExternalRequest(
              input.id,
              {
                organizationId,
              }
            );

          if (!beforeRequest) {
            throwAppError(
              ERROR_CODES.DATA_NOT_FOUND,
              "실습 요청을 찾을 수 없습니다.",
              404
            );
          }

          assertExternalRequestEditable({
  currentUser:
    ctx.user,
});

          await db.deletePracticeSupportExternalRequest(
            input.id,
            {
              organizationId,
            }
          );

          return {
            success: true,
            sourceType:
              "external" as const,
          };
        }

        const beforeRequest =
          await db.getPracticeSupportRequest(
            input.id,
            {
              organizationId,
            }
          );

        if (!beforeRequest) {
          throwAppError(
            ERROR_CODES.DATA_NOT_FOUND,
            "실습 요청을 찾을 수 없습니다.",
            404
          );
        }

        const student =
          await db.getStudent(
            beforeRequest.studentId,
            {
              organizationId,
            }
          );

        if (!student) {
          throwAppError(
            ERROR_CODES.DATA_NOT_FOUND,
            "학생을 찾을 수 없습니다.",
            404
          );
        }

        assertPracticeSupportEditable({
          currentUser:
            ctx.user,
          student,
        });

        await db.deletePracticeSupportRequest(
          input.id,
          {
            organizationId,
          }
        );

        await writeStudentAuditLog({
          ctx,

          studentId:
            Number(student.id),

          entityType:
            "practice_support",

          entityId:
            Number(input.id),

          action:
            "delete",

          title:
            "실습 요청 삭제",

          beforeJson:
            beforeRequest,

          afterJson:
            null,
        });

        return {
          success: true,
          sourceType:
            "student" as const,
        };
      }),


    requestRefund: protectedProcedure
      .input(
        z.object({
          requestId: z.number(),
          refundAmount: z.string(),
          refundReason: z.string().optional().nullable(),
        })
      )
     .mutation(async ({ input, ctx }) => {
  const organizationId = getCtxOrganizationId(ctx);

  await assertOrganizationFeatureEnabled(
    organizationId,
    "allowPracticeCenter",
    "현재 회사는 실습배정지원센터 기능을 사용할 수 없습니다."
  );

  await db.requestPracticeSupportRefund({
    organizationId,
    requestId: input.requestId,
          refundAmount: input.refundAmount,
          refundReason: input.refundReason ?? null,
        });

        return { success: true };
      }),

    approveRefund: protectedProcedure
      .input(
        z.object({
          requestId: z.number(),
        })
      )
     .mutation(async ({ ctx, input }) => {
  const organizationId = getCtxOrganizationId(ctx);

  await assertOrganizationFeatureEnabled(
    organizationId,
    "allowPracticeCenter",
    "현재 회사는 실습배정지원센터 기능을 사용할 수 없습니다."
  );

  if (!isAdminOrHost(ctx.user)) {
    throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "관리자 또는 호스트만 환불 승인할 수 있습니다.",
  403
);
  }

  await db.approvePracticeSupportRefund({
    organizationId,
  requestId: input.requestId,
  approvedBy: Number(ctx.user.id),
});

        return { success: true };
      }),

upsertByStudent: protectedProcedure
  .input(
    z.object({
      studentId: z.number(),
      semesterId: z.number().optional().nullable(),
      assigneeId: z.number(),
      clientName: z.string().min(1),
      phone: z.string().min(1),
      course: z.string().min(1),
      inputAddress: z.string().optional().nullable(),
      detailAddress: z.string().optional().nullable(),
      assigneeName: z.string().optional().nullable(),
      managerName: z.string().optional().nullable(),
     practiceSemesterLabel: z.string().max(50).optional().nullable(),
practiceHours: z.number().optional().nullable(),
practiceDate: z.string().optional().nullable(),
includeEducationCenter: z.boolean().optional(),
      includePracticeInstitution: z.boolean().optional(),
      coordinationStatus: z.enum(["미섭외","섭외중","섭외완료"]).optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
  const organizationId = getCtxOrganizationId(ctx);

  await assertOrganizationFeatureEnabled(
    organizationId,
    "allowPracticeCenter",
    "현재 회사는 실습배정지원센터 기능을 사용할 수 없습니다."
  );

const student = await db.getStudent(input.studentId, {
  organizationId,
});

if (!student) {
  throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "학생을 찾을 수 없습니다.",
  404
);
}

assertPracticeSupportEditable({
  currentUser: ctx.user,
  student,
});

  return db.upsertPracticeSupportRequestByStudent({
    organizationId,
    ...input,
  });
}),
  }),

  auth: router({
  me: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) {
      return null;
    }

    const organizationId = Number(
      (ctx.user as any)?.organizationId || 0
    );

    const user = await db.getUserById(
      Number(ctx.user.id),
      {
        organizationId:
          organizationId > 0
            ? organizationId
            : undefined,
      }
    );

    return user || null;
  }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, {
        ...cookieOptions,
        maxAge: -1,
      });
      return { success: true } as const;
    }),
  }),

authRecovery: router({
  sendCode: publicProcedure
    .input(
      z.object({
  organizationId: z.number().optional().default(1),
  purpose: z.enum(["find_id", "reset_password"]),

  name: z.string().min(1),
  phone: z.string().optional(),
  username: z.string().optional(),

  email: z.string().email(),
})
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = Number(input.organizationId || 1);
      const email = input.email.trim().toLowerCase();

      const code = String(Math.floor(100000 + Math.random() * 900000));
      const codeHash = await bcrypt.hash(code, 10);

      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

const recentCode = await db.getRecentEmailVerificationCode({
  organizationId,
  email,
  purpose: input.purpose,
  seconds: 30,
});

if (recentCode) {
  throwAppError(
  ERROR_CODES.INVALID_REQUEST,
  "인증코드는 30초 후 다시 발송할 수 있습니다.",
  400
);
}

const recentCount = await db.countRecentEmailVerificationCodes({
  organizationId,
  email,
  purpose: input.purpose,
  minutes: 5,
});

if (recentCount >= 5) {
  throwAppError(
  ERROR_CODES.INVALID_REQUEST,
  "인증코드 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
  429
);
}

if (input.purpose === "find_id") {
  const users = await db.findUsersForIdRecovery({
    organizationId,
    name: input.name,
    phone: input.phone || "",
    email,
  });

  if (users.length === 0) {throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "입력한 정보와 일치하는 계정을 찾을 수 없습니다.",
  404
);
  }
}

if (input.purpose === "reset_password") {
  if (!input.username?.trim()) {
   throwAppError(
  ERROR_CODES.INVALID_INPUT,
  "아이디를 입력해주세요.",
  400
);
  }

  const user = await db.findUserForPasswordReset({
    organizationId,
    name: input.name,
    username: input.username,
    email,
  });

  if (!user) {
    throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "입력한 정보와 일치하는 계정을 찾을 수 없습니다.",
  404
);
  }
}

      await db.createEmailVerificationCode({
        organizationId,
        email,
        purpose: input.purpose,
        codeHash,
        attempts: 0,
        maxAttempts: 5,
        expiresAt,
        usedAt: null,
        ipAddress: ctx.req?.ip || null,
        userAgent: ctx.req?.headers?.["user-agent"] || null,
      } as any);

      await sendVerificationEmail({
  to: email,
  code,
  purpose: input.purpose,
});

      return {
        success: true,
        message: "인증코드가 발송되었습니다.",
        devCode: process.env.NODE_ENV !== "production" ? code : undefined,
      };
    }),

  verifyFindIdCode: publicProcedure
    .input(
      z.object({
        organizationId: z.number().optional().default(1),
        email: z.string().email(),
        code: z.string().min(4),
      })
    )
    .mutation(async ({ input }) => {
      const organizationId = Number(input.organizationId || 1);
      const email = input.email.trim().toLowerCase();

      const record = await db.getLatestEmailVerificationCode({
        organizationId,
        email,
        purpose: "find_id",
      });

      if (!record) {
        throwAppError(
  ERROR_CODES.INVALID_REQUEST,
  "유효한 인증코드가 없습니다.",
  400
);
      }

      if (Number((record as any).attempts || 0) >= Number((record as any).maxAttempts || 5)) {
        throwAppError(
  ERROR_CODES.INVALID_REQUEST,
  "인증 시도 횟수를 초과했습니다.",
  400
);
      }

      const ok = await bcrypt.compare(input.code.trim(), String((record as any).codeHash || ""));

      if (!ok) {
        await db.increaseEmailVerificationAttempt(Number((record as any).id));
        throwAppError(
  ERROR_CODES.INVALID_REQUEST,
  "인증코드가 일치하지 않습니다.",
  400
);
      }

      await db.markEmailVerificationUsed(Number((record as any).id));

      const users = await db.findUsersByEmailForRecovery({
        organizationId,
        email,
      });

      return {
        success: true,
        users: users.map((u: any) => ({
          username: u.username,
          name: u.name,
          role: u.role,
        })),
      };
    }),

  verifyResetPasswordCode: publicProcedure
    .input(
      z.object({
        organizationId: z.number().optional().default(1),
	name: z.string().min(1),
        username: z.string().min(1),
        email: z.string().email(),
        code: z.string().min(4),
      })
    )
    .mutation(async ({ input }) => {
      const organizationId = Number(input.organizationId || 1);
      const email = input.email.trim().toLowerCase();

     const user = await db.findUserForPasswordReset({
  organizationId,
  name: input.name,
  username: input.username,
  email,
});

      if (!user) {
        throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "일치하는 계정을 찾을 수 없습니다.",
  404
);
      }

      const record = await db.getLatestEmailVerificationCode({
        organizationId,
        email,
        purpose: "reset_password",
      });

      if (!record) {
        throwAppError(
  ERROR_CODES.INVALID_REQUEST,
  "유효한 인증코드가 없습니다.",
  400
);
      }

      if (Number((record as any).attempts || 0) >= Number((record as any).maxAttempts || 5)) {
        throwAppError(
  ERROR_CODES.INVALID_REQUEST,
  "인증 시도 횟수를 초과했습니다.",
  400
);
      }

      const ok = await bcrypt.compare(input.code.trim(), String((record as any).codeHash || ""));

      if (!ok) {
        await db.increaseEmailVerificationAttempt(Number((record as any).id));
        throwAppError(
  ERROR_CODES.INVALID_REQUEST,
  "인증코드가 일치하지 않습니다.",
  400
);
      }

      return {
        success: true,
        resetAllowed: true,
      };
    }),

  resetPassword: publicProcedure
    .input(
      z.object({
        organizationId: z.number().optional().default(1),
name: z.string().min(1),        
username: z.string().min(1),
        email: z.string().email(),
        code: z.string().min(4),
        newPassword: z.string().min(8),
        newPasswordConfirm: z.string().min(8),
      })
    )
    .mutation(async ({ input }) => {
      if (input.newPassword !== input.newPasswordConfirm) {
        throwAppError(
  ERROR_CODES.INVALID_INPUT,
  "새 비밀번호가 서로 일치하지 않습니다.",
  400
);
      }

      const organizationId = Number(input.organizationId || 1);
      const email = input.email.trim().toLowerCase();

      const user = await db.findUserForPasswordReset({
  organizationId,
  name: input.name,
  username: input.username,
  email,
});

      if (!user) {
        throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "일치하는 계정을 찾을 수 없습니다.",
  404
);
      }

      const record = await db.getLatestEmailVerificationCode({
        organizationId,
        email,
        purpose: "reset_password",
      });

      if (!record) {
       throwAppError(
  ERROR_CODES.INVALID_REQUEST,
  "유효한 인증코드가 없습니다.",
  400
);
      }

      const ok = await bcrypt.compare(input.code.trim(), String((record as any).codeHash || ""));

      if (!ok) {
        await db.increaseEmailVerificationAttempt(Number((record as any).id));
        throwAppError(
  ERROR_CODES.INVALID_REQUEST,
  "인증코드가 일치하지 않습니다.",
  400
);
      }

const samePassword = await bcrypt.compare(
  input.newPassword,
  String((user as any).passwordHash || "")
);

if (samePassword) {
  throwAppError(
  ERROR_CODES.INVALID_REQUEST,
  "기존 비밀번호와 동일한 비밀번호는 사용할 수 없습니다.",
  400
);
}

      const passwordHash = await bcrypt.hash(input.newPassword, 10);

      await db.updateUserAccount(
        Number((user as any).id),
        {
          passwordHash,
        },
        {
          organizationId,
        }
      );

      await db.markEmailVerificationUsed(Number((record as any).id));

      return {
        success: true,
        message: "비밀번호가 변경되었습니다.",
      };
    }),
}),

  users: router({

  searchAssignable: protectedProcedure
    .input(
      z.object({
        username: z
          .string()
          .trim()
          .max(64),
      })
    )
    .query(async ({ ctx, input }) => {
      const organizationId =
        getCtxOrganizationId(ctx);

      if (!isAdminOrHost(ctx.user)) {
        throwAppError(
          ERROR_CODES.PERMISSION_DENIED,
          "관리자 또는 호스트만 담당자를 검색할 수 있습니다.",
          403
        );
      }

      const keyword =
        input.username.trim();

      if (keyword.length < 2) {
        return [];
      }

      const rows =
        await db.searchAssignableUsersByUsername({
          organizationId,
          username: keyword,
          limit: 10,
        });

      /**
       * Host는 회사 전체 검색 결과 반환
       */
      if (isHost(ctx.user)) {
        return rows;
      }

      /**
       * Admin은 자기 팀 검색 결과만 반환
       */
      const currentUserId =
        Number(ctx.user.id || 0);

      const teamMemberIds =
        await db.getUserTeamMemberIds(
          currentUserId,
          {
            organizationId,
          }
        );

      const allowedUserIds =
        new Set(
          [
            currentUserId,
            ...(teamMemberIds || []).map(Number),
          ]
        );

      return rows.filter(
        (row: any) =>
          allowedUserIds.has(
            Number(row.id)
          )
      );
    }),
  list: protectedProcedure.query(async ({ ctx }) => {
  const rows = await db.getAllUsersDetailed({
  organizationId: getCtxOrganizationId(ctx),
});

return isSuperhost(ctx.user) ? maskPersonalDataList(rows as any[]) : rows;
}),

  personnelDetail: hostProcedure
    .input(
      z.object({
        userId: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      const organizationId = getCtxOrganizationId(ctx);

      if (!organizationId) {
        throwAppError(
  ERROR_CODES.ORGANIZATION_REQUIRED,
  "organizationId is required",
  400
);
      }

      return await db.getUserPersonnelDetail({
        organizationId,
        userId: input.userId,
      });
    }),

  me: protectedProcedure.query(async ({ ctx }) => {
    return await db.getMyProfile(Number(ctx.user.id));
  }),

  updateMyPhoto: protectedProcedure
    .input(
      z.object({
        profileImageUrl: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await db.updateMyProfilePhoto({
        userId: Number(ctx.user.id),
        profileImageUrl: input.profileImageUrl,
      });
    }),

checkUsernameAvailable: protectedProcedure
  .input(
    z.object({
      username: z.string().min(1),
    })
  )
  .query(async ({ input }) => {
    const normalizedUsername =
      input.username.trim();

    const exists =
      await db.getUserByUsername(normalizedUsername);

    return {
      available: !exists,
    };
  }),

  changeMyPassword: protectedProcedure
    .input(
      z.object({
        newPassword: z.string().min(8),
        newPasswordConfirm: z.string().min(8),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.newPassword !== input.newPasswordConfirm) {
        throwAppError(
  ERROR_CODES.INVALID_INPUT,
  "새 비밀번호가 서로 일치하지 않습니다.",
  400
);
      }

      return await db.changeMyPassword({
        userId: Number(ctx.user.id),
        newPassword: input.newPassword,
      });
    }),

  create: hostProcedure
    .input(
      z.object({
        username: z.string().min(1),
        password: z.string().min(4),
        name: z.string().min(1),
        email: z.string().optional(),
       phone: z.string().optional(),
birthday: z.string().optional().nullable(),
role: z.enum(["staff", "admin", "host"]).default("staff"),
        bankName: z.string().optional(),
        bankAccount: z.string().optional(),
      })
    )
   .mutation(async ({ ctx, input }) => {
 const organizationId = getCtxOrganizationId(ctx);

  const limitStatus = await getOrganizationLimitStatus(organizationId);

  if (limitStatus.exceeded.users) {
    throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  `사용자 수 제한을 초과했습니다. 현재 ${limitStatus.usage.userCount}명 / 제한 ${limitStatus.limits.maxUsers}명`,
  403
);
  }

  const normalizedUsername = input.username.trim();

  const existingUser = await db.getUserByUsername(normalizedUsername);

  if (existingUser) {
    throwAppError(
      ERROR_CODES.DUPLICATE_RESOURCE,
      "이미 사용 중인 로그인 아이디입니다.",
      409
    );
  }

  const passwordHash = await bcrypt.hash(input.password, 10);

  await db.createUserAccount({
    organizationId,
        openId: normalizedUsername,
username: normalizedUsername,
        passwordHash,
        name: input.name.trim(),
        email: input.email?.trim() || null,
       phone: input.phone?.trim() || null,
birthday: input.birthday?.trim() || null,
role: input.role,
        bankName: input.bankName?.trim() || null,
        bankAccount: input.bankAccount?.trim() || null,
        loginMethod: "manual",
        isActive: true,
      });

      return { success: true };
    }),

  update: hostProcedure
    .input(
      z.object({
        id: z.number(),
        username: z.string().optional(),
        password: z.string().optional(),
        name: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        bankName: z.string().optional(),
        bankAccount: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, password, ...rest } = input;

      const normalizedUsername = rest.username?.trim();

      if (normalizedUsername) {
        const existingUser = await db.getUserByUsername(normalizedUsername);

        if (existingUser && Number((existingUser as any).id) !== Number(id)) {
          throwAppError(
            ERROR_CODES.DUPLICATE_RESOURCE,
            "이미 사용 중인 로그인 아이디입니다.",
            409
          );
        }
      }

      let passwordHash: string | undefined = undefined;

      if (password !== undefined && password.trim() !== "") {
        passwordHash = await bcrypt.hash(password, 10);
      }

     await db.updateUserAccount(
  id,
  {
    username: normalizedUsername,
    name: rest.name?.trim(),
    email: rest.email?.trim(),
    phone: rest.phone?.trim(),
    bankName: rest.bankName?.trim(),
    bankAccount: rest.bankAccount?.trim(),
    passwordHash,
  },
  {
    organizationId: getCtxOrganizationId(ctx),
  }
);

      return { success: true };
    }),

  updateRole: hostProcedure
    .input(
      z.object({
        id: z.number(),
        role: z.enum(["staff", "admin", "host"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await db.updateUserRole(
  input.id,
  input.role,
  {
    organizationId: getCtxOrganizationId(ctx),
  }
);

      return { success: true };
    }),

  updateActive: hostProcedure
    .input(
      z.object({
        id: z.number(),
        isActive: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await db.updateUserActive(
  input.id,
  input.isActive,
  {
    organizationId: getCtxOrganizationId(ctx),
  }
);

      return { success: true };
    }),
}),

org: router({
  teams: router({
    list: protectedProcedure.query(async ({ ctx }) => {
  return db.listTeams({
    organizationId: getCtxOrganizationId(ctx),
  });
}),

    create: hostProcedure
      .input(
        z.object({
          name: z.string().min(1),
          sortOrder: z.number().optional(),
          isActive: z.boolean().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
  const id = await db.createTeam({
    organizationId: getCtxOrganizationId(ctx),
    name: input.name,
          sortOrder: input.sortOrder ?? 0,
          isActive: input.isActive ?? true,
        });

        return { success: true, id };
      }),

    update: hostProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          sortOrder: z.number().optional(),
          isActive: z.boolean().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
  await db.updateTeam(
    input.id,
    {
      name: input.name,
      sortOrder: input.sortOrder,
      isActive: input.isActive,
    },
    {
      organizationId: getCtxOrganizationId(ctx),
    }
  );

        return { success: true };
      }),

    delete: hostProcedure
      .input(
        z.object({
          id: z.number(),
        })
      )
      .mutation(async ({ ctx, input }) => {
  await db.deleteTeam(input.id, {
    organizationId: getCtxOrganizationId(ctx),
  });
        return { success: true };
      }),
  }),

  positions: router({
    list: protectedProcedure.query(async ({ ctx }) => {
  return db.listPositions({
    organizationId: getCtxOrganizationId(ctx),
  });
}),

    create: hostProcedure
      .input(
        z.object({
          name: z.string().min(1),
          sortOrder: z.number().optional(),
          isActive: z.boolean().optional(),
settlementUnitAmount: z.string().optional(),
        })
      )
     .mutation(async ({ ctx, input }) => {
  const id = await db.createPosition({
    organizationId: getCtxOrganizationId(ctx),
    name: input.name,
    sortOrder: input.sortOrder ?? 0,
    isActive: input.isActive ?? true,
    settlementUnitAmount: input.settlementUnitAmount ?? "0",
  });

  return { success: true, id };
}),

    update: hostProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          sortOrder: z.number().optional(),
          isActive: z.boolean().optional(),
settlementUnitAmount: z.string().optional(),
        })
      )
     .mutation(async ({ ctx, input }) => {
  await db.updatePosition(
    input.id,
    {
      name: input.name,
      sortOrder: input.sortOrder,
      isActive: input.isActive,
      settlementUnitAmount: input.settlementUnitAmount,
    },
    {
      organizationId: getCtxOrganizationId(ctx),
    }
  );

  return { success: true };
}),

    delete: hostProcedure
      .input(
        z.object({
          id: z.number(),
        })
      )
      .mutation(async ({ ctx, input }) => {
  await db.deletePosition(input.id, {
    organizationId: getCtxOrganizationId(ctx),
  });
        return { success: true };
      }),
  }),

  userMappings: router({
    get: protectedProcedure
      .input(
        z.object({
          userId: z.number(),
        })
      )
      .query(async ({ ctx, input }) => {
  return db.getUserOrgMapping(input.userId, {
    organizationId: getCtxOrganizationId(ctx),
  });
}),

    upsert: hostProcedure
      .input(
        z.object({
          userId: z.number(),
          teamId: z.number().nullable().optional(),
          positionId: z.number().nullable().optional(),
          sortOrder: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const id = await db.upsertUserOrgMappingProtected({
organizationId: getCtxOrganizationId(ctx),
          actorRole: ctx.user.role,
          targetUserId: input.userId,
          teamId: input.teamId ?? null,
          positionId: input.positionId ?? null,
          sortOrder: input.sortOrder ?? 0,
        });

        return { success: true, id };
      }),

    delete: hostProcedure
      .input(
        z.object({
          userId: z.number(),
        })
      )
      .mutation(async ({ ctx, input }) => {
  await db.deleteUserOrgMapping(input.userId, {
    organizationId: getCtxOrganizationId(ctx),
  });
        return { success: true };
      }),
  }),
}),

messenger: router({
  myRooms: protectedProcedure.query(async ({ ctx }) => {
  const organizationId = getCtxOrganizationId(ctx);

  await assertOrganizationFeatureEnabled(
    organizationId,
    "allowMessenger",
    "현재 회사는 메신저 기능을 사용할 수 없습니다."
  );

  return db.listMyChatRooms(Number(ctx.user.id), {
    organizationId,
  });
}),

  directRoom: protectedProcedure
    .input(
      z.object({
        userId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
  const organizationId = getCtxOrganizationId(ctx);

  await assertOrganizationFeatureEnabled(
    organizationId,
    "allowMessenger",
    "현재 회사는 메신저 기능을 사용할 수 없습니다."
  );

  const room = await db.getOrCreateDirectChatRoom({
    organizationId,
  actorUserId: Number(ctx.user.id),
  otherUserId: input.userId,
});

      return {
        success: true,
        room,
      };
    }),

  messages: protectedProcedure
    .input(
      z.object({
        roomId: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
  const organizationId = getCtxOrganizationId(ctx);

  await assertOrganizationFeatureEnabled(
    organizationId,
    "allowMessenger",
    "현재 회사는 메신저 기능을 사용할 수 없습니다."
  );

  return db.listChatMessages(input.roomId, Number(ctx.user.id), {
    organizationId,
  });
}),

  members: protectedProcedure
    .input(
      z.object({
        roomId: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
  const organizationId = getCtxOrganizationId(ctx);

  await assertOrganizationFeatureEnabled(
    organizationId,
    "allowMessenger",
    "현재 회사는 메신저 기능을 사용할 수 없습니다."
  );

  return db.listChatRoomMembers(input.roomId, Number(ctx.user.id), {
    organizationId,
  });
}),

  sendMessage: protectedProcedure
    .input(
      z.object({
        roomId: z.number(),
        content: z.string().optional(),
        messageType: z.enum(["text", "image", "file", "system"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
  const organizationId = getCtxOrganizationId(ctx);

  await assertOrganizationFeatureEnabled(
    organizationId,
    "allowMessenger",
    "현재 회사는 메신저 기능을 사용할 수 없습니다."
  );

  const messageId = await db.createChatMessage({
    organizationId,
  roomId: input.roomId,
  senderId: Number(ctx.user.id),
  messageType: input.messageType ?? "text",
  content: input.content ?? null,
});

      return {
  success: true,
  id: Number(messageId),
  roomId: Number(input.roomId),
  senderId: Number(ctx.user.id),
  content: input.content ?? null,
  messageType: input.messageType ?? "text",
};
    }),

  markRead: protectedProcedure
    .input(
      z.object({
        roomId: z.number(),
        lastReadMessageId: z.number().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
  const organizationId = getCtxOrganizationId(ctx);

  await assertOrganizationFeatureEnabled(
    organizationId,
    "allowMessenger",
    "현재 회사는 메신저 기능을 사용할 수 없습니다."
  );

  await db.markChatRoomRead({
    organizationId,
  roomId: input.roomId,
  userId: Number(ctx.user.id),
  lastReadMessageId: input.lastReadMessageId,
});

      return { success: true };
    }),

  addAttachment: protectedProcedure
    .input(
      z.object({
        messageId: z.number(),
        fileName: z.string().min(1),
        fileUrl: z.string().min(1),
        fileType: z.string().optional(),
        fileSize: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
  const organizationId = getCtxOrganizationId(ctx);

  await assertOrganizationFeatureEnabled(
    organizationId,
    "allowMessenger",
    "현재 회사는 메신저 기능을 사용할 수 없습니다."
  );

  const id = await db.createChatAttachment({
    organizationId,
        messageId: input.messageId,
        fileName: input.fileName,
        fileUrl: input.fileUrl,
        fileType: input.fileType ?? null,
        fileSize: input.fileSize ?? null,
      });

      return { success: true, id };
    }),
}),

  formAdmin: router({
  list: hostProcedure
    .input(z.object({
      formType: z.enum(["landing", "ad"]),
    }))
    .query(async ({ input, ctx }) => {
  return db.listLeadForms(input.formType, {
    organizationId: getCtxOrganizationId(ctx),
  });
}),

  create: hostProcedure
  .input(z.object({
    assigneeId: z.number(),
    formType: z.enum(["landing", "ad"]),
    blueprintId: z.number().optional(),
  }))
    .mutation(async ({ input, ctx }) => {
  const organizationId = getCtxOrganizationId(ctx);

  const limitStatus = await getOrganizationLimitStatus(organizationId);

  if (limitStatus.exceeded.landingForms) {
   throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  `랜딩/광고폼 생성 제한을 초과했습니다. 현재 ${limitStatus.usage.landingFormCount}개 / 제한 ${limitStatus.limits.maxLandingForms}개`,
  403
);
  }

  if (input.blueprintId) {
  return db.createLeadFormFromBlueprint({
  organizationId,
  blueprintId: input.blueprintId,
  assigneeId: input.assigneeId,
});
}
// 👉 없으면 기존 방식
return db.createLeadForm(input.assigneeId, input.formType, {
  organizationId,
});
}),

  updateActive: hostProcedure
    .input(z.object({
      id: z.number(),
      isActive: z.boolean(),
    }))
   .mutation(async ({ input, ctx }) => {
  return db.updateLeadFormActive(input.id, input.isActive, {
   organizationId: getCtxOrganizationId(ctx),
  });
}),

  getTemplate: hostProcedure
  .input(
    z.object({
      formType: z.enum(["landing", "ad"]),
    })
  )
 .query(async ({ input, ctx }) => {
  const template = await db.getLeadFormTemplate(input.formType, {
    organizationId: getCtxOrganizationId(ctx),
  });

   const rawUiConfig = (template as any)?.uiConfigJson;

let uiConfig: any = {};

if (typeof rawUiConfig === "string" && rawUiConfig.trim()) {
  uiConfig = JSON.parse(rawUiConfig);
} else if (rawUiConfig && typeof rawUiConfig === "object") {
  uiConfig = rawUiConfig;
}

return {
  success: true,
  uiConfig,
};
  }),

renameTemplate: protectedProcedure
  .input(
    z.object({
      formType: z.enum(["landing", "ad"]),
      oldTemplateName: z.string().min(1),
      newTemplateName: z.string().min(1),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const updated = await db.renameNamedLeadFormTemplate({
  organizationId: getCtxOrganizationId(ctx),
  formType: input.formType,
      oldTemplateName: input.oldTemplateName.trim(),
      newTemplateName: input.newTemplateName.trim(),
      actorUserId: Number(ctx.user.id),
    });

    return {
      ok: true,
      token: updated?.token,
    };
  }),

  saveTemplate: hostProcedure
    .input(
      z.object({
        formType: z.enum(["landing", "ad"]),
        uiConfig: publicFormUiConfigSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = await db.saveLeadFormTemplate({
  organizationId: getCtxOrganizationId(ctx),
  formType: input.formType,
        actorUserId: Number(ctx.user.id),
        uiConfig: input.uiConfig,
      });

      return { success: true, id };
    }),

  saveUiConfig: hostProcedure
  .input(
    z.object({
      id: z.number(),
      uiConfig: publicFormUiConfigSchema,
    })
  )
  .mutation(async ({ input, ctx }) => {
  await db.updateLeadFormUiConfig(input.id, input.uiConfig, {
    organizationId: getCtxOrganizationId(ctx),
  });
    return { success: true };
  }),

  saveMyUiConfig: protectedProcedure
    .input(
      z.object({
        token: z.string(),
        formType: z.enum(["landing", "ad"]),
        uiConfig: publicFormUiConfigSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = await db.updateMyLeadFormUiConfig({
  organizationId: getCtxOrganizationId(ctx),
  token: input.token,
        formType: input.formType,
        userId: Number(ctx.user.id),
        uiConfig: input.uiConfig,
      });

      return { success: true, id };
    }),

listTemplates: protectedProcedure
  .input(
    z.object({
      formType: z.enum(["landing", "ad"]),
    })
  )
 .query(async ({ input, ctx }) => {
  const rows = await db.listLeadFormTemplates(input.formType, {
    organizationId: getCtxOrganizationId(ctx),
  });

    const items = rows.map((row) => {
      let parsed: any = {};

      try {
        const rawUiConfig = (row as any)?.uiConfigJson;

if (typeof rawUiConfig === "string" && rawUiConfig.trim()) {
  parsed = JSON.parse(rawUiConfig);
} else if (rawUiConfig && typeof rawUiConfig === "object") {
  parsed = rawUiConfig;
} else {
  parsed = {};
}
      } catch {
        parsed = {};
      }

      return {
        id: row.id,
        token: row.token,
        templateName: row.templateName,
        formType: row.formType,
        description: parsed?.description || "",
        tags: parsed?.tags || "",
        isPinned: Boolean(parsed?.isPinned),
        lastUsedAt: parsed?.lastUsedAt || "",
        canvas: parsed?.canvas || null,
      };
    });

    items.sort((a, b) => {
      if (a.isPinned !== b.isPinned) {
        return a.isPinned ? -1 : 1;
      }

      const aLast = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0;
      const bLast = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0;

      if (aLast !== bLast) {
        return bLast - aLast;
      }

      return Number(b.id || 0) - Number(a.id || 0);
    });

    return items;
  }),

saveAsTemplate: protectedProcedure
  .input(
    z.object({
      formType: z.enum(["landing", "ad"]),
      templateName: z.string().min(1),
      uiConfig: publicFormUiConfigSchema,
    })
  )
  .mutation(async ({ input, ctx }) => {
    const saved = await db.saveNamedLeadFormTemplate({
  organizationId: getCtxOrganizationId(ctx),
  formType: input.formType,
      templateName: input.templateName.trim(),
      uiConfig: input.uiConfig,
      actorUserId: Number(ctx.user.id),
    });

    return {
      ok: true,
      token: saved?.token,
    };
  }),

applyTemplateToMyForm: protectedProcedure
  .input(
    z.object({
      formType: z.enum(["landing", "ad"]),
      templateName: z.string().min(1),
      targetToken: z.string().min(1),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const updated = await db.applyNamedLeadFormTemplateToToken({
  organizationId: getCtxOrganizationId(ctx),
  formType: input.formType,
      templateName: input.templateName.trim(),
      targetToken: input.targetToken,
      actorUserId: Number(ctx.user.id),
    });

    return {
      ok: true,
      token: updated?.token,
    };
  }),

deleteTemplate: protectedProcedure
  .input(
    z.object({
      formType: z.enum(["landing", "ad"]),
      templateName: z.string().min(1),
    })
  )
  .mutation(async ({ input, ctx }) => {
    await db.deleteNamedLeadFormTemplate(
  input.formType,
  input.templateName.trim(),
  Number(ctx.user.id),
  {
    organizationId: getCtxOrganizationId(ctx),
  }
);

    return {
      ok: true,
    };
  }),

duplicateTemplate: protectedProcedure
  .input(
    z.object({
      formType: z.enum(["landing", "ad"]),
      sourceTemplateName: z.string().min(1),
      newTemplateName: z.string().min(1),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const created = await db.duplicateNamedLeadFormTemplate({
  organizationId: getCtxOrganizationId(ctx),
  formType: input.formType,
      sourceTemplateName: input.sourceTemplateName.trim(),
      newTemplateName: input.newTemplateName.trim(),
      actorUserId: Number(ctx.user.id),
    });

    return {
      ok: true,
      token: created?.token,
    };
  }),

}),

formBlueprintAdmin: router({
  list: hostProcedure
    .input(
      z.object({
        formType: z.enum(["landing", "ad"]),
      })
    )
    .query(async ({ input, ctx }) => {
      return db.listFormBlueprints(
  input.formType,
  {
    organizationId: getCtxOrganizationId(ctx),
  }
);
    }),

  getById: hostProcedure
    .input(
      z.object({
        id: z.number(),
      })
    )
    .query(async ({ input, ctx }) => {

      const row = await db.getFormBlueprintById(
  input.id,
  {
    organizationId: getCtxOrganizationId(ctx),
  }
);
      if (!row) {
        throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "뼈대를 찾을 수 없습니다.",
  404
);
      }

      return row;
    }),

  create: hostProcedure
    .input(
      z.object({
        formType: z.enum(["landing", "ad"]),
        name: z.string().min(1),
        description: z.string().nullable().optional(),
        uiConfig: publicFormUiConfigSchema,
      })
    )
    .mutation(async ({ input, ctx }) => {

      const created = await db.createFormBlueprint({
organizationId: getCtxOrganizationId(ctx),
        formType: input.formType,
        name: input.name,
        description: input.description ?? null,
        uiConfig: input.uiConfig,
        createdBy: Number(ctx.user.id),
      });

      return {
        ok: true,
        blueprint: created,
      };
    }),

  update: hostProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().nullable().optional(),
        uiConfig: publicFormUiConfigSchema.optional(),
        isActive: z.boolean().optional(),
        isDefault: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {

      const updated = await db.updateFormBlueprint({
organizationId: getCtxOrganizationId(ctx),
        id: input.id,
        name: input.name,
        description: input.description,
        uiConfig: input.uiConfig,
        isActive: input.isActive,
        isDefault: input.isDefault,
      });

      return {
        ok: true,
        blueprint: updated,
      };
    }),

  delete: hostProcedure
    .input(
      z.object({
        id: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {

      await db.deleteFormBlueprint(
  input.id,
  {
    organizationId: getCtxOrganizationId(ctx),
  }
);

      return {
        ok: true,
      };
    }),

  createFormFromBlueprint: hostProcedure
    .input(
      z.object({
        blueprintId: z.number(),
        assigneeId: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {

      const created = await db.createLeadFormFromBlueprint({
  organizationId: getCtxOrganizationId(ctx),
  blueprintId: input.blueprintId,
  assigneeId: input.assigneeId,
});

      return {
        ok: true,
        token: created.token,
      };
    }),
}),

publicForm: router({
  getByToken: publicProcedure
    .input(
      z.object({
        token: z.string(),
        formType: z.enum(["landing", "ad"]),
      })
    )
    .query(async ({ input }) => {
      return db.getPublicFormByToken(input.token, input.formType);
    }),

  submit: publicProcedure
    .input(
      z.object({
        token: z.string(),
        formType: z.enum(["landing", "ad"]),
        clientName: z.string().min(1),
        phone: z.string().min(10),
        finalEducation: z.string().min(1),
        desiredCourse: z.string().min(1),
        channel: z.string().min(1),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const form = await db.getPublicFormByToken(
        input.token,
        input.formType
      );

      if (!form?.ok) {
       throwAppError(
  ERROR_CODES.INVALID_REQUEST,
  "유효하지 않은 폼입니다.",
  400
);
      }

const id = await db.createConsultation({
  organizationId: Number((form as any)?.form?.organizationId || 0),
  consultDate: new Date(),
  channel: input.channel,
  clientName: input.clientName,
  phone: input.phone,
  finalEducation: input.finalEducation,
  desiredCourse: input.desiredCourse,
  notes: input.notes ?? "",
  status: "상담중",
  assigneeId: form.assigneeId,
} as any);

return { success: true, id };

    }),
}),

notification: router({
  list: protectedProcedure.query(async ({ ctx }) => {
  const organizationId = getCtxOrganizationId(ctx);

  if (!organizationId) {
    throwAppError(
      ERROR_CODES.ORGANIZATION_REQUIRED,
      "organizationId is required",
      400
    );
  }

  return db.listNotifications(Number(ctx.user.id), {
    organizationId,
  });
}),

 markRead: protectedProcedure
  .input(
    z.object({
      id: z.number(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const organizationId = getCtxOrganizationId(ctx);

    if (!organizationId) {
      throwAppError(
        ERROR_CODES.ORGANIZATION_REQUIRED,
        "organizationId is required",
        400
      );
    }

    await db.markNotificationRead(input.id, Number(ctx.user.id), {
      organizationId,
    });

    return { success: true };
  }),

markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
 const organizationId = getCtxOrganizationId(ctx);

  if (!organizationId) {
    throwAppError(
      ERROR_CODES.ORGANIZATION_REQUIRED,
      "organizationId is required",
      400
    );
  }

  await db.markAllNotificationsRead(Number(ctx.user.id), {
    organizationId,
  });

  return { success: true };
}),
}),

branding: router({
  getPublic: publicProcedure.query(async () => {
    return {
      organizationId: null,
      companyName: "위드원 교육",
      companyLogoUrl: null,
      messengerSubtitle: "사내 메신저",
    };
  }),

  get: protectedProcedure.query(async ({ ctx }) => {
    return db.getBrandingSettings({
      organizationId: getCtxOrganizationId(ctx),
    });
  }),

  save: hostProcedure
    .input(
      z.object({
        companyName: z.string().min(1),
        companyLogoUrl: z.string().optional().nullable(),
        messengerSubtitle: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = await db.saveBrandingSettings({
  organizationId: getCtxOrganizationId(ctx),
  companyName: input.companyName.trim(),
        companyLogoUrl: input.companyLogoUrl?.trim() || null,
        messengerSubtitle: input.messengerSubtitle.trim(),
        createdBy: Number(ctx.user.id),
        updatedBy: Number(ctx.user.id),
      } as any);

      return { success: true, id };
    }),
}),

  mobile: router({
  registerPushToken: publicProcedure
    .input(
      z.object({
        userId: z.number(),
        platform: z.string().min(1),
        expoPushToken: z.string().min(1),
        secret: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      if (input.secret !== process.env.MOBILE_TOKEN_SECRET) {
        throwAppError(
  ERROR_CODES.AUTH_REQUIRED,
  "인증에 실패했습니다.",
  401
);
      }

      const user = await db.getUserById(input.userId);

if (!user) {
  throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "유저를 찾을 수 없습니다.",
  404
);
}

const id = await db.upsertDeviceToken({
  organizationId: Number((user as any).organizationId || 0),
  userId: input.userId,
  platform: input.platform,
  expoPushToken: input.expoPushToken,
});

      return { success: true, id };
    }),
}),

  educationInstitution: router({
    list: protectedProcedure.query(async ({ ctx }) => {
  return db.listEducationInstitutions({
    organizationId: getCtxOrganizationId(ctx),
  });
}),

    create: hostProcedure
      .input(
        z.object({
          name: z.string().min(1),
          sortOrder: z.number().optional(),
settlementType: z.enum(["credit", "subject", "fixed"]).optional(),
unitCostAmount: z.string().optional(),
normalSubjectPrice: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
  const id = await db.createEducationInstitution({
    organizationId: getCtxOrganizationId(ctx),
    name: input.name.trim(),
    isActive: true,
    sortOrder: input.sortOrder ?? 0,
    settlementType: input.settlementType ?? "credit",
    unitCostAmount: input.unitCostAmount ?? "0",
    normalSubjectPrice: input.normalSubjectPrice ?? "75000",
  });

  return { id, success: true };
}),

    update: hostProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          isActive: z.boolean().optional(),
          sortOrder: z.number().optional(),
settlementType: z.enum(["credit", "subject", "fixed"]).optional(),
unitCostAmount: z.string().optional(),
normalSubjectPrice: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
  const { id, ...rest } = input;

  await db.updateEducationInstitution(id, rest, {
    organizationId: getCtxOrganizationId(ctx),
  });

  return { success: true };
}),
  }),

  settlementSystem: router({
    listInstitutionPositionRates: protectedProcedure
      .input(
        z
          .object({
            educationInstitutionId: z.number().optional(),
          })
          .optional()
      )
     .query(async ({ input, ctx }) => {
  return db.listEducationInstitutionPositionRates(
    input?.educationInstitutionId,
    {
      organizationId: getCtxOrganizationId(ctx),
    }
  );
}),

listSubjectPriceRules: hostProcedure
  .input(
    z
      .object({
        educationInstitutionId: z.number().nullable().optional(),
        includeInactive: z.boolean().optional(),
      })
      .optional()
  )
  .query(async ({ ctx, input }) => {
    const organizationId = getCtxOrganizationId(ctx);

    return db.listSettlementSubjectPriceRules({
      organizationId,
      educationInstitutionId:
        input?.educationInstitutionId === undefined
          ? undefined
          : input.educationInstitutionId,
      includeInactive: input?.includeInactive ?? true,
    });
  }),

upsertSubjectPriceRule: hostProcedure
  .input(
    z.object({
      id: z.number().optional(),
      educationInstitutionId: z.number().nullable().optional(),
      label: z.string().min(1),
      thresholdAmount: z.union([z.string(), z.number()]),
      creditValue: z.number(),
      sortOrder: z.number().optional(),
      isActive: z.boolean().optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const organizationId = getCtxOrganizationId(ctx);

    return db.upsertSettlementSubjectPriceRule({
      organizationId,
      id: input.id,
      educationInstitutionId:
        input.educationInstitutionId === undefined
          ? null
          : input.educationInstitutionId,
      label: input.label,
      thresholdAmount: input.thresholdAmount,
      creditValue: input.creditValue,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
    });
  }),

deleteSubjectPriceRule: hostProcedure
  .input(
    z.object({
      id: z.number(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const organizationId = getCtxOrganizationId(ctx);

    return db.deleteSettlementSubjectPriceRule({
      organizationId,
      id: input.id,
    });
  }),

listInstitutionPriceRules: hostProcedure
  .input(
    z.object({
      educationInstitutionId: z.number(),
      includeInactive: z.boolean().optional(),
    })
  )
  .query(async ({ ctx, input }) => {
    const organizationId = getCtxOrganizationId(ctx);

    return db.listSettlementInstitutionPriceRules({
      organizationId,
      educationInstitutionId: input.educationInstitutionId,
      includeInactive: input.includeInactive ?? true,
    });
  }),

upsertInstitutionPriceRule: hostProcedure
  .input(
    z.object({
      id: z.number().optional(),
      educationInstitutionId: z.number(),
      thresholdAmount: z.union([z.string(), z.number()]),
      institutionUnitCost: z.union([z.string(), z.number()]),
      sortOrder: z.number().optional(),
      isActive: z.boolean().optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const organizationId = getCtxOrganizationId(ctx);

    return db.upsertSettlementInstitutionPriceRule({
      organizationId,
      id: input.id,
      educationInstitutionId: input.educationInstitutionId,
      thresholdAmount: input.thresholdAmount,
      institutionUnitCost: input.institutionUnitCost,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
    });
  }),

deleteInstitutionPriceRule: hostProcedure
  .input(
    z.object({
      id: z.number(),
      educationInstitutionId: z.number(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const organizationId = getCtxOrganizationId(ctx);

    return db.deleteSettlementInstitutionPriceRule({
      organizationId,
      id: input.id,
      educationInstitutionId: input.educationInstitutionId,
    });
  }),

    getInstitutionPositionRate: protectedProcedure
      .input(
        z.object({
          educationInstitutionId: z.number(),
          positionId: z.number(),
        })
      )
      .query(async ({ input, ctx }) => {
  return db.getEducationInstitutionPositionRate(
    input.educationInstitutionId,
    input.positionId,
    {
      organizationId: getCtxOrganizationId(ctx),
    }
  );
}),

    upsertInstitutionPositionRate: hostProcedure
      .input(
        z.object({
          educationInstitutionId: z.number(),
          positionId: z.number(),
          freelancerUnitAmount: z.string(),
          isActive: z.boolean().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
  const id = await db.upsertEducationInstitutionPositionRate({
    organizationId: getCtxOrganizationId(ctx),
    educationInstitutionId: input.educationInstitutionId,
    positionId: input.positionId,
    freelancerUnitAmount: input.freelancerUnitAmount,
    isActive: input.isActive ?? true,
  });

  return { success: true, id };
}),

    deleteInstitutionPositionRate: hostProcedure
      .input(
        z.object({
          id: z.number(),
        })
      )
      .mutation(async ({ input, ctx }) => {
  await db.deleteEducationInstitutionPositionRate(input.id, {
    organizationId: getCtxOrganizationId(ctx),
  });

  return { success: true };
}),

    listPrivateCertificateMastersForSettlement: protectedProcedure.query(
  async ({ ctx }) => {
    const organizationId = getCtxOrganizationId(ctx);

    if (!organizationId) {
      throwAppError(
  ERROR_CODES.ORGANIZATION_REQUIRED,
  "organizationId is required",
  400
);
    }

    return db.listPrivateCertificateMasters({
      organizationId,
      activeOnly: false,
    });
  }
),

getSettings: protectedProcedure.query(async ({ ctx }) => {
  return db.getSettlementSettings({
    organizationId: getCtxOrganizationId(ctx),
  });
}),

    saveSettings: hostProcedure
      .input(
        z.object({
          payoutDay: z.number().min(1).max(31),
        })
      )
      .mutation(async ({ input, ctx }) => {
  const id = await db.saveSettlementSettings({
    organizationId: getCtxOrganizationId(ctx),
    payoutDay: input.payoutDay,
  });

  return { success: true, id };
}),

    backfillSettlementItems: hostProcedure
  .input(
    z.object({
      year: z.number().int().min(2020).max(2100),
      month: z.number().int().min(1).max(12),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const organizationId = getCtxOrganizationId(ctx);

    return db.backfillSettlementItems(Number(ctx.user.id), {
      organizationId,
      year: input.year,
      month: input.month,
    });
  }),

cleanupOrphanSettlementItems: hostProcedure
  .mutation(async ({ ctx }) => {
    return await db.cleanupOrphanSettlementItems({
      organizationId: getCtxOrganizationId(ctx),
    });
  }),
  }),

    ai: router({

    workSession:
      router({

        get:
          protectedProcedure
            .input(
              z.object({
                targetOrganizationId:
                  z.number()
                    .int()
                    .positive()
                    .optional()
                    .nullable(),
              })
                .optional()
            )
            .query(
              async ({
                ctx,
                input,
              }) => {
                const aiContext =
                  await createRequestAiContext({
                    ctx,

                    targetOrganizationId:
                      input
                        ?.targetOrganizationId ??
                      null,
                  });

                const session =
                  await db.getAiWorkSession({
                    organizationId:
                      aiContext.organizationId,

                    userId:
                      aiContext.userId,
                  });

                return {
                  success:
                    true,

                  session,
                };
              }
            ),

        setStudentTarget:
          protectedProcedure
            .input(
              z.object({
                studentId:
                  z.number()
                    .int()
                    .positive(),

                expectedVersion:
                  z.number()
                    .int()
                    .positive(),

                targetOrganizationId:
                  z.number()
                    .int()
                    .positive()
                    .optional()
                    .nullable(),
              })
            )
            .mutation(
              async ({
                ctx,
                input,
              }) => {
                const aiContext =
                  await createRequestAiContext({
                    ctx,

                    targetOrganizationId:
                      input
                        .targetOrganizationId ??
                      null,
                  });

                const student =
                  await db.getStudentById(
                    input.studentId,
                    {
                      organizationId:
                        aiContext.organizationId,
                    }
                  );

                if (!student) {
                  throwAppError(
                    ERROR_CODES.DATA_NOT_FOUND,
                    "현재 작업 대상으로 설정할 학생을 찾을 수 없습니다.",
                    404
                  );
                }

                assertCanAccessStudent({
                  context:
                    aiContext,

                  student,
                });

                const session =
                  await db.setAiActiveTarget({
                    organizationId:
                      aiContext.organizationId,

                    userId:
                      aiContext.userId,

                    expectedVersion:
                      input.expectedVersion,

                    target: {
                      type:
                        "student",

                      id:
                        Number(
                          student.id
                        ),

                      name:
                        String(
                          student.clientName ||
                          ""
                        ).trim() ||
                        null,
                    },

                    linkedContext: {
                      consultationId:
                        student.consultationId ===
                          null ||
                        student.consultationId ===
                          undefined
                          ? null
                          : Number(
                              student.consultationId
                            ),

                      studentId:
                        Number(
                          student.id
                        ),

                      practiceRequestId:
                        null,

                      privateCertificateRequestIds:
                        [],
                    },
                  });

                return {
                  success:
                    true,

                  message:
                    session.activeTarget
                      ?.name
                      ? `${session.activeTarget.name} 학생을 현재 작업 대상으로 설정했습니다.`
                      : "학생을 현재 작업 대상으로 설정했습니다.",

                  session,
                };
              }
            ),

        clearWorkflow:
          protectedProcedure
            .input(
              z.object({
                expectedVersion:
                  z.number()
                    .int()
                    .positive(),

                targetOrganizationId:
                  z.number()
                    .int()
                    .positive()
                    .optional()
                    .nullable(),
              })
            )
            .mutation(
              async ({
                ctx,
                input,
              }) => {
                const aiContext =
                  await createRequestAiContext({
                    ctx,

                    targetOrganizationId:
                      input
                        .targetOrganizationId ??
                      null,
                  });

                const session =
                  await db.clearAiWorkSession({
                    organizationId:
                      aiContext.organizationId,

                    userId:
                      aiContext.userId,

                    expectedVersion:
                      input.expectedVersion,

                    preserveActiveTarget:
                      true,
                  });

                return {
                  success:
                    true,

                  message:
                    "현재 작업 대상은 유지하고 진행 중인 업무를 초기화했습니다.",

                  session,
                };
              }
            ),

        clearAll:
          protectedProcedure
            .input(
              z.object({
                expectedVersion:
                  z.number()
                    .int()
                    .positive(),

                targetOrganizationId:
                  z.number()
                    .int()
                    .positive()
                    .optional()
                    .nullable(),
              })
            )
            .mutation(
              async ({
                ctx,
                input,
              }) => {
                const aiContext =
                  await createRequestAiContext({
                    ctx,

                    targetOrganizationId:
                      input
                        .targetOrganizationId ??
                      null,
                  });

                const session =
                  await db.clearAiWorkSession({
                    organizationId:
                      aiContext.organizationId,

                    userId:
                      aiContext.userId,

                    expectedVersion:
                      input.expectedVersion,

                    preserveActiveTarget:
                      false,
                  });

                return {
                  success:
                    true,

                  message:
                    "현재 작업 대상과 진행 중인 업무를 모두 초기화했습니다.",

                  session,
                };
              }
            ),
      }),

    chatHistory:
      protectedProcedure
        .input(
          z.object({
            limit:
              z.number()
                .int()
                .min(1)
                .max(500)
                .optional()
                .default(500),

            targetOrganizationId:
              z.number()
                .int()
                .positive()
                .optional()
                .nullable(),
          })
            .optional()
        )
        .query(
          async ({
            ctx,
            input,
          }) => {
            const aiContext =
              await createRequestAiContext({
                ctx,

                targetOrganizationId:
                  input
                    ?.targetOrganizationId ??
                  null,
              });

                        const [
              rows,
              workSession,
            ] =
              await Promise.all([
                db.getAiChatMessages({
                  organizationId:
                    aiContext.organizationId,

                  userId:
                    aiContext.userId,

                  limit:
                    input?.limit ??
                    500,
                }),

                db.getAiWorkSession({
                  organizationId:
                    aiContext.organizationId,

                  userId:
                    aiContext.userId,
                }),
              ]);

            return {
              success:
                true,

              messages:
                rows.map(
                  toAiChatPublicMessage
                ),

              total:
                rows.length,

              workSession,
            };
          }
        ),

    saveChatMessage:
      protectedProcedure
        .input(
          aiSaveChatMessageInputSchema
        )
        .mutation(
          async ({
            ctx,
            input,
          }) => {
            const aiContext =
              await createRequestAiContext({
                ctx,

                targetOrganizationId:
                  input
                    .targetOrganizationId ??
                  null,
              });

            const messageDataJson =
              input.data ??
              null;

            /**
             * 이미지 Base64가 실수로 메시지 데이터에
             * 들어가는 것을 서버에서 차단한다.
             */
            const serializedData =
              messageDataJson
                ? JSON.stringify(
                    messageDataJson
                  )
                : "";

            if (
              /imageBase64/i.test(
                serializedData
              )
            ) {
              throwAppError(
                ERROR_CODES.INVALID_REQUEST,
                "AI 채팅 기록에는 이미지 원본을 저장할 수 없습니다.",
                400
              );
            }

            if (
              serializedData.length >
              2_000_000
            ) {
              throwAppError(
                ERROR_CODES.INVALID_REQUEST,
                "AI 채팅 카드 데이터가 너무 큽니다.",
                400
              );
            }

            const id =
              await db.saveAiChatMessage({
                organizationId:
                  aiContext.organizationId,

                userId:
                  aiContext.userId,

                role:
                  input.role,

                kind:
                  input.kind,

                content:
                  input.content,

                                messageDataJson,

                selectedStudentId:
                  input.selectedStudentId ??
                  null,
              });

            return {
              success:
                true,

              id,
            };
          }
        ),

    clearChatHistory:
      protectedProcedure
        .input(
          z.object({
            targetOrganizationId:
              z.number()
                .int()
                .positive()
                .optional()
                .nullable(),
          })
            .optional()
        )
        .mutation(
          async ({
            ctx,
            input,
          }) => {
            const aiContext =
              await createRequestAiContext({
                ctx,

                targetOrganizationId:
                  input
                    ?.targetOrganizationId ??
                  null,
              });

            await db.clearAiChatMessages({
              organizationId:
                aiContext.organizationId,

              userId:
                aiContext.userId,
            });

            return {
              success:
                true,

              message:
                "AI 대화 기록이 전체 삭제되었습니다.",
            };
          }
        ),
    /**
     * AI 페이지 초기 진입용
     * 현재 로그인 유저 기준으로 사용 가능 기능 요약
     */
  bootstrap: protectedProcedure
  .input(
    z
      .object({
        targetOrganizationId: z
          .number()
          .int()
          .positive()
          .optional(),
      })
      .optional()
  )
  .query(async ({ ctx, input }) => {
    const aiContext =
      await createRequestAiContext({
        ctx,
        targetOrganizationId:
          input?.targetOrganizationId,
      });

    const availableTools =
      listRegisteredAiTools().filter(
        (tool) =>
          tool.allowedRoles.includes(
            aiContext.role
          )
      );

    return {
      success: true,

      user: {
        id: aiContext.userId,
        name: aiContext.userName,
        role: aiContext.role,
      },

      context: {
        organizationId:
          aiContext.organizationId,

        teamId: aiContext.teamId,
        positionId:
          aiContext.positionId,

        scope: aiContext.scope,

        /**
         * 사용자 ID 목록 자체는 프론트에 줄 필요가 없으므로
         * 개수만 전달한다.
         */
        allowedAssigneeCount:
          aiContext.allowedAssigneeIds ===
          null
            ? null
            : aiContext
                .allowedAssigneeIds
                .length,

        canWrite:
          aiContext.canWrite,

        canDelete:
          aiContext.canDelete,
      },

      capabilities: {
        canSearchStudents:
          availableTools.some(
            (tool) =>
              tool.name ===
              "student.search"
          ),

        canSearchConsultations:
          availableTools.some(
            (tool) =>
              tool.name ===
              "consultation.search"
          ),

        canReadNotifications:
          availableTools.some(
            (tool) =>
              tool.name ===
              "alert.missingData"
          ),

          canUsePendingActions:
          true,

        /**
 * AI 학생 통합등록 승인 실행 API 연결 완료
 */
canConfirmPendingActions:
  aiContext.canWrite === true,

        /**
         * 기존 직접 등록 API 존재 여부
         *
         * 현재는 true지만,
         * AI 자동등록 승인 기능과는 별개다.
         */
        canCreateTransferSubject:
          true,

        canCreatePlanSemester:
          true,

        canRecommendPracticePlace:
          true,

        canRunRiskScan:
          availableTools.some(
            (tool) =>
              tool.name ===
              "risk.studentDetail" ||
              tool.name ===
              "risk.studentList"
          ),

        canModifyServer: false,
        canDeleteData: false,
        canAlterSchema: false,
      },

      tools: availableTools,
    };
  }),

/**
 * 교육 관련 이미지 문서 분석
 *
 * 성적증명서, 교육원 수강내역,
 * 결제내역, 홈페이지 캡처 등을 분석한다.
 *
 * 분석 결과만 반환하며
 * DB 저장은 절대로 실행하지 않는다.
 */
analyzeDocument:
  protectedProcedure
    .input(
      aiDocumentAnalysisInputSchema
    )
    .mutation(
      async ({
        ctx,
        input,
      }) => {
        const aiContext =
          await createRequestAiContext({
            ctx,

            targetOrganizationId:
              input
                .targetOrganizationId ??
              null,
          });

                /**
         * 학생 운영 문서 분석은
         * Staff, Admin, Host만 사용할 수 있다.
         *
         * Staff:
         * 본인 담당 학생
         *
         * Admin:
         * 같은 팀 학생
         *
         * Host:
         * 같은 회사 전체 학생
         *
         * Superhost:
         * 학생 운영 데이터 접근 불가
         */
        if (
          aiContext.role !==
            "staff" &&
          aiContext.role !==
            "admin" &&
          aiContext.role !==
            "host"
        ) {
          throwAppError(
            ERROR_CODES.PERMISSION_DENIED,
            "현재 계정은 학생 문서를 분석할 수 없습니다.",
            403
          );
        }

        /**
         * 학생이 선택된 상태라면
         * 해당 학생이 실제로 존재하는지 확인한다.
         */
                if (
          input.studentId
        ) {
          const student =
            await db.getStudent(
              Number(
                input.studentId
              ),
              {
                organizationId:
                  aiContext.organizationId,
              }
            );

          if (!student) {
            throwAppError(
              ERROR_CODES.DATA_NOT_FOUND,
              "선택한 학생을 찾을 수 없습니다.",
              404
            );
          }

          /**
           * OCR 분석은 조회 권한을 사용한다.
           *
           * Staff:
           * 본인 담당 학생만 가능
           *
           * Admin:
           * 같은 팀 학생 가능
           *
           * Host:
           * 같은 회사 학생 가능
           */
          assertCanAccessStudent({
            context:
              aiContext,

            student,
          });
        }

        try {
          const result =
            await analyzeAiDocument({
              studentId:
                input.studentId ??
                null,

              mimeType:
                input.mimeType,

              fileName:
                input.fileName,

              imageBase64:
                input.imageBase64,
            });

          return {
            success: true,

            /**
             * DB에 저장된 데이터가 아니라
             * 담당자 확인용 분석 결과다.
             */
            analysis:
              result,

            meta: {
              organizationId:
                aiContext
                  .organizationId,

              userId:
                aiContext.userId,

              scope:
                aiContext.scope,

              saved:
                false,
            },
          };
        } catch (error) {
          console.error(
            "[AI DOCUMENT] 문서 분석 실패",
            {
              organizationId:
                aiContext
                  .organizationId,

              userId:
                aiContext.userId,

              studentId:
                input.studentId ??
                null,

              fileName:
                input.fileName,

              error,
            }
          );

          throwAppError(
            ERROR_CODES
              .INTERNAL_SERVER_ERROR,
            error instanceof Error
              ? error.message
              : "AI 문서 분석 중 오류가 발생했습니다.",
            500
          );
        }
      }
    ),

/**
 * 문서 분석 결과 CRM 반영 승인 초안 생성
 *
 * 실제 학생·과목·결제정보는 변경하지 않는다.
 * ai_pending_actions에 승인용 초안만 저장한다.
 */
documentImportPreview:
  protectedProcedure
    .input(
      aiDocumentImportPreviewInputSchema
    )
    .mutation(
      async ({
        ctx,
        input,
      }) => {
        const aiContext =
          await createRequestAiContext({
            ctx,

            targetOrganizationId:
              input
                .targetOrganizationId ??
              null,
          });

/**
 * 문서 반영 Pending Action 종류
 */
const documentPendingActionTypes =
  new Set([
    "document_transfer_import",
    "document_plan_import",
    "document_payment_import",
    "document_plan_payment_import",
  ]);

/**
 * 현재 AI 업무 세션을 먼저 가져온다.
 *
 * 동일 학생·동일 분석 문서의 기존 승인 초안을
 * 새 초안 생성 성공 후 교체하기 위해 사용한다.
 */
let workSession =
  await db.getAiWorkSession({
    organizationId:
      aiContext.organizationId,

    userId:
      aiContext.userId,
  });

const previousPresentedDocumentAction =
  workSession.lastPresentedAction;

const previousDocumentPendingActionId =
  previousPresentedDocumentAction &&
  previousPresentedDocumentAction.targetType ===
    "student" &&
  Number(
    previousPresentedDocumentAction.targetId ||
    0
  ) ===
    Number(
      input.studentId
    ) &&
  documentPendingActionTypes.has(
    String(
      previousPresentedDocumentAction.actionType ||
      ""
    )
  ) &&
  String(
    previousPresentedDocumentAction
      .payload
      ?.analysisId ||
    ""
  ) ===
    String(
      input.analysis.analysisId ||
      ""
    )
    ? Number(
        previousPresentedDocumentAction
          .payload
          ?.pendingActionId ||
        0
      )
    : 0;

                      /**
         * OCR 이미지 분석 자체는 조회 범위에서 가능하지만,
         * 분석 결과를 CRM 반영 초안으로 만드는 작업은
         * 실제 입력 작업의 시작 단계다.
         *
         * Staff/Admin/Host 모두
         * 본인이 실제 담당자인 학생만
         * 문서 CRM 반영 초안을 생성할 수 있다.
         *
         * Admin과 Host의 넓은 조회 범위는
         * 분석과 확인에만 사용하며,
         * 다른 담당자의 학생 데이터 입력에는 사용하지 않는다.
         *
         * Superhost는 학생 운영 데이터에
         * 반영 초안을 생성할 수 없다.
         */
        if (
          aiContext.role !==
            "staff" &&
          aiContext.role !==
            "admin" &&
          aiContext.role !==
            "host"
        ) {
          throwAppError(
            ERROR_CODES.PERMISSION_DENIED,
            "현재 계정은 문서 CRM 반영 초안을 생성할 수 없습니다.",
            403
          );
        }

        if (
          aiContext.canWrite !==
          true
        ) {
          throwAppError(
            ERROR_CODES.PERMISSION_DENIED,
            "현재 계정은 AI 문서 반영 초안을 생성할 수 없습니다.",
            403
          );
        }

        const student =
          await db.getStudent(
            Number(
              input.studentId
            ),
            {
              organizationId:
                aiContext.organizationId,
            }
          );

        if (!student) {
          throwAppError(
            ERROR_CODES.DATA_NOT_FOUND,
            "반영 대상 학생을 찾을 수 없습니다.",
            404
          );
        }

                        /**
         * 문서 CRM 반영 초안 생성은
         * 실제 데이터 입력 작업의 시작 단계다.
         *
         * 따라서 단순 조회 권한이 아니라
         * 현재 학생의 실제 담당자 쓰기 권한을 검사한다.
         *
         * Staff:
         * 본인 담당 학생만 가능
         *
         * Admin:
         * 팀 학생을 조회할 수 있지만
         * 본인 담당 학생만 반영 초안 생성 가능
         *
         * Host:
         * 회사 전체 학생을 조회할 수 있지만
         * 본인 담당 학생만 반영 초안 생성 가능
         *
         * Superhost:
         * 학생 운영 데이터 반영 불가
         */
        assertCanWriteStudent({
          context:
            aiContext,

          student,
        });

        const existingDocumentPendingAction =
  await db.getLatestPendingDocumentActionByStudentId({
    organizationId:
      aiContext.organizationId,

    studentId:
      Number(
        student.id
      ),

    requestedByUserId:
      aiContext.userId,
  });

        if (
          existingDocumentPendingAction
        ) {
          const publicExistingPendingAction =
            toAiPendingActionPublicResult(
              existingDocumentPendingAction
            );

          if (
            !publicExistingPendingAction
          ) {
            throwAppError(
              ERROR_CODES.INTERNAL_SERVER_ERROR,
              "기존 문서 CRM 반영 초안을 조회하지 못했습니다.",
              500
            );
          }

          /**
           * OCR 초안 취소는 최초 생성자 본인만 가능하다.
           *
           * 프론트에서 reused 여부로 추측하지 않고
           * 서버 DB의 requestedByUserId와 현재 사용자 ID를
           * 직접 비교한 결과를 반환한다.
           */
          const canCancel =
            Number(
              existingDocumentPendingAction
                .requestedByUserId ||
              0
            ) ===
            Number(
              aiContext.userId
            );

                    return {
            success:
              true,

            reused:
              true,

            canCancel,

            message:
              canCancel
                ? "이 학생에게 이미 본인이 생성한 승인 대기 중인 문서 CRM 반영 초안이 있습니다. 기존 초안을 먼저 확인해주세요."
                : "이 학생에게 이미 승인 대기 중인 문서 CRM 반영 초안이 있습니다. 기존 초안을 먼저 승인해주세요.",

            pendingAction:
              publicExistingPendingAction,

            action:
              publicExistingPendingAction,

            workSession,
          };
        }

        const analysis =
          input.analysis as
            AiDocumentAnalysisResult;

        /**
         * 문서에 추출된 학생명이 있고
         * 현재 선택 학생명과 다르면 경고를 추가한다.
         *
         * 이름 불일치만으로 초안 생성을 차단하지는 않는다.
         */
        const selectedStudentName =
          String(
            student.clientName ||
            ""
          ).trim();

        const documentStudentName =
          String(
            analysis
              .studentName
              ?.value ||
            ""
          ).trim();

        const nameMismatch =
          Boolean(
            selectedStudentName &&
            documentStudentName &&
            selectedStudentName !==
              documentStudentName
          );

        const normalizedAnalysis:
          AiDocumentAnalysisResult = {
          ...analysis,

          warnings:
            Array.from(
              new Set([
                ...(
                  analysis.warnings ||
                  []
                ),

                ...(
                  nameMismatch
                    ? [
                        `문서 학생명(${documentStudentName})과 선택 학생명(${selectedStudentName})이 일치하지 않습니다.`,
                      ]
                    : []
                ),
              ])
            ),
        };

const nileClassifiedAnalysis =
  await applyNileClassificationToUniversityTranscript({
    student,

    analysis:
      normalizedAnalysis,
  });

        let built:
          ReturnType<
            typeof buildDocumentImportDraft
          >;

        try {
          built =
            buildDocumentImportDraft({
              studentId:
                Number(
                  student.id
                ),

              analysis:
  nileClassifiedAnalysis,

              target:
                input.target ??
                null,
            });
        } catch (
          error
        ) {
          throwAppError(
            ERROR_CODES.INVALID_REQUEST,
            error instanceof
              Error
              ? error.message
              : "문서 CRM 반영 초안을 생성하지 못했습니다.",
            400
          );
        }

        const pendingAction =
          await db.createAiPendingAction({
            organizationId:
              aiContext.organizationId,

            requestedByUserId:
              aiContext.userId,

            requestedByRole:
              aiContext.role,

            actionType:
              built
                .draft
                .actionType,

            consultationId:
              null,

            studentId:
              Number(
                student.id
              ),

            semesterId:
              null,

            preview:
              built.preview,

            /**
             * 실제 Executor가 사용할 데이터다.
             *
             * 현재는 암호화된 Pending JSON으로만 저장되며
             * 실제 학생 데이터에는 반영되지 않는다.
             */
            payload: {
              draft:
                built.draft,
            },

            /**
             * 승인 시점에 원본 변경 여부를 비교하기 위한
             * 최소 학생 스냅샷이다.
             */
            sourceSnapshot: {
              student: {
                id:
                  Number(
                    student.id
                  ),

                organizationId:
                  Number(
                    student.organizationId
                  ),

                assigneeId:
                  student.assigneeId ===
                    null ||
                  student.assigneeId ===
                    undefined
                    ? null
                    : Number(
                        student.assigneeId
                      ),

                clientName:
                  student.clientName ||
                  null,

                course:
                  student.course ||
                  null,

                paymentAmount:
                  student.paymentAmount ??
                  null,

                paymentDate:
                  student.paymentDate ??
                  null,

                updatedAt:
                  student.updatedAt ??
                  null,
              },

              document: {
                analysisId:
                  built
                    .draft
                    .analysisId,

                documentType:
                  built
                    .draft
                    .documentType,

                target:
                  built
                    .draft
                    .target,

                analyzedAt:
                  built
                    .draft
                    .analyzedAt,
              },
            },

            expiresInMinutes:
              input
                .expiresInMinutes ??
              30,
          });

        const publicPendingAction =
          toAiPendingActionPublicResult(
            pendingAction
          );

        if (
          !publicPendingAction
        ) {
          throwAppError(
            ERROR_CODES.INTERNAL_SERVER_ERROR,
            "문서 CRM 반영 초안을 생성했지만 조회하지 못했습니다.",
            500
          );
        }

const canConfirm =
  publicPendingAction
    .preview
    ?.canConfirm ===
  true;

let previousDocumentPendingAction:
  any =
  null;

if (
  Number.isFinite(
    previousDocumentPendingActionId
  ) &&
  previousDocumentPendingActionId > 0 &&
  previousDocumentPendingActionId !==
    Number(
      pendingAction.id
    )
) {
  previousDocumentPendingAction =
    await db.getAiPendingActionForConfirmation({
      id:
        Math.floor(
          previousDocumentPendingActionId
        ),

      organizationId:
        aiContext.organizationId,

      requestedByUserId:
        aiContext.userId,
    });
}

/**
 * Work Session 값만 믿지 않고,
 * DB에서 다시 조회한 기존 Pending Action도 검사한다.
 */
const canReplacePreviousDocumentAction =
  canConfirm ===
    true &&
  previousDocumentPendingAction &&
Number(
  previousDocumentPendingAction.requestedByUserId || 0
) ===
Number(aiContext.userId) &&
documentPendingActionTypes.has(
    String(
      previousDocumentPendingAction
        .actionType ||
      ""
    )
  ) &&
  Number(
    previousDocumentPendingAction
      .studentId ||
    0
  ) ===
    Number(
      student.id
    ) &&
  Number(
    previousDocumentPendingAction
      .id ||
    0
  ) !==
    Number(
      pendingAction.id
    );

if (
  canConfirm ===
  true
) {
  /**
   * 새 문서 Pending Action을 먼저
   * Work Session의 현재 승인 대상으로 연결한다.
   */
  workSession =
    await db.patchAiWorkSession({
      organizationId:
        aiContext.organizationId,

      userId:
        aiContext.userId,

      expectedVersion:
        workSession.version,

      patch: {
        activeTarget: {
          type:
            "student",

          id:
            Number(
              student.id
            ),

          name:
            student.clientName ??
            null,
        },

        linkedContext: {
          studentId:
            Number(
              student.id
            ),
        },

        workflow: {
          step:
            "awaiting_confirmation",

          clearDraft:
            true,

          draftPatch: {
            analysisId:
              built.draft.analysisId,

            documentType:
              built.draft.documentType,

            target:
              built.draft.target,

            actionType:
              built.draft.actionType,

            studentId:
              Number(
                student.id
              ),
          },

          waitingFor:
            [],
        },

        lastPresentedAction: {
          actionId:
            `pending-action-${Number(
              pendingAction.id
            )}`,

          actionType:
            built.draft.actionType,

          targetType:
            "student",

          targetId:
            Number(
              student.id
            ),

          payload: {
            pendingActionId:
              Number(
                pendingAction.id
              ),

            analysisId:
              built.draft.analysisId,

            documentType:
              built.draft.documentType,

            target:
              built.draft.target,
          },

          expiresAt:
            pendingAction.expiresAt
              ? new Date(
                  pendingAction.expiresAt
                ).toISOString()
              : new Date(
                  Date.now() +
                  (
                    input.expiresInMinutes ??
                    30
                  ) *
                  60 *
                  1000
                ).toISOString(),
        },
      },
    });

  /**
   * 새 Pending Action 생성 및 Work Session 연결이
   * 모두 성공한 뒤에만 기존 초안을 취소한다.
   */
  if (
    canReplacePreviousDocumentAction
  ) {
    await cancelAiPendingActionForCurrentUser({
      ctx,

      pendingActionId:
        Number(
          previousDocumentPendingAction.id
        ),

      expectedVersion:
        null,

      targetOrganizationId:
        input.targetOrganizationId ??
        null,
    });
  }
} else {
  /**
   * 새 문서 초안에 누락값이 있으면
   * 기존 승인 가능 문서 초안을 유지한다.
   */
  const shouldPreservePreviousDocumentAction =
    previousDocumentPendingAction &&
    documentPendingActionTypes.has(
      String(
        previousDocumentPendingAction
          .actionType ||
        ""
      )
    ) &&
    Number(
      previousDocumentPendingAction
        .studentId ||
      0
    ) ===
      Number(
        student.id
      );

  const missingFields =
    Array.isArray(
      publicPendingAction
        .preview
        ?.missingFields
    )
      ? publicPendingAction
          .preview
          .missingFields
          .map(
            (
              value: unknown
            ) =>
              String(
                value ||
                ""
              ).trim()
          )
          .filter(
            Boolean
          )
      : [];

  workSession =
    await db.patchAiWorkSession({
      organizationId:
        aiContext.organizationId,

      userId:
        aiContext.userId,

      expectedVersion:
        workSession.version,

      patch: {
        activeTarget: {
          type:
            "student",

          id:
            Number(
              student.id
            ),

          name:
            student.clientName ??
            null,
        },

        linkedContext: {
          studentId:
            Number(
              student.id
            ),
        },

        workflow:
          shouldPreservePreviousDocumentAction
            ? {
                step:
                  "awaiting_confirmation",

                waitingFor:
                  [],
              }
            : {
                step:
                  "collecting_data",

                draftPatch: {
                  analysisId:
                    built.draft.analysisId,

                  documentType:
                    built.draft.documentType,

                  target:
                    built.draft.target,

                  actionType:
                    built.draft.actionType,

                  studentId:
                    Number(
                      student.id
                    ),
                },

                waitingFor:
                  missingFields,
              },

        lastPresentedAction:
          shouldPreservePreviousDocumentAction
            ? workSession
                .lastPresentedAction
            : null,
      },
    });
}

        await db.createAiActionLog({
  organizationId:
    aiContext.organizationId,

  userId:
    aiContext.userId,

  userName:
    aiContext.userName ||
    String(
      (ctx.user as any)
        ?.username ||
      ""
    ),

  action:
    "ai_document_import_preview",

  targetStudentId:
    Number(
      student.id
    ),

  targetStudentName:
    student.clientName ||
    null,

  payload: {
    request: {
      analysisId:
        built
          .draft
          .analysisId,

      documentType:
        built
          .draft
          .documentType,

      target:
        built
          .draft
          .target,

      actionType:
        built
          .draft
          .actionType,

      subjectCount:
        built
          .draft
          .subjects
          .length,

      hasPaymentAmount:
        built
          .draft
          .paymentAmount !==
        null,
    },

    result: {
  pendingActionId:
    publicPendingAction.id,

  status:
    publicPendingAction.status,

  canConfirm,

  replacedPendingActionId:
    canReplacePreviousDocumentAction
      ? Number(
          previousDocumentPendingAction.id
        )
      : null,

  missingFieldCount:
    publicPendingAction
      .preview
      ?.missingFields
      ?.length ||
    0,

  warningCount:
    publicPendingAction
      .preview
      ?.warnings
      ?.length ||
    0,
},
  },
});

        return {
  success:
    true,

  /**
   * 이번 요청에서 현재 사용자가 직접 만든 초안이다.
   */
  canCancel:
    true,

  message:
    canConfirm
      ? canReplacePreviousDocumentAction
        ? "수정된 문서 CRM 반영 초안으로 교체했습니다. 내용을 확인한 후 승인해주세요."
        : "문서 CRM 반영 내용을 확인한 후 승인해주세요."
      : previousDocumentPendingAction
        ? "수정된 문서 초안에 누락정보가 있어 기존 승인 초안을 유지했습니다."
        : "문서 CRM 반영에 필요한 일부 정보를 확인해주세요.",

  pendingAction:
    publicPendingAction,

  replacedPendingActionId:
    canReplacePreviousDocumentAction
      ? Number(
          previousDocumentPendingAction.id
        )
      : null,

  workSession,
};
      }
    ),

/**
 * 학생 통합등록 승인 초안 생성
 *
 * 실제 학생, 플랜, 학기, 과목은 생성하지 않는다.
 * ai_pending_actions에 승인용 초안만 저장한다.
 */
studentRegistrationPreview:
  protectedProcedure
    .input(
      z.object({
        /**
         * 상담DB에서 선택한 상담 ID
         */
        consultationId: z
          .number()
          .int()
          .positive(),

        /**
         * 사용자가 입력한 학생 등록 지시문
         */
        message: z
          .string()
          .trim()
          .min(
            1,
            "학생 등록 내용을 입력해주세요."
          )
          .max(
            10000,
            "학생 등록 내용은 10,000자를 초과할 수 없습니다."
          ),

        /**
         * AI가 설계한 앞으로 수강할
         * 우리플랜 과목
         */
        planSubjects:
          z.array(
            studentRegistrationPlanSubjectSchema
          )
            .max(
              100,
              "한 번에 설계할 수 있는 우리플랜 과목은 최대 100개입니다."
            )
            .optional()
            .default([]),       

 /**
         * OCR 또는 별도 과목 추출 결과
         */
        ocrSubjects: z
          .array(
            studentRegistrationOcrSubjectSchema
          )
          .max(
            100,
            "한 번에 등록할 수 있는 과목은 최대 100개입니다."
          )
          .optional()
          .default([]),

        /**
         * Superhost가 특정 회사를 선택한 경우에만 사용한다.
         * 일반 사용자는 서버 세션 organizationId로 고정된다.
         */
        targetOrganizationId: z
          .number()
          .int()
          .positive()
          .optional(),

        /**
         * 초안 만료시간
         *
         * 프론트에서 생략하면 DB 함수 기본값 30분 사용
         */
        expiresInMinutes: z
          .number()
          .int()
          .min(5)
          .max(24 * 60)
          .optional(),
      })
    )
    .mutation(
      async ({
        ctx,
        input,
      }) => {
        /**
         * 1. 세션 기반 AI 권한 Context 생성
         */
        const aiContext =
          await createRequestAiContext({
            ctx,

            targetOrganizationId:
              input.targetOrganizationId ??
              null,
          });

/**
 * 학생 통합등록 미리보기는 단순 조회가 아니다.
 *
 * 정보가 충족되면 실행 가능한 Pending Action을
 * 생성하므로 현재 AI 쓰기 권한이 반드시 필요하다.
 *
 * Superhost와 조회 전용 계정은
 * 학생 통합등록 초안을 생성할 수 없다.
 */
if (
  aiContext.canWrite !==
    true
) {
  throwAppError(
    ERROR_CODES.PERMISSION_DENIED,
    "현재 계정은 AI 학생 통합등록 초안을 생성할 수 없습니다.",
    403
  );
}

        let workSession =
  await db.getAiWorkSession({
    organizationId:
      aiContext.organizationId,

    userId:
      aiContext.userId,
  });

/**
 * 현재 동일 상담의 학생 통합등록 승인 초안이
 * 열려 있는지 확인하기 위한 서버 세션값이다.
 *
 * 새 초안 생성과 Work Session 연결이 성공한 뒤에만
 * 기존 초안을 취소한다.
 */
const previousRegistrationPendingActionId =
  workSession
    .lastPresentedAction
    ?.actionType ===
      "student_registration_create" &&
  workSession
    .lastPresentedAction
    ?.targetType ===
      "consultation" &&
  Number(
    workSession
      .lastPresentedAction
      ?.targetId ||
    0
  ) ===
    Number(
      input.consultationId
    )
    ? Number(
        workSession
          .lastPresentedAction
          ?.payload
          ?.pendingActionId ||
        0
      )
    : 0;

        /**
         * 2. 상담DB 원본 조회
         *
         * organizationId는 프론트 값을 사용하지 않고
         * AI Context에 확정된 값을 사용한다.
         */
        const consultation =
          await db.getConsultation(
            input.consultationId,
            {
              organizationId:
                aiContext.organizationId,
            }
          );

        if (!consultation) {
          throwAppError(
            ERROR_CODES.DATA_NOT_FOUND,
            "상담DB 정보를 찾을 수 없습니다.",
            404
          );
        }

        /**
         * 3. 상담DB 담당자 접근 권한 확인
         *
         * Staff:
         * 본인 상담만 가능
         *
         * Admin:
         * 같은 팀 담당자 상담만 가능
         *
         * Host:
         * 회사 전체 가능
         *
         * Superhost:
         * 선택한 회사 전체 가능
         */
        if (
          aiContext.allowedAssigneeIds !==
            null &&
          !aiContext.allowedAssigneeIds.includes(
            Number(
              consultation.assigneeId
            )
          )
        ) {
          throwAppError(
            ERROR_CODES.PERMISSION_DENIED,
            "해당 상담DB는 현재 사용자의 접근 범위에 포함되지 않습니다.",
            403
          );
        }

/**
 * 학생 통합등록은 상담DB 조회 권한과
 * 실제 등록 권한을 구분한다.
 *
 * Admin은 팀 상담을 조회할 수 있고
 * Host는 회사 전체 상담을 조회할 수 있지만,
 * 학생 생성과 학기·과목설계 입력은
 * 해당 상담의 실제 담당자만 진행할 수 있다.
 *
 * Executor에서도 실행 직전에
 * 같은 담당자 검사를 다시 수행한다.
 */
const consultationAssigneeId =
  Number(
    consultation.assigneeId ||
    0
  );

if (
  !Number.isFinite(
    consultationAssigneeId
  ) ||
  consultationAssigneeId <=
    0
) {
  throwAppError(
    ERROR_CODES.INVALID_REQUEST,
    "상담DB 담당자 정보를 확인할 수 없습니다.",
    409
  );
}

if (
  Math.floor(
    consultationAssigneeId
  ) !==
    aiContext.userId
) {
  throwAppError(
    ERROR_CODES.PERMISSION_DENIED,
    "해당 상담의 담당자만 등록예정 학생 전환과 학기·과목설계를 진행할 수 있습니다.",
    403
  );
}

        /**
         * 4. 이미 학생으로 전환된 상담인지 확인
         */
        const existingStudent =
          await db.getStudentByConsultationId(
            input.consultationId,
            {
              organizationId:
                aiContext.organizationId,
            }
          );

               if (existingStudent) {
          throwAppError(
            ERROR_CODES.DUPLICATE_RESOURCE,
            "이미 등록예정 학생으로 전환되었거나 기존 학생과 연결된 상담DB입니다.",
            409
          );
        }

        const requestedPlanSubjects =
          Array.isArray(
            input.planSubjects
          )
            ? input.planSubjects
            : [];

        const catalogPlanSubjects =
          requestedPlanSubjects.length > 0
            ? []
            : await buildRegistrationPlanSubjectsFromCatalog({
                organizationId:
                  aiContext.organizationId,

                courseName:
                  consultation.desiredCourse,
              });

        const resolvedPlanSubjects =
          requestedPlanSubjects.length > 0
            ? requestedPlanSubjects
            : catalogPlanSubjects;

        /**
         * 5. 학생 통합등록 Draft 생성
         *
         * 실제 DB 변경 없음
         */
        let builtDraft:
          ReturnType<
            typeof buildStudentRegistrationDraft
          >;

        try {
          builtDraft =
            buildStudentRegistrationDraft({
              message:
                input.message,

              consultation: {
                id:
                  Number(
                    consultation.id
                  ),

                clientName:
                  consultation.clientName ??
                  null,

                phone:
                  consultation.phone ??
                  null,

                desiredCourse:
                  consultation.desiredCourse ??
                  null,

                finalEducation:
                  consultation.finalEducation ??
                  null,

                assigneeId:
                  consultation.assigneeId ??
                  null,

                status:
                  consultation.status ??
                  null,
              },

              /**
               * 상담DB 담당자가 없을 때만
               * 현재 로그인 사용자 ID를 사용한다.
               */
              fallbackAssigneeId:
                aiContext.userId,

                        planSubjects:
            resolvedPlanSubjects,

          ocrSubjects:
            input.ocrSubjects,
            });
        } catch (
          error: any
        ) {
          throwAppError(
            ERROR_CODES.INVALID_REQUEST,
            error?.message ||
              "학생 통합등록 초안을 생성하지 못했습니다.",
            400
          );
        }

        /**
         * 6. 중복 및 원본 상태 경고 보완
         */
        const additionalWarnings:
          string[] = [];

               if (
          consultation.status ===
            "등록" ||
          consultation.status ===
            "등록예정"
        ) {
          additionalWarnings.push(
            `상담DB 상태가 이미 '${consultation.status}'으로 표시되어 있습니다. 기존 학생 연결 여부를 확인해주세요.`
          );
        }

        if (
          !String(
            consultation.clientName ??
            ""
          ).trim()
        ) {
          additionalWarnings.push(
            "상담DB 회원명이 비어 있습니다."
          );
        }

        if (
          !String(
            consultation.phone ??
            ""
          ).replace(/\D/g, "")
        ) {
          additionalWarnings.push(
            "상담DB 연락처가 비어 있습니다."
          );
        }

        const combinedWarnings =
          Array.from(
            new Set([
              ...builtDraft.draft
                .warnings,

              ...additionalWarnings,
            ])
          );

        builtDraft.draft.warnings =
          combinedWarnings;

        builtDraft.preview.warnings =
          combinedWarnings;

        /**
         * 7. 최종 승인 가능 여부 재계산
         */
       /**
 * 7. 최종 승인 가능 여부 재계산
 *
 * 누락값뿐만 아니라 중복과목과
 * 미확정 과목도 모두 확인한다.
 */
const hasDuplicateSubjects =
  Array.isArray(
    builtDraft.draft
      .duplicateSubjects
  ) &&
  builtDraft.draft
    .duplicateSubjects
    .length > 0;

const hasUnconfirmedPlanSubjects =
  Array.isArray(
    builtDraft.draft
      .planSubjects
  ) &&
  builtDraft.draft
    .planSubjects
    .some(
      (subject) =>
        subject.isConfirmed !==
        true
    );

const hasUnconfirmedTransferSubjects =
  Array.isArray(
    builtDraft.draft
      .transferSubjects
  ) &&
  builtDraft.draft
    .transferSubjects
    .some(
      (subject) =>
        subject.isConfirmed !==
        true
    );

const canConfirm =
  builtDraft.draft
    .missingFields
    .length === 0 &&
  !hasDuplicateSubjects &&
  !hasUnconfirmedPlanSubjects &&
  !hasUnconfirmedTransferSubjects;

builtDraft.draft.canConfirm =
  canConfirm;

builtDraft.preview.canConfirm =
  canConfirm;

const registrationMissingFields =
  Array.isArray(
    builtDraft.preview
      .missingFields
  )
    ? Array.from(
        new Set(
          builtDraft.preview
            .missingFields
            .map(
              (
                value
              ) =>
                String(
                  value ||
                  ""
                ).trim()
            )
            .filter(
              Boolean
            )
        )
      )
    : [];

let previousRegistrationPendingAction:
  any =
  null;

if (
  Number.isFinite(
    previousRegistrationPendingActionId
  ) &&
  previousRegistrationPendingActionId >
    0
) {
  previousRegistrationPendingAction =
    await db.getAiPendingActionForConfirmation({
      id:
        Math.floor(
          previousRegistrationPendingActionId
        ),

      organizationId:
        aiContext.organizationId,

      requestedByUserId:
        aiContext.userId,
    });
}

const shouldPreservePreviousRegistrationAction =
  canConfirm !==
    true &&
  Boolean(
    previousRegistrationPendingAction
  ) &&
  String(
    previousRegistrationPendingAction
      ?.actionType ||
    ""
  ) ===
    "student_registration_create" &&
  Number(
    previousRegistrationPendingAction
      ?.consultationId ||
    0
  ) ===
    Number(
      consultation.id
    );

       /**
 * 8. 승인 가능한 경우에만
 * ai_pending_actions 초안을 생성한다.
 *
 * 누락정보가 있는 수집 단계에서는
 * Pending Action을 만들지 않고
 * Work Session에만 현재 초안을 유지한다.
 */
let pendingAction:
  any =
  null;

let publicPendingAction:
  ReturnType<
    typeof toAiPendingActionPublicResult
  > =
  null;

if (
  canConfirm ===
  true
) {
  pendingAction =
    await db.createAiPendingAction({
      organizationId:
        aiContext.organizationId,

      requestedByUserId:
        aiContext.userId,

      requestedByRole:
        aiContext.role,

      actionType:
        "student_registration_create",

      consultationId:
        Number(
          consultation.id
        ),

      studentId:
        null,

      semesterId:
        null,

      preview:
        builtDraft.preview,

      payload:
        builtDraft.draft as unknown as Record<
          string,
          unknown
        >,

      /**
       * 실행 시 상담DB가 변경됐는지
       * 비교하기 위한 원본 Snapshot이다.
       */
      sourceSnapshot: {
        consultation: {
          id:
            Number(
              consultation.id
            ),

          organizationId:
            aiContext.organizationId,

          clientName:
            consultation.clientName ??
            null,

          phone:
            consultation.phone ??
            null,

          desiredCourse:
            consultation.desiredCourse ??
            null,

          finalEducation:
            consultation.finalEducation ??
            null,

          status:
            consultation.status ??
            null,

          assigneeId:
            consultation.assigneeId ??
            null,

          updatedAt:
            consultation.updatedAt
              ? new Date(
                  consultation.updatedAt
                ).toISOString()
              : null,
        },

        existingStudentId:
          null,
      },

      expiresInMinutes:
        input.expiresInMinutes,
    });

  if (
    !pendingAction
  ) {
    throwAppError(
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      "학생 통합등록 승인 초안을 저장하지 못했습니다.",
      500
    );
  }

  publicPendingAction =
    toAiPendingActionPublicResult(
      pendingAction
    );

  if (
    !publicPendingAction
  ) {
    throwAppError(
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      "학생 통합등록 승인 초안을 생성했지만 조회하지 못했습니다.",
      500
    );
  }
}

/**
 * 9. 승인 가능 여부에 따라
 * Work Session 상태를 변경한다.
 */
if (
  canConfirm ===
  true
) {
  if (
    !pendingAction ||
    !publicPendingAction
  ) {
    throwAppError(
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      "학생 통합등록 승인 초안 정보가 없습니다.",
      500
    );
  }

  workSession =
    await db.patchAiWorkSession({
      organizationId:
        aiContext.organizationId,

      userId:
        aiContext.userId,

      expectedVersion:
        workSession.version,

      patch: {
        activeTarget: {
          type:
            "consultation",

          id:
            Number(
              consultation.id
            ),

          name:
            consultation.clientName ??
            null,
        },

        linkedContext: {
          consultationId:
            Number(
              consultation.id
            ),
        },

        workflow: {
          type:
            "consultation_registration",

          step:
            "awaiting_confirmation",

          waitingFor:
            [],
        },

        lastPresentedAction: {
          actionId:
            `pending-action-${Number(
              pendingAction.id
            )}`,

          actionType:
            "student_registration_create",

          targetType:
            "consultation",

          targetId:
            Number(
              consultation.id
            ),

          payload: {
            pendingActionId:
              Number(
                pendingAction.id
              ),
          },

          expiresAt:
            pendingAction.expiresAt
              ? new Date(
                  pendingAction.expiresAt
                ).toISOString()
              : new Date(
                  Date.now() +
                  30 *
                  60 *
                  1000
                ).toISOString(),
        },
      },
    });

  /**
   * 새 통합등록 초안 생성과
   * Work Session 연결까지 완료된 이후에만
   * 기존 승인 초안을 취소한다.
   */
  if (
    previousRegistrationPendingAction &&
    String(
      previousRegistrationPendingAction
        .actionType ||
      ""
    ) ===
      "student_registration_create" &&
    Number(
      previousRegistrationPendingAction
        .consultationId ||
      0
    ) ===
      Number(
        consultation.id
      ) &&
    Number(
      previousRegistrationPendingAction
        .id ||
      0
    ) !==
      Number(
        pendingAction.id
      )
  ) {
    await cancelAiPendingActionForCurrentUser({
      ctx,

      pendingActionId:
        Number(
          previousRegistrationPendingAction
            .id
        ),

      expectedVersion:
        null,

      targetOrganizationId:
        input.targetOrganizationId ??
        null,
    });
  }
} else {
  /**
   * 동일 상담의 기존 승인 가능 초안이 있으면
   * 새 미완성 입력으로 기존 승인 카드를
   * 제거하지 않는다.
   *
   * 기존 승인 초안이 없다면
   * 누락정보 수집 단계로 변경한다.
   */
  workSession =
    await db.patchAiWorkSession({
      organizationId:
        aiContext.organizationId,

      userId:
        aiContext.userId,

      expectedVersion:
        workSession.version,

      patch: {
        activeTarget: {
          type:
            "consultation",

          id:
            Number(
              consultation.id
            ),

          name:
            consultation.clientName ??
            null,
        },

        linkedContext: {
          consultationId:
            Number(
              consultation.id
            ),
        },

        workflow:
  shouldPreservePreviousRegistrationAction
    ? {
        type:
          "consultation_registration",

        step:
          "awaiting_confirmation",

        waitingFor:
          [],
      }
    : {
        type:
          "consultation_registration",

        step:
          "collecting_data",

        draftPatch: {
          originalMessage:
            accumulatedMessage,

          consultationId:
            Number(
              consultation.id
            ),

          registrationDraft:
            builtDraft.draft,
        },

        waitingFor:
  sortStudentRegistrationMissingFields(
    registrationMissingFields
  ),
 },

        lastPresentedAction:
          shouldPreservePreviousRegistrationAction
            ? workSession
                .lastPresentedAction
            : null,
      },
    });
}

/**
 * 10. 내부 payload는 반환하지 않고
 * 공개용 DTO와 최신 Work Session만 반환한다.
 */
const returnedPendingAction =
  canConfirm ===
    true
    ? publicPendingAction
    : shouldPreservePreviousRegistrationAction
      ? toAiPendingActionPublicResult(
          previousRegistrationPendingAction
        )
      : null;

const replacedPendingActionId =
  canConfirm ===
    true &&
  previousRegistrationPendingAction &&
  String(
    previousRegistrationPendingAction
      .actionType ||
    ""
  ) ===
    "student_registration_create" &&
  Number(
    previousRegistrationPendingAction
      .consultationId ||
    0
  ) ===
    Number(
      consultation.id
    ) &&
  Number(
    previousRegistrationPendingAction
      .id ||
    0
  ) !==
    Number(
      pendingAction?.id ||
      0
    )
    ? Number(
        previousRegistrationPendingAction
          .id
      )
    : null;

return {
  success:
    true,

  message:
    canConfirm
      ? replacedPendingActionId
        ? "수정된 학생 통합등록 초안으로 교체했습니다. 내용을 확인한 후 승인해주세요."
        : "학생 통합등록 내용을 확인한 후 승인해주세요."
      : buildStudentRegistrationMissingMessage({
          missingFields:
            registrationMissingFields,

          preservePreviousAction:
            Boolean(
              shouldPreservePreviousRegistrationAction
            ),
        }),

  pendingAction:
    returnedPendingAction,

  replacedPendingActionId,

  workSession,
};
      }
    ),

pendingAction: router({
  /**
   * 본인이 만든 AI 승인 초안 조회
   *
   * payloadJson, idempotencyKey 등
   * 서버 내부 실행값은 반환하지 않는다.
   */
  get: protectedProcedure
    .input(
      z.object({
        id: z
          .number()
          .int()
          .positive(),

        /**
         * 일반 사용자는 무시되고
         * Superhost만 선택 회사에 적용된다.
         */
        targetOrganizationId: z
          .number()
          .int()
          .positive()
          .optional(),
      })
    )
    .query(
      async ({
        ctx,
        input,
      }) => {
        const aiContext =
          await createRequestAiContext({
            ctx,

            targetOrganizationId:
              input.targetOrganizationId,
          });

        const row =
          await db.getAiPendingActionForConfirmation({
            id: input.id,

            organizationId:
              aiContext.organizationId,

            requestedByUserId:
              aiContext.userId,
          });

        const action =
          toAiPendingActionPublicResult(
            row
          );

        if (!action) {
          throwAppError(
            ERROR_CODES.DATA_NOT_FOUND,
            "AI 승인 초안을 찾을 수 없습니다.",
            404
          );
        }

        return {
          success: true,
          action,
        };
      }
    ),

  /**
   * 현재 학생의 승인 대기 중인
   * 최신 문서 OCR Pending Action 조회
   *
   * 문서 초안을 만든 사용자가 아니라
   * 대상 학생의 실제 담당자가 승인 카드를
   * 불러오기 위한 API다.
   */
  getPendingDocumentByStudent:
    protectedProcedure
      .input(
        z.object({
          studentId:
            z.number()
              .int()
              .positive(),

          /**
           * 일반 사용자는 무시되고
           * Superhost만 선택 회사에 적용된다.
           *
           * 다만 Superhost는 아래 권한 검사에서
           * 학생 운영 데이터 접근이 차단된다.
           */
          targetOrganizationId:
            z.number()
              .int()
              .positive()
              .optional(),
        })
      )
      .query(
        async ({
          ctx,
          input,
        }) => {
          const aiContext =
            await createRequestAiContext({
              ctx,

              targetOrganizationId:
                input.targetOrganizationId ??
                null,
            });

          /**
           * 문서 승인과 실제 반영은
           * 쓰기 가능한 계정만 처리할 수 있다.
           */
          if (
            aiContext.canWrite !==
              true
          ) {
            throwAppError(
              ERROR_CODES.PERMISSION_DENIED,
              "현재 계정은 문서 승인 초안을 조회할 수 없습니다.",
              403
            );
          }

          const student =
            await db.getStudentById(
              input.studentId,
              {
                organizationId:
                  aiContext.organizationId,
              }
            );

          if (!student) {
            throwAppError(
              ERROR_CODES.DATA_NOT_FOUND,
              "문서 승인 초안의 대상 학생을 찾을 수 없습니다.",
              404
            );
          }

          /**
           * 이 API는 조회 권한이 아니라
           * 실제 적용 가능한 담당자 권한을 검사한다.
           *
           * Staff:
           * 본인 담당 학생만 가능
           *
           * Admin:
           * 본인 담당 학생만 가능
           *
           * Host:
           * 본인 담당 학생만 가능
           *
           * Superhost:
           * 차단
           */
          assertCanWriteStudent({
            context:
              aiContext,

            student,
          });

          const row =
  await db
    .getLatestPendingDocumentActionByStudentId({
      organizationId:
        aiContext.organizationId,

      studentId:
        Number(
          student.id
        ),

      requestedByUserId:
        aiContext.userId,
    });

          /**
           * 승인 대기 중인 문서 초안이 없는 것은
           * 오류가 아니라 정상 상태다.
           *
           * 프론트에서는 action === null이면
           * 승인 카드를 표시하지 않으면 된다.
           */
          if (!row) {
            return {
  success:
    true,

  action:
    null,

  canCancel:
    false,
};
          }

                    const action =
            toAiPendingActionPublicResult(
              row
            );

          /**
           * 학생 담당자로 조회할 수 있더라도
           * 초안 취소는 최초 생성자 본인만 가능하다.
           */
          const canCancel =
            Number(
              row.requestedByUserId ||
              0
            ) ===
            Number(
              aiContext.userId
            );

          return {
            success:
              true,

            action,

            canCancel,
          };
        }
      ),

  /**
   * 본인이 만든 AI 승인 초안 취소
   *
   * 실제 CRM 데이터에는 영향을 주지 않는다.
   */
  cancel: protectedProcedure
    .input(
      z.object({
        id: z
          .number()
          .int()
          .positive(),

        expectedVersion: z
          .number()
          .int()
          .positive(),

        targetOrganizationId: z
          .number()
          .int()
          .positive()
          .optional(),
      })
    )
        .mutation(
      async ({
        ctx,
        input,
      }) => {
        const cancelled =
          await cancelAiPendingActionForCurrentUser({
            ctx,

            pendingActionId:
              input.id,

            expectedVersion:
              input.expectedVersion,

            targetOrganizationId:
              input.targetOrganizationId ??
              null,
          });

        return {
          success:
            cancelled.success,

          action:
            cancelled.action,

          message:
            cancelled.message,

          workSession:
            cancelled.workSession,
        };
      }
    ),

  /**
 * AI Pending Action 승인 및 실행
 *
 * 지원 작업:
 * 1. 등록예정 학생 통합등록
 * 2. AI 문서 분석 결과 CRM 반영
 *
 * 현재 로그인 사용자가 직접 생성한 초안만
 * 조회·승인·실행할 수 있다.
 *
 * 실제 Executor에서도 회사, 사용자,
 * 대상 학생과 원본 변경 여부를 다시 검증한다.
 */
  confirm: protectedProcedure
    .input(
      z.object({
        id: z
          .number()
          .int()
          .positive(),

        expectedVersion: z
          .number()
          .int()
          .positive(),

        /**
         * 일반 사용자에게는 세션 회사가 적용된다.
         * Superhost만 선택 회사가 적용된다.
         */
        targetOrganizationId: z
          .number()
          .int()
          .positive()
          .optional(),
      })
    )
       .mutation(
      async ({
        ctx,
        input,
      }) => {
        const confirmed =
          await confirmAiPendingActionForCurrentUser({
            ctx,

            pendingActionId:
              input.id,

            expectedVersion:
              input.expectedVersion,

            targetOrganizationId:
              input.targetOrganizationId ??
              null,
          });

        /**
         * 기존 프론트가 사용하던 반환 형태를
         * 공통 함수 결과 그대로 유지한다.
         */
        return {
          success:
            confirmed.success,

          alreadyExecuted:
            confirmed.alreadyExecuted,

          executing:
            confirmed.executing,

          actionType:
            confirmed.actionType,

          consultationId:
            confirmed.consultationId,

          studentId:
            confirmed.studentId,

          scheduleId:
            confirmed.scheduleId,

          planId:
            confirmed.planId,

          semesterId:
            confirmed.semesterId,

          semesterIds:
            confirmed.semesterIds,

          planSubjectIds:
            confirmed.planSubjectIds,

          transferSubjectIds:
            confirmed.transferSubjectIds,

          practiceSaved:
            confirmed.practiceSaved,

          paymentUpdated:
            confirmed.paymentUpdated,

          action:
            confirmed.action,

          pendingAction:
            confirmed.pendingAction,

          workSession:
            confirmed.workSession,

          message:
            confirmed.message,
        };
      }
    ),
}),

    /**
     * 학생 / 상담 자연어 검색용 1차 버전
     */
    search: protectedProcedure
  .input(
    z.object({
      query: z
        .string()
        .trim()
        .min(1)
        .max(200),

      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional(),

      targetOrganizationId: z
        .number()
        .int()
        .positive()
        .optional(),
    })
  )
  .query(async ({ ctx, input }) => {
    const aiContext =
      await createRequestAiContext({
        ctx,
        targetOrganizationId:
          input.targetOrganizationId,
      });

    const [
      studentResult,
      consultationResult,
    ] = await Promise.all([
      executeAiTool<
        {
          query: string;
          limit?: number;
        },
        StudentSearchToolOutput
      >({
        toolName: "student.search",
        context: aiContext,
        input: {
          query: input.query,
          limit: input.limit ?? 20,
        },
      }),

      executeAiTool<
        {
          query: string;
          limit?: number;
        },
        ConsultationSearchToolOutput
      >({
        toolName:
          "consultation.search",
        context: aiContext,
        input: {
          query: input.query,
          limit: input.limit ?? 20,
        },
      }),
    ]);

    throwAiToolError(studentResult);
    throwAiToolError(
      consultationResult
    );

    const studentData =
      studentResult.data!;

    const consultationData =
      consultationResult.data!;

    /**
     * 프론트 AIAssistant에서 사용하던 응답 구조 유지
     */
    return {
      success: true,
      query: input.query,

      students:
        studentData.students,

      consultations:
        consultationData
          .consultations,

      meta: {
        studentRequestId:
          studentResult.meta
            .requestId,

        consultationRequestId:
          consultationResult.meta
            .requestId,

        scope: aiContext.scope,
      },
    };
  }),

    /**
     * AI 알림/누락 브리핑용
     */
    alerts: protectedProcedure
  .input(
    z
      .object({
        limit: z
          .number()
          .int()
          .min(1)
          .max(300)
          .optional(),

        targetOrganizationId: z
          .number()
          .int()
          .positive()
          .optional(),
      })
      .optional()
  )
  .query(async ({ ctx, input }) => {
    const aiContext =
      await createRequestAiContext({
        ctx,
        targetOrganizationId:
          input?.targetOrganizationId,
      });

    const result =
      await executeAiTool<
        {
          limit?: number;
        },
        MissingDataAlertToolOutput
      >({
        toolName:
          "alert.missingData",

        context: aiContext,

        input: {
          limit:
            input?.limit ?? 100,
        },
      });

    throwAiToolError(result);

    const data = result.data!;

    /**
     * 기존 프론트가 response.summary를 사용하므로 유지
     */
    return {
      success: true,

      summary: data.summary,

      /**
       * 새 구조에서는 모든 문제를 통합된 배열로 반환한다.
       */
      items: data.items,

      meta: {
        requestId:
          result.meta.requestId,

        scope: aiContext.scope,
      },
    };
  }),

tools: protectedProcedure
  .input(
    z
      .object({
        targetOrganizationId: z
          .number()
          .int()
          .positive()
          .optional(),
      })
      .optional()
  )
  .query(async ({ ctx, input }) => {
    const aiContext =
      await createRequestAiContext({
        ctx,
        targetOrganizationId:
          input?.targetOrganizationId,
      });

    const tools =
  listRegisteredAiTools()
    .filter(
      (
        tool
      ) =>
        tool.allowedRoles.includes(
          aiContext.role
        )
    )
    .filter(
      (
        tool
      ) => {
        if (
          aiContext.role ===
          "superhost"
        ) {
          return false;
        }

        if (
          tool.accessMode ===
          "draft"
        ) {
          return (
            aiContext.canWrite ===
            true
          );
        }

        return true;
      }
    )
    .map((tool) => ({
          name: tool.name,
          description:
            tool.description,

          accessMode:
            tool.accessMode,

          requiresConfirmation:
            tool.requiresConfirmation,

          autoExecutable:
            tool.autoExecutable,
        }));

    return {
      success: true,
      scope: aiContext.scope,
      tools,
    };
  }),

executeTool: protectedProcedure
  .input(
    z.object({
      toolName:
        z.enum([
          "student.search",
          "student.summary",
          "student.dashboard",
          "consultation.search",
          "alert.missingData",
          "risk.studentDetail",
          "risk.studentList",
        ]),

      input: z
        .record(z.string(), z.any())
        .optional()
        .default({}),

      targetOrganizationId: z
        .number()
        .int()
        .positive()
        .optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const aiContext =
      await createRequestAiContext({
        ctx,
        targetOrganizationId:
          input.targetOrganizationId,
      });

    const result =
      await executeAiTool({
        toolName:
          input.toolName,

        context: aiContext,

        input: input.input,
      });

    throwAiToolError(result);

    return result;
  }),

    createTransferSubject: protectedProcedure
      .input(
        z.object({
          studentId: z.number(),
          schoolName: z.string().optional(),
          subjectName: z.string().min(1),
          category: z.enum(["전공", "교양", "일반"]),
          requirementType: z.enum(["전공필수", "전공선택", "교양", "일반"]).optional(),
          credits: z.number().min(0).max(30).default(3),
          sortOrder: z.number().optional(),
          attachmentName: z.string().optional(),
          attachmentUrl: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
  const organizationId =
    getCtxOrganizationId(ctx);

  await assertAiAssistantEnabled(
    organizationId
  );

  const student =
    await db.getStudent(
      input.studentId,
      {
        organizationId,
      }
    );
        if (!student) throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "학생을 찾을 수 없습니다.",
  404
);

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
         throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "권한이 없습니다.",
  403
);
        }

        const existing =
  await db.listTransferSubjects(
    input.studentId,
    {
      organizationId,
    }
  );
        if ((existing?.length ?? 0) >= 100) {
          throwAppError(
  ERROR_CODES.INVALID_INPUT,
  "전적대 과목은 최대 100개까지 등록할 수 있습니다.",
  400
);
        }

        const id = await db.createTransferSubject({
organizationId,
          studentId: input.studentId,
          schoolName: input.schoolName?.trim() || null,
          subjectName: input.subjectName.trim(),
          transferCategory: input.category,
          transferRequirementType: input.requirementType ?? null,
          credits: input.credits,
          sortOrder: input.sortOrder ?? 0,
          attachmentName: input.attachmentName?.trim() || null,
          attachmentUrl: input.attachmentUrl?.trim() || null,
        } as any);

        if (db.createAiActionLog) {
          await db.createAiActionLog({
organizationId,
            userId: Number(ctx.user.id),
            userName: ctx.user.name,
            action: "create_transfer_subject_manual",
            targetStudentId: student.id,
            targetStudentName: student.clientName,
            payload: input,
          });
        }

        return { success: true, id };
      }),

uploadTranscriptImage: protectedProcedure
  .input(
    z.object({
      studentId: z.number(),
      imageBase64: z.string(),
    })
  )
  .mutation(async ({ ctx, input }) => {
  const organizationId =
    getCtxOrganizationId(ctx);

  await assertAiAssistantEnabled(
    organizationId
  );

  const student =
    await db.getStudent(
      input.studentId,
      {
        organizationId,
      }
    );
    if (!student) throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "학생을 찾을 수 없습니다.",
  404
);

    if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
      throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "권한이 없습니다.",
  403
);
    }

    const { data: { text } } = await Tesseract.recognize(
      Buffer.from(input.imageBase64, "base64"),
      "kor+eng"
    );

    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const subjects = lines
      .map((line) => {
        const match = line.match(/([가-힣A-Za-z\s]+)/);
        return match ? match[1].trim() : null;
      })
      .filter(Boolean);

    const rows = subjects.map((subjectName, idx) => ({
      subjectName,
      category: "전공" as const,
      requirementType: "전공선택" as const,
      credits: 3,
      sortOrder: idx,
    }));
let refinedRows = rows;

try {
  const response = await openai.responses.create({
    model: "gpt-5.4-mini",
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text:
              "너는 학점은행제 전적대 성적표 분석 전문가다. " +
              "OCR 결과를 바탕으로 과목명을 정리하고, " +
              "category는 전공/교양/일반 중 하나, " +
              "requirementType은 전공필수/전공선택/교양/일반 중 하나로 맞춰라. " +
              "불확실하면 보수적으로 전공/전공선택/3학점으로 둬라.",
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify({
              rawText: text,
              draftRows: rows,
            }),
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "transfer_subject_rows",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            rows: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  subjectName: { type: "string" },
                  category: {
                    type: "string",
                    enum: ["전공", "교양", "일반"],
                  },
                  requirementType: {
                    type: ["string", "null"],
                    enum: ["전공필수", "전공선택", "교양", "일반", null],
                  },
                  credits: { type: "number" },
                },
                required: ["subjectName", "category", "requirementType", "credits"],
              },
            },
          },
          required: ["rows"],
        },
      },
    },
  });

  const parsed = JSON.parse(response.output_text || "{}");
  refinedRows = cleanTransferRows(parsed.rows || []);
} catch (err) {
  console.error("[GPT ERROR]", err);
}

    return {
  success: true,
  message: "AI가 성적표를 분석해서 과목을 정리했어요.",
  rows: refinedRows,
};
  }),

    createPlanSemester: protectedProcedure
      .input(
        z.object({
          studentId: z.number(),
          semesterNo: z.number(),
          subjectName: z.string().min(1),
          category: z.enum(["전공", "교양", "일반"]),
          requirementType: z.enum(["전공필수", "전공선택", "교양", "일반"]).optional(),
          sortOrder: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
  const organizationId =
    getCtxOrganizationId(ctx);

  await assertAiAssistantEnabled(
    organizationId
  );

  const student =
    await db.getStudent(
      input.studentId,
      {
        organizationId,
      }
    );
        if (!student) throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "학생을 찾을 수 없습니다.",
  404
);

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "권한이 없습니다.",
  403
);
        }

        const existing =
  await db.listPlanSemesters(
    input.studentId,
    {
      organizationId,
    }
  );
        const semesterCount = existing.filter(
          (x: any) => Number(x.semesterNo) === Number(input.semesterNo)
        ).length;

        if (semesterCount >= 8) {
          throwAppError(
  ERROR_CODES.INVALID_INPUT,
  "우리 플랜은 학기당 최대 8과목까지 등록할 수 있습니다.",
  400
);
        }

        const id = await db.createPlanSemester({
organizationId,
          studentId: input.studentId,
          semesterNo: input.semesterNo,
          subjectName: input.subjectName.trim(),
          planCategory: input.category,
          planRequirementType: input.requirementType ?? null,
          credits: 3,
          sortOrder: input.sortOrder ?? 0,
        } as any);

        if (db.createAiActionLog) {
          await db.createAiActionLog({
organizationId,
            userId: Number(ctx.user.id),
            userName: ctx.user.name,
            action: "create_plan_semester_manual",
            targetStudentId: student.id,
            targetStudentName: student.clientName,
            payload: input,
          });
        }

        return { success: true, id };
      }),

    recommendPracticePlace: protectedProcedure
      .input(
        z.object({
          studentId: z.number(),
        })
      )
      .mutation(async ({ ctx, input }) => {
  const organizationId =
    getCtxOrganizationId(ctx);

  await assertAiAssistantEnabled(
    organizationId
  );

  if (!db.getPracticeRecommendationsForStudent) {
          throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "db.ts에 getPracticeRecommendationsForStudent 함수를 먼저 추가해야 합니다.",
  500
);
        }

        const student =
  await db.getStudent(
    input.studentId,
    {
      organizationId,
    }
  );
        if (!student) throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "학생을 찾을 수 없습니다.",
  404
);

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "권한이 없습니다.",
  403
);
        }

        const result =
  await db.getPracticeRecommendationsForStudent(
    input.studentId,
    {
      organizationId,
    }
  );

        if (db.createAiActionLog) {
          await db.createAiActionLog({
organizationId,
            userId: Number(ctx.user.id),
            userName: ctx.user.name,
            action: "recommend_practice_place",
            targetStudentId: student.id,
            targetStudentName: student.clientName,
            payload: { studentId: input.studentId },
          });
        }

        return {
          success: true,
          student: result.student,
          educationCenters: result.educationCenters,
          institutions: result.institutions,
          message: `${student.clientName} 학생 주소 기준으로 가장 가까운 실습교육원/기관 추천 결과를 정리했습니다.`,
        };
      }),

            chat:
      protectedProcedure
            .input(
      z
        .object({
          /**
           * 텍스트 없이 이미지 하나만 보내는 것도 허용한다.
           */
          message:
            z.string()
              .trim()
              .max(
                3000,
                "질문은 최대 3,000자까지 입력할 수 있습니다."
              )
              .optional()
              .default(""),

          /**
           * AI 채팅에 첨부된 이미지
           *
           * Base64는 채팅 DB에 저장하지 않고
           * 현재 요청에서 Runner로만 전달한다.
           */
          imageAttachment:
            z.object({
              fileName:
                z.string()
                  .trim()
                  .min(
                    1,
                    "파일명이 필요합니다."
                  )
                  .max(
                    255,
                    "파일명은 255자를 초과할 수 없습니다."
                  ),

              mimeType:
                z.enum([
                  "image/jpeg",
                  "image/png",
                  "image/webp",
                ]),

              imageBase64:
                z.string()
                  .min(
                    100,
                    "분석할 이미지가 없습니다."
                  )
                  .max(
                    14_000_000,
                    "이미지 용량이 너무 큽니다."
                  ),
            })
              .optional()
              .nullable(),

          selectedStudentId:
            z.number()
              .int()
              .positive()
              .optional()
              .nullable(),

          selectedStudentName:
            z.string()
              .trim()
              .max(100)
              .optional()
              .nullable(),

          targetOrganizationId:
            z.number()
              .int()
              .positive()
              .optional()
              .nullable(),
        })
        .superRefine(
          (
            value,
            ctx
          ) => {
            const hasMessage =
              String(
                value.message ||
                ""
              ).trim().length >
              0;

            const hasImage =
              Boolean(
                value.imageAttachment
                  ?.imageBase64
              );

            if (
              !hasMessage &&
              !hasImage
            ) {
              ctx.addIssue({
                code:
                  z.ZodIssueCode
                    .custom,

                path: [
                  "message",
                ],

                message:
                  "질문 내용 또는 이미지를 첨부해주세요.",
              });
            }
          }
        )
    )
        .mutation(
          async ({
            ctx,
            input,
          }) => {
                        const aiContext =
              await createRequestAiContext({
                ctx,

                targetOrganizationId:
                  input.targetOrganizationId ??
                  null,
              });

            let workSession =
              await db.getAiWorkSession({
                organizationId:
                  aiContext.organizationId,

                userId:
                  aiContext.userId,
              });

            const inputSelectedStudentId =
              Number(
                input.selectedStudentId ||
                0
              );

            const sessionStudentId =
              Number(
                workSession
                  .linkedContext
                  .studentId ||
                0
              );

            if (
              inputSelectedStudentId >
                0 &&
              inputSelectedStudentId !==
                sessionStudentId
            ) {
              const selectedStudent =
                await db.getStudentById(
                  inputSelectedStudentId,
                  {
                    organizationId:
                      aiContext.organizationId,
                  }
                );

              if (!selectedStudent) {
                throwAppError(
                  ERROR_CODES.DATA_NOT_FOUND,
                  "선택한 학생을 찾을 수 없습니다.",
                  404
                );
              }

              assertCanAccessStudent({
                context:
                  aiContext,

                student:
                  selectedStudent,
              });

              workSession =
                await db.setAiActiveTarget({
                  organizationId:
                    aiContext.organizationId,

                  userId:
                    aiContext.userId,

                  expectedVersion:
                    workSession.version,

                  target: {
                    type:
                      "student",

                    id:
                      Number(
                        selectedStudent.id
                      ),

                    name:
                      String(
                        selectedStudent
                          .clientName ||
                        ""
                      ).trim() ||
                      null,
                  },

                  linkedContext: {
                    consultationId:
                      selectedStudent
                        .consultationId ===
                        null ||
                      selectedStudent
                        .consultationId ===
                        undefined
                        ? null
                        : Number(
                            selectedStudent
                              .consultationId
                          ),

                    studentId:
                      Number(
                        selectedStudent.id
                      ),

                    practiceRequestId:
                      null,

                    privateCertificateRequestIds:
                      [],
                  },
                });
            }

            const activeStudentId =
              Number(
                workSession
                  .linkedContext
                  .studentId ||
                0
              ) ||
              null;

            const activeStudentName =
              workSession
                .activeTarget
                ?.type ===
                "student"
                ? workSession
                    .activeTarget
                    .name
                : null;

            /**
             * 현재 질문을 DB에 저장하기 전에
             * 기존 대화 최근 30개를 조회한다.
             *
             * 이렇게 해야 현재 질문이
             * conversationHistory와 중복되지 않는다.
             */
            const recentChatRows =
              await db.getAiChatMessages({
                organizationId:
                  aiContext.organizationId,

                userId:
                  aiContext.userId,

                limit:
                  30,
              });

/**
 * 가장 최근에 성공한 OCR 문서 분석 결과를 찾는다.
 *
 * getAiChatMessages()는
 * 과거 → 최신 순서로 반환하므로
 * 뒤에서부터 검색해야 가장 최근 문서가 잡힌다.
 *
 * 이미지 Base64는 채팅 DB에 저장하지 않으므로
 * 여기에는 OCR 분석 결과 JSON만 존재한다.
 */
const recentDocumentRow =
  [...recentChatRows]
    .reverse()
    .find(
      (
        row: any
      ) => {
        if (
          row.role !==
            "assistant" ||
          String(
            row.kind ||
            ""
          ) !==
            "document_analysis"
        ) {
          return false;
        }

        const data =
          parseAiChatMessageData(
            row.messageDataJson
          );

        return Boolean(
          data
            ?.documentAnalysis &&
          typeof data
            .documentAnalysis ===
            "object" &&
          !Array.isArray(
            data.documentAnalysis
          )
        );
      }
    ) ||
  null;

/**
 * Runner에는 가장 최근 OCR 분석 결과 하나만 전달한다.
 *
 * 이전 OCR 전체를 매 요청마다 전달하지 않아
 * AI Context가 불필요하게 커지는 것을 막는다.
 */
const recentDocumentData =
  recentDocumentRow
    ? parseAiChatMessageData(
        recentDocumentRow
          .messageDataJson
      )
    : null;

const recentDocument =
  recentDocumentRow &&
  recentDocumentData
    ?.documentAnalysis &&
  typeof recentDocumentData
    .documentAnalysis ===
    "object" &&
  !Array.isArray(
    recentDocumentData
      .documentAnalysis
  )
    ? {
        analysis:
          recentDocumentData
            .documentAnalysis as
            Record<
              string,
              unknown
            >,

        fileName:
          typeof recentDocumentData
            .fileName ===
            "string"
            ? recentDocumentData
                .fileName
            : null,

        mimeType:
          typeof recentDocumentData
            .mimeType ===
            "string"
            ? recentDocumentData
                .mimeType
            : null,

        createdAt:
          recentDocumentRow
            .createdAt ??
          null,
      }
    : null;

            /**
             * AI에 전달할 문맥은
             * user / assistant 메시지만 사용한다.
             *
             * DB에는 전체 내용을 저장하지만
             * AI 입력은 메시지당 최대 1,000자로 제한한다.
             */
            const conversationHistory =
              recentChatRows
                .filter(
                  (row: any) =>
                    row.role ===
                      "user" ||
                    row.role ===
                      "assistant"
                )
                .map(
                  (row: any) => ({
                    role:
                      row.role as
                        | "user"
                        | "assistant",

                    content:
                      String(
                        row.content ||
                        ""
                      )
                        .trim()
                        .slice(
                          0,
                          1000
                        ),
                  })
                )
                .filter(
                  (row) =>
                    row.content.length >
                    0
                )
                .slice(-30);

            /**
             * 현재 사용자 질문 저장
             */
            const normalizedUserMessage =
  String(
    input.message ||
    ""
  ).trim();

const userChatContent =
  normalizedUserMessage ||
  (
    input.imageAttachment
      ? `[이미지 첨부] ${
          input.imageAttachment
            .fileName
        }`
      : ""
  );

await db.saveAiChatMessage({
  organizationId:
    aiContext.organizationId,

  userId:
    aiContext.userId,

  role:
    "user",

  kind:
    "text",

  content:
    userChatContent,

  /**
   * 이미지 원본 Base64는 절대 대화 DB에 저장하지 않는다.
   *
   * 새로고침 후 사용자가 어떤 파일을 보냈는지
   * 표시할 수 있도록 메타정보만 남긴다.
   */
  messageDataJson:
    input.imageAttachment
      ? {
          attachment: {
            type:
              "image",

            fileName:
              input.imageAttachment
                .fileName,

            mimeType:
              input.imageAttachment
                .mimeType,
          },
        }
      : null,

  selectedStudentId:
    activeStudentId,
});

            /**
             * AI 답변이 이미 저장됐는지 추적한다.
             *
             * result.success === false 이후 예외를 던져도
             * catch에서 동일 오류 메시지를 다시 저장하지 않는다.
             */
            let assistantMessageSaved =
              false;

            try {
                           const result =
  await runAiAssistant({
    context:
      aiContext,

    message:
      String(
        input.message ||
        ""
      ).trim(),

    imageAttachment:
      input.imageAttachment
        ? {
            fileName:
              input.imageAttachment
                .fileName,

            mimeType:
              input.imageAttachment
                .mimeType,

            imageBase64:
              input.imageAttachment
                .imageBase64,
          }
        : null,

recentDocument:
  recentDocument
    ? {
        analysis:
          recentDocument.analysis,

        fileName:
          recentDocument.fileName,

        mimeType:
          recentDocument.mimeType,

        createdAt:
          recentDocument.createdAt,
      }
    : null,

    workSession,

    selectedStudentId:
      activeStudentId,

    selectedStudentName:
      activeStudentName,

    conversationHistory,
  });

/**
 * 현재 요청이 기존 승인 초안 수정인지 확인한다.
 *
 * 새 Pending Action 생성이 성공한 뒤
 * 이전 Pending Action을 취소하기 위해
 * 기존 ID를 먼저 보관한다.
 */
const isPendingActionRevision =
  result.pendingActionDecision
    ?.decision ===
    "revise" &&
  result.pendingActionDecision
    ?.confidence ===
    "high";

const previousPendingActionId =
  isPendingActionRevision
    ? Number(
        workSession
          .lastPresentedAction
          ?.payload
          ?.pendingActionId ||
        0
      )
    : 0;

const previousPendingActionType =
  isPendingActionRevision
    ? String(
        workSession
          .lastPresentedAction
          ?.actionType ||
        ""
      )
    : "";

/**
 * AI가 현재 승인 초안에 대한
 * 자연어 취소 의도를 확정한 경우
 *
 * Runner는 의미만 판단하고,
 * 실제 Pending Action은 Router가
 * 서버에서 다시 조회한 뒤 취소한다.
 */
if (
  result.pendingActionCommand
    ?.command ===
    "cancel"
) {
  const pendingActionId =
    Number(
      result.pendingActionCommand
        .pendingActionId ||
      0
    );

  if (
    !Number.isFinite(
      pendingActionId
    ) ||
    pendingActionId <=
      0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "취소할 AI 승인 초안 정보가 올바르지 않습니다.",
      400
    );
  }

  const cancelled =
    await cancelAiPendingActionForCurrentUser({
      ctx,

      pendingActionId:
        Math.floor(
          pendingActionId
        ),

      /**
       * 자연어 취소에서는 프론트 버전을
       * 신뢰하지 않고 서버에서 현재 버전을 조회한다.
       */
      expectedVersion:
        null,

      targetOrganizationId:
        input.targetOrganizationId ??
        null,
    });

  workSession =
    cancelled.workSession;

  const assistantReply =
    String(
      cancelled.message ||
      "AI 승인 초안이 취소되었습니다."
    ).trim();

  await db.saveAiChatMessage({
    organizationId:
      aiContext.organizationId,

    userId:
      aiContext.userId,

    role:
      "assistant",

    kind:
      "text",

    content:
      assistantReply,

    messageDataJson: {
      intent:
        "pending_action_cancel",

      pendingAction:
        cancelled.action,

      pendingActionCommand: {
        command:
          "cancel",

        pendingActionId:
          Math.floor(
            pendingActionId
          ),

        actionId:
          result.pendingActionCommand
            .actionId,

        actionType:
          cancelled.action
            ?.actionType ||
          result.pendingActionCommand
            .actionType ||
          null,
      },

      workflow: {
        type:
          workSession.workflow.type,

        step:
          workSession.workflow.step,

        waitingFor:
          workSession.workflow
            .waitingFor,
      },

      workSessionVersion:
        workSession.version,
    },

    selectedStudentId:
      activeStudentId,
  });

  assistantMessageSaved =
    true;

  return {
    ...result,

    reply:
      assistantReply,

    data: {
      pendingAction:
        cancelled.action,
    },

    pendingActionCommand:
      null,

    conversationHistoryCount:
      conversationHistory.length,

    workSession,
  };
}

/**
 * AI가 현재 승인 초안에 대한
 * 자연어 승인 의도를 확정한 경우
 *
 * Runner는 자연어 의미만 판단한다.
 * 실제 대상, 작업 유형, 버전과 권한은
 * Router가 DB에서 다시 확인한다.
 */
if (
  result.pendingActionCommand
    ?.command ===
    "confirm"
) {
  const pendingActionId =
    Number(
      result.pendingActionCommand
        .pendingActionId ||
      0
    );

  if (
    !Number.isFinite(
      pendingActionId
    ) ||
    pendingActionId <=
      0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "승인할 AI 초안 정보가 올바르지 않습니다.",
      400
    );
  }

  const confirmed =
    await confirmAiPendingActionForCurrentUser({
      ctx,

      pendingActionId:
        Math.floor(
          pendingActionId
        ),

      /**
       * 자연어 승인에서는 프론트 버전을
       * 사용하지 않는다.
       *
       * 공통 함수가 DB의 현재 버전을
       * 다시 조회해서 Executor에 전달한다.
       */
      expectedVersion:
        null,

      targetOrganizationId:
        input.targetOrganizationId ??
        null,
    });

  workSession =
    confirmed.workSession;

  const assistantReply =
    String(
      confirmed.message ||
      (
        confirmed.executing
          ? "AI 승인 작업을 실행하고 있습니다."
          : confirmed.alreadyExecuted
            ? "이미 처리된 AI 승인 작업입니다."
            : confirmed.success
              ? "AI 승인 작업이 완료되었습니다."
              : "AI 승인 작업을 완료하지 못했습니다."
      )
    ).trim();

  const resultStudentId =
    Number(
      confirmed.studentId ||
      0
    );

  const savedStudentId =
    resultStudentId > 0
      ? resultStudentId
      : activeStudentId;

  await db.saveAiChatMessage({
    organizationId:
      aiContext.organizationId,

    userId:
      aiContext.userId,

    role:
      "assistant",

    kind:
      confirmed.actionType ===
        "student_registration_create"
        ? "student_registration_result"
        : "text",

    content:
      assistantReply,

    messageDataJson: {
      intent:
        "pending_action_confirm",

      actionType:
        confirmed.actionType,

      pendingAction:
        confirmed.pendingAction,

      executionResult: {
        success:
          confirmed.success,

        alreadyExecuted:
          confirmed.alreadyExecuted,

        executing:
          confirmed.executing,

        consultationId:
          confirmed.consultationId,

        studentId:
          confirmed.studentId,

studentDetailPath:
  "studentDetailPath" in
    confirmed
    ? confirmed
        .studentDetailPath
    : null,

        scheduleId:
          confirmed.scheduleId,

        planId:
          confirmed.planId,

        semesterId:
          confirmed.semesterId,

        semesterIds:
          confirmed.semesterIds,

        planSubjectIds:
          confirmed.planSubjectIds,

        transferSubjectIds:
          confirmed.transferSubjectIds,

        practiceSaved:
          confirmed.practiceSaved,

        paymentUpdated:
          confirmed.paymentUpdated,
      },

      pendingActionCommand: {
        command:
          "confirm",

        pendingActionId:
          Math.floor(
            pendingActionId
          ),

        actionId:
          result.pendingActionCommand
            .actionId,

        actionType:
          confirmed.actionType ||
          result.pendingActionCommand
            .actionType ||
          null,
      },

      workflow: {
        type:
          workSession.workflow.type,

        step:
          workSession.workflow.step,

        waitingFor:
          workSession.workflow
            .waitingFor,
      },

      workSessionVersion:
        workSession.version,
    },

    selectedStudentId:
      savedStudentId,
  });

  assistantMessageSaved =
    true;

  return {
    ...result,

    success:
      confirmed.success,

    reply:
      assistantReply,

    data: {
      actionType:
        confirmed.actionType,

      pendingAction:
        confirmed.pendingAction,

      executionResult: {
        success:
          confirmed.success,

        alreadyExecuted:
          confirmed.alreadyExecuted,

        executing:
          confirmed.executing,

        consultationId:
          confirmed.consultationId,

        studentId:
          confirmed.studentId,

studentDetailPath:
  "studentDetailPath" in
    confirmed
    ? confirmed
        .studentDetailPath
    : null,

        scheduleId:
          confirmed.scheduleId,

        planId:
          confirmed.planId,

        semesterId:
          confirmed.semesterId,

        semesterIds:
          confirmed.semesterIds,

        planSubjectIds:
          confirmed.planSubjectIds,

        transferSubjectIds:
          confirmed.transferSubjectIds,

        practiceSaved:
          confirmed.practiceSaved,

        paymentUpdated:
          confirmed.paymentUpdated,
      },
    },

    /**
     * Router에서 이미 실행했으므로
     * 프론트가 다시 실행하지 않도록 제거한다.
     */
    pendingActionCommand:
      null,

    conversationHistoryCount:
      conversationHistory.length,

    workSession,
  };
}

/**
 * 직전 OCR 문서 분석 결과의
 * 자연어 CRM 반영 요청
 *
 * 예:
 * - "이거 넣어줘"
 * - "방금 거 반영해줘"
 * - "아까 분석한 거 등록해줘"
 *
 * Runner는 의미와 학생 ID만 판단한다.
 *
 * 실제 반영 초안 생성 시에는
 * Router가 서버 DB의 학생 / 권한 / OCR 결과를
 * 다시 검증한다.
 */
if (
  result.documentImportPreview
    ?.required === true
) {
  const documentPreview =
    result.documentImportPreview;

  const studentId =
    Number(
      documentPreview.studentId ||
      0
    );

  if (
    !Number.isFinite(
      studentId
    ) ||
    studentId <= 0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "문서 분석 결과를 반영할 학생 정보가 올바르지 않습니다.",
      400
    );
  }

  /**
   * Runner가 반환한 analysisId는
   * 일치 확인에만 사용한다.
   *
   * 실제 OCR 데이터는
   * Router가 앞에서 DB 채팅 기록에서 직접 읽은
   * recentDocument.analysis를 최종 기준으로 사용한다.
   */
  if (
    !recentDocument ||
    !recentDocument.analysis ||
    typeof recentDocument
      .analysis !==
      "object"
  ) {
    throwAppError(
      ERROR_CODES.DATA_NOT_FOUND,
      "최근 문서 분석 결과를 찾을 수 없습니다. 문서를 다시 분석해주세요.",
      404
    );
  }

  const recentAnalysis =
    recentDocument.analysis as
      AiDocumentAnalysisResult;

  const runnerAnalysisId =
    String(
      documentPreview.analysisId ||
      ""
    ).trim();

  const recentAnalysisId =
    String(
      recentAnalysis.analysisId ||
      ""
    ).trim();

  /**
   * Runner가 특정 analysisId를 전달했다면
   * 현재 서버의 최근 OCR과 반드시 일치해야 한다.
   *
   * 서로 다른 문서를 잘못 반영하는 것을 방지한다.
   */
  if (
    runnerAnalysisId &&
    recentAnalysisId &&
    runnerAnalysisId !==
      recentAnalysisId
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "현재 요청한 문서와 최근 분석한 문서가 일치하지 않습니다. 문서를 다시 확인해주세요.",
      400
    );
  }

  /**
   * 문서 CRM 반영은
   * Staff / Admin / Host만 가능하다.
   *
   * Superhost는 회사 운영 학생 데이터
   * 입력 범위에서 제외한다.
   */
  if (
    aiContext.role !==
      "staff" &&
    aiContext.role !==
      "admin" &&
    aiContext.role !==
      "host"
  ) {
    throwAppError(
      ERROR_CODES.PERMISSION_DENIED,
      "현재 계정은 문서 CRM 반영 초안을 생성할 수 없습니다.",
      403
    );
  }

  if (
    aiContext.canWrite !==
      true
  ) {
    throwAppError(
      ERROR_CODES.PERMISSION_DENIED,
      "현재 계정은 AI 문서 반영 초안을 생성할 수 없습니다.",
      403
    );
  }

  /**
   * 학생은 반드시 현재 조직 DB에서
   * 서버가 다시 조회한다.
   */
  const student =
    await db.getStudent(
      Math.floor(
        studentId
      ),
      {
        organizationId:
          aiContext.organizationId,
      }
    );

  if (
    !student
  ) {
    throwAppError(
      ERROR_CODES.DATA_NOT_FOUND,
      "반영 대상 학생을 찾을 수 없습니다.",
      404
    );
  }

  /**
   * 조회 권한과 쓰기 권한은 다르다.
   *
   * Admin / Host도 다른 담당자의 학생을
   * 조회할 수 있다는 이유만으로
   * OCR 결과를 입력할 수 없다.
   *
   * 기존 문서 반영 API와 동일하게
   * 실제 학생 담당자 쓰기 권한을 다시 검사한다.
   */
  assertCanWriteStudent({
    context:
      aiContext,

    student,
  });

  /**
   * 같은 학생에게 이미 승인 대기 중인
   * 문서 반영 Pending Action이 존재하는지 확인한다.
   *
   * 기존 documentImportPreview API와
   * 동일한 정책을 사용한다.
   */
  const existingDocumentPendingAction =
    await db
      .getLatestPendingDocumentActionByStudentId({
        organizationId:
          aiContext.organizationId,

        studentId:
          Number(
            student.id
          ),

        requestedByUserId:
          aiContext.userId,
      });

  if (
    existingDocumentPendingAction
  ) {
    const publicExistingPendingAction =
      toAiPendingActionPublicResult(
        existingDocumentPendingAction
      );

    if (
      !publicExistingPendingAction
    ) {
      throwAppError(
        ERROR_CODES.INTERNAL_SERVER_ERROR,
        "기존 문서 CRM 반영 초안을 조회하지 못했습니다.",
        500
      );
    }

    const canCancel =
      Number(
        existingDocumentPendingAction
          .requestedByUserId ||
        0
      ) ===
      Number(
        aiContext.userId
      );

    const assistantReply =
      canCancel
        ? "이 학생에게 이미 본인이 만든 승인 대기 중인 문서 CRM 반영 초안이 있습니다. 기존 초안을 먼저 확인해주세요."
        : "이 학생에게 이미 승인 대기 중인 문서 CRM 반영 초안이 있습니다. 기존 초안을 먼저 승인해주세요.";

    /**
     * 자연어 경로에서도 기존 프론트의
     * Pending Action 카드 형식을 그대로 사용한다.
     */
    await db.saveAiChatMessage({
      organizationId:
        aiContext.organizationId,

      userId:
        aiContext.userId,

      role:
        "assistant",

      kind:
        "student_registration_preview",

      content:
        assistantReply,

      messageDataJson: {
        intent:
          "document_import_preview",

        pendingAction:
          publicExistingPendingAction,

        pendingActionCanCancel:
          canCancel,

        pendingActionSource:
          "chat",

        documentAnalysis:
          recentAnalysis,

        fileName:
          recentDocument.fileName ??
          null,

        mimeType:
          recentDocument.mimeType ??
          null,
      },

      selectedStudentId:
        Number(
          student.id
        ),
    });

    assistantMessageSaved =
      true;

    return {
      ...result,

      reply:
        assistantReply,

      data: {
        pendingAction:
          publicExistingPendingAction,

        pendingActionCanCancel:
          canCancel,

        pendingActionSource:
          "chat",

        documentAnalysis:
          recentAnalysis,
      },

      conversationHistoryCount:
        conversationHistory.length,

      workSession,
    };
  }

  /**
   * 문서에 이름이 추출된 경우
   * 실제 선택 학생과 다르면 경고만 추가한다.
   *
   * 이름 불일치만으로 강제 차단하지 않는
   * 기존 documentImportPreview 정책을 유지한다.
   */
  const selectedStudentName =
    String(
      student.clientName ||
      ""
    ).trim();

  const documentStudentName =
    String(
      recentAnalysis
        .studentName
        ?.value ||
      ""
    ).trim();

  const nameMismatch =
    Boolean(
      selectedStudentName &&
      documentStudentName &&
      selectedStudentName !==
        documentStudentName
    );

  const normalizedAnalysis:
    AiDocumentAnalysisResult = {
    ...recentAnalysis,

    warnings:
      Array.from(
        new Set([
          ...(
            recentAnalysis
              .warnings ||
            []
          ),

          ...(
            nameMismatch
              ? [
                  `문서 학생명(${documentStudentName})과 선택 학생명(${selectedStudentName})이 일치하지 않습니다.`,
                ]
              : []
          ),
        ])
      ),
  };

const nileClassifiedAnalysis =
  await applyNileClassificationToUniversityTranscript({
    student,

    analysis:
      normalizedAnalysis,
  });

  /**
   * 기존 document-import-draft 엔진을 그대로 사용한다.
   *
   * AI가 과목 / 결제 / 반영 위치를 새로 만드는 게 아니라
   * OCR 엔진이 생성한 분석 결과를 서버 Draft Builder가
   * 최종 반영 형식으로 변환한다.
   */
  let built:
    ReturnType<
      typeof buildDocumentImportDraft
    >;

  try {
    built =
      buildDocumentImportDraft({
        studentId:
          Number(
            student.id
          ),

        analysis:
  nileClassifiedAnalysis,

        /**
         * 자연어에서 별도 위치를 지정하지 않았으므로
         * OCR의 recommendedTarget을 사용한다.
         */
        target:
          null,
      });
  } catch (
    error
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      error instanceof Error
        ? error.message
        : "문서 CRM 반영 초안을 생성하지 못했습니다.",
      400
    );
  }

  /**
   * 실제 학생 데이터는 아직 변경하지 않는다.
   *
   * 승인 대기용 Pending Action만 생성한다.
   */
  const pendingAction =
    await db.createAiPendingAction({
      organizationId:
        aiContext.organizationId,

      requestedByUserId:
        aiContext.userId,

      requestedByRole:
        aiContext.role,

      actionType:
        built.draft
          .actionType,

      consultationId:
        null,

      studentId:
        Number(
          student.id
        ),

      semesterId:
        null,

      preview:
        built.preview,

      payload: {
        draft:
          built.draft,
      },

      /**
       * 승인 시점에 학생 데이터가
       * 중간에 바뀌었는지 Executor가 확인할 수 있도록
       * 기존 API와 동일한 스냅샷을 남긴다.
       */
      sourceSnapshot: {
        student: {
          id:
            Number(
              student.id
            ),

          organizationId:
            Number(
              student.organizationId
            ),

          assigneeId:
            student.assigneeId ===
              null ||
            student.assigneeId ===
              undefined
              ? null
              : Number(
                  student.assigneeId
                ),

          clientName:
            student.clientName ||
            null,

          course:
            student.course ||
            null,

          paymentAmount:
            student.paymentAmount ??
            null,

          paymentDate:
            student.paymentDate ??
            null,

          updatedAt:
            student.updatedAt ??
            null,
        },

        document: {
          analysisId:
            built.draft
              .analysisId,

          documentType:
            built.draft
              .documentType,

          target:
            built.draft
              .target,

          analyzedAt:
            built.draft
              .analyzedAt,
        },
      },

      expiresInMinutes:
        30,
    });

  const publicPendingAction =
    toAiPendingActionPublicResult(
      pendingAction
    );

  if (
    !publicPendingAction
  ) {
    throwAppError(
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      "문서 CRM 반영 초안을 생성했지만 조회하지 못했습니다.",
      500
    );
  }

  const canConfirm =
    publicPendingAction
      .preview
      ?.canConfirm ===
    true;

  /**
   * 승인 가능한 초안이면
   * 현재 AI Work Session을
   * 이 Pending Action에 연결한다.
   *
   * 이후 사용자가
   * "승인해", "진행해", "취소해"
   * 라고 말해도 동일 Pending Action으로 이어진다.
   */
  if (
    canConfirm
  ) {
    workSession =
      await db.patchAiWorkSession({
        organizationId:
          aiContext.organizationId,

        userId:
          aiContext.userId,

        expectedVersion:
          workSession.version,

        patch: {
          activeTarget: {
            type:
              "student",

            id:
              Number(
                student.id
              ),

            name:
              student.clientName ??
              null,
          },

          linkedContext: {
            studentId:
              Number(
                student.id
              ),
          },

          workflow: {
            step:
              "awaiting_confirmation",

            clearDraft:
              true,

            draftPatch: {
              analysisId:
                built.draft
                  .analysisId,

              documentType:
                built.draft
                  .documentType,

              target:
                built.draft
                  .target,

              actionType:
                built.draft
                  .actionType,

              studentId:
                Number(
                  student.id
                ),
            },

            waitingFor:
              [],
          },

          lastPresentedAction: {
            actionId:
              `pending-action-${Number(
                pendingAction.id
              )}`,

            actionType:
              built.draft
                .actionType,

            targetType:
              "student",

            targetId:
              Number(
                student.id
              ),

            payload: {
              pendingActionId:
                Number(
                  pendingAction.id
                ),

              analysisId:
                built.draft
                  .analysisId,

              documentType:
                built.draft
                  .documentType,

              target:
                built.draft
                  .target,
            },

            expiresAt:
              pendingAction
                .expiresAt
                ? new Date(
                    pendingAction
                      .expiresAt
                  ).toISOString()
                : new Date(
                    Date.now() +
                    30 *
                    60 *
                    1000
                  ).toISOString(),
          },
        },
      });
  } else {
    /**
     * 누락값이 있으면 승인 상태로 만들지 않고
     * 무엇이 부족한지만 Work Session에 남긴다.
     */
    const missingFields =
      Array.isArray(
        publicPendingAction
          .preview
          ?.missingFields
      )
        ? publicPendingAction
            .preview
            .missingFields
            .map(
              (
                value:
                  unknown
              ) =>
                String(
                  value ||
                  ""
                ).trim()
            )
            .filter(
              Boolean
            )
        : [];

    workSession =
      await db.patchAiWorkSession({
        organizationId:
          aiContext.organizationId,

        userId:
          aiContext.userId,

        expectedVersion:
          workSession.version,

        patch: {
          activeTarget: {
            type:
              "student",

            id:
              Number(
                student.id
              ),

            name:
              student.clientName ??
              null,
          },

          linkedContext: {
            studentId:
              Number(
                student.id
              ),
          },

          workflow: {
            step:
              "collecting_data",

            clearDraft:
              true,

            draftPatch: {
              analysisId:
                built.draft
                  .analysisId,

              documentType:
                built.draft
                  .documentType,

              target:
                built.draft
                  .target,

              actionType:
                built.draft
                  .actionType,

              studentId:
                Number(
                  student.id
                ),
            },

            waitingFor:
              missingFields,
          },

          lastPresentedAction:
            null,
        },
      });
  }

  /**
   * AI 업무 감사 로그
   */
  await db.createAiActionLog({
    organizationId:
      aiContext.organizationId,

    userId:
      aiContext.userId,

    userName:
      aiContext.userName ||
      String(
        (ctx.user as any)
          ?.username ||
        ""
      ),

    action:
      "ai_document_import_preview",

    targetStudentId:
      Number(
        student.id
      ),

    targetStudentName:
      student.clientName ||
      null,

    payload: {
      source:
        "natural_language_chat",

      request: {
        analysisId:
          built.draft
            .analysisId,

        documentType:
          built.draft
            .documentType,

        target:
          built.draft
            .target,

        actionType:
          built.draft
            .actionType,

        subjectCount:
          built.draft
            .subjects
            .length,

        hasPaymentAmount:
          built.draft
            .paymentAmount !==
          null,
      },

      result: {
        pendingActionId:
          publicPendingAction.id,

        status:
          publicPendingAction.status,

        canConfirm,

        missingFieldCount:
          publicPendingAction
            .preview
            ?.missingFields
            ?.length ||
          0,

        warningCount:
          publicPendingAction
            .preview
            ?.warnings
            ?.length ||
          0,
      },
    },
  });

  const assistantReply =
    canConfirm
      ? "문서 CRM 반영 내용을 확인한 후 승인해주세요."
      : "문서 CRM 반영에 필요한 일부 정보를 확인해주세요.";

  /**
   * 새로고침 후에도 동일 승인 카드가 복원되도록
   * Router에서 채팅 기록을 한 번만 저장한다.
   */
  await db.saveAiChatMessage({
    organizationId:
      aiContext.organizationId,

    userId:
      aiContext.userId,

    role:
      "assistant",

    kind:
      "student_registration_preview",

    content:
      assistantReply,

    messageDataJson: {
      intent:
        "document_import_preview",

      pendingAction:
        publicPendingAction,

      pendingActionCanCancel:
        true,

      pendingActionSource:
        "chat",

      documentAnalysis:
        normalizedAnalysis,

      fileName:
        recentDocument
          .fileName ??
        null,

      mimeType:
        recentDocument
          .mimeType ??
        null,

      workSessionVersion:
        workSession.version,
    },

    selectedStudentId:
      Number(
        student.id
      ),
  });

  assistantMessageSaved =
    true;

  return {
    ...result,

    reply:
      assistantReply,

    data: {
      pendingAction:
        publicPendingAction,

      pendingActionCanCancel:
        true,

      pendingActionSource:
        "chat",

      documentAnalysis:
        normalizedAnalysis,
    },

    conversationHistoryCount:
      conversationHistory.length,

    workSession,
  };
}

if (
  result.workSessionPatch
) {
  workSession =
    await db.patchAiWorkSession({
      organizationId:
        aiContext.organizationId,

      userId:
        aiContext.userId,

      expectedVersion:
        workSession.version,

      patch:
        result.workSessionPatch,
    });
}

/**
 * AI Runner가 실패 결과를 반환한 경우
 */
              if (
                result.success !==
                true
              ) {
                const failureReply =
                  String(
                    result.reply ||
                    result.toolResult
                      ?.error
                      ?.message ||
                    "AI 요청을 처리하지 못했습니다."
                  ).trim();

                await db.saveAiChatMessage({
                  organizationId:
                    aiContext.organizationId,

                  userId:
                    aiContext.userId,

                  role:
                    "assistant",

                  kind:
                    "error",

                  content:
                    failureReply,

                  messageDataJson:
  result.toolResult &&
  typeof result.toolResult ===
    "object"
    ? {
        toolResult:
          result.toolResult,
      }
    : {
        workflow: {
          type:
            workSession.workflow.type,

          step:
            workSession.workflow.step,

          waitingFor:
            workSession.workflow.waitingFor,
        },

        workSessionVersion:
          workSession.version,
      },

                                    selectedStudentId:
                    activeStudentId,
                });

                assistantMessageSaved =
                  true;

                /**
                 * 도구 실행 결과가 실패라면
                 * 기존 공통 오류 변환 함수를 사용한다.
                 */
                if (
                  result.toolResult &&
                  result.toolResult
                    .success === false
                ) {
                  throwAiToolError(
                    result.toolResult
                  );
                }

                throwAppError(
                  ERROR_CODES.INVALID_REQUEST,
                  failureReply,
                  400
                );
              }

/**
 * 상담DB 번호가 확인된 학생등록 요청은
 * 프론트에서 실제 pendingAction을 생성한 뒤
 * 완성된 미리보기 카드를 별도로 저장한다.
 *
 * 여기서 임시 안내 응답까지 저장하면
 * 새로고침 후 미리보기 카드가 두 개 보일 수 있다.
 */
const shouldWaitForRegistrationPreview =
  result.registrationPreview
    ?.required === true &&
  Number(
    result.registrationPreview
      ?.consultationId ||
    0
  ) > 0;

if (
  shouldWaitForRegistrationPreview
) {
  return {
    ...result,

    conversationHistoryCount:
      conversationHistory.length,

    workSession,
  };
}
/**
 * 일정 등록 Tool은 실제 DB 일정을 바로 생성하지 않는다.
 *
 * Runner가 만든 검증된 초안을
 * AI Pending Action으로 저장하고
 * 사용자 승인 카드를 반환한다.
 */
if (
  result.scheduleCreateDraft &&
  result.scheduleCreateDraft
    .pendingActionRequired ===
    true
) {
  const scheduleDraft =
    result.scheduleCreateDraft;

  const studentId =
    Number(
      scheduleDraft.studentId ||
      0
    );

  if (
    !Number.isFinite(
      studentId
    ) ||
    studentId <= 0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "일정을 연결할 학생 정보가 올바르지 않습니다.",
      400
    );
  }

  const pendingAction =
    await db.createAiPendingAction({
      organizationId:
        aiContext.organizationId,

      requestedByUserId:
        aiContext.userId,

      requestedByRole:
        aiContext.role,

      actionType:
        "schedule_create",

      consultationId:
        null,

      studentId:
        Math.floor(
          studentId
        ),

      semesterId:
        null,

      payload: {
        draft: {
          studentId:
            Math.floor(
              studentId
            ),

          studentName:
            scheduleDraft.studentName,

          title:
            scheduleDraft.title,

          description:
            scheduleDraft.description,

          scheduleDate:
            scheduleDraft.scheduleDate,

          meridiem:
            scheduleDraft.meridiem,

          hour12:
            scheduleDraft.hour12,

          minute:
            scheduleDraft.minute,

          startAt:
            scheduleDraft.startAt,

          scope:
            scheduleDraft.isGlobal ===
              true
              ? "global"
              : "personal",
        },

        originalMessage:
          input.message,
      },

      preview: {
        title:
          scheduleDraft.preview
            .title,

        summary:
          scheduleDraft.preview
            .summary,

        sections: [
  {
    label:
      "일정 정보",

    items:
      scheduleDraft.preview
        .items,
  },
],

        changes: [
  {
    label:
      "일정명",

    before:
      null,

    after:
      scheduleDraft.title,
  },

  {
    label:
      "일정 날짜",

    before:
      null,

    after:
      scheduleDraft.scheduleDate,
  },

  {
    label:
      "일정 시간",

    before:
      null,

    after:
      `${
        scheduleDraft.meridiem ===
          "PM"
          ? "오후"
          : "오전"
      } ${scheduleDraft.hour12}시 ${String(
        scheduleDraft.minute
      ).padStart(
        2,
        "0"
      )}분`,
  },

  {
    label:
      "일정 범위",

    before:
      null,

    after:
      scheduleDraft.isGlobal ===
        true
        ? "회사 전체"
        : "개인",
  },
],

        executionSteps: [
          "학생 접근권한을 다시 확인합니다.",
          "일정 날짜와 시간을 다시 검증합니다.",
          "학생 일정에 등록합니다.",
        ],

        missingFields:
          [],

        warnings:
          Array.isArray(
            scheduleDraft.preview
              .warnings
          )
            ? scheduleDraft.preview
                .warnings
            : [],

        canConfirm:
          scheduleDraft.preview
            .canConfirm === true,
      },

      expiresInMinutes:
        30,
    });

  const publicPendingAction =
  toAiPendingActionPublicResult(
    pendingAction
  );

workSession =
  await db.patchAiWorkSession({
    organizationId:
      aiContext.organizationId,

    userId:
      aiContext.userId,

    expectedVersion:
      workSession.version,

    patch: {
      lastPresentedAction: {
  actionId:
    `pending-action-${Number(
      pendingAction.id
    )}`,

  actionType:
    "schedule_create",

  targetType:
    "student",

        targetId:
          Math.floor(
            studentId
          ),

        payload: {
          pendingActionId:
            Number(
              pendingAction.id
            ),
        },

        expiresAt:
          pendingAction.expiresAt
            ? new Date(
                pendingAction.expiresAt
              ).toISOString()
            : new Date(
                Date.now() +
                30 * 60 * 1000
              ).toISOString(),
      },
    },
  });

/**
 * 기존 승인 초안을 수정해서 새 일정 초안이
 * 정상적으로 생성된 경우에만 이전 초안을 취소한다.
 *
 * 새 초안을 Work Session에 연결한 뒤 취소하므로
 * 이전 초안 취소가 새 Work Session을 초기화하지 않는다.
 */
await replacePreviousAiPendingActionIfNeeded({
  ctx,

  isPendingActionRevision,

  previousPendingActionId,

  previousPendingActionType,

  expectedActionType:
    "schedule_create",

  newPendingActionId:
    Number(
      pendingAction.id
    ),

  targetOrganizationId:
    input.targetOrganizationId ??
    null,
});

const reply =
    String(
      result.reply ||
      `${scheduleDraft.studentName || "선택 학생"}의 일정 등록 초안을 만들었습니다.`
    ).trim();

  await db.saveAiChatMessage({
    organizationId:
      aiContext.organizationId,

    userId:
      aiContext.userId,

    role:
      "assistant",

    kind:
      "text",

    content:
      reply,

    messageDataJson: {
  toolName:
    "schedule.create",

  pendingActionDecision:
    result.pendingActionDecision ??
    null,

  replacedPendingActionId:
  isPendingActionRevision &&
  previousPendingActionType ===
    "schedule_create" &&
  previousPendingActionId > 0
    ? Math.floor(
        previousPendingActionId
      )
    : null,

  scheduleCreateDraft:
    scheduleDraft,

  pendingAction:
    publicPendingAction,
},

    selectedStudentId:
      Math.floor(
        studentId
      ),
  });

  assistantMessageSaved =
    true;

      return {
    ...result,

    pendingAction:
      publicPendingAction,

    scheduleCreateDraft:
      scheduleDraft,

    conversationHistoryCount:
      conversationHistory.length,

    workSession,
  };
}

/**
 * 상담DB 신규등록 Tool은
 * consultations 테이블을 즉시 생성하지 않는다.
 *
 * Runner에서 생성한 신규 상담 초안을
 * AI Pending Action으로 저장하고
 * 사용자의 최종 승인을 기다린다.
 */
if (
  result.consultationCreateDraft &&
  result.consultationCreateDraft
    .pendingActionRequired ===
    true
) {
  const consultationDraft =
    result.consultationCreateDraft;

  const draft =
    consultationDraft.draft;

  if (
    !draft ||
    typeof draft !==
      "object" ||
    Array.isArray(
      draft
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "상담DB 신규등록 승인 초안이 올바르지 않습니다.",
      400
    );
  }

  const clientName =
    String(
      draft.clientName ||
      ""
    )
      .trim()
      .slice(
        0,
        100
      );

  if (
    !clientName
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "신규 상담자의 이름이 필요합니다.",
      400
    );
  }

  const phone =
    String(
      draft.phone ||
      ""
    )
      .replace(
        /\D/g,
        ""
      )
      .slice(
        0,
        11
      );

  if (
    phone.length <
      10 ||
    phone.length >
      11
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "신규 상담자의 연락처가 올바르지 않습니다.",
      400
    );
  }

  if (
    Number(
      draft.requestedByUserId ||
      0
    ) !==
      aiContext.userId
  ) {
    throwAppError(
      ERROR_CODES.PERMISSION_DENIED,
      "상담DB 신규등록 초안의 요청자 정보가 일치하지 않습니다.",
      403
    );
  }

  if (
    draft.requestedByRole !==
      aiContext.role
  ) {
    throwAppError(
      ERROR_CODES.PERMISSION_DENIED,
      "상담DB 신규등록 초안의 요청자 권한 정보가 일치하지 않습니다.",
      403
    );
  }

  const missingFields =
    Array.isArray(
      consultationDraft.preview
        ?.missingFields
    )
      ? consultationDraft.preview
          .missingFields
          .map(
            (
              value
            ) =>
              String(
                value ||
                ""
              ).trim()
          )
          .filter(
            Boolean
          )
      : [];

  const warnings =
    Array.isArray(
      consultationDraft.preview
        ?.warnings
    )
      ? consultationDraft.preview
          .warnings
          .map(
            (
              value
            ) =>
              String(
                value ||
                ""
              ).trim()
          )
          .filter(
            Boolean
          )
      : [];

  const previewSections =
    Array.isArray(
      consultationDraft.preview
        ?.sections
    )
      ? consultationDraft.preview
          .sections
          .map(
            (
              section
            ) => ({
              label:
                String(
                  section?.title ||
                  "신규 상담정보"
                ),

              items:
                Array.isArray(
                  section?.items
                )
                  ? section.items
                      .map(
                        (
                          item
                        ) =>
                          String(
                            item ||
                            ""
                          ).trim()
                      )
                      .filter(
                        Boolean
                      )
                  : [],
            })
          )
      : [];

  const previewChanges =
    Array.isArray(
      consultationDraft.preview
        ?.changes
    )
      ? consultationDraft.preview
          .changes
          .map(
            (
              change
            ) => ({
              label:
                String(
                  change?.label ||
                  change?.field ||
                  "신규 입력 항목"
                ),

              before:
                null,

              after:
                change?.after ??
                null,
            })
          )
      : [];

  /**
   * consultation-create-executor는
   * action.payloadJson 자체를 신규 상담 초안으로 읽는다.
   *
   * payload 안에 draft를 한 번 더 감싸지 않는다.
   */
  const pendingAction =
    await db.createAiPendingAction({
      organizationId:
        aiContext.organizationId,

      requestedByUserId:
        aiContext.userId,

      requestedByRole:
        aiContext.role,

      actionType:
        "consultation_create",

      consultationId:
        null,

      studentId:
        null,

      semesterId:
        null,

      payload: {
        consultDate:
          String(
            draft.consultDate ||
            ""
          ).trim(),

        channel:
          String(
            draft.channel ||
            "AI 상담 등록"
          ).trim(),

        clientName,

        phone,

        finalEducation:
          draft.finalEducation ??
          null,

        desiredCourse:
          draft.desiredCourse ??
          null,

        notes:
          draft.notes ??
          null,

        status:
          String(
            draft.status ||
            "상담중"
          ).trim(),

        canConfirm:
          draft.canConfirm ===
            true &&
          missingFields.length ===
            0,

        missingFields,

        warnings,
      },

      preview: {
        title:
          consultationDraft.preview
            ?.title ||
          "상담DB 신규등록",

        summary:
          consultationDraft.preview
            ?.summary ||
          `${clientName}님의 신규 상담정보를 등록합니다.`,

        sections:
          previewSections,

        changes:
          previewChanges,

        executionSteps:
          Array.isArray(
            consultationDraft.preview
              ?.executionSteps
          )
            ? consultationDraft.preview
                .executionSteps
            : [
                "승인 요청의 회사와 최초 요청자를 다시 확인합니다.",
                "동일한 연락처의 기존 상담DB가 있는지 다시 확인합니다.",
                "현재 로그인 사용자를 상담 담당자로 지정합니다.",
                "상담DB 신규등록 결과와 AI 실행 이력을 기록합니다.",
              ],

        missingFields,

        warnings,

        canConfirm:
          consultationDraft.preview
            ?.canConfirm ===
            true &&
          missingFields.length ===
            0,
      },

      sourceSnapshot: {
        requestedByUserId:
          aiContext.userId,

        requestedByRole:
          aiContext.role,

        clientName,

        phoneLast4:
          phone.slice(
            -4
          ),

        draftCreatedAt:
          draft.createdAt ??
          null,
      },

      expiresInMinutes:
        30,
    });

  const publicPendingAction =
    toAiPendingActionPublicResult(
      pendingAction
    );

  workSession =
    await db.patchAiWorkSession({
      organizationId:
        aiContext.organizationId,

      userId:
        aiContext.userId,

      expectedVersion:
        workSession.version,

      patch: {
        workflow: {
          type:
            "consultation_registration",

          step:
            "awaiting_confirmation",

          draftPatch: {
            ...draft,
          },

          waitingFor:
            [],
        },

        lastPresentedAction: {
          actionId:
            `pending-action-${Number(
              pendingAction.id
            )}`,

          actionType:
            "consultation_create",

          /**
           * 신규 상담은 아직 실제 consultationId가 없으므로
           * 임시 대상 ID로 Pending Action ID를 사용한다.
           *
           * 실제 상담 생성 후 Executor 결과의
           * consultationId로 다시 연결된다.
           */
          targetType:
            "consultation",

          targetId:
            Number(
              pendingAction.id
            ),

          payload: {
            pendingActionId:
              Number(
                pendingAction.id
              ),
          },

          expiresAt:
            pendingAction.expiresAt
              ? new Date(
                  pendingAction.expiresAt
                ).toISOString()
              : new Date(
                  Date.now() +
                  30 * 60 * 1000
                ).toISOString(),
        },
      },
    });

  /**
   * 사용자가 기존 상담 신규등록 초안을 수정한 경우
   * 새 Pending Action 생성 후 이전 초안을 취소한다.
   */
  await replacePreviousAiPendingActionIfNeeded({
  ctx,

  isPendingActionRevision,

  previousPendingActionId,

  previousPendingActionType,

  expectedActionType:
    "consultation_create",

  newPendingActionId:
    Number(
      pendingAction.id
    ),

  targetOrganizationId:
    input.targetOrganizationId ??
    null,
});

  const reply =
    String(
      result.reply ||
      `${clientName}님의 상담DB 신규등록 초안을 만들었습니다.`
    ).trim();

  await db.saveAiChatMessage({
    organizationId:
      aiContext.organizationId,

    userId:
      aiContext.userId,

    role:
      "assistant",

    kind:
      "student_registration_preview",

    content:
      reply,

    messageDataJson: {
      toolName:
        "consultation.create",

      pendingActionDecision:
        result.pendingActionDecision ??
        null,

      replacedPendingActionId:
        isPendingActionRevision &&
        previousPendingActionType ===
          "consultation_create" &&
        previousPendingActionId >
          0
          ? Math.floor(
              previousPendingActionId
            )
          : null,

      consultationCreateDraft:
        consultationDraft,

      pendingAction:
        publicPendingAction,
    },

    selectedStudentId:
      activeStudentId,
  });

  assistantMessageSaved =
    true;

  return {
    ...result,

    pendingAction:
      publicPendingAction,

    consultationCreateDraft:
      consultationDraft,

    conversationHistoryCount:
      conversationHistory.length,

    workSession,
  };
}

/**
 * 상담DB 수정 Tool은 상담정보를 즉시 변경하지 않는다.
 *
 * Runner에서 생성한 상담 수정 초안을
 * AI Pending Action으로 저장하고
 * 사용자의 최종 승인을 기다린다.
 */
if (
  result.consultationUpdateDraft &&
  result.consultationUpdateDraft
    .pendingActionRequired ===
    true
) {
  const consultationDraft =
    result.consultationUpdateDraft;

  const consultationId =
    Number(
      consultationDraft
        .consultationId ||
      0
    );

  /**
   * Runner와 Tool에서 검증했더라도
   * Pending Action 저장 직전에 ID를 다시 검사한다.
   */
  if (
    !Number.isFinite(
      consultationId
    ) ||
    consultationId <= 0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "수정할 상담DB 정보가 올바르지 않습니다.",
      400
    );
  }

  /**
   * 실제 변경 항목이 존재하는지 다시 확인한다.
   */
  const changes =
    Array.isArray(
      consultationDraft.changes
    )
      ? consultationDraft.changes
      : [];

  if (
    changes.length ===
    0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "변경할 상담정보가 없습니다.",
      400
    );
  }

  /**
   * Tool에서 생성한 변경 초안을
   * Pending Action에 저장한다.
   *
   * 이 시점에는 consultations 테이블을
   * 실제로 수정하지 않는다.
   */
  const pendingAction =
    await db.createAiPendingAction({
      organizationId:
        aiContext.organizationId,

      requestedByUserId:
        aiContext.userId,

      requestedByRole:
        aiContext.role,

      actionType:
        "consultation_update",

      consultationId:
        Math.floor(
          consultationId
        ),

      studentId:
        null,

      semesterId:
        null,

      /**
       * 다음 단계의 Executor가 사용할
       * 승인된 변경 초안이다.
       */
      payload: {
        draft:
          consultationDraft.draft,

        originalMessage:
          input.message,
      },

      /**
       * 사용자 승인 카드에 표시할 데이터다.
       */
      preview: {
        title:
          consultationDraft.preview
            .title ||
          "상담DB 정보 수정",

        summary:
          consultationDraft.preview
            .summary ||
          "상담DB 변경 내용을 확인해주세요.",

        /**
         * 공용 Pending Action Preview 구조는
         * label + items 형태를 사용한다.
         */
        sections:
          Array.isArray(
            consultationDraft.preview
              .sections
          )
            ? consultationDraft.preview
                .sections
                .map(
                  (
                    section
                  ) => ({
                    label:
                      String(
                        section?.title ||
                        "수정 대상"
                      ),

                    items:
                      Array.isArray(
                        section?.items
                      )
                        ? section.items
                            .map(
                              (
                                item
                              ) =>
                                String(
                                  item ||
                                  ""
                                ).trim()
                            )
                            .filter(
                              Boolean
                            )
                        : [],
                  })
                )
            : [],

        /**
         * 변경 전·후 비교 카드 데이터다.
         */
        changes:
          changes.map(
            (
              change
            ) => ({
              label:
                String(
                  change.label ||
                  change.field ||
                  "변경 항목"
                ),

              before:
                change.before ??
                null,

              after:
                change.after ??
                null,
            })
          ),

        executionSteps:
          Array.isArray(
            consultationDraft.preview
              .executionSteps
          )
            ? consultationDraft.preview
                .executionSteps
            : [
                "현재 상담정보를 다시 확인합니다.",
                "사용자의 상담 접근권한을 다시 확인합니다.",
                "승인된 변경 항목만 상담DB에 반영합니다.",
              ],

        missingFields:
          Array.isArray(
            consultationDraft.preview
              .missingFields
          )
            ? consultationDraft.preview
                .missingFields
            : [],

        warnings:
          Array.isArray(
            consultationDraft.preview
              .warnings
          )
            ? consultationDraft.preview
                .warnings
            : [],

        canConfirm:
          consultationDraft.preview
            .canConfirm ===
            true &&
          changes.length >
            0,
      },

      /**
       * 다음 Executor 단계에서
       * 초안 생성 후 원본이 변경됐는지 비교할 스냅샷이다.
       */
      sourceSnapshot: {
        consultation: {
          id:
            Math.floor(
              consultationId
            ),

          clientName:
            consultationDraft.clientName ??
            null,

          status:
            consultationDraft.draft
              .originalValues
              .status ??
            null,

          notes:
            consultationDraft.draft
              .originalValues
              .notes ??
            null,
        },

        draftCreatedAt:
          consultationDraft.draft
            .createdAt,
      },

      expiresInMinutes:
        30,
    });

  /**
   * DB 내부 JSON 값을
   * 프론트에 안전하게 전달할 공용 형태로 변환한다.
   */
  const publicPendingAction =
  toAiPendingActionPublicResult(
    pendingAction
  );

workSession =
  await db.patchAiWorkSession({
    organizationId:
      aiContext.organizationId,

    userId:
      aiContext.userId,

    expectedVersion:
      workSession.version,

    patch: {
      lastPresentedAction: {
  actionId:
    `pending-action-${Number(
      pendingAction.id
    )}`,

  actionType:
    "consultation_update",

  targetType:
    "consultation",

        targetId:
          Math.floor(
            consultationId
          ),

        payload: {
          pendingActionId:
            Number(
              pendingAction.id
            ),
        },

        expiresAt:
          pendingAction.expiresAt
            ? new Date(
                pendingAction.expiresAt
              ).toISOString()
            : new Date(
                Date.now() +
                30 * 60 * 1000
              ).toISOString(),
      },
    },
  });

/**
 * 기존 상담DB 수정 승인 초안을 변경한 경우
 * 새 초안 생성 성공 후 이전 초안을 취소한다.
 */
await replacePreviousAiPendingActionIfNeeded({
  ctx,

  isPendingActionRevision,

  previousPendingActionId,

  previousPendingActionType,

  expectedActionType:
    "consultation_update",

  newPendingActionId:
    Number(
      pendingAction.id
    ),

  targetOrganizationId:
    input.targetOrganizationId ??
    null,
});

const reply =
    String(
      result.reply ||
      `${
        consultationDraft.clientName ||
        `상담DB ${consultationId}번`
      }의 상담정보 수정 초안을 만들었습니다.`
    ).trim();

  /**
   * 대화 기록에도 Pending Action을 함께 저장한다.
   *
   * 새로고침 후에도 승인 카드를 복원할 수 있도록
   * pendingAction과 초안 정보를 모두 보존한다.
   */
  await db.saveAiChatMessage({
    organizationId:
      aiContext.organizationId,

    userId:
      aiContext.userId,

    role:
      "assistant",

    /**
     * 현재 프론트가 Pending Action 카드를
     * student_registration_preview 종류로 처리하고 있으므로
     * 별도 Kind 추가 전까지 기존 값을 재사용한다.
     */
    kind:
      "student_registration_preview",

    content:
      reply,

    messageDataJson: {
  toolName:
    "consultation.update",

  pendingActionDecision:
    result.pendingActionDecision ??
    null,

  replacedPendingActionId:
  isPendingActionRevision &&
  previousPendingActionType ===
    "consultation_update" &&
  previousPendingActionId > 0
    ? Math.floor(
        previousPendingActionId
      )
    : null,

  consultationUpdateDraft:
    consultationDraft,

  pendingAction:
    publicPendingAction,
},

        selectedStudentId:
      activeStudentId,
  });

  assistantMessageSaved =
    true;

    return {
    ...result,

    pendingAction:
      publicPendingAction,

    consultationUpdateDraft:
      consultationDraft,

    conversationHistoryCount:
      conversationHistory.length,

    workSession,
  };
}

/**
 * 학생 플랜 생성 Tool은
 * plans 테이블을 즉시 변경하지 않는다.
 *
 * Runner에서 생성한 플랜 생성 초안을
 * AI Pending Action으로 저장하고
 * 사용자의 최종 승인을 기다린다.
 */
if (
  result.planCreateDraft &&
  result.planCreateDraft
    .pendingActionRequired ===
    true
) {
  const planDraft =
    result.planCreateDraft;

  const studentId =
    Number(
      planDraft.studentId ||
      0
    );

  /**
   * Pending Action 저장 직전
   * 핵심 대상 학생을 다시 검사한다.
   */
  if (
    !Number.isFinite(
      studentId
    ) ||
    studentId <=
    0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "플랜을 생성할 학생 정보가 올바르지 않습니다.",
      400
    );
  }

  /**
   * Tool 결과 안의 실제 승인 초안
   */
  const draft =
    planDraft.draft;

  if (
    !draft ||
    typeof draft !==
      "object" ||
    Array.isArray(
      draft
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "플랜 생성 승인 초안이 올바르지 않습니다.",
      400
    );
  }

  /**
   * 바깥쪽 Tool 결과의 학생과
   * 내부 승인 초안의 학생이 같은지 확인한다.
   */
  if (
    Number(
      draft.studentId ||
      0
    ) !==
    Math.floor(
      studentId
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "플랜 생성 초안의 대상 학생 정보가 일치하지 않습니다.",
      400
    );
  }

  const assigneeId =
    Number(
      draft.assigneeId ||
      0
    );

  if (
    !Number.isFinite(
      assigneeId
    ) ||
    assigneeId <=
    0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "학생 담당자 정보가 올바르지 않습니다.",
      400
    );
  }

  /**
   * 신규 생성 초안은 반드시
   * 기존 플랜이 없었던 상태에서 만들어져야 한다.
   */
  if (
    draft.originalPlanExists !==
    false
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "플랜 생성 초안의 기존 플랜 상태가 올바르지 않습니다.",
      400
    );
  }

  /**
   * 실습 여부는 플랜 생성 시
   * 반드시 명확한 boolean이어야 한다.
   */
  if (
    typeof draft.hasPractice !==
    "boolean"
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "실습 필요 여부가 확정되지 않았습니다.",
      400
    );
  }

  const totalTheorySubjects =
    Number(
      draft.totalTheorySubjects
    );

  const requiredMajorCount =
    Number(
      draft.requiredMajorCount
    );

  const electiveMajorCount =
    Number(
      draft.electiveMajorCount
    );

  const liberalCount =
    Number(
      draft.liberalCount
    );

  const generalCount =
    Number(
      draft.generalCount
    );

  const planCounts = [
    totalTheorySubjects,
    requiredMajorCount,
    electiveMajorCount,
    liberalCount,
    generalCount,
  ];

  /**
   * 모든 과목 수는 0 이상의 정수만 허용한다.
   */
  if (
    planCounts.some(
      (
        value
      ) =>
        !Number.isFinite(
          value
        ) ||
        !Number.isInteger(
          value
        ) ||
        value < 0
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "플랜 과목 수 정보가 올바르지 않습니다.",
      400
    );
  }

  const categoryTotal =
    requiredMajorCount +
    electiveMajorCount +
    liberalCount +
    generalCount;

  if (
    categoryTotal !==
    totalTheorySubjects
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      `전체 이론 과목 수(${totalTheorySubjects})와 분류 합계(${categoryTotal})가 일치하지 않습니다.`,
      400
    );
  }

  /**
   * 플랜 생성 초안을 Pending Action으로 저장한다.
   *
   * 이 시점에는 plans 테이블을
   * 절대로 변경하지 않는다.
   */
  const pendingAction =
    await db.createAiPendingAction({
      organizationId:
        aiContext.organizationId,

      requestedByUserId:
        aiContext.userId,

      requestedByRole:
        aiContext.role,

      actionType:
        "plan_create",

      consultationId:
        null,

      studentId:
        Math.floor(
          studentId
        ),

      semesterId:
        null,

      /**
       * Executor가 최종 승인 후
       * 실제 plans 테이블 생성에 사용하는 초안
       */
      payload: {
        draft,

        originalMessage:
          input.message,
      },

      preview: {
        title:
          planDraft.preview
            .title ||
          "학생 플랜 생성",

        summary:
          planDraft.preview
            .summary ||
          "생성할 학생 플랜 내용을 확인해주세요.",

        /**
         * plan.create Registry는
         * label + items 형식을 사용하고 있다.
         */
        sections:
          Array.isArray(
            planDraft.preview
              .sections
          )
            ? planDraft.preview
                .sections
                .map(
                  (
                    section
                  ) => ({
                    label:
                      String(
                        (section as any)
                          ?.label ||
                        (section as any)
                          ?.title ||
                        "플랜 생성 내용"
                      ),

                    items:
                      Array.isArray(
                        (section as any)
                          ?.items
                      )
                        ? (
                            section as any
                          ).items
                            .map(
                              (
                                item:
                                  unknown
                              ) =>
                                String(
                                  item ||
                                  ""
                                ).trim()
                            )
                            .filter(
                              Boolean
                            )
                        : [],
                  })
                )
            : [],

        changes:
          Array.isArray(
            planDraft.preview
              .changes
          )
            ? planDraft.preview
                .changes
            : [],

        executionSteps:
          Array.isArray(
            planDraft.preview
              .executionSteps
          )
            ? planDraft.preview
                .executionSteps
            : [
                "현재 학생과 조직 정보를 다시 확인합니다.",
                "학생 플랜 생성 권한을 다시 확인합니다.",
                "학생 담당자 변경 여부를 다시 확인합니다.",
                "기존 플랜이 새로 생성되지 않았는지 확인합니다.",
                "플랜 과목 수와 실습 필요 여부를 검증합니다.",
                "승인된 내용으로 학생 플랜을 생성합니다.",
              ],

        missingFields:
          Array.isArray(
            planDraft.preview
              .missingFields
          )
            ? planDraft.preview
                .missingFields
            : [],

        warnings:
          Array.isArray(
            planDraft.preview
              .warnings
          )
            ? planDraft.preview
                .warnings
            : [],

        canConfirm:
          planDraft.preview
            .canConfirm ===
            true,
      },

      /**
       * 초안 생성 시점 학생/플랜 상태
       *
       * 실제 Executor에서는 현재 DB를 다시 조회한다.
       */
      sourceSnapshot: {
        student: {
          id:
            Math.floor(
              studentId
            ),

          clientName:
            planDraft.studentName ??
            null,

          assigneeId:
            Math.floor(
              assigneeId
            ),
        },

        plan: {
          originalPlanExists:
            false,

          desiredCourse:
            draft.desiredCourse ??
            null,

          finalEducation:
            draft.finalEducation ??
            null,

          hasPractice:
            draft.hasPractice,

          totalTheorySubjects,

          requiredMajorCount,

          electiveMajorCount,

          liberalCount,

          generalCount,
        },

        draftCreatedAt:
          draft.createdAt,
      },

      expiresInMinutes:
        30,
    });

  const publicPendingAction =
    toAiPendingActionPublicResult(
      pendingAction
    );

  /**
   * 사용자가 이후
   * "ㅇㅇ", "진행해줘", "승인"
   * 이라고 했을 때 바로 plan_create를 찾는다.
   */
  workSession =
    await db.patchAiWorkSession({
      organizationId:
        aiContext.organizationId,

      userId:
        aiContext.userId,

      expectedVersion:
        workSession.version,

      patch: {
        lastPresentedAction: {
          actionId:
            `pending-action-${Number(
              pendingAction.id
            )}`,

          actionType:
            "plan_create",

          targetType:
            "student",

          targetId:
            Math.floor(
              studentId
            ),

          payload: {
            pendingActionId:
              Number(
                pendingAction.id
              ),
          },

          expiresAt:
            pendingAction.expiresAt
              ? new Date(
                  pendingAction.expiresAt
                ).toISOString()
              : new Date(
                  Date.now() +
                  30 * 60 * 1000
                ).toISOString(),
        },
      },
    });

  /**
   * 기존 plan_create 승인 초안을
   * 수정해서 새 초안이 만들어진 경우
   * 새 초안 생성 성공 후 이전 초안을 취소한다.
   */
  await replacePreviousAiPendingActionIfNeeded({
    ctx,

    isPendingActionRevision,

    previousPendingActionId,

    previousPendingActionType,

    expectedActionType:
      "plan_create",

    newPendingActionId:
      Number(
        pendingAction.id
      ),

    targetOrganizationId:
      input.targetOrganizationId ??
      null,
  });

  const reply =
    String(
      result.reply ||
      `${
        planDraft.studentName ||
        `학생 ${studentId}번`
      }의 플랜 생성 초안을 만들었습니다.`
    ).trim();

  /**
   * 새로고침해도 승인 카드가 복원되도록
   * AI 대화 기록에 저장한다.
   */
  await db.saveAiChatMessage({
    organizationId:
      aiContext.organizationId,

    userId:
      aiContext.userId,

    role:
      "assistant",

    kind:
      "student_registration_preview",

    content:
      reply,

    messageDataJson: {
      toolName:
        "plan.create",

      pendingActionDecision:
        result.pendingActionDecision ??
        null,

      replacedPendingActionId:
        isPendingActionRevision &&
        previousPendingActionType ===
          "plan_create" &&
        previousPendingActionId > 0
          ? Math.floor(
              previousPendingActionId
            )
          : null,

      planCreateDraft:
        planDraft,

      pendingAction:
        publicPendingAction,
    },

    selectedStudentId:
      Math.floor(
        studentId
      ),
  });

  assistantMessageSaved =
    true;

    return {
    ...result,

    pendingAction:
      publicPendingAction,

    planCreateDraft:
      planDraft,

    conversationHistoryCount:
      conversationHistory.length,

    workSession,
  };
}

/**
 * 학생 플랜 수정 Tool은
 * plans 테이블을 즉시 변경하지 않는다.
 *
 * Runner에서 생성한 플랜 수정 초안을
 * AI Pending Action으로 저장하고
 * 사용자의 최종 승인을 기다린다.
 */
if (
  result.planUpdateDraft &&
  result.planUpdateDraft
    .pendingActionRequired ===
    true
) {
  const planUpdateDraft =
    result.planUpdateDraft;

  const studentId =
    Number(
      planUpdateDraft.studentId ||
      0
    );

  if (
    !Number.isFinite(
      studentId
    ) ||
    studentId <=
    0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "플랜을 수정할 학생 정보가 올바르지 않습니다.",
      400
    );
  }

  const planId =
    Number(
      planUpdateDraft.planId ||
      0
    );

  if (
    !Number.isFinite(
      planId
    ) ||
    planId <=
    0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "수정할 플랜 정보가 올바르지 않습니다.",
      400
    );
  }

  const draft =
    planUpdateDraft.draft;

  if (
    !draft ||
    typeof draft !==
      "object" ||
    Array.isArray(
      draft
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "플랜 수정 승인 초안이 올바르지 않습니다.",
      400
    );
  }

  /**
   * Tool 바깥 대상과
   * 실제 승인 Draft 대상 학생이 동일해야 한다.
   */
  if (
    Number(
      draft.studentId ||
      0
    ) !==
    Math.floor(
      studentId
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "플랜 수정 초안의 대상 학생 정보가 일치하지 않습니다.",
      400
    );
  }

  if (
    Number(
      draft.planId ||
      0
    ) !==
    Math.floor(
      planId
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "플랜 수정 초안의 플랜 정보가 일치하지 않습니다.",
      400
    );
  }

  const assigneeId =
    Number(
      draft.assigneeId ||
      0
    );

  if (
    !Number.isFinite(
      assigneeId
    ) ||
    assigneeId <=
    0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "학생 담당자 정보가 올바르지 않습니다.",
      400
    );
  }

  const originalValues =
    draft.originalValues;

  if (
    !originalValues ||
    typeof originalValues !==
      "object" ||
    Array.isArray(
      originalValues
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "플랜 수정 원본 정보가 올바르지 않습니다.",
      400
    );
  }

  if (
    Number(
      originalValues.planId ||
      0
    ) !==
    Math.floor(
      planId
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "플랜 수정 원본의 플랜 ID가 일치하지 않습니다.",
      400
    );
  }

  const updates =
    draft.updates;

  if (
    !updates ||
    typeof updates !==
      "object" ||
    Array.isArray(
      updates
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "플랜 수정 변경정보가 올바르지 않습니다.",
      400
    );
  }

  const allowedUpdateFields = [
    "desiredCourse",
    "finalEducation",
    "hasPractice",
    "totalTheorySubjects",
    "requiredMajorCount",
    "electiveMajorCount",
    "liberalCount",
    "generalCount",
  ] as const;

  const requestedFields =
    allowedUpdateFields.filter(
      (
        field
      ) =>
        Object.prototype.hasOwnProperty.call(
          updates,
          field
        )
    );

  if (
    requestedFields.length ===
    0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "플랜 수정 초안에 변경 항목이 없습니다.",
      400
    );
  }

  /**
   * Router에서도 승인 초안 핵심 형식을 재검증한다.
   *
   * 실제 값과 Snapshot 충돌 검사는
   * Executor에서 현재 DB를 다시 조회한 뒤 처리한다.
   */
  if (
    Object.prototype.hasOwnProperty.call(
      updates,
      "hasPractice"
    ) &&
    typeof (
      updates as any
    ).hasPractice !==
      "boolean"
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "실습 필요 여부가 올바르지 않습니다.",
      400
    );
  }

  const numericFields = [
    "totalTheorySubjects",
    "requiredMajorCount",
    "electiveMajorCount",
    "liberalCount",
    "generalCount",
  ] as const;

  for (
    const field of
    numericFields
  ) {
    if (
      !Object.prototype.hasOwnProperty.call(
        updates,
        field
      )
    ) {
      continue;
    }

    const value =
      Number(
        (
          updates as any
        )[
          field
        ]
      );

    if (
      !Number.isInteger(
        value
      ) ||
      value <
        0
    ) {
      throwAppError(
        ERROR_CODES.INVALID_REQUEST,
        "플랜 과목 수 변경정보가 올바르지 않습니다.",
        400
      );
    }
  }

  /**
   * 현재 createAiPendingAction()은
   * 별도 planId 컬럼 입력을 받지 않는다.
   *
   * planId는 payload와 sourceSnapshot에 보존한다.
   */
  const pendingAction =
    await db.createAiPendingAction({
      organizationId:
        aiContext.organizationId,

      requestedByUserId:
        aiContext.userId,

      requestedByRole:
        aiContext.role,

      actionType:
        "plan_update",

      consultationId:
        null,

      studentId:
        Math.floor(
          studentId
        ),

      semesterId:
        null,

      payload: {
        draft,

        originalMessage:
          input.message,
      },

      preview: {
        title:
          planUpdateDraft
            .preview
            .title ||
          "학생 플랜 수정",

        summary:
          planUpdateDraft
            .preview
            .summary ||
          "수정할 학생 플랜 내용을 확인해주세요.",

        sections:
          Array.isArray(
            planUpdateDraft
              .preview
              .sections
          )
            ? planUpdateDraft
                .preview
                .sections
                .map(
                  (
                    section
                  ) => ({
                    label:
                      String(
                        (section as any)
                          ?.label ||
                        (section as any)
                          ?.title ||
                        "플랜 수정 내용"
                      ),

                    items:
                      Array.isArray(
                        (section as any)
                          ?.items
                      )
                        ? (
                            section as any
                          ).items
                            .map(
                              (
                                item:
                                  unknown
                              ) =>
                                String(
                                  item ||
                                  ""
                                ).trim()
                            )
                            .filter(
                              Boolean
                            )
                        : [],
                  })
                )
            : [],

        changes:
          Array.isArray(
            planUpdateDraft
              .preview
              .changes
          )
            ? planUpdateDraft
                .preview
                .changes
            : [],

        executionSteps:
          Array.isArray(
            planUpdateDraft
              .preview
              .executionSteps
          )
            ? planUpdateDraft
                .preview
                .executionSteps
            : [],

        missingFields:
          Array.isArray(
            planUpdateDraft
              .preview
              .missingFields
          )
            ? planUpdateDraft
                .preview
                .missingFields
            : [],

        warnings:
          Array.isArray(
            planUpdateDraft
              .preview
              .warnings
          )
            ? planUpdateDraft
                .preview
                .warnings
            : [],

        canConfirm:
          planUpdateDraft
            .preview
            .canConfirm ===
            true,
      },

      sourceSnapshot: {
        student: {
          id:
            Math.floor(
              studentId
            ),

          clientName:
            planUpdateDraft
              .studentName ??
            null,

          assigneeId:
            Math.floor(
              assigneeId
            ),
        },

        plan: {
          id:
            Math.floor(
              planId
            ),

          originalValues,
        },

        draftCreatedAt:
          draft.createdAt,
      },

      expiresInMinutes:
        30,
    });

  const publicPendingAction =
    toAiPendingActionPublicResult(
      pendingAction
    );

  /**
   * 이후 사용자가 승인/진행 요청을 보내면
   * plan_update Pending Action을 바로 찾는다.
   */
  workSession =
    await db.patchAiWorkSession({
      organizationId:
        aiContext.organizationId,

      userId:
        aiContext.userId,

      expectedVersion:
        workSession.version,

      patch: {
        lastPresentedAction: {
          actionId:
            `pending-action-${Number(
              pendingAction.id
            )}`,

          actionType:
            "plan_update",

          targetType:
            "student",

          targetId:
            Math.floor(
              studentId
            ),

          payload: {
            pendingActionId:
              Number(
                pendingAction.id
              ),

            planId:
              Math.floor(
                planId
              ),
          },

          expiresAt:
            pendingAction.expiresAt
              ? new Date(
                  pendingAction.expiresAt
                ).toISOString()
              : new Date(
                  Date.now() +
                  30 * 60 * 1000
                ).toISOString(),
        },
      },
    });

  /**
   * 기존 plan_update 초안을 수정하여
   * 새 초안을 만든 경우 이전 초안을 취소한다.
   */
  await replacePreviousAiPendingActionIfNeeded({
    ctx,

    isPendingActionRevision,

    previousPendingActionId,

    previousPendingActionType,

    expectedActionType:
      "plan_update",

    newPendingActionId:
      Number(
        pendingAction.id
      ),

    targetOrganizationId:
      input.targetOrganizationId ??
      null,
  });

  const reply =
    String(
      result.reply ||
      `${
        planUpdateDraft
          .studentName ||
        `학생 ${studentId}번`
      }의 플랜 수정 초안을 만들었습니다.`
    ).trim();

  /**
   * 새로고침 후에도 승인카드를 복원할 수 있도록
   * 대화 기록에 Pending Action 정보를 저장한다.
   */
  await db.saveAiChatMessage({
    organizationId:
      aiContext.organizationId,

    userId:
      aiContext.userId,

    role:
      "assistant",

    kind:
      "student_registration_preview",

    content:
      reply,

    messageDataJson: {
      toolName:
        "plan.update",

      pendingActionDecision:
        result.pendingActionDecision ??
        null,

      replacedPendingActionId:
        isPendingActionRevision &&
        previousPendingActionType ===
          "plan_update" &&
        previousPendingActionId >
          0
          ? Math.floor(
              previousPendingActionId
            )
          : null,

      planUpdateDraft:
        planUpdateDraft,

      pendingAction:
        publicPendingAction,
    },

    selectedStudentId:
      Math.floor(
        studentId
      ),
  });

  assistantMessageSaved =
    true;

  return {
    ...result,

    pendingAction:
      publicPendingAction,

    planUpdateDraft:
      planUpdateDraft,

    conversationHistoryCount:
      conversationHistory.length,

    workSession,
  };
}



/**
 * 학생 플랜 과목 생성 Tool은
 * planSemesters 테이블을 즉시 변경하지 않는다.
 *
 * Runner에서 생성한 플랜 과목 초안을
 * AI Pending Action으로 저장하고
 * 사용자의 최종 승인을 기다린다.
 */
if (
  result.planSubjectsCreateDraft &&
  result.planSubjectsCreateDraft
    .pendingActionRequired ===
    true
) {
  const planSubjectsDraft =
    result.planSubjectsCreateDraft;

  const studentId =
    Number(
      planSubjectsDraft.studentId ||
      0
    );

  if (
    !Number.isFinite(
      studentId
    ) ||
    studentId <=
    0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "플랜 과목을 생성할 학생 정보가 올바르지 않습니다.",
      400
    );
  }

  const planId =
    Number(
      planSubjectsDraft.planId ||
      0
    );

  if (
    !Number.isFinite(
      planId
    ) ||
    planId <=
    0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "플랜 과목을 생성할 플랜 정보가 올바르지 않습니다.",
      400
    );
  }

  const draft =
    planSubjectsDraft.draft;

  if (
    !draft ||
    typeof draft !==
      "object" ||
    Array.isArray(
      draft
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "플랜 과목 생성 승인 초안이 올바르지 않습니다.",
      400
    );
  }

  /**
   * 바깥 Tool 결과와 내부 Draft의
   * 학생 ID가 동일해야 한다.
   */
  if (
    Number(
      draft.studentId ||
      0
    ) !==
    Math.floor(
      studentId
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "플랜 과목 생성 초안의 대상 학생 정보가 일치하지 않습니다.",
      400
    );
  }

  /**
   * 바깥 Tool 결과와 내부 Draft의
   * 플랜 ID도 동일해야 한다.
   */
  if (
    Number(
      draft.planId ||
      0
    ) !==
    Math.floor(
      planId
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "플랜 과목 생성 초안의 플랜 정보가 일치하지 않습니다.",
      400
    );
  }

  const assigneeId =
    Number(
      draft.assigneeId ||
      0
    );

  if (
    !Number.isFinite(
      assigneeId
    ) ||
    assigneeId <=
    0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "학생 담당자 정보가 올바르지 않습니다.",
      400
    );
  }

  const originalPlanSubjectIds =
    Array.isArray(
      draft.originalPlanSubjectIds
    )
      ? Array.from(
          new Set(
            draft.originalPlanSubjectIds
              .map(
                (
                  value
                ) =>
                  Number(
                    value
                  )
              )
              .filter(
                (
                  value
                ) =>
                  Number.isFinite(
                    value
                  ) &&
                  value >
                    0
              )
              .map(
                (
                  value
                ) =>
                  Math.floor(
                    value
                  )
              )
          )
        ).sort(
          (
            a,
            b
          ) =>
            a -
            b
        )
      : [];

  const subjects =
    Array.isArray(
      draft.subjects
    )
      ? draft.subjects
      : [];

  if (
    subjects.length ===
    0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "등록할 플랜 과목이 없습니다.",
      400
    );
  }

  if (
    subjects.length >
    100
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "한 번에 등록할 수 있는 플랜 과목은 최대 100개입니다.",
      400
    );
  }

  /**
   * Pending Action 저장 직전에도
   * 개별 과목의 핵심값을 검증한다.
   *
   * 최종 실행 시 Executor와 DB Transaction에서
   * 다시 한 번 전체 검증한다.
   */
  for (
    let index =
      0;
    index <
      subjects.length;
    index +=
      1
  ) {
    const subject =
      subjects[index];

    if (
      !subject ||
      typeof subject !==
        "object" ||
      Array.isArray(
        subject
      )
    ) {
      throwAppError(
        ERROR_CODES.INVALID_REQUEST,
        `${index + 1}번째 플랜 과목 정보가 올바르지 않습니다.`,
        400
      );
    }

    const semesterNo =
      Number(
        subject.semesterNo
      );

    if (
      !Number.isInteger(
        semesterNo
      ) ||
      semesterNo <
        1 ||
      semesterNo >
        20
    ) {
      throwAppError(
        ERROR_CODES.INVALID_REQUEST,
        `${index + 1}번째 플랜 과목의 학기 번호가 올바르지 않습니다.`,
        400
      );
    }

    const subjectName =
      String(
        subject.subjectName ||
        ""
      )
        .trim()
        .replace(
          /\s+/g,
          " "
        );

    if (
      !subjectName
    ) {
      throwAppError(
        ERROR_CODES.INVALID_REQUEST,
        `${index + 1}번째 플랜 과목명이 없습니다.`,
        400
      );
    }

    const planCategory =
      String(
        subject.planCategory ||
        ""
      ).trim();

    if (
      planCategory !==
        "전공" &&
      planCategory !==
        "교양" &&
      planCategory !==
        "일반"
    ) {
      throwAppError(
        ERROR_CODES.INVALID_REQUEST,
        `${subjectName} 과목의 플랜 분류가 올바르지 않습니다.`,
        400
      );
    }

    const planRequirementType =
      String(
        subject.planRequirementType ||
        ""
      ).trim();

    if (
      planRequirementType !==
        "전공필수" &&
      planRequirementType !==
        "전공선택" &&
      planRequirementType !==
        "교양" &&
      planRequirementType !==
        "일반"
    ) {
      throwAppError(
        ERROR_CODES.INVALID_REQUEST,
        `${subjectName} 과목의 요구구분이 올바르지 않습니다.`,
        400
      );
    }

    const credits =
      Number(
        subject.credits
      );

    if (
      !Number.isInteger(
        credits
      ) ||
      credits <
        1 ||
      credits >
        10
    ) {
      throwAppError(
        ERROR_CODES.INVALID_REQUEST,
        `${subjectName} 과목의 학점 정보가 올바르지 않습니다.`,
        400
      );
    }

    const sortOrder =
      Number(
        subject.sortOrder
      );

    if (
      !Number.isInteger(
        sortOrder
      ) ||
      sortOrder <
        0
    ) {
      throwAppError(
        ERROR_CODES.INVALID_REQUEST,
        `${subjectName} 과목의 정렬 순서가 올바르지 않습니다.`,
        400
      );
    }

    if (
      typeof subject
        .settlementIncluded !==
      "boolean"
    ) {
      throwAppError(
        ERROR_CODES.INVALID_REQUEST,
        `${subjectName} 과목의 정산 포함 여부가 올바르지 않습니다.`,
        400
      );
    }
  }

  /**
   * createAiPendingAction()의 현재 실제 타입에는
   * planId 컬럼 인자가 없다.
   *
   * 따라서 planId는 draft와 sourceSnapshot에 보존한다.
   */
  const pendingAction =
    await db.createAiPendingAction({
      organizationId:
        aiContext.organizationId,

      requestedByUserId:
        aiContext.userId,

      requestedByRole:
        aiContext.role,

      actionType:
        "plan_subjects_create",

      consultationId:
        null,

      studentId:
        Math.floor(
          studentId
        ),

      semesterId:
        null,

      payload: {
        draft,

        originalMessage:
          input.message,
      },

      preview: {
        title:
          planSubjectsDraft
            .preview
            .title ||
          "학생 플랜 과목 생성",

        summary:
          planSubjectsDraft
            .preview
            .summary ||
          "등록할 학생 플랜 과목을 확인해주세요.",

        sections:
          Array.isArray(
            planSubjectsDraft
              .preview
              .sections
          )
            ? planSubjectsDraft
                .preview
                .sections
                .map(
                  (
                    section
                  ) => ({
                    label:
                      String(
                        (section as any)
                          ?.label ||
                        (section as any)
                          ?.title ||
                        "플랜 과목 등록 내용"
                      ),

                    items:
                      Array.isArray(
                        (section as any)
                          ?.items
                      )
                        ? (
                            section as any
                          ).items
                            .map(
                              (
                                item:
                                  unknown
                              ) =>
                                String(
                                  item ||
                                  ""
                                ).trim()
                            )
                            .filter(
                              Boolean
                            )
                        : [],
                  })
                )
            : [],

        changes:
          Array.isArray(
            planSubjectsDraft
              .preview
              .changes
          )
            ? planSubjectsDraft
                .preview
                .changes
            : [],

        executionSteps:
          Array.isArray(
            planSubjectsDraft
              .preview
              .executionSteps
          )
            ? planSubjectsDraft
                .preview
                .executionSteps
            : [],

        missingFields:
          Array.isArray(
            planSubjectsDraft
              .preview
              .missingFields
          )
            ? planSubjectsDraft
                .preview
                .missingFields
            : [],

        warnings:
          Array.isArray(
            planSubjectsDraft
              .preview
              .warnings
          )
            ? planSubjectsDraft
                .preview
                .warnings
            : [],

        canConfirm:
          planSubjectsDraft
            .preview
            .canConfirm ===
            true,
      },

      sourceSnapshot: {
        student: {
          id:
            Math.floor(
              studentId
            ),

          clientName:
            planSubjectsDraft
              .studentName ??
            null,

          assigneeId:
            Math.floor(
              assigneeId
            ),
        },

        plan: {
          id:
            Math.floor(
              planId
            ),
        },

        originalPlanSubjectIds,

        draftCreatedAt:
          draft.createdAt,
      },

      expiresInMinutes:
        30,
    });

  const publicPendingAction =
    toAiPendingActionPublicResult(
      pendingAction
    );

  /**
   * 이후 "승인", "진행해줘"라고 하면
   * 이 plan_subjects_create Pending Action을 사용한다.
   */
  workSession =
    await db.patchAiWorkSession({
      organizationId:
        aiContext.organizationId,

      userId:
        aiContext.userId,

      expectedVersion:
        workSession.version,

      patch: {
        lastPresentedAction: {
          actionId:
            `pending-action-${Number(
              pendingAction.id
            )}`,

          actionType:
            "plan_subjects_create",

          targetType:
            "student",

          targetId:
            Math.floor(
              studentId
            ),

          payload: {
            pendingActionId:
              Number(
                pendingAction.id
              ),

            planId:
              Math.floor(
                planId
              ),
          },

          expiresAt:
            pendingAction.expiresAt
              ? new Date(
                  pendingAction.expiresAt
                ).toISOString()
              : new Date(
                  Date.now() +
                  30 * 60 * 1000
                ).toISOString(),
        },
      },
    });

  /**
   * 기존 플랜과목 생성 초안을 수정해서
   * 새 초안이 만들어진 경우 이전 것을 취소한다.
   */
  await replacePreviousAiPendingActionIfNeeded({
    ctx,

    isPendingActionRevision,

    previousPendingActionId,

    previousPendingActionType,

    expectedActionType:
      "plan_subjects_create",

    newPendingActionId:
      Number(
        pendingAction.id
      ),

    targetOrganizationId:
      input.targetOrganizationId ??
      null,
  });

  const reply =
    String(
      result.reply ||
      `${
        planSubjectsDraft
          .studentName ||
        `학생 ${studentId}번`
      }의 플랜 과목 ${subjects.length}개 등록 초안을 만들었습니다.`
    ).trim();

  await db.saveAiChatMessage({
    organizationId:
      aiContext.organizationId,

    userId:
      aiContext.userId,

    role:
      "assistant",

    kind:
      "student_registration_preview",

    content:
      reply,

    messageDataJson: {
      toolName:
        "plan.subjects.create",

      pendingActionDecision:
        result.pendingActionDecision ??
        null,

      replacedPendingActionId:
        isPendingActionRevision &&
        previousPendingActionType ===
          "plan_subjects_create" &&
        previousPendingActionId >
          0
          ? Math.floor(
              previousPendingActionId
            )
          : null,

      planSubjectsCreateDraft:
        planSubjectsDraft,

      pendingAction:
        publicPendingAction,
    },

    selectedStudentId:
      Math.floor(
        studentId
      ),
  });

  assistantMessageSaved =
    true;

  return {
    ...result,

    pendingAction:
      publicPendingAction,

    planSubjectsCreateDraft:
      planSubjectsDraft,

    conversationHistoryCount:
      conversationHistory.length,

    workSession,
  };
}

/**
 * 학생 플랜 과목 수정 Tool은
 * planSemesters 테이블을 즉시 변경하지 않는다.
 *
 * Runner에서 생성한 과목 수정 초안을
 * Pending Action으로 저장하고
 * 사용자 최종 승인을 기다린다.
 */
if (
  result.planSubjectsUpdateDraft &&
  result.planSubjectsUpdateDraft
    .pendingActionRequired ===
    true
) {
  const planSubjectsUpdateDraft =
    result.planSubjectsUpdateDraft;

  const studentId =
    Number(
      planSubjectsUpdateDraft
        .studentId ||
      0
    );

  if (
    !Number.isFinite(
      studentId
    ) ||
    studentId <=
      0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "플랜 과목을 수정할 학생 정보가 올바르지 않습니다.",
      400
    );
  }

  const planId =
    Number(
      planSubjectsUpdateDraft
        .planId ||
      0
    );

  if (
    !Number.isFinite(
      planId
    ) ||
    planId <=
      0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "플랜 과목을 수정할 플랜 정보가 올바르지 않습니다.",
      400
    );
  }

  const planSubjectId =
    Number(
      planSubjectsUpdateDraft
        .planSubjectId ||
      0
    );

  if (
    !Number.isFinite(
      planSubjectId
    ) ||
    planSubjectId <=
      0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "수정할 플랜 과목 정보가 올바르지 않습니다.",
      400
    );
  }

  const draft =
    planSubjectsUpdateDraft
      .draft;

  if (
    !draft ||
    typeof draft !==
      "object" ||
    Array.isArray(
      draft
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "플랜 과목 수정 승인 초안이 올바르지 않습니다.",
      400
    );
  }

  /**
   * Tool 결과 대상과
   * 내부 Draft 대상이 동일해야 한다.
   */
  if (
    Number(
      draft.studentId ||
      0
    ) !==
    Math.floor(
      studentId
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "플랜 과목 수정 초안의 학생 정보가 일치하지 않습니다.",
      400
    );
  }

  if (
    Number(
      draft.planId ||
      0
    ) !==
    Math.floor(
      planId
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "플랜 과목 수정 초안의 플랜 정보가 일치하지 않습니다.",
      400
    );
  }

  if (
    Number(
      draft.planSubjectId ||
      0
    ) !==
    Math.floor(
      planSubjectId
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "플랜 과목 수정 초안의 과목 정보가 일치하지 않습니다.",
      400
    );
  }

  const assigneeId =
    Number(
      draft.assigneeId ||
      0
    );

  if (
    !Number.isFinite(
      assigneeId
    ) ||
    assigneeId <=
      0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "학생 담당자 정보가 올바르지 않습니다.",
      400
    );
  }

  const originalValues =
    draft.originalValues;

  if (
    !originalValues ||
    typeof originalValues !==
      "object" ||
    Array.isArray(
      originalValues
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "플랜 과목 수정 원본 정보가 올바르지 않습니다.",
      400
    );
  }

  if (
    Number(
      originalValues.id ||
      0
    ) !==
    Math.floor(
      planSubjectId
    ) ||
    Number(
      originalValues.studentId ||
      0
    ) !==
    Math.floor(
      studentId
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "플랜 과목 수정 원본 대상 정보가 일치하지 않습니다.",
      400
    );
  }

  const updates =
    draft.updates;

  if (
    !updates ||
    typeof updates !==
      "object" ||
    Array.isArray(
      updates
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "플랜 과목 수정 변경정보가 올바르지 않습니다.",
      400
    );
  }

  const allowedUpdateFields = [
    "semesterNo",
    "subjectName",
    "planCategory",
    "planRequirementType",
    "credits",
    "sortOrder",
    "settlementIncluded",
  ] as const;

  const requestedFields =
    allowedUpdateFields.filter(
      (
        field
      ) =>
        Object.prototype
          .hasOwnProperty.call(
            updates,
            field
          )
    );

  if (
    requestedFields.length ===
      0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "플랜 과목 수정 초안에 변경 항목이 없습니다.",
      400
    );
  }

  /**
   * 승인 저장 직전 핵심 입력형식을
   * Router에서도 재확인한다.
   */
  if (
    Object.prototype
      .hasOwnProperty.call(
        updates,
        "semesterNo"
      )
  ) {
    const value =
      Number(
        (
          updates as any
        ).semesterNo
      );

    if (
      !Number.isInteger(
        value
      ) ||
      value <
        1 ||
      value >
        20
    ) {
      throwAppError(
        ERROR_CODES.INVALID_REQUEST,
        "플랜 과목 학기 정보가 올바르지 않습니다.",
        400
      );
    }
  }

  if (
    Object.prototype
      .hasOwnProperty.call(
        updates,
        "subjectName"
      )
  ) {
    const value =
      String(
        (
          updates as any
        ).subjectName ||
        ""
      )
        .trim()
        .replace(
          /\s+/g,
          " "
        );

    if (
      !value
    ) {
      throwAppError(
        ERROR_CODES.INVALID_REQUEST,
        "플랜 과목명이 올바르지 않습니다.",
        400
      );
    }
  }

  if (
    Object.prototype
      .hasOwnProperty.call(
        updates,
        "planCategory"
      )
  ) {
    const value =
      String(
        (
          updates as any
        ).planCategory ||
        ""
      ).trim();

    if (
      value !==
        "전공" &&
      value !==
        "교양" &&
      value !==
        "일반"
    ) {
      throwAppError(
        ERROR_CODES.INVALID_REQUEST,
        "플랜 과목 분류가 올바르지 않습니다.",
        400
      );
    }
  }

  if (
    Object.prototype
      .hasOwnProperty.call(
        updates,
        "planRequirementType"
      )
  ) {
    const value =
      String(
        (
          updates as any
        ).planRequirementType ||
        ""
      ).trim();

    if (
      value !==
        "전공필수" &&
      value !==
        "전공선택" &&
      value !==
        "교양" &&
      value !==
        "일반"
    ) {
      throwAppError(
        ERROR_CODES.INVALID_REQUEST,
        "플랜 과목 요구구분이 올바르지 않습니다.",
        400
      );
    }
  }

  if (
    Object.prototype
      .hasOwnProperty.call(
        updates,
        "credits"
      )
  ) {
    const value =
      Number(
        (
          updates as any
        ).credits
      );

    if (
      !Number.isInteger(
        value
      ) ||
      value <
        1 ||
      value >
        10
    ) {
      throwAppError(
        ERROR_CODES.INVALID_REQUEST,
        "플랜 과목 학점 정보가 올바르지 않습니다.",
        400
      );
    }
  }

  if (
    Object.prototype
      .hasOwnProperty.call(
        updates,
        "sortOrder"
      )
  ) {
    const value =
      Number(
        (
          updates as any
        ).sortOrder
      );

    if (
      !Number.isInteger(
        value
      ) ||
      value <
        0
    ) {
      throwAppError(
        ERROR_CODES.INVALID_REQUEST,
        "플랜 과목 정렬 순서가 올바르지 않습니다.",
        400
      );
    }
  }

  if (
    Object.prototype
      .hasOwnProperty.call(
        updates,
        "settlementIncluded"
      ) &&
    typeof (
      updates as any
    ).settlementIncluded !==
      "boolean"
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "플랜 과목 정산 포함 여부가 올바르지 않습니다.",
      400
    );
  }

  /**
   * 실제 DB 수정은 하지 않고
   * 승인용 Pending Action만 만든다.
   */
  const pendingAction =
    await db.createAiPendingAction({
      organizationId:
        aiContext.organizationId,

      requestedByUserId:
        aiContext.userId,

      requestedByRole:
        aiContext.role,

      actionType:
        "plan_subjects_update",

      consultationId:
        null,

      studentId:
        Math.floor(
          studentId
        ),

      semesterId:
        null,

      payload: {
        draft,

        originalMessage:
          input.message,
      },

      preview: {
        title:
          planSubjectsUpdateDraft
            .preview
            .title ||
          "학생 플랜 과목 수정",

        summary:
          planSubjectsUpdateDraft
            .preview
            .summary ||
          "수정할 플랜 과목 내용을 확인해주세요.",

        sections:
          Array.isArray(
            planSubjectsUpdateDraft
              .preview
              .sections
          )
            ? planSubjectsUpdateDraft
                .preview
                .sections
                .map(
                  (
                    section
                  ) => ({
                    label:
                      String(
                        (section as any)
                          ?.label ||
                        (section as any)
                          ?.title ||
                        "플랜 과목 수정 내용"
                      ),

                    items:
                      Array.isArray(
                        (section as any)
                          ?.items
                      )
                        ? (
                            section as any
                          ).items
                            .map(
                              (
                                item:
                                  unknown
                              ) =>
                                String(
                                  item ||
                                  ""
                                ).trim()
                            )
                            .filter(
                              Boolean
                            )
                        : [],
                  })
                )
            : [],

        changes:
          Array.isArray(
            planSubjectsUpdateDraft
              .preview
              .changes
          )
            ? planSubjectsUpdateDraft
                .preview
                .changes
            : [],

        executionSteps:
          Array.isArray(
            planSubjectsUpdateDraft
              .preview
              .executionSteps
          )
            ? planSubjectsUpdateDraft
                .preview
                .executionSteps
            : [],

        missingFields:
          Array.isArray(
            planSubjectsUpdateDraft
              .preview
              .missingFields
          )
            ? planSubjectsUpdateDraft
                .preview
                .missingFields
            : [],

        warnings:
          Array.isArray(
            planSubjectsUpdateDraft
              .preview
              .warnings
          )
            ? planSubjectsUpdateDraft
                .preview
                .warnings
            : [],

        canConfirm:
          planSubjectsUpdateDraft
            .preview
            .canConfirm ===
            true,
      },

      sourceSnapshot: {
        student: {
          id:
            Math.floor(
              studentId
            ),

          clientName:
            planSubjectsUpdateDraft
              .studentName ??
            null,

          assigneeId:
            Math.floor(
              assigneeId
            ),
        },

        plan: {
          id:
            Math.floor(
              planId
            ),
        },

        planSubject: {
          id:
            Math.floor(
              planSubjectId
            ),

          originalValues,
        },

        draftCreatedAt:
          draft.createdAt,
      },

      expiresInMinutes:
        30,
    });

  const publicPendingAction =
    toAiPendingActionPublicResult(
      pendingAction
    );

  /**
   * 승인/진행 요청이 들어오면
   * 이 Pending Action을 바로 찾도록 유지한다.
   */
  workSession =
    await db.patchAiWorkSession({
      organizationId:
        aiContext.organizationId,

      userId:
        aiContext.userId,

      expectedVersion:
        workSession.version,

      patch: {
        lastPresentedAction: {
          actionId:
            `pending-action-${Number(
              pendingAction.id
            )}`,

          actionType:
            "plan_subjects_update",

          targetType:
            "student",

          targetId:
            Math.floor(
              studentId
            ),

          payload: {
            pendingActionId:
              Number(
                pendingAction.id
              ),

            planId:
              Math.floor(
                planId
              ),

            planSubjectId:
              Math.floor(
                planSubjectId
              ),
          },

          expiresAt:
            pendingAction.expiresAt
              ? new Date(
                  pendingAction.expiresAt
                ).toISOString()
              : new Date(
                  Date.now() +
                  30 * 60 * 1000
                ).toISOString(),
        },
      },
    });

  /**
   * 기존 플랜 과목 수정 초안을
   * 다시 수정한 경우 이전 초안을 취소한다.
   */
  await replacePreviousAiPendingActionIfNeeded({
    ctx,

    isPendingActionRevision,

    previousPendingActionId,

    previousPendingActionType,

    expectedActionType:
      "plan_subjects_update",

    newPendingActionId:
      Number(
        pendingAction.id
      ),

    targetOrganizationId:
      input.targetOrganizationId ??
      null,
  });

  const reply =
    String(
      result.reply ||
      `${
        planSubjectsUpdateDraft
          .studentName ||
        `학생 ${studentId}번`
      }의 플랜 과목 수정 초안을 만들었습니다.`
    ).trim();

  await db.saveAiChatMessage({
    organizationId:
      aiContext.organizationId,

    userId:
      aiContext.userId,

    role:
      "assistant",

    kind:
      "student_registration_preview",

    content:
      reply,

    messageDataJson: {
      toolName:
        "plan.subjects.update",

      pendingActionDecision:
        result.pendingActionDecision ??
        null,

      replacedPendingActionId:
        isPendingActionRevision &&
        previousPendingActionType ===
          "plan_subjects_update" &&
        previousPendingActionId >
          0
          ? Math.floor(
              previousPendingActionId
            )
          : null,

      planSubjectsUpdateDraft:
        planSubjectsUpdateDraft,

      pendingAction:
        publicPendingAction,
    },

    selectedStudentId:
      Math.floor(
        studentId
      ),
  });

  assistantMessageSaved =
    true;

  return {
    ...result,

    pendingAction:
      publicPendingAction,

    planSubjectsUpdateDraft:
      planSubjectsUpdateDraft,

    conversationHistoryCount:
      conversationHistory.length,

    workSession,
  };
}



/**
 * 학생 학기 생성 Tool은
 * semesters 테이블을 즉시 변경하지 않는다.
 *
 * Runner에서 생성한 학기 생성 초안을
 * AI Pending Action으로 저장하고
 * 사용자의 최종 승인을 기다린다.
 */
if (
  result.semesterCreateDraft &&
  result.semesterCreateDraft
    .pendingActionRequired ===
    true
) {
  const semesterDraft =
    result.semesterCreateDraft;

  const studentId =
    Number(
      semesterDraft.studentId ||
      0
    );

  const semesterOrder =
    Number(
      semesterDraft.semesterOrder ||
      0
    );

  const semesterLabel =
    String(
      semesterDraft.semesterLabel ||
      ""
    ).trim();

  /**
   * Runner와 Tool에서 검증했더라도
   * Pending Action 저장 직전에
   * 핵심 식별값을 다시 검사한다.
   */
  if (
    !Number.isFinite(
      studentId
    ) ||
    studentId <= 0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "학기를 생성할 학생 정보가 올바르지 않습니다.",
      400
    );
  }

    if (
    !Number.isInteger(
      semesterOrder
    ) ||
    semesterOrder < 1 ||
    semesterOrder > 20
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "생성할 학기 순서는 1부터 20 사이의 정수여야 합니다.",
      400
    );
  }

    if (
    !semesterLabel
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "생성할 학기 구분이 없습니다.",
      400
    );
  }

  if (
    !/^(\d{4})년\s([12])학기$/.test(
      semesterLabel
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "생성할 학기 구분은 2026년 1학기 형식이어야 합니다.",
      400
    );
  }

  /**
   * Tool 결과 안의 실제 승인 초안을 확인한다.
   */
  const draft =
    semesterDraft.draft;

  if (
    !draft ||
    typeof draft !==
      "object" ||
    Array.isArray(
      draft
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "학기 생성 승인 초안이 올바르지 않습니다.",
      400
    );
  }

  /**
   * 바깥쪽 결과값과 실제 승인 초안의
   * 학생 및 학기 값이 동일한지 검사한다.
   */
   if (
    Number(
      draft.studentId ||
      0
    ) !==
      Math.floor(
        studentId
      ) ||
    Number(
      draft.semesterOrder ||
      0
    ) !==
      semesterOrder ||
    String(
      draft.semesterLabel ||
      ""
    ).trim() !==
      semesterLabel
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "학기 생성 초안의 대상 정보가 일치하지 않습니다.",
      400
    );
  }

  const assigneeId =
    Number(
      draft.assigneeId ||
      0
    );

  if (
    !Number.isFinite(
      assigneeId
    ) ||
    assigneeId <= 0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "학생 담당자 정보가 올바르지 않습니다.",
      400
    );
  }

  const originalLastSemesterOrder =
    Number(
      draft.originalLastSemesterOrder ??
      0
    );

    if (
    !Number.isInteger(
      originalLastSemesterOrder
    ) ||
    originalLastSemesterOrder < 0 ||
    originalLastSemesterOrder > 19
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "기존 마지막 학기 순서 정보가 올바르지 않습니다.",
      400
    );
  }

  /**
   * 학기 생성 초안을 Pending Action으로 저장한다.
   *
   * 이 시점에는 semesters 테이블을
   * 실제로 변경하지 않는다.
   */
  const pendingAction =
    await db.createAiPendingAction({
      organizationId:
        aiContext.organizationId,

      requestedByUserId:
        aiContext.userId,

      requestedByRole:
        aiContext.role,

      actionType:
        "semester_create",

      consultationId:
        null,

      studentId:
        Math.floor(
          studentId
        ),

      /**
       * 아직 실제 학기가 생성되지 않았으므로
       * semesterId는 null로 저장한다.
       */
      semesterId:
        null,

      /**
       * 다음 단계의 Executor가 사용할
       * 학기 생성 승인 초안이다.
       */
      payload: {
        draft,

        originalMessage:
          input.message,
      },

      /**
       * 사용자 승인 카드에 표시할 데이터다.
       */
      preview: {
        title:
          semesterDraft.preview
            .title ||
          "학생 학기 생성",

        summary:
          semesterDraft.preview
            .summary ||
          "생성할 학기 내용을 확인해주세요.",

        /**
         * Runner/Registry에서는 title + items,
         * Pending Action 공용 구조에서는
         * label + items를 사용한다.
         */
        sections:
          Array.isArray(
            semesterDraft.preview
              .sections
          )
            ? semesterDraft.preview
                .sections
                .map(
                  (
                    section
                  ) => ({
                    label:
                      String(
                        section?.title ||
                        "학기 생성 내용"
                      ),

                    items:
                      Array.isArray(
                        section?.items
                      )
                        ? section.items
                            .map(
                              (
                                item
                              ) =>
                                String(
                                  item ||
                                  ""
                                ).trim()
                            )
                            .filter(
                              Boolean
                            )
                        : [],
                  })
                )
            : [],

        /**
         * 신규 생성이므로 기존 값과 변경값을
         * 비교하는 changes는 비워둔다.
         */
        changes:
          [],

        executionSteps:
          Array.isArray(
            semesterDraft.preview
              .executionSteps
          )
            ? semesterDraft.preview
                .executionSteps
            : [
                "현재 학생과 조직 정보를 다시 확인합니다.",
                "학생 학기 수정 권한을 다시 확인합니다.",
                "초안 생성 이후 추가된 학기가 있는지 확인합니다.",
                "동일한 학기 순서와 학기 구분이 있는지 확인합니다.",
                "승인된 내용으로 새 학기를 생성합니다.",
              ],

        missingFields:
          Array.isArray(
            semesterDraft.preview
              .missingFields
          )
            ? semesterDraft.preview
                .missingFields
            : [],

        warnings:
          Array.isArray(
            semesterDraft.preview
              .warnings
          )
            ? semesterDraft.preview
                .warnings
            : [],

        canConfirm:
          semesterDraft.preview
            .canConfirm ===
            true,
      },

      /**
       * 초안이 만들어졌을 당시 학생 및
       * 기존 마지막 학기 상태를 보존한다.
       *
       * Executor에서 현재 DB와 다시 비교하여
       * 동시 수정이나 중복 등록을 차단한다.
       */
      sourceSnapshot: {
        student: {
          id:
            Math.floor(
              studentId
            ),

          clientName:
            semesterDraft.studentName ??
            null,

          assigneeId:
            Math.floor(
              assigneeId
            ),
        },

        semester: {
          semesterOrder:
            Math.floor(
              semesterOrder
            ),

          semesterLabel,

          originalLastSemesterOrder:
            Math.floor(
              originalLastSemesterOrder
            ),
        },

        draftCreatedAt:
          draft.createdAt,
      },

      expiresInMinutes:
        30,
    });

  const publicPendingAction =
    toAiPendingActionPublicResult(
      pendingAction
    );

  /**
   * 사용자가 이후 "ㅇㅇ", "진행해줘"라고
   * 답했을 때 방금 생성한 Pending Action을
   * 정확하게 승인할 수 있도록 업무 세션에 연결한다.
   */
  workSession =
    await db.patchAiWorkSession({
      organizationId:
        aiContext.organizationId,

      userId:
        aiContext.userId,

      expectedVersion:
        workSession.version,

      patch: {
        lastPresentedAction: {
          actionId:
            `pending-action-${Number(
              pendingAction.id
            )}`,

          actionType:
            "semester_create",

          targetType:
            "student",

          targetId:
            Math.floor(
              studentId
            ),

          payload: {
            pendingActionId:
              Number(
                pendingAction.id
              ),
          },

          expiresAt:
            pendingAction.expiresAt
              ? new Date(
                  pendingAction.expiresAt
                ).toISOString()
              : new Date(
                  Date.now() +
                  30 * 60 * 1000
                ).toISOString(),
        },
      },
    });

  /**
   * 기존 학기 생성 승인 초안을 수정한 경우
   * 새 초안 생성 성공 후 이전 초안을 취소한다.
   */
 await replacePreviousAiPendingActionIfNeeded({
    ctx,

    isPendingActionRevision,

    previousPendingActionId,

    previousPendingActionType,

    expectedActionType:
      "semester_create",

    newPendingActionId:
      Number(
        pendingAction.id
      ),

    targetOrganizationId:
      input.targetOrganizationId ??
      null,
  });

  const reply =
    String(
      result.reply ||
      `${
        semesterDraft.studentName ||
        `학생 ${studentId}번`
      }의 ${semesterOrder}학기 생성 초안을 만들었습니다.`
    ).trim();

  /**
   * 새로고침 후에도 학기 생성 승인 카드를
   * 복원할 수 있도록 AI 대화 기록에 저장한다.
   */
  await db.saveAiChatMessage({
    organizationId:
      aiContext.organizationId,

    userId:
      aiContext.userId,

    role:
      "assistant",

    /**
     * 현재 프론트의 Pending Action 카드가
     * student_registration_preview kind를
     * 사용하므로 기존 종류를 재사용한다.
     */
    kind:
      "student_registration_preview",

    content:
      reply,

    messageDataJson: {
      toolName:
        "semester.create",

      pendingActionDecision:
        result.pendingActionDecision ??
        null,

      replacedPendingActionId:
        isPendingActionRevision &&
        previousPendingActionType ===
          "semester_create" &&
        previousPendingActionId > 0
          ? Math.floor(
              previousPendingActionId
            )
          : null,

      semesterCreateDraft:
        semesterDraft,

      pendingAction:
        publicPendingAction,
    },

    selectedStudentId:
      Math.floor(
        studentId
      ),
  });

  assistantMessageSaved =
    true;

  return {
    ...result,

    pendingAction:
      publicPendingAction,

    semesterCreateDraft:
      semesterDraft,

    conversationHistoryCount:
      conversationHistory.length,

    workSession,
  };
}

/**
 * 학생 학기 수정 Tool은
 * semesters 테이블을 즉시 변경하지 않는다.
 *
 * Runner에서 생성한 학기 수정 초안을
 * AI Pending Action으로 저장하고
 * 사용자의 최종 승인을 기다린다.
 */
if (
  result.semesterUpdateDraft &&
  result.semesterUpdateDraft
    .pendingActionRequired ===
    true
) {
  const semesterUpdateDraft =
    result.semesterUpdateDraft;

  const studentId =
    Number(
      semesterUpdateDraft
        .studentId ||
      0
    );

  const semesterId =
    Number(
      semesterUpdateDraft
        .semesterId ||
      0
    );

  const semesterOrder =
    Number(
      semesterUpdateDraft
        .semesterOrder ||
      0
    );

  if (
    !Number.isFinite(
      studentId
    ) ||
    studentId <= 0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "수정할 학생 정보가 올바르지 않습니다.",
      400
    );
  }

  if (
    !Number.isFinite(
      semesterId
    ) ||
    semesterId <= 0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "수정할 학기 정보가 올바르지 않습니다.",
      400
    );
  }

  if (
    !Number.isInteger(
      semesterOrder
    ) ||
    semesterOrder <= 0 ||
    semesterOrder > 20
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "수정할 학기 순서가 올바르지 않습니다.",
      400
    );
  }

  const draft =
    semesterUpdateDraft
      .draft;

  if (
    !draft ||
    typeof draft !==
      "object" ||
    Array.isArray(
      draft
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "학기 수정 승인 초안이 올바르지 않습니다.",
      400
    );
  }

  if (
    Number(
      draft.studentId ||
      0
    ) !==
      Math.floor(
        studentId
      ) ||
    Number(
      draft.semesterId ||
      0
    ) !==
      Math.floor(
        semesterId
      ) ||
    Number(
      draft.semesterOrder ||
      0
    ) !==
      Math.floor(
        semesterOrder
      )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "학기 수정 초안의 대상 정보가 일치하지 않습니다.",
      400
    );
  }

  const assigneeId =
    Number(
      draft.assigneeId ||
      0
    );

  if (
    !Number.isFinite(
      assigneeId
    ) ||
    assigneeId <= 0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "학생 담당자 정보가 올바르지 않습니다.",
      400
    );
  }

  const originalValues =
    draft.originalValues;

  if (
    !originalValues ||
    typeof originalValues !==
      "object" ||
    Array.isArray(
      originalValues
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "학기 수정 원본 정보가 올바르지 않습니다.",
      400
    );
  }

  const updates =
    draft.updates;

  if (
    !updates ||
    typeof updates !==
      "object" ||
    Array.isArray(
      updates
    ) ||
    Object.keys(
      updates
    ).length === 0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "변경할 학기 정보가 없습니다.",
      400
    );
  }

  const allowedUpdateFields =
    new Set([
      "semesterLabel",
      "plannedMonth",
      "plannedInstitution",
      "plannedSubjectCount",
      "plannedAmount",
      "actualStartDate",
      "actualInstitution",
      "actualSubjectCount",
      "actualAmount",
      "actualPaymentDate",
    ]);

  const updateKeys =
    Object.keys(
      updates
    );

  if (
    updateKeys.some(
      (
        key
      ) =>
        !allowedUpdateFields.has(
          key
        )
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "허용되지 않은 학기 수정 항목이 포함되어 있습니다.",
      400
    );
  }

  const originalApprovalStatus =
    String(
      originalValues
        .approvalStatus ||
      "요청전"
    ).trim();

  if (
    originalApprovalStatus !==
      "요청전" &&
    originalApprovalStatus !==
      "불승인"
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      originalApprovalStatus ===
        "대기"
        ? "승인 대기 중인 학기는 수정할 수 없습니다."
        : originalApprovalStatus ===
            "승인"
          ? "이미 승인된 학기는 수정할 수 없습니다."
          : "현재 승인 상태에서는 학기를 수정할 수 없습니다.",
      409
    );
  }

  const changes =
    Array.isArray(
      semesterUpdateDraft
        .changes
    )
      ? semesterUpdateDraft
          .changes
      : [];

  if (
    changes.length ===
    0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "실제로 변경되는 학기 정보가 없습니다.",
      400
    );
  }

  const pendingAction =
    await db.createAiPendingAction({
      organizationId:
        aiContext.organizationId,

      requestedByUserId:
        aiContext.userId,

      requestedByRole:
        aiContext.role,

      actionType:
        "semester_update",

      consultationId:
        null,

      studentId:
        Math.floor(
          studentId
        ),

      semesterId:
        Math.floor(
          semesterId
        ),

      payload: {
        draft,

        originalMessage:
          input.message,
      },

      preview: {
        title:
          semesterUpdateDraft
            .preview
            .title ||
          "학생 학기 수정",

        summary:
          semesterUpdateDraft
            .preview
            .summary ||
          "학기 수정 내용을 확인해주세요.",

        sections:
          Array.isArray(
            semesterUpdateDraft
              .preview
              .sections
          )
            ? semesterUpdateDraft
                .preview
                .sections
                .map(
                  (
                    section
                  ) => ({
                    label:
                      String(
                        section?.title ||
                        "학기 수정 내용"
                      ),

                    items:
                      Array.isArray(
                        section?.items
                      )
                        ? section.items
                            .map(
                              (
                                item
                              ) =>
                                String(
                                  item ||
                                  ""
                                ).trim()
                            )
                            .filter(
                              Boolean
                            )
                        : [],
                  })
                )
            : [],

        changes:
          changes.map(
            (
              change
            ) => ({
              label:
                String(
                  change?.label ||
                  change?.field ||
                  "변경 항목"
                ),

              before:
                change?.before ??
                null,

              after:
                change?.after ??
                null,
            })
          ),

        executionSteps:
          Array.isArray(
            semesterUpdateDraft
              .preview
              .executionSteps
          )
            ? semesterUpdateDraft
                .preview
                .executionSteps
            : [],

        missingFields:
          Array.isArray(
            semesterUpdateDraft
              .preview
              .missingFields
          )
            ? semesterUpdateDraft
                .preview
                .missingFields
            : [],

        warnings:
          Array.isArray(
            semesterUpdateDraft
              .preview
              .warnings
          )
            ? semesterUpdateDraft
                .preview
                .warnings
            : [],

        canConfirm:
          semesterUpdateDraft
            .preview
            .canConfirm ===
            true,
      },

      sourceSnapshot: {
        student: {
          id:
            Math.floor(
              studentId
            ),

          clientName:
            semesterUpdateDraft
              .studentName ??
            null,

          assigneeId:
            Math.floor(
              assigneeId
            ),
        },

        semester: {
          id:
            Math.floor(
              semesterId
            ),

          semesterOrder:
            Math.floor(
              semesterOrder
            ),

          originalValues,
        },

        draftCreatedAt:
          draft.createdAt,
      },

      expiresInMinutes:
        30,
    });

  const publicPendingAction =
    toAiPendingActionPublicResult(
      pendingAction
    );

  workSession =
    await db.patchAiWorkSession({
      organizationId:
        aiContext.organizationId,

      userId:
        aiContext.userId,

      expectedVersion:
        workSession.version,

      patch: {
        lastPresentedAction: {
          actionId:
            `pending-action-${Number(
              pendingAction.id
            )}`,

          actionType:
            "semester_update",

          targetType:
            "student",

          targetId:
            Math.floor(
              studentId
            ),

          payload: {
            pendingActionId:
              Number(
                pendingAction.id
              ),
          },

          expiresAt:
            pendingAction.expiresAt
              ? new Date(
                  pendingAction.expiresAt
                ).toISOString()
              : new Date(
                  Date.now() +
                  30 * 60 * 1000
                ).toISOString(),
        },
      },
    });

  await replacePreviousAiPendingActionIfNeeded({
    ctx,

    isPendingActionRevision,

    previousPendingActionId,

    previousPendingActionType,

    expectedActionType:
      "semester_update",

    newPendingActionId:
      Number(
        pendingAction.id
      ),

    targetOrganizationId:
      input.targetOrganizationId ??
      null,
  });

  const reply =
    String(
      result.reply ||
      `${
        semesterUpdateDraft
          .studentName ||
        `학생 ${studentId}번`
      }의 ${semesterOrder}학기 수정 초안을 만들었습니다.`
    ).trim();

  await db.saveAiChatMessage({
    organizationId:
      aiContext.organizationId,

    userId:
      aiContext.userId,

    role:
      "assistant",

    kind:
      "student_registration_preview",

    content:
      reply,

    messageDataJson: {
      toolName:
        "semester.update",

      pendingActionDecision:
        result.pendingActionDecision ??
        null,

      replacedPendingActionId:
        isPendingActionRevision &&
        previousPendingActionType ===
          "semester_update" &&
        previousPendingActionId > 0
          ? Math.floor(
              previousPendingActionId
            )
          : null,

      semesterUpdateDraft,

      pendingAction:
        publicPendingAction,
    },

    selectedStudentId:
      Math.floor(
        studentId
      ),
  });

  assistantMessageSaved =
    true;

  return {
    ...result,

    pendingAction:
      publicPendingAction,

    semesterUpdateDraft,

    conversationHistoryCount:
      conversationHistory.length,

    workSession,
  };
}

/**
 * 학생 학기 입력완료 Tool은
 * semesters 테이블을 즉시 변경하지 않는다.
 *
 * Runner에서 생성한 입력완료 초안을
 * AI Pending Action으로 저장하고
 * 사용자의 최종 승인을 기다린다.
 */
if (
  result.semesterCompleteDraft &&
  result.semesterCompleteDraft
    .pendingActionRequired ===
    true
) {
  const semesterCompleteDraft =
    result.semesterCompleteDraft;

  const studentId =
    Number(
      semesterCompleteDraft
        .studentId ||
      0
    );

  const semesterId =
    Number(
      semesterCompleteDraft
        .semesterId ||
      0
    );

  const semesterOrder =
    Number(
      semesterCompleteDraft
        .semesterOrder ||
      0
    );

  /**
   * Runner와 Tool에서 이미 검증했더라도
   * Pending Action 저장 직전에
   * 대상 학생과 학기 값을 다시 검사한다.
   */
  if (
    !Number.isFinite(
      studentId
    ) ||
    studentId <= 0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "입력완료 처리할 학생 정보가 올바르지 않습니다.",
      400
    );
  }

  if (
    !Number.isFinite(
      semesterId
    ) ||
    semesterId <= 0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "입력완료 처리할 학기 정보가 올바르지 않습니다.",
      400
    );
  }

  if (
    !Number.isInteger(
      semesterOrder
    ) ||
    semesterOrder <= 0 ||
    semesterOrder > 20
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "입력완료 처리할 학기 순서가 올바르지 않습니다.",
      400
    );
  }

  const draft =
    semesterCompleteDraft
      .draft;

  if (
    !draft ||
    typeof draft !==
      "object" ||
    Array.isArray(
      draft
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "학기 입력완료 승인 초안이 올바르지 않습니다.",
      400
    );
  }

  /**
   * 바깥쪽 Tool 결과와 내부 승인 초안의
   * 학생·학기 정보가 모두 일치해야 한다.
   */
  if (
    Number(
      draft.studentId ||
      0
    ) !==
      Math.floor(
        studentId
      ) ||
    Number(
      draft.semesterId ||
      0
    ) !==
      Math.floor(
        semesterId
      ) ||
    Number(
      draft.semesterOrder ||
      0
    ) !==
      Math.floor(
        semesterOrder
      )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "학기 입력완료 초안의 대상 정보가 일치하지 않습니다.",
      400
    );
  }

  const assigneeId =
    Number(
      draft.assigneeId ||
      0
    );

  if (
    !Number.isFinite(
      assigneeId
    ) ||
    assigneeId <= 0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "학생 담당자 정보가 올바르지 않습니다.",
      400
    );
  }

  /**
   * 입력완료 시 허용되는 변경값은
   * 아래 두 값으로 고정한다.
   *
   * 다른 필드를 포함한 초안은 저장하지 않는다.
   */
  if (
    draft.updates
      ?.isCompleted !==
      true ||
    draft.updates
      ?.approvalStatus !==
      "대기"
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "학기 입력완료 변경값이 올바르지 않습니다.",
      400
    );
  }

  const originalValues =
    draft.originalValues;

  if (
    !originalValues ||
    typeof originalValues !==
      "object" ||
    Array.isArray(
      originalValues
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "학기 입력완료 원본 상태가 올바르지 않습니다.",
      400
    );
  }

  /**
   * 이미 완료된 학기를 대상으로 만든 초안은
   * Pending Action으로 저장하지 않는다.
   */
  if (
    originalValues.isCompleted ===
    true
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "이미 입력완료 처리된 학기입니다.",
      409
    );
  }

  const originalApprovalStatus =
    String(
      originalValues
        .approvalStatus ||
      ""
    ).trim();

  /**
   * 학생 상세페이지의 입력완료 버튼과
   * 동일한 허용 규칙을 적용한다.
   */
  if (
    originalApprovalStatus !==
      "요청전" &&
    originalApprovalStatus !==
      "불승인"
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      originalApprovalStatus ===
        "대기"
        ? "이미 승인 대기 중인 학기입니다."
        : originalApprovalStatus ===
            "승인"
          ? "이미 승인된 학기는 입력완료 처리할 수 없습니다."
          : "현재 승인 상태에서는 입력완료 처리할 수 없습니다.",
      409
    );
  }

  /**
   * 학기 입력완료 초안을 Pending Action으로 저장한다.
   *
   * 이 시점에는 semesters 테이블을
   * 실제로 변경하지 않는다.
   */
  const pendingAction =
    await db.createAiPendingAction({
      organizationId:
        aiContext.organizationId,

      requestedByUserId:
        aiContext.userId,

      requestedByRole:
        aiContext.role,

      actionType:
        "semester_complete",

      consultationId:
        null,

      studentId:
        Math.floor(
          studentId
        ),

      semesterId:
        Math.floor(
          semesterId
        ),

      /**
       * Executor가 승인 실행 시 사용할
       * 학기 입력완료 초안이다.
       */
      payload: {
        draft,

        originalMessage:
          input.message,
      },

      preview: {
        title:
          semesterCompleteDraft
            .preview
            .title ||
          "학생 학기 입력완료",

        summary:
          semesterCompleteDraft
            .preview
            .summary ||
          "학기 입력완료 처리 내용을 확인해주세요.",

        sections:
          Array.isArray(
            semesterCompleteDraft
              .preview
              .sections
          )
            ? semesterCompleteDraft
                .preview
                .sections
                .map(
                  (
                    section
                  ) => ({
                    label:
                      String(
                        section?.title ||
                        "입력완료 처리 내용"
                      ),

                    items:
                      Array.isArray(
                        section?.items
                      )
                        ? section.items
                            .map(
                              (
                                item
                              ) =>
                                String(
                                  item ||
                                  ""
                                ).trim()
                            )
                            .filter(
                              Boolean
                            )
                        : [],
                  })
                )
            : [],

        changes:
          Array.isArray(
            semesterCompleteDraft
              .preview
              .changes
          )
            ? semesterCompleteDraft
                .preview
                .changes
                .map(
                  (
                    change
                  ) => ({
                    label:
                      String(
                        change?.label ||
                        "변경 항목"
                      ),

                    before:
                      change?.before ??
                      null,

                    after:
                      change?.after ??
                      null,

                    description:
                      change?.description ??
                      null,
                  })
                )
            : [
                {
                  label:
                    "입력 상태",

                  before:
                    false,

                  after:
                    true,
                },
                {
                  label:
                    "승인 상태",

                  before:
                    originalApprovalStatus,

                  after:
                    "대기",
                },
              ],

        executionSteps:
          Array.isArray(
            semesterCompleteDraft
              .preview
              .executionSteps
          )
            ? semesterCompleteDraft
                .preview
                .executionSteps
            : [
                "현재 학생과 조직 정보를 다시 확인합니다.",
                "현재 담당자의 학생 수정 권한을 다시 확인합니다.",
                "학기 상태가 초안 생성 이후 변경되지 않았는지 확인합니다.",
                "실제 등록정보와 우리플랜 과목 수를 다시 확인합니다.",
                "입력완료 상태와 승인 대기 상태만 반영합니다.",
              ],

        missingFields:
          Array.isArray(
            semesterCompleteDraft
              .preview
              .missingFields
          )
            ? semesterCompleteDraft
                .preview
                .missingFields
            : [],

        warnings:
          Array.isArray(
            semesterCompleteDraft
              .preview
              .warnings
          )
            ? semesterCompleteDraft
                .preview
                .warnings
            : [],

        canConfirm:
          semesterCompleteDraft
            .preview
            .canConfirm ===
            true,
      },

      /**
       * 초안 생성 당시 학생 담당자와
       * 학기의 실제 등록정보를 함께 보존한다.
       *
       * Executor는 payload.draft.originalValues를
       * 기준으로 현재 DB와 다시 비교한다.
       */
      sourceSnapshot: {
        student: {
          id:
            Math.floor(
              studentId
            ),

          clientName:
            semesterCompleteDraft
              .studentName ??
            null,

          assigneeId:
            Math.floor(
              assigneeId
            ),
        },

        semester: {
          id:
            Math.floor(
              semesterId
            ),

          semesterOrder:
            Math.floor(
              semesterOrder
            ),

          semesterLabel:
            semesterCompleteDraft
              .semesterLabel ??
            null,

          actualSubjectCount:
            Number(
              draft.actualSubjectCount ||
              0
            ),

          planSubjectCount:
            Number(
              draft.planSubjectCount ||
              0
            ),

          originalValues,
        },

        draftCreatedAt:
          draft.createdAt,
      },

      expiresInMinutes:
        30,
    });

  const publicPendingAction =
    toAiPendingActionPublicResult(
      pendingAction
    );

  /**
   * 사용자가 이후 “ㅇㅇ”, “진행해줘”라고
   * 답했을 때 방금 만든 입력완료 Action을
   * 정확히 승인할 수 있도록 연결한다.
   */
  workSession =
    await db.patchAiWorkSession({
      organizationId:
        aiContext.organizationId,

      userId:
        aiContext.userId,

      expectedVersion:
        workSession.version,

      patch: {
        lastPresentedAction: {
          actionId:
            `pending-action-${Number(
              pendingAction.id
            )}`,

          actionType:
            "semester_complete",

          targetType:
            "student",

          targetId:
            Math.floor(
              studentId
            ),

          payload: {
            pendingActionId:
              Number(
                pendingAction.id
              ),
          },

          expiresAt:
            pendingAction.expiresAt
              ? new Date(
                  pendingAction.expiresAt
                ).toISOString()
              : new Date(
                  Date.now() +
                  30 * 60 * 1000
                ).toISOString(),
        },
      },
    });

  /**
   * 기존 입력완료 승인 초안을 수정하거나
   * 다시 생성한 경우 새 초안 생성 이후
   * 이전 초안을 취소한다.
   */
  await replacePreviousAiPendingActionIfNeeded({
    ctx,

    isPendingActionRevision,

    previousPendingActionId,

    previousPendingActionType,

    expectedActionType:
      "semester_complete",

    newPendingActionId:
      Number(
        pendingAction.id
      ),

    targetOrganizationId:
      input.targetOrganizationId ??
      null,
  });

  const reply =
    String(
      result.reply ||
      `${
        semesterCompleteDraft
          .studentName ||
        `학생 ${studentId}번`
      }의 ${semesterOrder}학기 입력완료 초안을 만들었습니다.`
    ).trim();

  /**
   * 새로고침 후에도 입력완료 승인 카드를
   * 복원할 수 있도록 AI 대화 기록에 저장한다.
   */
  await db.saveAiChatMessage({
    organizationId:
      aiContext.organizationId,

    userId:
      aiContext.userId,

    role:
      "assistant",

    kind:
      "student_registration_preview",

    content:
      reply,

    messageDataJson: {
      toolName:
        "semester.complete",

      pendingActionDecision:
        result.pendingActionDecision ??
        null,

      replacedPendingActionId:
        isPendingActionRevision &&
        previousPendingActionType ===
          "semester_complete" &&
        previousPendingActionId > 0
          ? Math.floor(
              previousPendingActionId
            )
          : null,

      semesterCompleteDraft,

      pendingAction:
        publicPendingAction,
    },

    selectedStudentId:
      Math.floor(
        studentId
      ),
  });

  assistantMessageSaved =
    true;

  return {
    ...result,

    pendingAction:
      publicPendingAction,

    semesterCompleteDraft,

    conversationHistoryCount:
      conversationHistory.length,

    workSession,
  };
}

/**
 * 학생 기본정보 수정 Tool은
 * 학생정보를 즉시 변경하지 않는다.
 *
 * Runner에서 생성한 학생 수정 초안을
 * AI Pending Action으로 저장하고
 * 사용자의 최종 승인을 기다린다.
 */
if (
  result.studentUpdateDraft &&
  result.studentUpdateDraft
    .pendingActionRequired ===
    true
) {
  const studentDraft =
    result.studentUpdateDraft;

  const studentId =
    Number(
      studentDraft.studentId ||
      0
    );

  /**
   * Runner와 Tool에서 검증했더라도
   * Pending Action 저장 직전에
   * 학생 ID를 다시 검사한다.
   */
  if (
    !Number.isFinite(
      studentId
    ) ||
    studentId <= 0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "수정할 학생 정보가 올바르지 않습니다.",
      400
    );
  }

  /**
   * 실제 변경 항목이 존재하는지
   * 다시 확인한다.
   */
  const changes =
    Array.isArray(
      studentDraft.changes
    )
      ? studentDraft.changes
      : [];

  if (
    changes.length ===
    0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "변경할 학생정보가 없습니다.",
      400
    );
  }

  /**
   * Tool에서 생성한 변경 초안을
   * Pending Action에 저장한다.
   *
   * 이 시점에는 students 테이블을
   * 실제로 수정하지 않는다.
   */
  const pendingAction =
    await db.createAiPendingAction({
      organizationId:
        aiContext.organizationId,

      requestedByUserId:
        aiContext.userId,

      requestedByRole:
        aiContext.role,

      actionType:
        "student_update",

      consultationId:
        null,

      studentId:
        Math.floor(
          studentId
        ),

      semesterId:
        null,

      /**
       * Executor가 실제 승인 실행 시
       * 사용할 학생 수정 초안이다.
       */
      payload: {
        draft:
          studentDraft.draft,

        originalMessage:
          input.message,
      },

      /**
       * 사용자 승인 카드에 표시할 데이터다.
       */
      preview: {
        title:
          studentDraft.preview
            .title ||
          "학생 기본정보 수정",

        summary:
          studentDraft.preview
            .summary ||
          "학생 기본정보 변경 내용을 확인해주세요.",

        sections:
  Array.isArray(
    studentDraft.preview
      .sections
  )
    ? studentDraft.preview
        .sections
        .map(
          (
            section
          ) => ({
            label:
              String(
                section?.title ||
                "수정 대상"
              ),

            items:
              Array.isArray(
                section?.items
              )
                ? section.items
                    .map(
                      (
                        item
                      ) =>
                        String(
                          item ||
                          ""
                        ).trim()
                    )
                    .filter(
                      Boolean
                    )
                : [],
          })
        )
    : [],

        changes:
          changes.map(
            (
              change
            ) => ({
              label:
                String(
                  change.label ||
                  change.field ||
                  "변경 항목"
                ),

              before:
                change.before ??
                null,

              after:
                change.after ??
                null,
            })
          ),

        executionSteps:
          Array.isArray(
            studentDraft.preview
              .executionSteps
          )
            ? studentDraft.preview
                .executionSteps
            : [
                "현재 학생정보를 다시 확인합니다.",
                "학생 조회 및 수정 권한을 다시 확인합니다.",
                "승인된 변경 항목만 학생정보에 반영합니다.",
              ],

        missingFields:
          Array.isArray(
            studentDraft.preview
              .missingFields
          )
            ? studentDraft.preview
                .missingFields
            : [],

        warnings:
          Array.isArray(
            studentDraft.preview
              .warnings
          )
            ? studentDraft.preview
                .warnings
            : [],

        canConfirm:
          studentDraft.preview
            .canConfirm ===
            true &&
          changes.length >
            0,
      },

      /**
       * Executor에서도 draft.originalValues를
       * 기준으로 충돌검사를 수행한다.
       *
       * sourceSnapshot은 사용자 승인 기록과
       * 추후 감사 확인을 위해 함께 보존한다.
       */
      sourceSnapshot: {
        student: {
          id:
            Math.floor(
              studentId
            ),

          clientName:
            studentDraft.studentName ??
            null,

          status:
            studentDraft.draft
              .originalValues
              .status ??
            null,

          course:
            studentDraft.draft
              .originalValues
              .course ??
            null,

          address:
            studentDraft.draft
              .originalValues
              .address ??
            null,

          detailAddress:
            studentDraft.draft
              .originalValues
              .detailAddress ??
            null,
        },

        draftCreatedAt:
          studentDraft.draft
            .createdAt,
      },

      expiresInMinutes:
        30,
    });

 const publicPendingAction =
  toAiPendingActionPublicResult(
    pendingAction
  );

workSession =
  await db.patchAiWorkSession({
    organizationId:
      aiContext.organizationId,

    userId:
      aiContext.userId,

    expectedVersion:
      workSession.version,

    patch: {
      lastPresentedAction: {
  actionId:
    `pending-action-${Number(
      pendingAction.id
    )}`,

  actionType:
    "student_update",

  targetType:
    "student",

        targetId:
          Math.floor(
            studentId
          ),

        payload: {
          pendingActionId:
            Number(
              pendingAction.id
            ),
        },

        expiresAt:
          pendingAction.expiresAt
            ? new Date(
                pendingAction.expiresAt
              ).toISOString()
            : new Date(
                Date.now() +
                30 * 60 * 1000
              ).toISOString(),
      },
    },
  });

/**
 * 기존 학생 수정 승인 초안을 변경한 경우
 * 새 초안 생성 성공 후 이전 초안을 취소한다.
 */
await replacePreviousAiPendingActionIfNeeded({
  ctx,

  isPendingActionRevision,

  previousPendingActionId,

  previousPendingActionType,

  expectedActionType:
    "student_update",

  newPendingActionId:
    Number(
      pendingAction.id
    ),

  targetOrganizationId:
    input.targetOrganizationId ??
    null,
});

const reply =
    String(
      result.reply ||
      `${
        studentDraft.studentName ||
        `학생 ${studentId}번`
      }의 기본정보 수정 초안을 만들었습니다.`
    ).trim();

  /**
   * 새로고침 후에도 승인 카드를
   * 복원할 수 있도록 대화 기록에 저장한다.
   */
  await db.saveAiChatMessage({
    organizationId:
      aiContext.organizationId,

    userId:
      aiContext.userId,

    role:
      "assistant",

    /**
     * 현재 프론트 Pending Action 카드가
     * 이 kind를 기준으로 복원되고 있으므로
     * 기존 값을 재사용한다.
     */
    kind:
      "student_registration_preview",

    content:
      reply,

    messageDataJson: {
      toolName:
        "student.update",

  pendingActionDecision:
    result.pendingActionDecision ??
    null,

  replacedPendingActionId:
  isPendingActionRevision &&
  previousPendingActionType ===
    "student_update" &&
  previousPendingActionId > 0
    ? Math.floor(
        previousPendingActionId
      )
    : null,

      studentUpdateDraft:
        studentDraft,

      pendingAction:
        publicPendingAction,
    },

    selectedStudentId:
      Math.floor(
        studentId
      ),
  });

  assistantMessageSaved =
    true;

    return {
    ...result,

    pendingAction:
      publicPendingAction,

    studentUpdateDraft:
      studentDraft,

    conversationHistoryCount:
      conversationHistory.length,

    workSession,
  };
}

const kind =
  getAiChatKindFromResult(
    result
  );

              /**
               * result.data와 registrationPreview가
               * 동시에 존재해도 둘 다 보존한다.
               *
               * 기존 코드는 result.data가 존재하면
               * registrationPreview가 저장되지 않을 수 있었다.
               */
              const messageData: Record<
                string,
                unknown
              > = {};

              if (
                result.data &&
                typeof result.data ===
                  "object" &&
                !Array.isArray(
                  result.data
                )
              ) {
                Object.assign(
                  messageData,
                  result.data
                );
              }

              if (
                result.registrationPreview
              ) {
                messageData.registrationPreview =
                  result.registrationPreview;
              }

              if (
                result.toolResult &&
                typeof result.toolResult ===
                  "object"
              ) {
                messageData.toolResult =
                  result.toolResult;
              }

/**
 * 문서 분석 Tool 결과는
 * 기존 document_analysis 카드가 바로 사용할 수 있도록
 * documentAnalysis 키로도 별도 보존한다.
 *
 * Base64 원본은 Tool 결과에 포함되지 않는다.
 */
if (
  result.toolName ===
    "document.analysis" &&
  result.toolResult
    ?.success ===
    true &&
  result.toolResult
    ?.data &&
  typeof result.toolResult
    .data ===
    "object"
) {
  messageData.documentAnalysis =
    result.toolResult.data;

  if (
    input.imageAttachment
  ) {
    messageData.fileName =
      input.imageAttachment
        .fileName;

    messageData.mimeType =
      input.imageAttachment
        .mimeType;
  }
}

messageData.workSessionVersion =
  workSession.version;

messageData.workflow = {
  type:
    workSession.workflow.type,

  step:
    workSession.workflow.step,

  waitingFor:
    workSession.workflow.waitingFor,
};

              const messageDataJson =
                Object.keys(
                  messageData
                ).length > 0
                  ? messageData
                  : null;

              const assistantReply =
                String(
                  result.reply ||
                  "응답 결과가 없습니다."
                ).trim();

              await db.saveAiChatMessage({
                organizationId:
                  aiContext.organizationId,

                userId:
                  aiContext.userId,

                role:
                  "assistant",

                kind,

                content:
                  assistantReply,

                messageDataJson,

                                selectedStudentId:
                  activeStudentId,
              });

              assistantMessageSaved =
                true;

                            return {
                ...result,

                conversationHistoryCount:
                  conversationHistory.length,

                workSession,
              };
            } catch (
              error
            ) {
              const errorMessage =
                error instanceof Error
                  ? String(
                      error.message ||
                      ""
                    ).trim()
                  : "AI 요청을 처리하는 중 오류가 발생했습니다.";

              /**
               * OpenAI 호출 실패 등
               * 아직 답변이 저장되지 않은 예외만 저장한다.
               *
               * 실패 결과를 이미 저장한 뒤 발생한 예외는
               * assistantMessageSaved가 true이므로
               * 중복 저장하지 않는다.
               */
              if (
                !assistantMessageSaved
              ) {
                await db.saveAiChatMessage({
                  organizationId:
                    aiContext.organizationId,

                  userId:
                    aiContext.userId,

                  role:
                    "assistant",

                  kind:
                    "error",

                  content:
                    errorMessage ||
                    "AI 요청을 처리하는 중 오류가 발생했습니다.",

                  messageDataJson:
                    null,

                                    selectedStudentId:
                    activeStudentId,
                });

                assistantMessageSaved =
                  true;
              }

              throw error;
            }
          }
        ),

    runAction: protectedProcedure
      .input(
        z.object({
          action: z.enum([
            "create_transfer_subject",
            "create_plan_semester",
            "recommend_practice_place",
          ]),
          studentKeyword: z.string().min(1),
          subjectName: z.string().min(1).optional(),
          category: z.enum(["전공", "교양", "일반"]).optional(),
          semesterNo: z.number().optional(),
          selectedStudentId: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
  const organizationId =
    getCtxOrganizationId(ctx);

  const assigneeId =
    isAdminOrHost(ctx.user)
      ? undefined
      : Number(ctx.user.id) || 1;

  const students =
    await db.listStudents(
      assigneeId,
      {
        organizationId,
      }
    );
        const keyword = input.studentKeyword.trim();
        const keywordLower = keyword.toLowerCase();
        const keywordDigits = keyword.replace(/\D/g, "");

        let matchedStudents: any[] = [];

        if (input.selectedStudentId) {
          const selected = (students || []).find(
            (item: any) => Number(item.id) === Number(input.selectedStudentId)
          );

          if (!selected) {
            throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "선택한 학생을 찾을 수 없습니다.",
  404
);
          }

          matchedStudents = [selected];
        }

        if (!matchedStudents.length) {
          matchedStudents = (students || []).filter((item: any) => {
            return (
              String(item.clientName || "").toLowerCase().includes(keywordLower) ||
              String(item.phone || "").replace(/\D/g, "").includes(keywordDigits)
            );
          });
        }

        if (matchedStudents.length === 0) {
          throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "해당 학생을 찾을 수 없습니다.",
  404
);
        }

        if (matchedStudents.length > 1) {
          return {
            success: false,
            needsSelection: true,
            message: "동일하거나 유사한 학생이 여러 명입니다. 아래에서 선택해주세요.",
            candidates: matchedStudents.slice(0, 10).map((student: any) => ({
              id: student.id,
              clientName: student.clientName,
              phone: student.phone,
              course: student.course,
              status: student.status,
              institution: student.institution,
              finalEducation: student.finalEducation,
            })),
          };
        }

        const student = matchedStudents[0];

        if (input.action === "create_transfer_subject") {
          if (!input.subjectName?.trim()) {
            return {
              success: true,
              needsSelection: false,
              student: {
                id: student.id,
                name: student.clientName,
                phone: student.phone,
                course: student.course,
                finalEducation: student.finalEducation,
              },
              message: "전적대 입력 대상으로 학생을 찾았어요. 과목명과 구분을 확인한 뒤 실행할 수 있습니다.",
            };
          }

          if (!input.category) {
            throwAppError(
  ERROR_CODES.INVALID_INPUT,
  "전적대 과목 구분이 필요합니다.",
  400
);
          }

          const id =
  await db.createTransferSubject({
    organizationId,

    studentId:
      Number(student.id),

    schoolName:
      null,

    subjectName:
      input.subjectName.trim(),

    transferCategory:
      input.category,

    transferRequirementType:
      null,

    credits:
      3,

    sortOrder:
      0,

    attachmentName:
      null,

    attachmentUrl:
      null,
  } as any);

        if (db.createAiActionLog) {
  await db.createAiActionLog({
    organizationId,

    userId:
      Number(ctx.user.id),

    userName:
      ctx.user.name,

    action:
      "create_transfer_subject",

    targetStudentId:
      Number(student.id),

    targetStudentName:
      student.clientName,

    payload:
      input,
  });
}

          if (db.createAiLearningEntry) {
  await db.createAiLearningEntry({
    organizationId,

    userId:
      Number(ctx.user.id),

    userName:
      ctx.user.name,

    learningType:
      "transfer_subject_input",

    inputText:
      `${student.clientName} 전적대 ${input.subjectName} ${input.category}`,

    normalizedKey:
      `transfer_subject|${input.category}`,

    targetStudentId:
      Number(student.id),

    targetStudentName:
      student.clientName,

    payload:
      input,
  });
}

          return {
            success: true,
            needsSelection: false,
            action: input.action,
            student: {
              id: student.id,
              name: student.clientName,
              phone: student.phone,
              course: student.course,
              finalEducation: student.finalEducation,
            },
            createdId: id,
            message: `${student.clientName} 학생의 전적대 과목 "${input.subjectName}" 입력이 완료되었습니다.`,
          };
        }

        if (input.action === "create_plan_semester") {
          if (!input.subjectName?.trim()) {
            return {
              success: true,
              needsSelection: false,
              student: {
                id: student.id,
                name: student.clientName,
                phone: student.phone,
                course: student.course,
                finalEducation: student.finalEducation,
              },
              message: "플랜 입력 대상으로 학생을 찾았어요. 학기, 과목명, 구분을 확인한 뒤 실행할 수 있습니다.",
            };
          }

          if (!input.semesterNo) {
           throwAppError(
  ERROR_CODES.INVALID_INPUT,
  "학기 정보가 필요합니다.",
  400
);
          }

          if (!input.category) {
            throwAppError(
  ERROR_CODES.INVALID_INPUT,
  "플랜 과목 구분이 필요합니다.",
  400
);
          }

          const existing =
  await db.listPlanSemesters(
    Number(student.id),
    {
      organizationId,
    }
  );
          const semesterCount = (existing || []).filter(
            (x: any) => Number(x.semesterNo) === Number(input.semesterNo)
          ).length;

          if (semesterCount >= 8) {
            throwAppError(
  ERROR_CODES.INVALID_INPUT,
  "우리 플랜은 학기당 최대 8과목까지 등록할 수 있습니다.",
  400
);
          }

          const id =
  await db.createPlanSemester({
    organizationId,

    studentId:
      Number(student.id),

    semesterNo:
      Number(input.semesterNo),

    subjectName:
      input.subjectName.trim(),

    planCategory:
      input.category,

    planRequirementType:
      null,

    credits:
      3,

    sortOrder:
      0,
  } as any);

          if (db.createAiActionLog) {
  await db.createAiActionLog({
    organizationId,

    userId:
      Number(ctx.user.id),

    userName:
      ctx.user.name,

    action:
      "create_plan_semester",

    targetStudentId:
      Number(student.id),

    targetStudentName:
      student.clientName,

    payload:
      input,
  });
}

          if (db.createAiLearningEntry) {
  await db.createAiLearningEntry({
    organizationId,

    userId:
      Number(ctx.user.id),

    userName:
      ctx.user.name,

    learningType:
      "plan_semester_input",

    inputText:
      `${student.clientName} ${input.semesterNo}학기 ${input.subjectName} ${input.category}`,

    normalizedKey:
      `plan_semester|${input.semesterNo}|${input.category}`,

    targetStudentId:
      Number(student.id),

    targetStudentName:
      student.clientName,

    payload:
      input,
  });
}

          return {
            success: true,
            needsSelection: false,
            action: input.action,
            student: {
              id: student.id,
              name: student.clientName,
              phone: student.phone,
              course: student.course,
              finalEducation: student.finalEducation,
            },
            createdId: id,
            message: `${student.clientName} 학생의 ${input.semesterNo}학기 플랜 과목 "${input.subjectName}" 입력이 완료되었습니다.`,
          };
        }

        if (input.action === "recommend_practice_place") {
          if (!db.getPracticeRecommendationsForStudent) {
            throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "db.ts에 getPracticeRecommendationsForStudent 함수를 먼저 추가해야 합니다.",
  500
);
          }

          const recommendations =
  await db.getPracticeRecommendationsForStudent(
    Number(student.id),
    {
      organizationId,
    }
  );

         if (db.createAiActionLog) {
  await db.createAiActionLog({
    organizationId,

    userId:
      Number(ctx.user.id),

    userName:
      ctx.user.name,

    action:
      "recommend_practice_place",

    targetStudentId:
      Number(student.id),

    targetStudentName:
      student.clientName,

    payload:
      input,
  });
}

          const educationLines = (recommendations.educationCenters || [])
            .slice(0, 3)
            .map((item: any, idx: number) => `${idx + 1}. ${item.name} - ${item.distanceKm}km`);

          const institutionLines = (recommendations.institutions || [])
            .slice(0, 3)
            .map((item: any, idx: number) => `${idx + 1}. ${item.name} - ${item.distanceKm}km`);

          return {
            success: true,
            needsSelection: false,
            action: input.action,
            student: {
              id: student.id,
              name: student.clientName,
              phone: student.phone,
              course: student.course,
              finalEducation: student.finalEducation,
            },
            recommendations,
            message: [
              `${student.clientName} 학생 주소 기준으로 가장 가까운 실습 추천 결과를 정리했어요.`,
              "",
              "교육원 추천:",
              ...(educationLines.length ? educationLines : ["- 추천 가능한 교육원이 없습니다."]),
              "",
              "실습기관 추천:",
              ...(institutionLines.length ? institutionLines : ["- 추천 가능한 기관이 없습니다."]),
            ].join("\n"),
          };
        }

        throwAppError(
  ERROR_CODES.INVALID_REQUEST,
  "지원하지 않는 액션입니다.",
  400
);
      }),
  }),
  dashboard: router({
  monthApprovals: protectedProcedure.query(async ({ ctx }) => {
    const organizationId = getCtxOrganizationId(ctx);
    const isAdminHost = isAdminOrHost(ctx.user);
    const assigneeId = isAdminHost ? undefined : Number(ctx.user.id);

    const stats = await db.getDashboardStats(assigneeId, {
      organizationId,
    });

    const monthEntries = await db.getMonthSalesEntries(assigneeId, {
      organizationId,
    });

    const students = await db.listStudents(assigneeId, {
      organizationId,
    });

    const approved = (students || []).filter(
      (s: any) => s.approvalStatus === "승인"
    );
    const rejected = (students || []).filter(
      (s: any) => s.approvalStatus === "불승인"
    );
    const pending = (students || []).filter(
      (s: any) => s.approvalStatus === "대기"
    );

    const approvedTotal = approved.reduce(
      (sum: number, s: any) =>
        sum + Number(s.netPaidAmount || s.paidAmount || 0),
      0
    );

    const rejectedTotal = rejected.reduce(
      (sum: number, s: any) =>
        sum + Number(s.netPaidAmount || s.paidAmount || 0),
      0
    );

    const pendingTotal = pending.reduce(
      (sum: number, s: any) =>
        sum + Number(s.netPaidAmount || s.paidAmount || 0),
      0
    );

    return {
      approved,
      rejected,
      pending,
      approvedTotal,
      rejectedTotal,
      pendingTotal,
      monthRefund: stats?.monthRefund ?? 0,
      totalRefund: stats?.totalRefund ?? 0,
      entries: monthEntries?.entries ?? [],
    };
  }),

  stats: protectedProcedure.query(async ({ ctx }) => {
    const organizationId = getCtxOrganizationId(ctx);
    const isAdminHost = isAdminOrHost(ctx.user);
    const assigneeId = isAdminHost ? undefined : Number(ctx.user.id);

    return db.getDashboardStats(assigneeId, {
      organizationId,
    });
  }),

  totalStats: hostProcedure.query(async ({ ctx }) => {
    const organizationId = getCtxOrganizationId(ctx);

    return db.getDashboardStats(undefined, {
      organizationId,
    });
  }),

  monthSalesEntries: protectedProcedure.query(async ({ ctx }) => {
    const organizationId = getCtxOrganizationId(ctx);
    const isAdminHost = isAdminOrHost(ctx.user);
    const assigneeId = isAdminHost ? undefined : Number(ctx.user.id);

    return db.getMonthSalesEntries(assigneeId, {
      organizationId,
    });
  }),

  totalMonthSalesEntries: hostProcedure.query(async ({ ctx }) => {
   const organizationId = getCtxOrganizationId(ctx);

    return db.getMonthSalesEntries(undefined, {
      organizationId,
    });
  }),
}),
  consultation: router({
  list: protectedProcedure
    .input(
      z
        .object({
          showAll: z.boolean().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
  const organizationId = getCtxOrganizationId(ctx);

  if (!organizationId) {
    throwAppError(
  ERROR_CODES.ORGANIZATION_REQUIRED,
  "organizationId is required",
  400
);
  }

  const showAll = !!input?.showAll;
  const myId = Number(ctx.user.id) || 1;

  if (isHost(ctx.user) && showAll) {
  return db.listConsultations(undefined, {
    organizationId,
  });
}

if (isAdmin(ctx.user) && showAll) {
  const teamMemberIds =
    await db.getUserTeamMemberIds(myId, {
      organizationId,
    });

  return db.listConsultations(undefined, {
    organizationId,
    assigneeIds: teamMemberIds,
  });
}

return db.listConsultations(myId, {
  organizationId,
});
}), 

    create: protectedProcedure
      .input(
        z.object({
          consultDate: z.string(),
          channel: z.string(),
          clientName: z.string(),
          phone: z.string().max(30),
          finalEducation: z.string().optional(),
          desiredCourse: z.string().optional(),
          notes: z.string().optional(),
          status: z.string().default("상담중"),
        })
      )
      .mutation(async ({ ctx, input }) => {
  const organizationId = getCtxOrganizationId(ctx);

  if (!organizationId) {
    throwAppError(
  ERROR_CODES.ORGANIZATION_REQUIRED,
  "organizationId is required",
  400
);
  }

  const assigneeId = Number(ctx.user.id);
  const safeAssigneeId =
    Number.isFinite(assigneeId) && assigneeId > 0 ? assigneeId : 1;

  const id = await db.createConsultation({
    ...input,
    organizationId,
    consultDate: new Date(input.consultDate),
    finalEducation: input.finalEducation ?? "",
    assigneeId: safeAssigneeId,
  } as any);

  return { success: true, id };
}),

    bulkCreate: protectedProcedure
      .input(
        z.object({
mode: z.enum(["append", "replace"]).default("append"),
categoryId: z.number().nullable().optional(),
          rows: z.array(
            z.object({
              consultDate: z.string(),
              channel: z.string(),
              clientName: z.string(),
              phone: z.string(),
              finalEducation: z.string().optional(),
              desiredCourse: z.string().optional(),
              notes: z.string().optional(),
              status: z.string().default("상담중"),
            })
          ),
        })
      )
      .mutation(async ({ ctx, input }) => {

const MAX_BULK_CONSULTATIONS = 500;

if (input.rows.length > MAX_BULK_CONSULTATIONS) {
  throwAppError(
  ERROR_CODES.INVALID_REQUEST,
  `상담DB 일괄등록은 서버 안정성을 위해 1회 최대 ${MAX_BULK_CONSULTATIONS}건까지만 가능합니다. 현재 ${input.rows.length}건입니다.`,
  400
);
}

        const assigneeId = Number(ctx.user.id);
        const safeAssigneeId =
          Number.isFinite(assigneeId) && assigneeId > 0 ? assigneeId : 1;

        const dataList = input.rows.map((row) => ({
          ...row,
          consultDate: new Date(row.consultDate),
          finalEducation: row.finalEducation ?? "",
          assigneeId: safeAssigneeId,
        }));

        await db.bulkCreateConsultations(dataList as any);

        return {
          success: true,
          count: dataList.length,
        };
      }),

    importCsv: protectedProcedure
      .input(
        z.object({
          csvText: z.string(),
          hasHeader: z.boolean().default(true),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const assigneeId = Number(ctx.user.id);
        const safeAssigneeId =
          Number.isFinite(assigneeId) && assigneeId > 0 ? assigneeId : 1;

        const lines = input.csvText.trim().split("\n").filter((l) => l.trim());
        const startIdx = input.hasHeader ? 1 : 0;
        const rows: any[] = [];

        for (let i = startIdx; i < lines.length; i++) {
          const cols = lines[i].includes("\t")
            ? lines[i].split("\t")
            : lines[i].split(",");

          const consultDateStr =
            cols[0]?.trim() || new Date().toISOString().slice(0, 10);

          const channel = cols[1]?.trim() || "";
          const clientName = cols[2]?.trim() || "";
          const phone = (cols[3]?.trim() || "").replace(/\D/g, "").slice(0, 11);
          const finalEducation = cols[4]?.trim() || "";
          const desiredCourse = cols[5]?.trim() || "";
          const notes = cols[6]?.trim() || "";
          const status = cols[7]?.trim() || "상담중";

          if (!clientName || !phone) continue;

          rows.push({
            consultDate: new Date(consultDateStr),
            channel,
            clientName,
            phone,
            finalEducation,
            desiredCourse,
            notes,
            status,
            assigneeId: safeAssigneeId,
          });
        }

       if (rows.length === 0) {
  throwAppError(
  ERROR_CODES.INVALID_INPUT,
  "유효한 데이터가 없습니다.",
  400
);
}

const MAX_BULK_CONSULTATIONS = 500;

if (rows.length > MAX_BULK_CONSULTATIONS) {
  throwAppError(
  ERROR_CODES.INVALID_REQUEST,
  `CSV 임포트는 서버 안정성을 위해 1회 최대 ${MAX_BULK_CONSULTATIONS}건까지만 가능합니다. 현재 유효 데이터는 ${rows.length}건입니다.`,
  400
);
}

await db.bulkCreateConsultations(rows as any);

        return {
          success: true,
          count: rows.length,
        };
      }),

    update: protectedProcedure
  .input(
    z.object({
      id: z.number(),
      consultDate: z.string().optional(),
      channel: z.string().optional(),
      clientName: z.string().optional(),
      phone: z.string().optional(),
      finalEducation: z.string().optional(),
      desiredCourse: z.string().optional(),
      notes: z.string().optional(),
      status: z.string().optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const organizationId = getCtxOrganizationId(ctx);

    if (!organizationId) {
      throwAppError(
  ERROR_CODES.ORGANIZATION_REQUIRED,
  "organizationId is required",
  400
);
    }

    const item = await db.getConsultation(input.id, {
      organizationId,
    });

    if (!item) {
      throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "상담 기록을 찾을 수 없습니다.",
  404
);
    }

    const myId = Number(ctx.user.id) || 1;

    if (!isHost(ctx.user) && Number(item.assigneeId) !== myId) {
      throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "권한이 없습니다.",
  403
);
    }

    const { id, ...rest } = input;
    const data: any = { ...rest };

    if (!isHost(ctx.user)) {
      const allowedForStaff: any = {};

      if (rest.notes !== undefined) {
        allowedForStaff.notes = rest.notes;
      }

      if (rest.status !== undefined) {
        allowedForStaff.status = rest.status;
      }

if (rest.finalEducation !== undefined) {
  const currentValue = String(
    item.finalEducation || ""
  ).trim();

  const nextValue = String(
    rest.finalEducation || ""
  ).trim();

  if (currentValue && currentValue !== nextValue) {
    throwAppError(
      ERROR_CODES.PERMISSION_DENIED,
      "최종학력은 최초 입력 후 수정할 수 없습니다.",
      403
    );
  }

  if (!currentValue && nextValue) {
    allowedForStaff.finalEducation = nextValue;
  }
}

if (rest.desiredCourse !== undefined) {
  const currentValue = String(
    item.desiredCourse || ""
  ).trim();

  const nextValue = String(
    rest.desiredCourse || ""
  ).trim();

  if (currentValue && currentValue !== nextValue) {
    throwAppError(
      ERROR_CODES.PERMISSION_DENIED,
      "희망과정은 최초 입력 후 수정할 수 없습니다.",
      403
    );
  }

  if (!currentValue && nextValue) {
    allowedForStaff.desiredCourse = nextValue;
  }
}

      await db.updateConsultation(id, allowedForStaff, {
  organizationId,
});

      if (rest.status === "등록예정") {
        const linkedStudent = await db.getStudentByConsultationId(id, {
  organizationId,
});

        if (!linkedStudent) {
          const latestConsultation = await db.getConsultation(id, {
  organizationId,
});

          if (latestConsultation) {
            await db.createStudent({
  organizationId,
  clientName: latestConsultation.clientName,
              phone: latestConsultation.phone,
              course: latestConsultation.desiredCourse || "",
              finalEducation: latestConsultation.finalEducation || "",
              assigneeId: latestConsultation.assigneeId,
              consultationId: id,
            } as any);
          }
        }

        await db.syncStudentFromConsultation(id, {
  organizationId,
});
      }

      return { success: true };
    }

    if (rest.consultDate) {
      data.consultDate = new Date(rest.consultDate);
    }

    await db.updateConsultation(id, data, {
  organizationId,
});

    if (rest.status === "등록예정") {
     const linkedStudent = await db.getStudentByConsultationId(id, {
  organizationId,
});

      if (!linkedStudent) {
        const latestConsultation = await db.getConsultation(id, {
  organizationId,
});

        if (latestConsultation) {
          await db.createStudent({
  organizationId,
  clientName: latestConsultation.clientName,
            phone: latestConsultation.phone,
            course: latestConsultation.desiredCourse || "",
            finalEducation: latestConsultation.finalEducation || "",
            assigneeId: latestConsultation.assigneeId,
            consultationId: id,
          } as any);
        }
      }
    }

    await db.syncStudentFromConsultation(id, {
  organizationId,
});

    return { success: true };
  }),

    reassign: hostProcedure
      .input(
        z.object({
          id: z.number(),
          assigneeId: z.number(),
        })
      )
      .mutation(async ({ ctx, input }) => {
  const organizationId = getCtxOrganizationId(ctx);

  await db.reassignConsultationAndLinkedStudent(
    input.id,
    input.assigneeId,
    { organizationId }
  );

  return { success: true };
}),

    bulkReassign: hostProcedure
      .input(
        z.object({
          fromAssigneeId: z.number(),
          toAssigneeId: z.number(),
        })
      )
     .mutation(async ({ ctx, input }) => {
  const organizationId = getCtxOrganizationId(ctx);

  await db.bulkReassignConsultationsAndLinkedStudents(
    input.fromAssigneeId,
    input.toAssigneeId,
    { organizationId }
  );

  return { success: true };
}),

  delete: hostProcedure
  .input(z.object({ id: z.number() }))
  .mutation(async ({ ctx, input }) => {
    const organizationId = getCtxOrganizationId(ctx);

    const item = await db.getConsultation(input.id, {
      organizationId,
    });

    if (!item) {
      throwAppError(
        ERROR_CODES.DATA_NOT_FOUND,
        "상담 기록을 찾을 수 없습니다.",
        404
      );
    }

    await db.deleteConsultation(input.id, {
      organizationId,
      deletedBy: Number(ctx.user.id),
    });

    await db.createAuditLog({
      organizationId,
      actorUserId: Number(ctx.user.id),
      actorRole: String((ctx.user as any)?.role || ""),
      action: "consultation.soft_delete",
      targetType: "consultation",
      targetId: input.id,
      memo: "상담DB 삭제 처리",
    } as any);

    return { success: true };
  }),

listDeleted: hostProcedure
  .input(
    z
      .object({
        limit: z.number().optional(),
      })
      .optional()
  )
  .query(async ({ ctx, input }) => {
    return db.listDeletedConsultations({
      organizationId: getCtxOrganizationId(ctx),
      limit: input?.limit ?? 100,
    });
  }),

restore: hostProcedure
  .input(z.object({ id: z.number() }))
  .mutation(async ({ ctx, input }) => {
    const organizationId = getCtxOrganizationId(ctx);

    await db.restoreConsultation({
      id: input.id,
      organizationId,
    });

    await db.createAuditLog({
      organizationId,
      actorUserId: Number(ctx.user.id),
      actorRole: String((ctx.user as any)?.role || ""),
      action: "consultation.restore",
      targetType: "consultation",
      targetId: input.id,
      memo: "삭제된 상담DB 복구 처리",
    } as any);

    return { success: true };
  }),

  }),

 student: router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const organizationId = getCtxOrganizationId(ctx);
    const currentUserId = Number(ctx.user.id) || 0;

    if (!currentUserId) {
      throwAppError(
        ERROR_CODES.AUTH_REQUIRED,
        "사용자 정보를 확인할 수 없습니다.",
        401
      );
    }

    // HOST는 회사 전체 학생 조회
    if (isHost(ctx.user)) {
      return db.listStudents(undefined, {
        organizationId,
      });
    }

    // ADMIN은 같은 팀 담당 학생 조회
    if (isAdmin(ctx.user)) {
      const teamMemberIds =
        await db.getUserTeamMemberIds(
          currentUserId,
          {
            organizationId,
          }
        );

      return db.listStudents(teamMemberIds, {
        organizationId,
      });
    }

    // STAFF는 본인 담당 학생만 조회
    return db.listStudents(currentUserId, {
      organizationId,
    });
  }),

    get: protectedProcedure
  .input(
    z.object({
      id: z.number(),
    })
  )
  .query(async ({ ctx, input }) => {
    return db.getStudent(input.id, {
      organizationId:
        getCtxOrganizationId(ctx),
    });
  }),

    paymentSummary: protectedProcedure
      .input(z.object({ studentId: z.number() }))
      .query(async ({ input }) => {
        return db.getStudentPaymentSummary(input.studentId);
      }),

    create: protectedProcedure
      .input(
        z.object({
          clientName: z.string(),
          phone: z.string(),
          course: z.string(),
          startDate: z.string().optional(),
          paymentAmount: z.string().optional(),
          subjectCount: z.number().optional(),
          paymentDate: z.string().optional(),
          institution: z.string().optional(),
          totalSemesters: z.number().optional(),
          consultationId: z.number().optional(),
          address: z.string().optional(),
          detailAddress: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const data: any = {
  organizationId: getCtxOrganizationId(ctx),
  ...input,
  assigneeId: Number(ctx.user.id) || 1,
};

        if (input.startDate) data.startDate = new Date(input.startDate);
        if (input.paymentDate) data.paymentDate = new Date(input.paymentDate);

        const id = await db.createStudent(data);
        return { id };
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          clientName: z.string().optional(),
          phone: z.string().optional(),
          course: z.string().optional(),
          status: z.enum(["등록", "종료", "등록 종료"]).optional(),
          startDate: z.string().optional(),
          paymentAmount: z.string().optional(),
          subjectCount: z.number().optional(),
          paymentDate: z.string().optional(),
          institution: z.string().optional(),
          institutionId: z.number().optional(),
totalSemesters: z.number().optional(),
studentLoginId: z.string().max(100).optional().nullable(),
address: z.string().optional(),
          detailAddress: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const item = await db.getStudent(input.id, {
  organizationId: getCtxOrganizationId(ctx),
});
        if (!item) throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "학생 기록을 찾을 수 없습니다.",
  404
);

        const myId = Number(ctx.user.id) || 1;
        if (!isAdminOrHost(ctx.user) && item.assigneeId !== myId) {
          throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "권한이 없습니다.",
  403
);
        }

        const { id, ...rest } = input;
        const data: any = { ...rest };

        if (rest.startDate) data.startDate = new Date(rest.startDate);
        if (rest.paymentDate) data.paymentDate = new Date(rest.paymentDate);
if (rest.studentLoginId !== undefined) {
  data.studentLoginId =
    String(rest.studentLoginId || "").trim() || null;
}

        await db.updateStudent(id, data, {
  organizationId: getCtxOrganizationId(ctx),
});
        return { success: true };
      }),

    updateAddressAndCoords: protectedProcedure
      .input(
        z.object({
          studentId: z.number(),
          address: z.string().optional().nullable(),
          detailAddress: z.string().optional().nullable(),
          latitude: z.number().optional().nullable(),
          longitude: z.number().optional().nullable(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const item = await db.getStudent(input.studentId, {
  organizationId: getCtxOrganizationId(ctx),
});
        if (!item) throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "학생 기록을 찾을 수 없습니다.",
  404
);

        const myId = Number(ctx.user.id) || 1;
        if (!isAdminOrHost(ctx.user) && item.assigneeId !== myId) {
          throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "권한이 없습니다.",
  403
);
        }

        await db.updateStudentAddressAndCoords({
  ...input,
  organizationId: getCtxOrganizationId(ctx),
});
        return { success: true };
      }),

    delete: protectedProcedure
  .input(z.object({ id: z.number() }))
  .mutation(async () => {
    throwAppError(
  ERROR_CODES.INVALID_REQUEST,
  "학생 삭제는 상담 DB 페이지에서만 가능합니다.",
  400
);
  }),

    registrationSummary: protectedProcedure
      .input(z.object({ studentId: z.number() }))
      .query(async ({ ctx, input }) => {
        const student = await db.getStudent(input.studentId, {
  organizationId: getCtxOrganizationId(ctx),
});
        if (!student) return null;

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          return null;
        }

        return db.getStudentRegistrationSummary(input.studentId, {
  organizationId: getCtxOrganizationId(ctx),
});
      }),
}),

  plan: router({
    get: protectedProcedure
  .input(z.object({ studentId: z.number() }))
  .query(async ({ ctx, input }) => {
    const organizationId = getCtxOrganizationId(ctx);

    const student = await db.getStudent(input.studentId, {
      organizationId,
    });
    if (!student) {
      return null;
    }

    if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
      return null;
    }

    const plan = await db.getPlan(input.studentId, {
      organizationId,
    });
    return plan ?? null;
  }),

    upsert: protectedProcedure
     .input(
  z.object({
    studentId: z.number(),
    desiredCourse: z.string().optional(),
    finalEducation: z.string().optional(),
    totalTheorySubjects: z.number().min(0).optional(),

    requiredMajorCount: z.number().min(0).optional(),
    electiveMajorCount: z.number().min(0).optional(),
    liberalCount: z.number().min(0).optional(),
    generalCount: z.number().min(0).optional(),

    hasPractice: z.boolean().optional(),
    practiceHours: z.number().optional(),
    practiceDate: z.string().optional(),
    practiceArranged: z.boolean().optional(),
    practiceStatus: z.enum(["미섭외", "섭외중", "섭외완료"]).optional(),
    specialNotes: z.string().optional(),
  }).superRefine((val, ctx) => {
    if (!FEATURE_FLAGS.PLAN_REQUIREMENT_ENFORCE) return;
    const totalTheorySubjects = Number(val.totalTheorySubjects ?? 0);
    const requiredMajorCount = Number(val.requiredMajorCount ?? 0);
    const electiveMajorCount = Number(val.electiveMajorCount ?? 0);
    const liberalCount = Number(val.liberalCount ?? 0);
    const generalCount = Number(val.generalCount ?? 0);

    const sum =
      requiredMajorCount +
      electiveMajorCount +
      liberalCount +
      generalCount;

    if (sum !== totalTheorySubjects) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["totalTheorySubjects"],
        message:
          `총 이론 과목 수(${totalTheorySubjects})와 분류 합계(${sum})가 일치하지 않습니다.`,
      });
    }
  })
)
      .mutation(async ({ ctx, input }) => {
  const organizationId = getCtxOrganizationId(ctx);

  const student = await db.getStudent(input.studentId, {
    organizationId,
  });

  if (!student) throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "학생을 찾을 수 없습니다.",
  404
);

  if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
    throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "권한이 없습니다.",
  403
);
  }

  const id = await db.upsertPlan({
    ...input,
    organizationId,
  } as any);

  return { id, success: true };
}),
  }),

  semester: router({
    list: protectedProcedure
      .input(z.object({ studentId: z.number() }))
      .query(async ({ ctx, input }) => {
        const organizationId = getCtxOrganizationId(ctx);

const student = await db.getStudent(input.studentId, {
  organizationId,
});
        if (!student) return [];

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          return [];
        }

        return db.listSemesters(input.studentId, {
  organizationId,
});
      }),

   listAll: protectedProcedure
  .input(
    z.object({
      plannedMonth: z
        .string()
        .optional(),
    })
  )
  .query(async ({ ctx, input }) => {
    const organizationId =
      getCtxOrganizationId(ctx);

    const currentUserId =
      Number(ctx.user.id) || 0;

    if (!currentUserId) {
      throwAppError(
        ERROR_CODES.AUTH_REQUIRED,
        "사용자 정보를 확인할 수 없습니다.",
        401
      );
    }

    // HOST는 회사 전체 학기별 예정표 조회
    if (isHost(ctx.user)) {
      return db.listAllSemesters(
        undefined,
        input.plannedMonth,
        {
          organizationId,
        }
      );
    }

    // ADMIN은 같은 팀 담당자의
    // 학기별 예정표 조회
    if (isAdmin(ctx.user)) {
      const teamMemberIds =
        await db.getUserTeamMemberIds(
          currentUserId,
          {
            organizationId,
          }
        );

      return db.listAllSemesters(
        teamMemberIds,
        input.plannedMonth,
        {
          organizationId,
        }
      );
    }

    // STAFF는 본인 담당 예정표만 조회
    return db.listAllSemesters(
      currentUserId,
      input.plannedMonth,
      {
        organizationId,
      }
    );
  }),

    create: protectedProcedure
      .input(
        z.object({
  studentId: z.number(),
  semesterOrder: z.number(),
semesterLabel: z.string().optional().nullable(),
  plannedMonth: z.string().optional(),
  plannedInstitution: z.string().optional(),
  plannedInstitutionId: z.number().optional(),
  plannedSubjectCount: z.number().optional(),
  plannedAmount: z.string().optional(),
  practiceStatus: z.enum(["미섭외", "섭외중", "섭외완료"]).optional(),
  primaryCourse: z.string().optional(),
  registeredCourses: z.array(z.string()).optional(),
})
      )
      .mutation(async ({ ctx, input }) => {
  const organizationId = getCtxOrganizationId(ctx);

  const student = await db.getStudent(input.studentId, {
    organizationId,
  });

  if (!student) throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "학생을 찾을 수 없습니다.",
  404
);

  if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
    throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "권한이 없습니다.",
  403
);
  }

  const id = await db.createSemester({
    ...input,
    organizationId,
    status: "등록",
    practiceStatus: input.practiceStatus ?? "미섭외",
    primaryCourse: input.primaryCourse || undefined,
    registeredCoursesJson:
      input.registeredCourses !== undefined
        ? JSON.stringify(
            input.registeredCourses
              .map((x) => String(x || "").trim())
              .filter(Boolean)
          )
        : undefined,
  } as any);

  if (input.plannedSubjectCount !== undefined && input.plannedSubjectCount > 0) {
    await db.syncPlanSemestersByCount(
  input.studentId,
  input.semesterOrder,
  input.plannedSubjectCount,
  {
    organizationId: getCtxOrganizationId(ctx),
  }
);
  }

  return { id, success: true };
}),

    update: protectedProcedure
  .input(
    z.object({
      id: z.number(),
semesterLabel: z.string().optional().nullable(),
      plannedMonth: z.string().optional(),
      plannedInstitution: z.string().optional(),
      plannedSubjectCount: z.number().optional(),
      plannedAmount: z.string().optional(),
      plannedInstitutionId: z.number().optional(),
      actualInstitutionId: z.number().optional(),
      actualStartDate: z.string().optional(),
      actualInstitution: z.string().optional(),
      actualSubjectCount:
  z.number().optional(),
      actualAmount: z.string().optional(),
      actualPaymentDate: z.string().optional(),
      isCompleted: z.boolean().optional(),
      approvalStatus: z.enum(["요청전", "대기", "승인", "불승인"]).optional(),
      status: z.enum(["등록", "종료", "등록 종료"]).optional(),
      practiceStatus: z.enum(["미섭외", "섭외중", "섭외완료"]).optional(),
      practiceSupportRequestId: z.number().optional(),
      primaryCourse: z.string().optional(),
      registeredCourses: z.array(z.string()).optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const organizationId = getCtxOrganizationId(ctx);

    const sem = await db.getSemester(input.id, { organizationId });
    if (!sem) throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "학기를 찾을 수 없습니다.",
  404
);

    const student = await db.getStudent(Number(sem.studentId), {
      organizationId,
    });

    if (!student) throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "학생을 찾을 수 없습니다.",
  404
);

   assertStudentEditable({
  currentUser: ctx.user,
  student,
});

/**
 * 승인 완료된 학기의 입력완료 해제 보호
 *
 * 승인된 상태에서 isCompleted를 false로 변경하는 것은
 * 호스트만 가능하다.
 *
 * Admin, Staff, Superhost 및 API 직접 호출도 차단한다.
 */
if (
  sem.approvalStatus === "승인" &&
  sem.isCompleted === true &&
  input.isCompleted === false &&
  ctx.user?.role !== "host"
) {
  throwAppError(
    ERROR_CODES.PERMISSION_DENIED,
    "승인 완료된 학기의 입력완료 체크는 호스트만 해제할 수 있습니다.",
    403
  );
}

const allSemsForStatusCheck = await db.listSemesters(sem.studentId, {
  organizationId,
});

    const sortedSemsForStatusCheck = [...allSemsForStatusCheck].sort(
      (a: any, b: any) => Number(a.semesterOrder) - Number(b.semesterOrder)
    );

    const lastSem =
      sortedSemsForStatusCheck[sortedSemsForStatusCheck.length - 1];

    if (input.status === "등록 종료") {
      if (!lastSem || Number(lastSem.id) !== Number(sem.id)) {
        throwAppError(
  ERROR_CODES.INVALID_REQUEST,
  "마지막 학기에서만 등록 종료할 수 있습니다.",
  400
);
      }
    }

    const { id, registeredCourses, ...rest } = input;
    const data: any = { ...rest };

    if (rest.actualStartDate) {
      data.actualStartDate = new Date(rest.actualStartDate);
    }

    if (rest.actualPaymentDate) {
      data.actualPaymentDate = new Date(rest.actualPaymentDate);
    }

    if (input.primaryCourse !== undefined) {
      data.primaryCourse = input.primaryCourse?.trim() || null;
    }

    if (registeredCourses !== undefined) {
      const cleanedCourses = registeredCourses
        .map((x) => String(x || "").trim())
        .filter(Boolean);

      data.registeredCoursesJson = JSON.stringify(cleanedCourses);

      if (input.primaryCourse === undefined) {
        data.primaryCourse = cleanedCourses[0] || null;
      }
    }

    const beforeSemester = sem;

    await db.updateSemester(id, data, {
      organizationId,
    });

    const afterSemester = await db.getSemester(id, {
      organizationId,
    });

    const semesterAction =
      beforeSemester?.isCompleted !== afterSemester?.isCompleted
        ? afterSemester?.isCompleted
          ? "complete"
          : "uncomplete"
        : "update";

    await writeStudentAuditLog({
      ctx,
      studentId: Number(beforeSemester.studentId),
      entityType: "semester",
      entityId: Number(id),
      action: semesterAction as any,
      title:
        semesterAction === "complete"
          ? `${beforeSemester.semesterOrder}학기 입력완료 체크`
          : semesterAction === "uncomplete"
            ? `${beforeSemester.semesterOrder}학기 입력완료 해제`
            : `${beforeSemester.semesterOrder}학기 학기별 예정표/결제표 수정`,
      beforeJson: beforeSemester,
      afterJson: afterSemester,
    });

    const shouldSyncSubjectSettlement =
      input.actualInstitutionId !== undefined ||
      input.actualSubjectCount !== undefined ||
      input.actualAmount !== undefined ||
      input.actualPaymentDate !== undefined ||
      input.actualStartDate !== undefined;

    if (shouldSyncSubjectSettlement) {
      await db.syncSubjectSettlementItemBySemesterId(
        id,
        Number(ctx.user.id),
        { organizationId }
      );
    }

    if (input.plannedSubjectCount !== undefined) {
      await db.syncPlanSemestersByCount(
        Number(sem.studentId),
        Number(sem.semesterOrder),
        input.plannedSubjectCount,
        { organizationId }
      );
    }

    if (input.status !== undefined) {
      const refreshedSems = await db.listSemesters(sem.studentId, {
        organizationId,
      });

      const sortedRefreshedSems = [...refreshedSems].sort(
        (a: any, b: any) => Number(a.semesterOrder) - Number(b.semesterOrder)
      );

      const refreshedLastSem =
        sortedRefreshedSems[sortedRefreshedSems.length - 1];

      const studentStatus =
        refreshedLastSem?.status === "등록 종료" ? "등록 종료" : "등록";

      await db.updateStudent(
        sem.studentId,
        { status: studentStatus },
        { organizationId }
      );
    }

    const allSems = await db.listSemesters(sem.studentId, {
      organizationId,
    });

    const firstActual = allSems
      .filter(
        (s: any) =>
          s.actualStartDate ||
          s.actualInstitutionId ||
          s.actualAmount ||
          s.actualPaymentDate
      )
      .sort(
        (a: any, b: any) =>
          Number(a.semesterOrder) - Number(b.semesterOrder)
      )[0];

    if (firstActual) {
      let institutionName: string | undefined = undefined;

      if (firstActual.actualInstitutionId) {
        const institutions = await db.listEducationInstitutions({
          organizationId,
        });

        const found = institutions.find(
          (x: any) => Number(x.id) === Number(firstActual.actualInstitutionId)
        );

        institutionName = found?.name;
      }

      const refreshedSems = await db.listSemesters(sem.studentId, {
        organizationId,
      });

      const sortedRefreshedSems = [...refreshedSems].sort(
        (a: any, b: any) => Number(a.semesterOrder) - Number(b.semesterOrder)
      );

      const refreshedLastSem =
        sortedRefreshedSems[sortedRefreshedSems.length - 1];

      const studentStatus =
        refreshedLastSem?.status === "등록 종료" ? "등록 종료" : "등록";

      await db.updateStudent(
        sem.studentId,
        {
          startDate: firstActual.actualStartDate || undefined,
          institutionId: firstActual.actualInstitutionId || undefined,
          institution: institutionName || undefined,
          subjectCount: firstActual.actualSubjectCount || undefined,
          paymentAmount: firstActual.actualAmount || undefined,
          paymentDate: firstActual.actualPaymentDate || undefined,
          status: studentStatus,
        },
        { organizationId }
      );
    }

    if (input.isCompleted) {
      await db.checkAndAutoComplete(sem.studentId, {
        organizationId,
      });
    }

    return { success: true };
  }),

    copyPlannedToActual: protectedProcedure
  .input(z.object({ id: z.number() }))
  .mutation(async ({ ctx, input }) => {
    const organizationId = getCtxOrganizationId(ctx);

    const sem = await db.getSemester(input.id, {
      organizationId,
    });

    if (!sem) throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "학기를 찾을 수 없습니다.",
  404
);

    const student = await db.getStudent(Number(sem.studentId), {
      organizationId,
    });

    if (!student) throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "학생을 찾을 수 없습니다.",
  404
);

    assertStudentEditable({
      currentUser: ctx.user,
      student,
    });

    const raw = String(sem.plannedMonth || "").replace(/[^0-9]/g, "");

    const actualStartDate =
      raw.length === 6
        ? new Date(`${raw.slice(0, 4)}-${raw.slice(4, 6)}-01`)
        : undefined;

    const beforeSemester = sem;

    await db.updateSemester(
      input.id,
      {
        actualStartDate,
        actualInstitutionId: sem.plannedInstitutionId,
        actualInstitution: sem.plannedInstitution,
        actualSubjectCount: sem.plannedSubjectCount,
        actualAmount: sem.plannedAmount,
      },
      { organizationId }
    );

    const afterSemester = await db.getSemester(input.id, {
      organizationId,
    });

    await writeStudentAuditLog({
      ctx,
      studentId: Number(sem.studentId),
      entityType: "semester",
      entityId: Number(input.id),
      action: "update",
      title: `${sem.semesterOrder}학기 예정 정보를 실제 결제 정보로 복사`,
      beforeJson: beforeSemester,
      afterJson: afterSemester,
    });

    return { success: true };
  }),

approve: protectedProcedure
  .input(
    z.object({
  id: z.number(),
  approvalStatus: z.enum(["승인", "불승인"]),
  rejectionReason: z.string().optional().nullable(),
})
  )
  .mutation(async ({ ctx, input }) => {
    if (!isAdminOrHost(ctx.user)) {
      throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "관리자 또는 호스트만 처리할 수 있습니다.",
  403
);
    }

    const organizationId = getCtxOrganizationId(ctx);

    if (!organizationId) {
      throwAppError(
  ERROR_CODES.ORGANIZATION_REQUIRED,
  "organizationId is required",
  400
);
    }

    const now = new Date();

const rejectionReason = String(input.rejectionReason || "").trim();

if (input.approvalStatus === "불승인" && !rejectionReason) {
  throwAppError(
    ERROR_CODES.INVALID_REQUEST,
    "불승인 사유는 필수입니다.",
    400
  );
}

    const beforeSemester = await db.getSemester(Number(input.id), {
      organizationId,
    });

    if (!beforeSemester) {
      throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "학기 정보를 찾을 수 없습니다.",
  404
);
    }

// ADMIN은 같은 팀 학생의 학기만 처리 가능
if (isAdmin(ctx.user)) {
  const student =
    await db.getStudent(
      Number(beforeSemester.studentId),
      {
        organizationId,
      }
    );

  if (!student) {
    throwAppError(
      ERROR_CODES.DATA_NOT_FOUND,
      "학생 정보를 찾을 수 없습니다.",
      404
    );
  }

  const teamMemberIds =
    await db.getUserTeamMemberIds(
      Number(ctx.user.id),
      {
        organizationId,
      }
    );

  if (
    !teamMemberIds.includes(
      Number(student.assigneeId)
    )
  ) {
    throwAppError(
      ERROR_CODES.PERMISSION_DENIED,
      "같은 팀 학생의 학기만 승인 처리할 수 있습니다.",
      403
    );
  }
}

    await db.updateSemester(
  Number(input.id),
  {
    approvalStatus: input.approvalStatus,

    approvedAt:
      input.approvalStatus === "승인"
        ? now
        : null,

    rejectedAt:
      input.approvalStatus === "불승인"
        ? now
        : null,

rejectionReason:
  input.approvalStatus === "불승인"
    ? rejectionReason
    : null,

    isLocked:
      input.approvalStatus === "승인",

    // 불승인 시 입력완료 체크 자동 해제
    isCompleted:
      input.approvalStatus === "불승인"
        ? false
        : true,
  } as any,
  {
    organizationId,
  }
);

    const sem = await db.getSemester(Number(input.id), {
      organizationId,
    });

    if (!sem) {
      throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "학기 정보를 찾을 수 없습니다.",
  404
);
    }

    await db.syncSubjectSettlementItemBySemesterId(
      Number(input.id),
      Number(ctx.user.id),
      {
        organizationId,
      }
    );

    const student = await db.getStudent(Number(sem.studentId), {
      organizationId,
    });

    if (!student) {
      throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "학생 정보를 찾을 수 없습니다.",
  404
);
    }

    const allSems = await db.listSemesters(Number(student.id), {
      organizationId,
    });

    const hasApprovedSemester = (allSems || []).some(
      (row: any) => row.approvalStatus === "승인"
    );

    const beforeStudent = student;

    if (hasApprovedSemester) {
      await db.updateStudent(
        Number(student.id),
        {
          status: "등록",
          approvalStatus: "승인",
          approvedAt: now,
          rejectedAt: null,
        } as any,
        {
          organizationId,
        }
      );

      if (student.consultationId) {
        await db.updateConsultation(
          Number(student.consultationId),
          {
            status: "등록",
          } as any,
          {
            organizationId,
          }
        );
      }
    } else {
      await db.updateStudent(
        Number(student.id),
        {
          // students.status enum에는 등록예정이 없음
          // 등록예정 여부는 approvalStatus로 구분
          status: "등록",
          approvalStatus:
            input.approvalStatus === "불승인" ? "불승인" : "대기",
          approvedAt: null,
          rejectedAt: input.approvalStatus === "불승인" ? now : null,
        } as any,
        {
          organizationId,
        }
      );

      if (student.consultationId) {
        await db.updateConsultation(
          Number(student.consultationId),
          {
            status: "등록예정",
          } as any,
          {
            organizationId,
          }
        );
      }
    }

    const afterStudent = await db.getStudent(Number(student.id), {
      organizationId,
    });

    await writeStudentAuditLog({
      ctx,
      studentId: Number(student.id),
      entityType: "semester",
      entityId: Number(input.id),
      action: input.approvalStatus === "승인" ? "complete" : "update",
      title:
        input.approvalStatus === "승인"
          ? `${sem.semesterOrder}학기 승인 처리`
          : `${sem.semesterOrder}학기 불승인 처리`,
      beforeJson: {
        semester: beforeSemester,
        student: beforeStudent,
      },
      afterJson: {
        semester: sem,
        student: afterStudent,
      },
    });

    if (student.assigneeId) {
      const notificationTitle =
        input.approvalStatus === "승인" ? "학기 승인 완료" : "학기 불승인";

      const notificationLevel =
        input.approvalStatus === "승인" ? "success" : "danger";

      const notificationMessage =
        input.approvalStatus === "승인"
          ? `[학기 승인] ${student.clientName || "학생"} 학생의 ${sem.semesterOrder}학기 승인이 완료되었습니다.`
          : `[학기 불승인] ${student.clientName || "학생"} 학생의 ${sem.semesterOrder}학기가 불승인 처리되었습니다.`;

    const semesterNotificationMetadata = {
  approvalStatus: input.approvalStatus,
  studentId: Number(student.id),
  semesterId: Number(input.id),
  semesterOrder: Number(sem.semesterOrder || 0),
  rejectionReason:
    input.approvalStatus === "불승인" ? rejectionReason : null,
};

const semesterNotificationMessage =
  input.approvalStatus === "승인"
    ? notificationMessage
    : `${notificationMessage}\n\n불승인 사유:\n${rejectionReason}`;

const notificationId = await db.createNotification({
  organizationId,
  userId: Number(student.assigneeId),
  type: "semester_approval",
  title: notificationTitle,
  level: notificationLevel,
  message: semesterNotificationMessage,
  relatedId: Number(student.id),
  targetType: "semester",
  targetId: Number(input.id),
  linkUrl: `/students/${student.id}`,
  metadataJson: JSON.stringify(semesterNotificationMetadata),
  isRead: false,
} as any);

emitLiveNotification({
  organizationId,
  id: Number(notificationId),
  userId: Number(student.assigneeId),
  type: "semester_approval",
  title: notificationTitle,
  level: notificationLevel,
  message: semesterNotificationMessage,
  relatedId: Number(student.id),
  targetType: "semester",
  targetId: Number(input.id),
  linkUrl: `/students/${student.id}`,
  metadataJson: JSON.stringify(semesterNotificationMetadata),
  isRead: false,
});
    }

    return { success: true };
  }),

    delete: protectedProcedure
     .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
  const organizationId = getCtxOrganizationId(ctx);

  const sem = await db.getSemester(input.id, {
    organizationId,
  });

  if (sem?.isLocked) throwAppError(
  ERROR_CODES.INVALID_REQUEST,
  "승인된 학기는 삭제할 수 없습니다.",
  400
);

  await db.deleteSemester(input.id, {
    organizationId,
  });
        return { success: true };
      }),
  }),

  refund: router({
    listByStudent: protectedProcedure
      .input(z.object({ studentId: z.number() }))
      .query(async ({ ctx, input }) => {
        const organizationId = getCtxOrganizationId(ctx);

const student = await db.getStudent(input.studentId, {
  organizationId,
});
        if (!student) return [];

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          return [];
        }

        return db.listRefundsByStudent(input.studentId, {
  organizationId,
});
      }),

    listPending: protectedProcedure.query(
  async ({ ctx }) => {
    if (!isAdminOrHost(ctx.user)) {
      throwAppError(
        ERROR_CODES.PERMISSION_DENIED,
        "관리자 또는 호스트만 확인할 수 있습니다.",
        403
      );
    }

    const organizationId =
      getCtxOrganizationId(ctx);

    const currentUserId =
      Number(ctx.user.id) || 0;

    if (!currentUserId) {
      throwAppError(
        ERROR_CODES.AUTH_REQUIRED,
        "사용자 정보를 확인할 수 없습니다.",
        401
      );
    }

    // HOST는 회사 전체 대기 환불 조회
    if (isHost(ctx.user)) {
      return db.listPendingRefunds({
        organizationId,
      });
    }

    // ADMIN은 같은 팀 대기 환불만 조회
    const teamMemberIds =
      await db.getUserTeamMemberIds(
        currentUserId,
        {
          organizationId,
        }
      );

    return db.listPendingRefunds({
      organizationId,
      assigneeIds: teamMemberIds,
    });
  }
),

    create: protectedProcedure
      .input(
        z.object({
          studentId: z.number(),
          semesterId: z.number().optional().nullable(),
          refundAmount: z.string(),
          refundDate: z.string(),
          reason: z.string().optional(),
          refundType: z
            .enum(["부분환불", "전액환불", "환불후재등록", "교육원이동"])
            .optional(),
          attachmentName: z.string().optional(),
          attachmentUrl: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const organizationId = getCtxOrganizationId(ctx);

const student = await db.getStudent(input.studentId, {
  organizationId,
});
        if (!student) throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "학생을 찾을 수 없습니다.",
  404
);

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "권한이 없습니다.",
  403
);
        }

        const id = await db.createRefund({
organizationId,
          studentId: input.studentId,
          semesterId: input.semesterId ?? null,
          assigneeId: student.assigneeId,
          refundAmount: input.refundAmount as any,
          refundDate: new Date(input.refundDate),
          reason: input.reason ?? "",
          refundType: input.refundType ?? "부분환불",
          approvalStatus: "대기",
          attachmentName: input.attachmentName ?? null,
          attachmentUrl: input.attachmentUrl ?? null,
        } as any);

        return { id, success: true };
      }),

   approve: protectedProcedure

  .input(z.object({ id: z.number() }))
  .mutation(async ({ ctx, input }) => {
    if (!isAdminOrHost(ctx.user)) {
      throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "관리자 또는 호스트만 승인할 수 있습니다.",
  403
);
    }

    const organizationId = getCtxOrganizationId(ctx);

const targetRefund = await db.getRefundById(input.id, {
  organizationId,
});

if (!targetRefund) {
  throwAppError(
    ERROR_CODES.DATA_NOT_FOUND,
    "환불 요청을 찾을 수 없습니다.",
    404
  );
}

// ADMIN은 같은 팀 환불만 승인 가능
if (isAdmin(ctx.user)) {
  const teamMemberIds =
    await db.getUserTeamMemberIds(
      Number(ctx.user.id),
      {
        organizationId,
      }
    );

  if (
    !teamMemberIds.includes(
      Number(targetRefund.assigneeId)
    )
  ) {
    throwAppError(
      ERROR_CODES.PERMISSION_DENIED,
      "같은 팀의 환불 요청만 승인할 수 있습니다.",
      403
    );
  }
}

await db.approveRefund(input.id, Number(ctx.user.id), {
  organizationId,
} as any);

    if (targetRefund?.assigneeId) {
      const studentName =
        targetRefund.clientName || `학생 #${targetRefund.studentId}`;

      const notificationId = await db.createNotification({
  organizationId,
  userId: Number(targetRefund.assigneeId),
        type: "approval",
        title: "환불 승인 완료",
        level: "success",
        message: `[환불 승인] ${studentName} 환불이 승인되었습니다.`,
        relatedId: Number(input.id),
targetType: "refund",
targetId: Number(input.id),
linkUrl: `/approval-history/refund/${input.id}`,
metadataJson: JSON.stringify({
  approvalStatus: "승인",
}),
isRead: false,
      } as any);

      emitLiveNotification({
  organizationId,
  id: Number(notificationId),
  userId: Number(targetRefund.assigneeId),
        type: "approval",
        title: "환불 승인 완료",
        level: "success",
        message: `[환불 승인] ${studentName} 환불이 승인되었습니다.`,
        relatedId: Number(input.id),
targetType: "refund",
targetId: Number(input.id),
linkUrl: `/approval-history/refund/${input.id}`,
metadataJson: JSON.stringify({
  approvalStatus: "승인",
}),
isRead: false,
      });
    }

    return { success: true };
  }),

    reject: protectedProcedure
      .input(
  z.object({
    id: z.number(),
    rejectionReason: z.string().min(1, "환불 반려 사유는 필수입니다."),
  })
)
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrHost(ctx.user)) {
          throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "관리자 또는 호스트만 불승인 처리할 수 있습니다.",
  403
);
        }

        const organizationId = getCtxOrganizationId(ctx);

const targetRefund = await db.getRefundById(input.id, {
  organizationId,
});

if (!targetRefund) {
  throwAppError(
    ERROR_CODES.DATA_NOT_FOUND,
    "환불 요청을 찾을 수 없습니다.",
    404
  );
}

if (isAdmin(ctx.user)) {
  const teamMemberIds =
    await db.getUserTeamMemberIds(
      Number(ctx.user.id),
      {
        organizationId,
      }
    );

  if (
    !teamMemberIds.includes(
      Number(targetRefund.assigneeId)
    )
  ) {
    throwAppError(
      ERROR_CODES.PERMISSION_DENIED,
      "같은 팀의 환불 요청만 불승인 처리할 수 있습니다.",
      403
    );
  }
}

await db.rejectRefund(input.id, Number(ctx.user.id), {
  organizationId,
  rejectionReason: input.rejectionReason.trim(),
} as any);

if (targetRefund?.assigneeId) {
  const studentName =
    targetRefund.clientName || `학생 #${targetRefund.studentId}`;

  const notificationId = await db.createNotification({
  organizationId,
  userId: Number(targetRefund.assigneeId),
    type: "approval",
    title: "환불 반려",
    level: "danger",
    message: `[환불 반려] ${studentName} 환불이 반려되었습니다.`,
    relatedId: Number(input.id),
targetType: "refund",
targetId: Number(input.id),
linkUrl: `/approval-history/refund/${input.id}`,
metadataJson: JSON.stringify({
  approvalStatus: "불승인",
  rejectionReason: input.rejectionReason.trim(),
}),
isRead: false,
  } as any);

  emitLiveNotification({
  organizationId,
  id: Number(notificationId),
  userId: Number(targetRefund.assigneeId),
    type: "approval",
    title: "환불 반려",
    level: "danger",
    message: `[환불 반려] ${studentName} 환불이 반려되었습니다.`,
    relatedId: Number(input.id),
targetType: "refund",
targetId: Number(input.id),
linkUrl: `/approval-history/refund/${input.id}`,
metadataJson: JSON.stringify({
  approvalStatus: "불승인",
  rejectionReason: input.rejectionReason.trim(),
}),
isRead: false,
  });
}

return { success: true };
      }),

   update: protectedProcedure
  .input(
    z.object({
      id: z.number(),
      semesterId: z.number().optional().nullable(),
      refundAmount: z.string().optional(),
      refundDate: z.string().optional(),
      reason: z.string().optional(),
      refundType: z
        .enum(["부분환불", "전액환불", "환불후재등록", "교육원이동"])
        .optional(),
      attachmentName: z.string().optional(),
      attachmentUrl: z.string().optional(),
    })
  )
      .mutation(async ({ ctx, input }) => {
  const data: any = {};

  if (input.semesterId !== undefined) data.semesterId = input.semesterId ?? null;
  if (input.refundAmount !== undefined) data.refundAmount = input.refundAmount;
  if (input.refundDate !== undefined)
    data.refundDate = input.refundDate ? new Date(input.refundDate) : null;
  if (input.reason !== undefined) data.reason = input.reason;
  if (input.refundType !== undefined) data.refundType = input.refundType;
  if (input.attachmentName !== undefined)
    data.attachmentName = input.attachmentName?.trim() || null;
  if (input.attachmentUrl !== undefined)
    data.attachmentUrl = input.attachmentUrl?.trim() || null;

  await db.updateRefund(input.id, data, {
  organizationId: getCtxOrganizationId(ctx),
});
return { success: true };
}),

    delete: hostProcedure
      .input(z.object({ id: z.number() }))
     .mutation(async ({ ctx, input }) => {
  await db.deleteRefund(input.id, {
    organizationId: getCtxOrganizationId(ctx),
  });
  return { success: true };
}),
  }),

  planSemester: router({
    list: protectedProcedure
      .input(z.object({ studentId: z.number() }))
      .query(async ({ ctx, input }) => {
       const organizationId = getCtxOrganizationId(ctx);

const student = await db.getStudent(input.studentId, {
  organizationId,
});
        if (!student) return [];

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          return [];
        }

        return db.listPlanSemesters(input.studentId, {
  organizationId: getCtxOrganizationId(ctx),
});
      }),

    create: protectedProcedure
      .input(
        z.object({
          studentId: z.number(),
          semesterNo: z.number(),
          subjectName: z.string().min(1),
          category: z.enum(["전공", "교양", "일반"]),
          requirementType: z.enum(["전공필수", "전공선택", "교양", "일반"]).optional(),
          sortOrder: z.number().optional(),
settlementIncluded: z.boolean().optional(),
retakeRequired: z.boolean().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const organizationId = getCtxOrganizationId(ctx);

const student = await db.getStudent(input.studentId, {
  organizationId,
});
        if (!student) throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "학생을 찾을 수 없습니다.",
  404
);

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "권한이 없습니다.",
  403
);
        }

        const existing = await db.listPlanSemesters(input.studentId, {
  organizationId,
});
        const semesterCount = existing.filter(
          (x: any) => Number(x.semesterNo) === Number(input.semesterNo)
        ).length;

        if (semesterCount >= 8) {
          throwAppError(
  ERROR_CODES.INVALID_INPUT,
  "우리 플랜은 학기당 최대 8과목까지 등록할 수 있습니다.",
  400
);
        }

        const id = await db.createPlanSemester({
organizationId: getCtxOrganizationId(ctx),
          studentId: input.studentId,
          semesterNo: input.semesterNo,
          subjectName: input.subjectName.trim(),
          planCategory: input.category,
          planRequirementType: input.requirementType ?? null,
          credits: 3,
          sortOrder: input.sortOrder ?? 0,
settlementIncluded: input.settlementIncluded,
retakeRequired:
  input.retakeRequired ??
  false,
        } as any);

        return { id, success: true };
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          subjectName: z.string().optional(),
          category: z.enum(["전공", "교양", "일반"]).optional(),
          requirementType: z.enum(["전공필수", "전공선택", "교양", "일반"]).optional(),
          semesterNo: z.number().optional(),
          sortOrder: z.number().optional(),
settlementIncluded: z.boolean().optional(),
retakeRequired: z.boolean().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const data: any = {};

        if (input.subjectName !== undefined) data.subjectName = input.subjectName.trim();
        if (input.category !== undefined) data.planCategory = input.category;
        if (input.requirementType !== undefined) data.planRequirementType = input.requirementType;
        if (input.semesterNo !== undefined) data.semesterNo = input.semesterNo;
        if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
if (input.settlementIncluded !== undefined) {
  data.settlementIncluded = input.settlementIncluded;
}
if (
  input.retakeRequired !==
  undefined
) {
  data.retakeRequired =
    input.retakeRequired;
}

        await db.updatePlanSemester(input.id, data, {
  organizationId: getCtxOrganizationId(ctx),
});
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deletePlanSemester(input.id, {
  organizationId: getCtxOrganizationId(ctx),
});
        return { success: true };
      }),
  }),

  transferSubject: router({
    list: protectedProcedure
      .input(z.object({ studentId: z.number() }))
      .query(async ({ ctx, input }) => {
        const student = await db.getStudent(input.studentId, {
  organizationId: getCtxOrganizationId(ctx),
});
        if (!student) return [];

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          return [];
        }

        return db.listTransferSubjects(input.studentId, {
  organizationId: getCtxOrganizationId(ctx),
});
      }),

    create: protectedProcedure
      .input(
        z.object({
          studentId: z.number(),
          schoolName: z.string().optional(),
          subjectName: z.string().min(1),
          category: z.enum(["전공", "교양", "일반"]),
          requirementType: z.enum(["전공필수", "전공선택", "교양", "일반"]).optional(),
          credits: z.number().min(0).max(30),
          sortOrder: z.number().optional(),
          attachmentName: z.string().optional(),
          attachmentUrl: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const student = await db.getStudent(input.studentId, {
  organizationId: getCtxOrganizationId(ctx),
});
        if (!student) throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "학생을 찾을 수 없습니다.",
  404
);

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
         throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "권한이 없습니다.",
  403
);
        }

        const existing = await db.listTransferSubjects(input.studentId, {
  organizationId: getCtxOrganizationId(ctx),
});
        if ((existing?.length ?? 0) >= 100) {
          throwAppError(
  ERROR_CODES.INVALID_INPUT,
  "전적대 과목은 최대 100개까지 등록할 수 있습니다.",
  400
);
        }

        const id = await db.createTransferSubject({
 organizationId: getCtxOrganizationId(ctx),
          studentId: input.studentId,
          schoolName: input.schoolName?.trim() || null,
          subjectName: input.subjectName.trim(),
          transferCategory: input.category,
          transferRequirementType: input.requirementType ?? null,
          credits: input.credits,
          sortOrder: input.sortOrder ?? 0,
          attachmentName: input.attachmentName?.trim() || null,
          attachmentUrl: input.attachmentUrl?.trim() || null,
        } as any);

        return { id, success: true };
      }),

    bulkCreate: protectedProcedure
      .input(
        z.object({
          studentId: z.number(),
          count: z.number().min(1).max(100),
          schoolName: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const organizationId = getCtxOrganizationId(ctx);

const student = await db.getStudent(input.studentId, {
  organizationId,
});
        if (!student) throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "학생을 찾을 수 없습니다.",
  404
);

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "권한이 없습니다.",
  403
);
        }

       const existing = await db.listTransferSubjects(input.studentId, {
  organizationId: getCtxOrganizationId(ctx),
});
        const existingCount = existing?.length ?? 0;

        if (existingCount + input.count > 100) {
          throwAppError(
  ERROR_CODES.INVALID_INPUT,
  "전적대 과목은 최대 100개까지 등록할 수 있습니다.",
  400
);
        }

        const rows = Array.from({ length: input.count }).map((_, i) => ({
  organizationId,
  studentId: input.studentId,
          schoolName: input.schoolName?.trim() || "전적대",
          subjectName: `새 과목${existingCount + i + 1}`,
          transferCategory: "전공" as const,
          transferRequirementType: "전공선택" as const,
          credits: 3,
          sortOrder: existingCount + i,
          attachmentName: null,
          attachmentUrl: null,
        }));

        await db.bulkCreateTransferSubjects(rows as any);

        return { success: true, count: input.count };
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          schoolName: z.string().optional(),
          subjectName: z.string().optional(),
          category: z.enum(["전공", "교양", "일반"]).optional(),
          requirementType: z.enum(["전공필수", "전공선택", "교양", "일반"]).optional(),
          credits: z.number().min(0).max(30).optional(),
          sortOrder: z.number().optional(),
          attachmentName: z.string().optional(),
          attachmentUrl: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const data: any = {};

        if (input.schoolName !== undefined) data.schoolName = input.schoolName.trim();
        if (input.subjectName !== undefined) data.subjectName = input.subjectName.trim();
        if (input.category !== undefined) data.transferCategory = input.category;
        if (input.requirementType !== undefined) data.transferRequirementType = input.requirementType;
        if (input.credits !== undefined) data.credits = input.credits;
        if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
        if (input.attachmentName !== undefined) data.attachmentName = input.attachmentName.trim();
        if (input.attachmentUrl !== undefined) data.attachmentUrl = input.attachmentUrl.trim();

        await db.updateTransferSubject(input.id, data, {
  organizationId: getCtxOrganizationId(ctx),
});
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteTransferSubject(input.id, {
  organizationId: getCtxOrganizationId(ctx),
});
        return { success: true };
      }),
  }),

  transferAttachment: router({
    list: protectedProcedure
      .input(z.object({ studentId: z.number() }))
      .query(async ({ ctx, input }) => {
        const organizationId = getCtxOrganizationId(ctx);

const student = await db.getStudent(input.studentId, {
  organizationId,
});
        if (!student) return [];

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          return [];
        }

        return db.listTransferAttachments(input.studentId, {
  organizationId,
});
      }),

    create: protectedProcedure
      .input(
        z.object({
          studentId: z.number(),
          fileName: z.string().min(1),
          fileUrl: z.string().min(1),
          sortOrder: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const organizationId = getCtxOrganizationId(ctx);

const student = await db.getStudent(input.studentId, {
  organizationId,
});
        if (!student) throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "학생을 찾을 수 없습니다.",
  404
);

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "권한이 없습니다.",
  403
);
        }

        const existing = await db.listTransferAttachments(input.studentId, {
  organizationId,
});
        if ((existing?.length ?? 0) >= 4) {
          throwAppError(
  ERROR_CODES.INVALID_INPUT,
  "첨부파일은 최대 4개까지 등록할 수 있습니다.",
  400
);
        }

        const id = await db.createTransferAttachment({
organizationId,
          studentId: input.studentId,
          fileName: input.fileName.trim(),
          fileUrl: input.fileUrl.trim(),
          sortOrder: input.sortOrder ?? (existing?.length ?? 0),
        } as any);

        return { id, success: true };
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          fileName: z.string().optional(),
          fileUrl: z.string().optional(),
          sortOrder: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const data: any = {};
        if (input.fileName !== undefined) data.fileName = input.fileName.trim();
        if (input.fileUrl !== undefined) data.fileUrl = input.fileUrl.trim();
        if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;

        await db.updateTransferAttachment(input.id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteTransferAttachment(input.id);
        return { success: true };
      }),
  }),

courseTemplate: router({
  list: protectedProcedure
    .input(
  z
    .object({
      courseKey:
        z.string().optional(),

      catalogId:
        z.number()
          .int()
          .positive()
          .optional(),
    })
    .optional()
)
    .query(async ({ ctx, input }) => {
      const organizationId = getCtxOrganizationId(ctx);

      if (!organizationId) {
        throwAppError(
  ERROR_CODES.ORGANIZATION_REQUIRED,
  "organizationId is required",
  400
);
      }

      return db.listCourseSubjectTemplates(
  input?.courseKey,
  {
    organizationId,

    catalogId:
      input?.catalogId ??
      null,
  }
);
    }),

  create: hostProcedure
    .input(
  z.object({
    courseKey:
      z.string().min(1),

    catalogId:
      z.number()
        .int()
        .positive()
        .optional(),

    subjectName:
      z.string().min(1),

    category:
      z.enum([
        "전공",
        "교양",
        "일반",
      ]),

    requirementType:
      z
        .enum([
          "전공필수",
          "전공선택",
          "교양",
          "일반",
        ])
        .optional(),

    sortOrder:
      z.number().optional(),
  })
)
    .mutation(async ({ ctx, input }) => {
      const organizationId = getCtxOrganizationId(ctx);

      if (!organizationId) {
        throwAppError(
  ERROR_CODES.ORGANIZATION_REQUIRED,
  "organizationId is required",
  400
);
      }

      const id =
  await db.createCourseSubjectTemplate({
    organizationId,

    courseKey:
      input.courseKey.trim(),

    catalogId:
      input.catalogId ??
      null,

    subjectName:
      input.subjectName.trim(),

    category:
      input.category,

    requirementType:
      input.requirementType ??
      null,

    sortOrder:
      input.sortOrder ??
      0,

    isActive:
      true,
  } as any);

      return { id, success: true };
    }),

  applyToPlanSemester: protectedProcedure
    .input(
      z.object({
        studentId: z.number(),
        semesterNo: z.number(),
        subjectIds: z.array(z.number()).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = getCtxOrganizationId(ctx);

      if (!organizationId) {
        throwAppError(
  ERROR_CODES.ORGANIZATION_REQUIRED,
  "organizationId is required",
  400
);
      }

      const student = await db.getStudent(input.studentId, {
        organizationId,
      });
      if (!student) throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "학생을 찾을 수 없습니다.",
  404
);

      if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
        throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "권한이 없습니다.",
  403
);
      }

      const result = await db.bulkCreatePlanSemestersFromTemplate({
        organizationId,
        studentId: input.studentId,
        semesterNo: input.semesterNo,
        subjectIds: input.subjectIds,
      });

      return { success: true, count: result.count };
    }),
}), 

practiceEducationCenter: router({
  list: protectedProcedure
    .input(
      z.object({
        categoryId: z.number().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const organizationId = getCtxOrganizationId(ctx);

      if (!organizationId) {
        throwAppError(
  ERROR_CODES.ORGANIZATION_REQUIRED,
  "organizationId is required",
  400
);
      }

     return db.listMergedPracticeEducationCenters({
  organizationId,
  categoryId: input?.categoryId,
});
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const organizationId = getCtxOrganizationId(ctx);

      if (!organizationId) {
        throwAppError(
  ERROR_CODES.ORGANIZATION_REQUIRED,
  "organizationId is required",
  400
);
      }

      if (input.id < 0) {
  const rows = await db.listMergedPracticeEducationCenters({
    organizationId,
  });

  return rows.find((row: any) => Number(row.id) === Number(input.id)) ?? null;
}

return db.getPracticeEducationCenter(input.id, {
  organizationId,
});
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        phone: z.string().optional(),
        address: z.string().optional(),
        detailAddress: z.string().optional(),
        feeAmount: z.string().optional(),
        latitude: z.string().optional(),
        longitude: z.string().optional(),
        note: z.string().optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "host") {
        throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "관리자 또는 호스트만 등록할 수 있습니다.",
  403
);
      }

      const organizationId = getCtxOrganizationId(ctx);

      if (!organizationId) {
        throwAppError(
  ERROR_CODES.ORGANIZATION_REQUIRED,
  "organizationId is required",
  400
);
      }

      const id = await db.createPracticeEducationCenter({
        organizationId,
        name: input.name.trim(),
        phone: input.phone?.trim() || null,
        address: input.address?.trim() || null,
        detailAddress: input.detailAddress?.trim() || null,
        feeAmount: input.feeAmount || "0",
        latitude: input.latitude || null,
        longitude: input.longitude || null,
        note: input.note || null,
        isActive: input.isActive ?? true,
        sortOrder: input.sortOrder ?? 0,
      } as any);

      return { id, success: true };
    }),

  bulkCreate: protectedProcedure
    .input(
      z.object({
        mode: z.enum(["append", "replace"]).default("append"),
        categoryId: z.number().nullable().optional(),
        rows: z.array(
          z.object({
            categoryId: z.number().optional(),
            representativeName: z.string().optional(),
            availableCourse: z.string().optional(),
            memo: z.string().optional(),
            name: z.string().min(1),
            phone: z.string().optional(),
            address: z.string().optional(),
            detailAddress: z.string().optional(),
            feeAmount: z.string().optional(),
            latitude: z.string().optional(),
            longitude: z.string().optional(),
            note: z.string().optional(),
            isActive: z.boolean().optional(),
            sortOrder: z.number().optional(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "host" && ctx.user.role !== "superhost") {
        throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "호스트만 등록할 수 있습니다.",
  403
);
      }

      const organizationId = getCtxOrganizationId(ctx);

      if (!organizationId) {
        throwAppError(
  ERROR_CODES.ORGANIZATION_REQUIRED,
  "organizationId is required",
  400
);
      }

      return db.bulkCreatePracticeEducationCenters(
        input.rows.map((row, idx) => ({
          categoryId: row.categoryId ?? input.categoryId ?? null,
          representativeName: row.representativeName?.trim() || null,
          availableCourse: row.availableCourse?.trim() || null,
          memo: row.memo?.trim() || null,
          name: row.name.trim(),
          phone: row.phone?.trim() || null,
          address: row.address?.trim() || null,
          detailAddress: row.detailAddress?.trim() || null,
          feeAmount: row.feeAmount || "0",
          latitude: row.latitude || null,
          longitude: row.longitude || null,
          note: row.note?.trim() || null,
          isActive: row.isActive ?? true,
          sortOrder: row.sortOrder ?? idx,
        })),
        {
          organizationId,
          mode: input.mode,
          categoryId: input.categoryId ?? null,
        }
      );
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        detailAddress: z.string().optional(),
        feeAmount: z.string().optional(),
        latitude: z.string().optional(),
        longitude: z.string().optional(),
        note: z.string().optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "host") {
        throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "관리자 또는 호스트만 등록할 수 있습니다.",
  403
);
      }

      const organizationId = getCtxOrganizationId(ctx);

      if (!organizationId) {
        throwAppError(
  ERROR_CODES.ORGANIZATION_REQUIRED,
  "organizationId is required",
  400
);
      }

     const { id, ...rest } = input;

if (id < 0) {
  await db.upsertPracticeEducationCenterOverride({
    organizationId,
    masterId: Math.abs(id),
    data: {
      name: rest.name?.trim() ?? undefined,
      phone: rest.phone?.trim() ?? undefined,
      address: rest.address?.trim() ?? undefined,
      detailAddress: rest.detailAddress?.trim() ?? undefined,
      feeAmount: rest.feeAmount ?? undefined,
      latitude: rest.latitude || undefined,
      longitude: rest.longitude || undefined,
      memo: rest.note?.trim() ?? undefined,
    },
  });
} else {
  await db.updatePracticeEducationCenter(id, rest as any, {
    organizationId,
  });
}

      return { success: true };
    }),

  updateAvailability: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        isInactive: z.boolean(),
        inactiveReason: z.string().nullable().optional(),
        inactiveStartDate: z.string().nullable().optional(),
        inactiveEndDate: z.string().nullable().optional(),
        hideOnMapWhenInactive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (
        ctx.user.role !== "admin" &&
        ctx.user.role !== "host" &&
        ctx.user.role !== "superhost"
      ) {
        throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "관리자 또는 호스트만 등록할 수 있습니다.",
  403
);
      }

      const organizationId = getCtxOrganizationId(ctx);

      if (!organizationId) {
        throwAppError(
  ERROR_CODES.ORGANIZATION_REQUIRED,
  "organizationId is required",
  400
);
      }

      if (input.id < 0) {
  await db.updatePracticeEducationCenterAvailabilityOverride({
    organizationId,
    masterId: Math.abs(input.id),
    isInactive: input.isInactive,
    inactiveReason: input.inactiveReason ?? null,
    inactiveStartDate: input.inactiveStartDate ?? null,
    inactiveEndDate: input.inactiveEndDate ?? null,
    hideOnMapWhenInactive: input.hideOnMapWhenInactive ?? true,
  });
} else {
  await db.updatePracticeEducationCenterAvailability(
    input.id,
    {
      isInactive: input.isInactive,
      inactiveReason: input.inactiveReason ?? null,
      inactiveStartDate: input.inactiveStartDate ?? null,
      inactiveEndDate: input.inactiveEndDate ?? null,
      hideOnMapWhenInactive: input.hideOnMapWhenInactive ?? true,
    },
    { organizationId }
  );
}

      return { success: true };
    }),

updatePartner: hostProcedure
  .input(
    z.object({
      id: z.number(),
      isPartner: z.boolean(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    if (
      ctx.user.role !== "host" &&
      ctx.user.role !== "superhost"
    ) {
      throwAppError(
        ERROR_CODES.PERMISSION_DENIED,
        "관리자 또는 호스트만 수정할 수 있습니다.",
        403
      );
    }

    const organizationId = getCtxOrganizationId(ctx);

    if (!organizationId) {
      throwAppError(
        ERROR_CODES.ORGANIZATION_REQUIRED,
        "organizationId is required",
        400
      );
    }

    if (input.id < 0) {
      await db.updatePracticeEducationCenterPartnerOverride({
        organizationId,
        masterId: Math.abs(input.id),
        isPartner: input.isPartner,
      });
    } else {
      await db.updatePracticeEducationCenterPartner(
        input.id,
        input.isPartner,
        { organizationId }
      );
    }

    return { success: true };
  }),

updatePartnerPrice: hostProcedure
  .input(
    z.object({
      id: z.number(),
      partnerPrice: z.union([z.string(), z.number()]),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const organizationId = getCtxOrganizationId(ctx);

    if (input.id < 0) {
      await db.updatePracticeEducationCenterPartnerPriceOverride({
        organizationId,
        masterId: Math.abs(input.id),
        partnerPrice: input.partnerPrice,
      });
    } else {
      await db.updatePracticeEducationCenterPartnerPrice(input.id, {
        organizationId,
        partnerPrice: input.partnerPrice,
      });
    }

    return { success: true };
  }),

  bulkDeactivate: protectedProcedure
    .input(
      z.object({
  categoryId: z.number().optional().nullable(),
  inactiveReason: z.string().nullable().optional(),
  inactiveStartDate: z.string().nullable().optional(),
  inactiveEndDate: z.string().nullable().optional(),
  hideOnMapWhenInactive: z.boolean().optional(),
})
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "host" && ctx.user.role !== "superhost") {
        throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "호스트만 일괄 비활성화할 수 있습니다.",
  403
);
      }

      const organizationId = getCtxOrganizationId(ctx);

      if (!organizationId) {
        throwAppError(
  ERROR_CODES.ORGANIZATION_REQUIRED,
  "organizationId is required",
  400
);
      }

      return db.bulkDeactivatePracticeEducationCenterOverrides({
  organizationId,
  categoryId: input.categoryId ?? null,
  inactiveReason: input.inactiveReason ?? "일괄 비활성화",
  inactiveStartDate: input.inactiveStartDate ?? null,
  inactiveEndDate: input.inactiveEndDate ?? null,
  hideOnMapWhenInactive: input.hideOnMapWhenInactive ?? true,
});
    }),

  fixCoords: protectedProcedure
    .input(
      z.object({
        limit: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = getCtxOrganizationId(ctx);

      if (!organizationId) {
        throwAppError(
  ERROR_CODES.ORGANIZATION_REQUIRED,
  "organizationId is required",
  400
);
      }

      return db.fixMissingCoordinates({
        organizationId,
        type: "education",
        limit: input.limit,
      });
    }),

  delete: hostProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = getCtxOrganizationId(ctx);

      if (!organizationId) {
        throwAppError(
  ERROR_CODES.ORGANIZATION_REQUIRED,
  "organizationId is required",
  400
);
      }

     if (input.id < 0) {
  await db.hidePracticeEducationCenterOverride({
    organizationId,
    masterId: Math.abs(input.id),
  });
} else {
  await db.deletePracticeEducationCenter(input.id, {
    organizationId,
  });
}

      return { success: true };
    }),
}),
  practiceInstitution: router({
    list: protectedProcedure
  .input(
    z.object({
      institutionType: z.enum(["education", "institution"]).optional(),
      categoryId: z.number().optional(),
    }).optional()
  )
  .query(async ({ ctx, input }) => {
  const organizationId = getCtxOrganizationId(ctx);

  if (!organizationId) {
    throwAppError(
  ERROR_CODES.ORGANIZATION_REQUIRED,
  "organizationId is required",
  400
);
  }

  return db.listMergedPracticeInstitutions({
  organizationId,
  institutionType: input?.institutionType,
  categoryId: input?.categoryId,
});
}),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
  const organizationId = getCtxOrganizationId(ctx);

  if (!organizationId) {
    throwAppError(
  ERROR_CODES.ORGANIZATION_REQUIRED,
  "organizationId is required",
  400
);
  }

  if (input.id < 0) {
  const rows = await db.listMergedPracticeInstitutions({
    organizationId,
  });

  return rows.find((row: any) => Number(row.id) === Number(input.id)) ?? null;
}

return db.getPracticeInstitution(input.id, {
  organizationId,
});
}),

    create: protectedProcedure
      .input(
        z.object({
          institutionType: z.enum(["education", "institution"]),
          name: z.string().min(1),
          representativeName: z.string().optional(),
          phone: z.string().optional(),
          address: z.string().min(1),
          detailAddress: z.string().optional(),
          price: z.string().optional(),
          latitude: z.string().optional(),
          longitude: z.string().optional(),
          availableCourse: z.string().optional(),
          memo: z.string().optional(),
          isActive: z.boolean().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrHost(ctx.user)) {
          throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "관리자 또는 호스트만 수정할 수 있습니다.",
  403
);
        }

const organizationId = getCtxOrganizationId(ctx);

if (!organizationId) {
  throwAppError(
  ERROR_CODES.ORGANIZATION_REQUIRED,
  "organizationId is required",
  400
);
}

        const id = await db.createPracticeInstitution({
organizationId,
          institutionType: input.institutionType,
          name: input.name.trim(),
          representativeName: input.representativeName?.trim() || null,
          phone: input.phone?.trim() || null,
          address: input.address.trim(),
          detailAddress: input.detailAddress?.trim() || null,
          price: input.price || "0",
          latitude: input.latitude || null,
          longitude: input.longitude || null,
          availableCourse: input.availableCourse?.trim() || null,
          memo: input.memo || null,
          isActive: input.isActive ?? true,
        } as any);

        return { id, success: true };
      }),

    bulkCreate: protectedProcedure
      .input(
        z.object({
mode: z.enum(["append", "replace"]).default("append"),
categoryId: z.number().nullable().optional(),
          rows: z.array(
            z.object({
  institutionType: z.enum(["education", "institution"]),
  categoryId: z.number().optional(),
  name: z.string().min(1),
  representativeName: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().min(1),
  detailAddress: z.string().optional(),
  price: z.string().optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  availableCourse: z.string().optional(),
  memo: z.string().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().optional(),
})
          ),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrHost(ctx.user)) {
          throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "관리자 또는 호스트만 수정할 수 있습니다.",
  403
);
        }

const organizationId = getCtxOrganizationId(ctx);

if (!organizationId) {
  throwAppError(
  ERROR_CODES.ORGANIZATION_REQUIRED,
  "organizationId is required",
  400
);
}

       const result = await db.bulkCreatePracticeInstitutions(
  input.rows.map((row, idx) => ({
    institutionType: row.institutionType,
    categoryId: row.categoryId ?? null,
    name: row.name.trim(),
    representativeName: row.representativeName?.trim() || null,
    phone: row.phone?.trim() || null,
    address: row.address.trim(),
    detailAddress: row.detailAddress?.trim() || null,
    price: row.price || "0",
    latitude: row.latitude || null,
    longitude: row.longitude || null,
    availableCourse: row.availableCourse?.trim() || null,
    memo: row.memo || null,
    isActive: row.isActive ?? true,
    sortOrder: (row as any).sortOrder ?? idx,
  })) as any,
  {
  organizationId,
  mode: input.mode,
  categoryId: input.categoryId ?? null,
}
);

return result;
      }),

bulkDeactivate: protectedProcedure
  .input(
    z.object({
  institutionType: z.enum(["education", "institution"]).optional(),
  categoryId: z.number().optional().nullable(),
  inactiveReason: z.string().nullable().optional(),
  inactiveStartDate: z.string().nullable().optional(),
  inactiveEndDate: z.string().nullable().optional(),
  hideOnMapWhenInactive: z.boolean().optional(),
})
  )
  .mutation(async ({ ctx, input }) => {
    if (ctx.user.role !== "host" && ctx.user.role !== "superhost") {
      throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "호스트만 일괄 비활성화할 수 있습니다.",
  403
);
    }

const organizationId = getCtxOrganizationId(ctx);

if (!organizationId) {
  throwAppError(
  ERROR_CODES.ORGANIZATION_REQUIRED,
  "organizationId is required",
  400
);
}

return db.bulkDeactivatePracticeInstitutionOverrides({
  organizationId,
  institutionType: input.institutionType,
  categoryId: input.categoryId ?? null,
  inactiveReason: input.inactiveReason ?? "일괄 비활성화",
  inactiveStartDate: input.inactiveStartDate ?? null,
  inactiveEndDate: input.inactiveEndDate ?? null,
  hideOnMapWhenInactive: input.hideOnMapWhenInactive ?? true,
});
  }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          institutionType: z.enum(["education", "institution"]).optional(),
          name: z.string().optional(),
          representativeName: z.string().optional(),
          phone: z.string().optional(),
          address: z.string().optional(),
          detailAddress: z.string().optional(),
          price: z.string().optional(),
          latitude: z.string().optional(),
          longitude: z.string().optional(),
          availableCourse: z.string().optional(),
          memo: z.string().optional(),
          isActive: z.boolean().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrHost(ctx.user)) {
          throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "관리자 또는 호스트만 수정할 수 있습니다.",
  403
);
        }

        const { id, ...rest } = input;
        const data: any = {};

        if (rest.institutionType !== undefined) data.institutionType = rest.institutionType;
        if (rest.name !== undefined) data.name = rest.name.trim();
        if (rest.representativeName !== undefined) data.representativeName = rest.representativeName.trim();
        if (rest.phone !== undefined) data.phone = rest.phone.trim();
        if (rest.address !== undefined) data.address = rest.address.trim();
        if (rest.detailAddress !== undefined) data.detailAddress = rest.detailAddress.trim();
        if (rest.price !== undefined) data.price = rest.price;
        if (rest.latitude !== undefined) data.latitude = rest.latitude || null;
        if (rest.longitude !== undefined) data.longitude = rest.longitude || null;
        if (rest.availableCourse !== undefined) data.availableCourse = rest.availableCourse.trim();
        if (rest.memo !== undefined) data.memo = rest.memo;
        if (rest.isActive !== undefined) data.isActive = rest.isActive;

        const organizationId = getCtxOrganizationId(ctx);

if (!organizationId) {
  throwAppError(
  ERROR_CODES.ORGANIZATION_REQUIRED,
  "organizationId is required",
  400
);
}

if (id < 0) {
  await db.upsertPracticeInstitutionOverride({
    organizationId,
    masterId: Math.abs(id),
    data: {
      name: data.name,
      phone: data.phone,
      address: data.address,
      detailAddress: data.detailAddress,
      price: data.price,
      latitude: data.latitude,
      longitude: data.longitude,
      availableCourse: data.availableCourse,
      memo: data.memo,
    },
  });
} else {
  await db.updatePracticeInstitution(id, data, {
    organizationId,
  });
}
        return { success: true };
      }),

  updateAvailability: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        isInactive: z.boolean(),
        inactiveReason: z.string().nullable().optional(),
        inactiveStartDate: z.string().nullable().optional(),
        inactiveEndDate: z.string().nullable().optional(),
        hideOnMapWhenInactive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (
        ctx.user.role !== "admin" &&
        ctx.user.role !== "host" &&
        ctx.user.role !== "superhost"
      ) {
        throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "관리자 또는 호스트만 수정할 수 있습니다.",
  403
);
      }

const organizationId = getCtxOrganizationId(ctx);

if (!organizationId) {
  throwAppError(
  ERROR_CODES.ORGANIZATION_REQUIRED,
  "organizationId is required",
  400
);
}

if (input.id < 0) {
  await db.updatePracticeInstitutionAvailabilityOverride({
    organizationId,
    masterId: Math.abs(input.id),
    isInactive: input.isInactive,
    inactiveReason: input.inactiveReason ?? null,
    inactiveStartDate: input.inactiveStartDate ?? null,
    inactiveEndDate: input.inactiveEndDate ?? null,
    hideOnMapWhenInactive: input.hideOnMapWhenInactive ?? true,
  });
} else {
  await db.updatePracticeInstitutionAvailability(
    input.id,
    {
      isInactive: input.isInactive,
      inactiveReason: input.inactiveReason ?? null,
      inactiveStartDate: input.inactiveStartDate ?? null,
      inactiveEndDate: input.inactiveEndDate ?? null,
      hideOnMapWhenInactive: input.hideOnMapWhenInactive ?? true,
    },
    { organizationId }
  );
}

return { success: true };
    }),

updatePracticeAvailability: protectedProcedure
  .input(
    z.object({
      id: z.number(),
      practiceAvailabilityType: z.enum([
        "unknown",
        "weekday",
        "weekend",
        "both",
      ]),
    })
  )
  .mutation(async ({ ctx, input }) => {
    if (
      ctx.user.role !== "admin" &&
      ctx.user.role !== "host" &&
      ctx.user.role !== "superhost"
    ) {
      throwAppError(
        ERROR_CODES.PERMISSION_DENIED,
        "관리자 또는 호스트만 수정할 수 있습니다.",
        403
      );
    }

    const organizationId = getCtxOrganizationId(ctx);

    if (input.id < 0) {
      await db.updatePracticeInstitutionPracticeAvailabilityOverride({
        organizationId,
        masterId: Math.abs(input.id),
        practiceAvailabilityType: input.practiceAvailabilityType,
      });
    } else {
      await db.updatePracticeInstitutionPracticeAvailability(
        input.id,
        input.practiceAvailabilityType,
        { organizationId }
      );
    }

    return { success: true };
  }),

fixCoords: protectedProcedure
  .input(
    z.object({
      limit: z.number().optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
   const organizationId = getCtxOrganizationId(ctx);

if (!organizationId) {
  throwAppError(
  ERROR_CODES.ORGANIZATION_REQUIRED,
  "organizationId is required",
  400
);
}

return db.fixMissingCoordinates({
  organizationId,
  type: "institution",
  limit: input.limit,
});
  }),

    delete: hostProcedure
      .input(z.object({ id: z.number() }))
     .mutation(async ({ ctx, input }) => {
  const organizationId = getCtxOrganizationId(ctx);

  if (!organizationId) {
    throwAppError(
  ERROR_CODES.ORGANIZATION_REQUIRED,
  "organizationId is required",
  400
);
  }

  if (input.id < 0) {
  await db.hidePracticeInstitutionOverride({
    organizationId,
    masterId: Math.abs(input.id),
  });
} else {
  await db.deletePracticeInstitution(input.id, {
    organizationId,
  });
}
        return { success: true };
      }),
  }),

practiceListCategory: router({
  list: protectedProcedure
    .input(
      z.object({
        listType: z.enum(["education", "institution"]).optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const organizationId = getCtxOrganizationId(ctx);

      if (!organizationId) {
        throwAppError(
  ERROR_CODES.ORGANIZATION_REQUIRED,
  "organizationId is required",
  400
);
      }

      return db.listPracticeListCategories(input?.listType, {
        organizationId,
      });
    }),

  create: hostProcedure
    .input(
      z.object({
        name: z.string().min(1),
        listType: z.enum(["education", "institution"]),
        description: z.string().optional(),
        sortOrder: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = getCtxOrganizationId(ctx);

      if (!organizationId) {
        throwAppError(
  ERROR_CODES.ORGANIZATION_REQUIRED,
  "organizationId is required",
  400
);
      }

      const id = await db.createPracticeListCategory({
        organizationId,
        name: input.name.trim(),
        listType: input.listType,
        description: input.description?.trim() || null,
        sortOrder: input.sortOrder ?? 0,
        isActive: true,
      } as any);

      return { success: true, id };
    }),

  update: hostProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        sortOrder: z.number().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = getCtxOrganizationId(ctx);

      if (!organizationId) {
        throwAppError(
  ERROR_CODES.ORGANIZATION_REQUIRED,
  "organizationId is required",
  400
);
      }

      const { id, ...rest } = input;

      await db.updatePracticeListCategory(id, rest as any, {
        organizationId,
      });

      return { success: true };
    }),

  delete: hostProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = getCtxOrganizationId(ctx);

      if (!organizationId) {
        throwAppError(
  ERROR_CODES.ORGANIZATION_REQUIRED,
  "organizationId is required",
  400
);
      }

      await db.deletePracticeListCategory(input.id, {
        organizationId,
      });

      return { success: true };
    }),
}),

  jobSupport: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const assigneeId = isAdminOrHost(ctx.user) ? undefined : Number(ctx.user.id) || 1;
      return db.listJobSupportRequests(assigneeId, {
  organizationId: getCtxOrganizationId(ctx),
});
    }),

    listByStudent: protectedProcedure
      .input(z.object({ studentId: z.number() }))
      .query(async ({ ctx, input }) => {
        const organizationId = getCtxOrganizationId(ctx);

const student = await db.getStudent(input.studentId, {
  organizationId,
});
        if (!student) return [];

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          return [];
        }

        return db.listJobSupportRequestsByStudent(input.studentId, {
  organizationId,
});
      }),

    create: protectedProcedure
      .input(
        z.object({
          studentId: z.number(),
          inputAddress: z.string().optional(),
          desiredArea: z.string().optional(),
          note: z.string().optional(),
          feeAmount: z.string().optional(),
          attachmentName: z.string().optional(),
          attachmentUrl: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const organizationId = getCtxOrganizationId(ctx);

const student = await db.getStudent(input.studentId, {
  organizationId,
});
        if (!student) throwAppError(
  ERROR_CODES.DATA_NOT_FOUND,
  "학생을 찾을 수 없습니다.",
  404
);

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "권한이 없습니다.",
  403
);
        }

        const assignee = await db.getUserById(student.assigneeId);

        const id = await db.createJobSupportRequest({
organizationId,
          studentId: input.studentId,
          assigneeId: student.assigneeId,
          clientName: student.clientName,
          phone: student.phone,
          assigneeName: assignee?.name || null,
          inputAddress: input.inputAddress?.trim() || null,
          desiredArea: input.desiredArea?.trim() || null,
          includeWelfareCenter: true,
          includeCareCenter: true,
          includeEtcInstitution: false,
          supportStatus: "요청",
          feeAmount: input.feeAmount || "0",
          paymentStatus: "결제대기",
          note: input.note || null,
          attachmentName: input.attachmentName || null,
          attachmentUrl: input.attachmentUrl || null,
        } as any);

        return { id, success: true };
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          inputAddress: z.string().optional(),
          desiredArea: z.string().optional(),
          supportStatus: z.enum(["요청", "진행중", "면접안내", "완료", "보류", "취소"]).optional(),
          selectedInstitutionName: z.string().optional(),
          selectedInstitutionAddress: z.string().optional(),
          selectedInstitutionDistanceKm: z.string().optional(),
          feeAmount: z.string().optional(),
          paymentStatus: z.enum(["결제대기", "입금확인", "완료", "취소"]).optional(),
          paidAt: z.string().optional(),
          note: z.string().optional(),
          attachmentName: z.string().optional(),
          attachmentUrl: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrHost(ctx.user)) {
          throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "관리자 또는 호스트만 등록할 수 있습니다.",
  403
);
        }

        const data: any = {};
        if (input.inputAddress !== undefined) data.inputAddress = input.inputAddress.trim();
        if (input.desiredArea !== undefined) data.desiredArea = input.desiredArea.trim();
        if (input.supportStatus !== undefined) data.supportStatus = input.supportStatus;
        if (input.selectedInstitutionName !== undefined) data.selectedInstitutionName = input.selectedInstitutionName.trim();
        if (input.selectedInstitutionAddress !== undefined) data.selectedInstitutionAddress = input.selectedInstitutionAddress.trim();
        if (input.selectedInstitutionDistanceKm !== undefined) data.selectedInstitutionDistanceKm = input.selectedInstitutionDistanceKm || null;
        if (input.feeAmount !== undefined) data.feeAmount = input.feeAmount;
        if (input.paymentStatus !== undefined) data.paymentStatus = input.paymentStatus;
        if (input.paidAt !== undefined) data.paidAt = input.paidAt ? new Date(input.paidAt) : null;
        if (input.note !== undefined) data.note = input.note;
        if (input.attachmentName !== undefined) data.attachmentName = input.attachmentName;
        if (input.attachmentUrl !== undefined) data.attachmentUrl = input.attachmentUrl;

        const organizationId =
  getCtxOrganizationId(ctx);

await db.updateJobSupportRequest(
  input.id,
  data,
  {
    organizationId,
  }
);
        return { success: true };
      }),

    delete: hostProcedure
  .input(z.object({ id: z.number() }))
  .mutation(async ({ ctx, input }) => {
    const organizationId =
      getCtxOrganizationId(ctx);

    await db.deleteJobSupportRequest(
      input.id,
      {
        organizationId,
      }
    );

    return { success: true };
  }),
  }),

    settlement: router({
  monthLockStatus: hostProcedure
    .input(
      z.object({
        year: z.number(),
        month: z.number(),
      })
    )
    .query(async ({ input, ctx }) => {
      const organizationId = getCtxOrganizationId(ctx);

      await assertOrganizationFeatureEnabled(
        organizationId,
        "allowSettlementReport",
        "현재 회사는 정산 리포트 기능을 사용할 수 없습니다."
      );

      const lock = await db.getSettlementMonthLock({
        organizationId,
        year: input.year,
        month: input.month,
      });

      return {
        isLocked: Boolean(lock && (lock as any).isLocked !== false),
        lock,
      };
    }),

  lockMonth: hostProcedure
    .input(
      z.object({
        year: z.number(),
        month: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const organizationId = getCtxOrganizationId(ctx);

      await assertOrganizationFeatureEnabled(
        organizationId,
        "allowSettlementReport",
        "현재 회사는 정산 리포트 기능을 사용할 수 없습니다."
      );

      const lock = await db.lockSettlementMonth({
        organizationId,
        year: input.year,
        month: input.month,
        actorUserId: Number(ctx.user.id),
      });

      return {
        success: true,
        lock,
      };
    }),

  unlockMonth: hostProcedure
    .input(
      z.object({
        year: z.number(),
        month: z.number(),
        reason: z.string().min(2).max(300),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const organizationId = getCtxOrganizationId(ctx);

      await assertOrganizationFeatureEnabled(
        organizationId,
        "allowSettlementReport",
        "현재 회사는 정산 리포트 기능을 사용할 수 없습니다."
      );

      const lock = await db.unlockSettlementMonth({
        organizationId,
        year: input.year,
        month: input.month,
        actorUserId: Number(ctx.user.id),
        reason: input.reason,
      });

      return {
        success: true,
        lock,
      };
    }),

  report: hostProcedure
    .input(
      z.object({
        year: z.number(),
        month: z.number(),
        assigneeId: z.number().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
     const organizationId = getCtxOrganizationId(ctx);

      await assertOrganizationFeatureEnabled(
        organizationId,
        "allowSettlementReport",
        "현재 회사는 정산 리포트 기능을 사용할 수 없습니다."
      );

           return db.getSettlementReport(input.year, input.month, input.assigneeId, {
        organizationId,
      });
    }),

  customerTypeSummary: hostProcedure
    .input(
      z.object({
        year: z.number(),
        month: z.number(),
        assigneeId: z.number().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const organizationId = getCtxOrganizationId(ctx);

      await assertOrganizationFeatureEnabled(
        organizationId,
        "allowSettlementReport",
        "현재 회사는 정산 리포트 기능을 사용할 수 없습니다."
      );

      return db.getSettlementCustomerTypeSummary({
        organizationId,
        year: input.year,
        month: input.month,
        assigneeId: input.assigneeId,
      });
    }),

    entries: hostProcedure
    .input(
      z.object({
        year: z.number(),
        month: z.number(),
        assigneeId: z.number().optional(),
        customerType: z
          .enum(["new", "existing"])
          .optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const organizationId = getCtxOrganizationId(ctx);

      await assertOrganizationFeatureEnabled(
        organizationId,
        "allowSettlementReport",
        "현재 회사는 정산 리포트 기능을 사용할 수 없습니다."
      );

      return db.getSettlementEntries({
        organizationId,
        year: input.year,
        month: input.month,
        assigneeId: input.assigneeId,
        customerType: input.customerType,
      });
    }),

  institutionSummary: hostProcedure
    .input(
      z.object({
        year: z.number(),
        month: z.number(),
      })
    )
    .query(async ({ input, ctx }) => {
      const organizationId = getCtxOrganizationId(ctx);

      await assertOrganizationFeatureEnabled(
        organizationId,
        "allowSettlementReport",
        "현재 회사는 정산 리포트 기능을 사용할 수 없습니다."
      );

      return db.getSettlementInstitutionSummary({
        year: input.year,
        month: input.month,
        organizationId,
      } as any);
    }),

  institutionEntries: hostProcedure
    .input(
      z.object({
        year: z.number(),
        month: z.number(),
        institutionName: z.string().min(1),
      })
    )
    .query(async ({ input, ctx }) => {
      const organizationId = getCtxOrganizationId(ctx);

      await assertOrganizationFeatureEnabled(
        organizationId,
        "allowSettlementReport",
        "현재 회사는 정산 리포트 기능을 사용할 수 없습니다."
      );

      return db.getSettlementInstitutionEntries({
        year: input.year,
        month: input.month,
        institutionName: input.institutionName,
        organizationId,
      } as any);
    }),

  institutionMonthlyTrend: hostProcedure
    .input(
      z.object({
        year: z.number(),
      })
    )
    .query(async ({ input, ctx }) => {
      const organizationId = getCtxOrganizationId(ctx);

      await assertOrganizationFeatureEnabled(
        organizationId,
        "allowSettlementReport",
        "현재 회사는 정산 리포트 기능을 사용할 수 없습니다."
      );

      return db.getSettlementInstitutionMonthlyTrend({
        year: input.year,
        organizationId,
      } as any);
    }),

  downloadPayslipExcel: hostProcedure
    .input(
      z.object({
        year: z.number(),
        month: z.number(),
        assigneeId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = getCtxOrganizationId(ctx);

      await assertOrganizationFeatureEnabled(
        organizationId,
        "allowSettlementReport",
        "현재 회사는 정산 리포트 기능을 사용할 수 없습니다."
      );

      const payslipData = await db.getSettlementPayslip({
        year: input.year,
        month: input.month,
        assigneeId: input.assigneeId,
        organizationId,
      } as any);

      const { fileName, buffer } = await buildSettlementPayslipExcel(payslipData);

      const base64 = Buffer.from(buffer).toString("base64");

      return {
        success: true,
        fileName,
        base64,
      };
    }),

  downloadSalesSummaryExcel: hostProcedure
    .input(
      z.object({
        year: z.number(),
        month: z.number(),
        assigneeId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = getCtxOrganizationId(ctx);

      await assertOrganizationFeatureEnabled(
        organizationId,
        "allowSettlementReport",
        "현재 회사는 정산 리포트 기능을 사용할 수 없습니다."
      );

      const settlementData = await db.getSettlementEntries({
        organizationId,
        year: input.year,
        month: input.month,
        assigneeId: input.assigneeId,
      });

      const entries = settlementData?.entries || [];

      const assigneeName =
        String(entries[0]?.assigneeName || "").trim() ||
        `담당자_${input.assigneeId}`;

      const { fileName, buffer, rowCount } =
        await buildSettlementSalesSummaryExcel({
          year: input.year,
          month: input.month,
          assigneeName,
          entries,
        });

      const base64 = Buffer.from(buffer).toString("base64");

      return {
        success: true,
        fileName,
        base64,
        rowCount,
      };
    }),

  payslip: hostProcedure
    .input(
      z.object({
        year: z.number(),
        month: z.number(),
        assigneeId: z.number(),
      })
    )
    .query(async ({ input, ctx }) => {
      const organizationId = getCtxOrganizationId(ctx);

      await assertOrganizationFeatureEnabled(
        organizationId,
        "allowSettlementReport",
        "현재 회사는 정산 리포트 기능을 사용할 수 없습니다."
      );

      return db.getSettlementPayslip({
        year: input.year,
        month: input.month,
        assigneeId: input.assigneeId,
        organizationId,
      } as any);
    }),
}),


  superhost: router({
  /**
   * 슈퍼호스트 홈 대시보드
   */
  dashboard: superHostProcedure.query(async () => {
    return {
      success: true,
      sections: [
        { key: "tenants", label: "테넌트 관리", status: "준비중" },
        { key: "layoutBuilder", label: "레이아웃 빌더", status: "준비중" },
        { key: "aiPolicy", label: "AI 정책 관리", status: "준비중" },
        { key: "security", label: "보안 분리", status: "진행중" },
      ],
    };
  }),

  /**
   * SaaS 기준:
   * superhost는 플랫폼 운영자일 뿐,
   * 각 회사 직원 계정은 각 회사 host가 직접 관리한다.
   */
  createUser: superHostProcedure
    .input(
      z.object({
        openId: z.string().min(1),
        username: z.string().min(1),
        password: z.string().min(4),
        name: z.string().min(1),
        email: z.string().optional(),
        phone: z.string().optional(),
        role: z.enum(["staff", "admin", "host", "superhost"]).default("staff"),
        bankName: z.string().optional(),
        bankAccount: z.string().optional(),
      })
    )
    .mutation(async () => {
      throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "SaaS 운영자는 각 회사 직원을 직접 생성할 수 없습니다.",
  403
);
    }),

  /**
   * SaaS 기준:
   * 각 회사 직원 권한 변경은 해당 회사 host가 처리한다.
   */
  updateUserRole: superHostProcedure
    .input(
      z.object({
        id: z.number(),
        role: z.enum(["staff", "admin", "host", "superhost"]),
      })
    )
    .mutation(async () => {
      throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "SaaS 운영자는 각 회사 직원 권한을 직접 변경할 수 없습니다.",
  403
);
    }),

  /**
   * SaaS 기준:
   * superhost도 전체 회사 직원 목록을 볼 수 없다.
   */
  listUsers: superHostProcedure.query(async () => {
    throwAppError(
  ERROR_CODES.PERMISSION_DENIED,
  "SaaS 운영자는 각 회사 직원을 직접 조회할 수 없습니다.",
  403
);
  }),

  /**
   * superhost용 AI 정책 더미
   * 나중에 ai_policies 같은 테이블 생기면 연결
   */
  aiPolicy: router({
    get: superHostProcedure.query(async () => {
      return {
        success: true,
        policy: {
          allowSearch: true,
          allowCreateTransferSubject: true,
          allowCreatePlanSemester: true,
          allowDelete: false,
          allowSchemaChange: false,
          allowServerEdit: false,
        },
      };
    }),

        update: superHostProcedure
      .input(
        z.object({
          allowSearch: z.boolean(),
          allowCreateTransferSubject: z.boolean(),
          allowCreatePlanSemester: z.boolean(),
          allowDelete: z.boolean(),
          allowSchemaChange: z.boolean(),
          allowServerEdit: z.boolean(),
        })
      )
      .mutation(async ({ input }) => {
        return {
          success: true,
          policy: input,
        };
      }),
  }),
  }),
});


export type AppRouter = typeof appRouter;