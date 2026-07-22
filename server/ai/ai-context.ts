import { and, eq } from "drizzle-orm";

import { getDb, getUserTeamMemberIds } from "../db";
import {
  userOrgMappings,
} from "../../drizzle/schema";

import type {
  AiDataScope,
  AiRole,
  AiUserContext,
  BuildAiContextInput,
} from "./ai.types";

function normalizePositiveInteger(
  value: unknown
): number | null {
  const normalized = Number(value);

  if (
    !Number.isFinite(normalized) ||
    normalized <= 0
  ) {
    return null;
  }

  return Math.floor(normalized);
}

function normalizeRole(value: unknown): AiRole {
  const role = String(value || "")
    .trim()
    .toLowerCase();

  if (
    role === "staff" ||
    role === "admin" ||
    role === "host" ||
    role === "superhost"
  ) {
    return role;
  }

  throw new Error(
    "AI Context를 생성할 수 없는 사용자 권한입니다."
  );
}

function resolveScope(role: AiRole): AiDataScope {
  if (role === "staff") return "self";
  if (role === "admin") return "team";
  if (role === "host") return "organization";
  return "system";
}

async function getUserOrganizationMapping(params: {
  userId: number;
  organizationId: number;
}) {
  const db = await getDb();

  if (!db) {
    throw new Error("DB not available");
  }

  const rows = await db
    .select({
      teamId: userOrgMappings.teamId,
      positionId: userOrgMappings.positionId,
    })
    .from(userOrgMappings)
    .where(
      and(
        eq(
          userOrgMappings.userId,
          params.userId
        ),
        eq(
          userOrgMappings.organizationId,
          params.organizationId
        )
      )
    )
    .limit(1);

  return rows[0] || null;
}

function resolveOrganizationId(params: {
  user: any;
  role: AiRole;
  targetOrganizationId?: number | null;
}) {
  const sessionOrganizationId =
    normalizePositiveInteger(
      params.user?.organizationId ??
        params.user?.organization_id ??
        params.user?.organization?.id
    );

  const targetOrganizationId =
    normalizePositiveInteger(
      params.targetOrganizationId
    );

  /**
   * Superhost는 아무 회사 데이터나 자동으로 읽으면 안 된다.
   *
   * 반드시 AI 실행 요청에서 대상 회사가 명시되어야 한다.
   */
  if (params.role === "superhost") {
    if (!targetOrganizationId) {
      throw new Error(
        "슈퍼호스트 AI 조회는 대상 회사를 먼저 선택해야 합니다."
      );
    }

    return targetOrganizationId;
  }

  if (!sessionOrganizationId) {
    throw new Error(
      "소속 회사 정보를 확인할 수 없습니다."
    );
  }

  /**
   * 일반 사용자가 targetOrganizationId를 넘기더라도
   * 세션 organizationId만 사용한다.
   */
  return sessionOrganizationId;
}

async function resolveAllowedAssigneeIds(params: {
  role: AiRole;
  userId: number;
  organizationId: number;
  teamId: number | null;
}) {
  if (params.role === "staff") {
    return [params.userId];
  }

  if (params.role === "admin") {
    if (!params.teamId) {
      /**
       * Admin인데 팀이 배정되지 않은 경우
       * 회사 전체가 노출되면 안 되므로 본인만 허용한다.
       */
      return [params.userId];
    }

    const teamMemberIds =
      await getUserTeamMemberIds(
        params.userId,
        {
          organizationId:
            params.organizationId,
        }
      );

    const normalizedIds = Array.from(
      new Set(
        (teamMemberIds || [])
          .map((id: unknown) => Number(id))
          .filter(
            (id: number) =>
              Number.isFinite(id) && id > 0
          )
      )
    );

    /**
     * 팀 조회 결과가 비어도 현재 Admin 본인은 포함시킨다.
     */
    if (
      !normalizedIds.includes(params.userId)
    ) {
      normalizedIds.push(params.userId);
    }

    return normalizedIds;
  }

  /**
   * Host / Superhost
   * null은 선택 회사 전체 담당자를 의미한다.
   */
  return null;
}

export async function buildAiContext(
  input: BuildAiContextInput
): Promise<AiUserContext> {
  const user = input.user;

  if (!user) {
    throw new Error(
      "AI 기능을 사용하려면 로그인이 필요합니다."
    );
  }

  const userId = normalizePositiveInteger(user.id);

  if (!userId) {
    throw new Error(
      "로그인 사용자 ID를 확인할 수 없습니다."
    );
  }

  const role = normalizeRole(user.role);

  const organizationId =
    resolveOrganizationId({
      user,
      role,
      targetOrganizationId:
        input.targetOrganizationId,
    });

  const mapping =
    await getUserOrganizationMapping({
      userId,
      organizationId,
    });

  const teamId =
    normalizePositiveInteger(mapping?.teamId);

  const positionId =
    normalizePositiveInteger(
      mapping?.positionId
    );

  const allowedAssigneeIds =
    await resolveAllowedAssigneeIds({
      role,
      userId,
      organizationId,
      teamId,
    });

  const userName =
    String(
      user.name ||
        user.username ||
        ""
    ).trim() || null;

 return {
  userId,
  userName,
  role,
  organizationId,

  teamId,
  positionId,

  scope: resolveScope(role),
  allowedAssigneeIds,

  /**
   * AI 쓰기 권한
   *
   * Staff:
   * 본인 담당 상담DB를 학생으로 전환하는
   * Pending Action 승인 실행만 허용한다.
   *
   * Admin / Host:
   * 추후 역할별 쓰기 기능을 추가할 때 확장한다.
   *
   * Superhost:
   * 회사 학생 데이터를 직접 생성하지 못하도록 차단한다.
   */
  canWrite:
    role === "staff",

  /**
   * AI 삭제는 영구 금지
   */
  canDelete: false,

  isSuperhost:
    role === "superhost",

  createdAt:
    new Date().toISOString(),
};
}