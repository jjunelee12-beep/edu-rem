import { getDb } from "../db";
import {
  aiActionLogs,
} from "../../drizzle/schema";

import type {
  AiAuditPayload,
  AiToolStatus,
  AiUserContext,
} from "./ai.types";

function safeJsonStringify(
  value: unknown,
  maxLength = 50000
) {
  try {
    const json = JSON.stringify(
      value ?? null
    );

    if (json.length <= maxLength) {
      return json;
    }

    return JSON.stringify({
      truncated: true,
      originalLength: json.length,
      preview: json.slice(0, maxLength),
    });
  } catch (error) {
    return JSON.stringify({
      serializationFailed: true,
      message:
        error instanceof Error
          ? error.message
          : String(error),
    });
  }
}

function maskSensitiveValue(
  key: string,
  value: unknown
): unknown {
  const normalizedKey = key
    .toLowerCase()
    .replace(/[_-]/g, "");

  const sensitiveKeys = [
    "password",
    "passwordhash",
    "token",
    "apikey",
    "secret",
    "authorization",
    "cookie",
    "residentnumber",
    "ssn",
    "bankaccount",
  ];

  if (
    sensitiveKeys.some((item) =>
      normalizedKey.includes(item)
    )
  ) {
    return "[REDACTED]";
  }

  return value;
}

function sanitizeAuditValue(
  value: unknown,
  depth = 0
): unknown {
  if (depth > 6) {
    return "[MAX_DEPTH]";
  }

  if (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, 100)
      .map((item) =>
        sanitizeAuditValue(item, depth + 1)
      );
  }

  if (typeof value === "object") {
    const result: Record<string, unknown> =
      {};

    for (const [key, rawValue] of Object.entries(
      value as Record<string, unknown>
    )) {
      const masked = maskSensitiveValue(
        key,
        rawValue
      );

      result[key] =
        masked === "[REDACTED]"
          ? masked
          : sanitizeAuditValue(
              masked,
              depth + 1
            );
    }

    return result;
  }

  return String(value);
}

export function createAiRequestId() {
  return [
    "ai",
    Date.now(),
    Math.random()
      .toString(36)
      .slice(2, 10),
  ].join("-");
}

export function createAiAuditPayload(params: {
  context: AiUserContext;
  requestId: string;
  toolName: string;
  status: AiToolStatus;

  input?: unknown;
  outputSummary?: unknown;

  startedAt: string;
  finishedAt?: string;
  durationMs?: number;

  errorMessage?: string | null;
}): AiAuditPayload {
  return {
    requestId: params.requestId,
    toolName: params.toolName,
    status: params.status,

    input: sanitizeAuditValue(
      params.input
    ),

    outputSummary: sanitizeAuditValue(
      params.outputSummary
    ),

    role: params.context.role,
    scope: params.context.scope,
    teamId: params.context.teamId,
    allowedAssigneeIds:
      params.context.allowedAssigneeIds,

    startedAt: params.startedAt,
    finishedAt: params.finishedAt,
    durationMs: params.durationMs,

    errorMessage:
      params.errorMessage || null,
  };
}

export async function writeAiAuditLog(params: {
  context: AiUserContext;

  requestId: string;
  toolName: string;
  status: AiToolStatus;

  input?: unknown;
  outputSummary?: unknown;

  targetStudentId?: number | null;
  targetStudentName?: string | null;

  startedAt: string;
  finishedAt?: string;
  durationMs?: number;

  errorMessage?: string | null;
}) {
  const db = await getDb();

  if (!db) {
    /**
     * AI 본 작업이 로그 실패 때문에 중단되면 안 되므로
     * 감사로그 실패는 콘솔에만 남긴다.
     */
    console.error(
      "[AI AUDIT] DB not available",
      {
        requestId: params.requestId,
        toolName: params.toolName,
      }
    );

    return null;
  }

  const payload =
    createAiAuditPayload({
      context: params.context,
      requestId: params.requestId,
      toolName: params.toolName,
      status: params.status,

      input: params.input,
      outputSummary:
        params.outputSummary,

      startedAt: params.startedAt,
      finishedAt: params.finishedAt,
      durationMs: params.durationMs,

      errorMessage:
        params.errorMessage,
    });

  try {
    const result: any = await db
      .insert(aiActionLogs)
      .values({
        organizationId:
          params.context.organizationId,

        userId: params.context.userId,
        userName:
          params.context.userName,

        action: params.toolName,

        targetStudentId:
          params.targetStudentId ??
          null,

        targetStudentName:
          params.targetStudentName ??
          null,

        payload:
          safeJsonStringify(payload),
      } as any);

    return (
      result?.insertId ??
      result?.[0]?.insertId ??
      null
    );
  } catch (error) {
    console.error(
      "[AI AUDIT] 로그 저장 실패",
      {
        requestId: params.requestId,
        toolName: params.toolName,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      }
    );

    return null;
  }
}

/**
 * 결과 전체를 로그에 넣으면 개인정보와 용량 문제가 생길 수 있다.
 * 로그에는 개수와 식별 정보 정도만 남긴다.
 */
export function summarizeAiToolOutput(
  output: unknown
): unknown {
  if (
    output === null ||
    output === undefined
  ) {
    return null;
  }

  if (Array.isArray(output)) {
    return {
      type: "array",
      count: output.length,
    };
  }

  if (typeof output !== "object") {
    return output;
  }

  const objectOutput =
    output as Record<string, any>;

  const summary: Record<string, unknown> =
    {};

  const safeSummaryKeys = [
    "success",
    "count",
    "query",
    "mode",
    "message",
    "summary",
    "studentId",
    "riskLevel",
    "riskScore",
    "issueCount",
  ];

  for (const key of safeSummaryKeys) {
    if (
      objectOutput[key] !== undefined
    ) {
      summary[key] =
        sanitizeAuditValue(
          objectOutput[key]
        );
    }
  }

  if (
    Array.isArray(objectOutput.students)
  ) {
    summary.studentCount =
      objectOutput.students.length;
  }

  if (
    Array.isArray(
      objectOutput.consultations
    )
  ) {
    summary.consultationCount =
      objectOutput.consultations.length;
  }

  if (
    Array.isArray(objectOutput.items)
  ) {
    summary.itemCount =
      objectOutput.items.length;
  }

  if (
    Object.keys(summary).length === 0
  ) {
    return {
      type: "object",
      keys: Object.keys(
        objectOutput
      ).slice(0, 30),
    };
  }

  return summary;
}