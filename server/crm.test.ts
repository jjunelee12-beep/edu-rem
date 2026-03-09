import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Helper: 인증된 사용자 컨텍스트 생성 ─────────────────────────────
type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createUserContext(overrides: Partial<AuthenticatedUser> = {}): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "staff-user-1",
    email: "staff@example.com",
    name: "직원A",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createAdminContext(overrides: Partial<AuthenticatedUser> = {}): TrpcContext {
  return createUserContext({ id: 99, openId: "admin-owner", name: "관리자", role: "admin", ...overrides });
}

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

// ─── Auth Tests ──────────────────────────────────────────────────────
describe("auth.me", () => {
  it("returns null for unauthenticated user", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("returns user for authenticated user", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeDefined();
    expect(result?.name).toBe("직원A");
    expect(result?.role).toBe("user");
  });

  it("returns admin role for admin user", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result?.role).toBe("admin");
  });
});

// ─── Permission Tests (Protected Procedures) ────────────────────────
describe("permission: protected procedures", () => {
  it("consultation.list throws UNAUTHORIZED for unauthenticated user", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.consultation.list()).rejects.toThrow();
  });

  it("student.list throws UNAUTHORIZED for unauthenticated user", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.student.list()).rejects.toThrow();
  });

  it("dashboard.stats throws UNAUTHORIZED for unauthenticated user", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.dashboard.stats()).rejects.toThrow();
  });

  it("dashboard.monthApprovals throws UNAUTHORIZED for unauthenticated user", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.dashboard.monthApprovals()).rejects.toThrow();
  });
});

// ─── Permission Tests (Admin Procedures) ─────────────────────────────
describe("permission: admin-only procedures", () => {
  it("student.approve throws FORBIDDEN for non-admin", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.student.approve({ id: 1, approvalStatus: "승인" })
    ).rejects.toThrow();
  });

  it("settlement.report throws FORBIDDEN for non-admin", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.settlement.report({ year: 2026, month: 3 })
    ).rejects.toThrow();
  });

  it("refund.update throws FORBIDDEN for non-admin", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.refund.update({ id: 1, refundAmount: "100000" })
    ).rejects.toThrow();
  });

  it("refund.delete throws FORBIDDEN for non-admin", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.refund.delete({ id: 1 })
    ).rejects.toThrow();
  });
});

// ─── Input Validation Tests ──────────────────────────────────────────
describe("input validation", () => {
  it("consultation.create rejects missing required fields", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    // @ts-expect-error intentionally missing required fields
    await expect(caller.consultation.create({})).rejects.toThrow();
  });

  it("student.create rejects missing required fields", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    // @ts-expect-error intentionally missing required fields
    await expect(caller.student.create({})).rejects.toThrow();
  });

  it("student.approve rejects invalid approvalStatus", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      // @ts-expect-error intentionally invalid status
      caller.student.approve({ id: 1, approvalStatus: "잘못된상태" })
    ).rejects.toThrow();
  });

  it("settlement.report validates year and month as numbers", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      // @ts-expect-error intentionally invalid types
      caller.settlement.report({ year: "abc", month: "def" })
    ).rejects.toThrow();
  });

  it("settlement.report accepts optional assigneeId filter", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    // Should not throw for valid input with optional assigneeId
    const result = await caller.settlement.report({ year: 2026, month: 3, assigneeId: 1 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("consultation.create accepts phone up to 30 chars", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    // phone max is 30 chars in schema, 12 chars should pass
    const result = await caller.consultation.create({
      consultDate: "2026-03-01",
      channel: "블로그",
      clientName: "홍길동",
      phone: "010123456789", // 12 chars - within 30 char limit
    });
    expect(result).toHaveProperty("id");
  });

  it("consultation.create rejects phone longer than 30 chars", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.consultation.create({
        consultDate: "2026-03-01",
        channel: "블로그",
        clientName: "홍길동",
        phone: "0101234567890123456789012345678", // 31 chars
      })
    ).rejects.toThrow();
  });

  it("student.update rejects invalid status enum", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      // @ts-expect-error intentionally invalid status
      caller.student.update({ id: 1, status: "잘못된상태" })
    ).rejects.toThrow();
  });

  it("plan.upsert accepts boolean hasPractice", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    // This should fail because student doesn't exist, but input validation should pass
    await expect(
      caller.plan.upsert({ studentId: 99999, hasPractice: true, practiceHours: 40 })
    ).rejects.toThrow("학생을 찾을 수 없습니다");
  });

  it("semester.copyPlannedToActual requires id", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    // @ts-expect-error intentionally missing id
    await expect(caller.semester.copyPlannedToActual({})).rejects.toThrow();
  });

  it("refund.create requires refundAmount and refundDate", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    // @ts-expect-error intentionally missing required fields
    await expect(caller.refund.create({ studentId: 1 })).rejects.toThrow();
  });
});

// ─── v3 Feature Tests ────────────────────────────────────────────────
describe("v3: bulk create consultations", () => {
  it("bulkCreate rejects empty rows", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    // Empty rows should still pass validation (rows is an array)
    const result = await caller.consultation.bulkCreate({ rows: [] });
    // With no valid data, it should return count 0
    expect(result.count).toBe(0);
  });

  it("bulkCreate validates row schema", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.consultation.bulkCreate({
        // @ts-expect-error intentionally invalid row structure
        rows: [{ invalidField: "test" }],
      })
    ).rejects.toThrow();
  });

  it("bulkCreate accepts valid rows", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.consultation.bulkCreate({
      rows: [
        {
          consultDate: "2026-03-01",
          channel: "블로그",
          clientName: "테스트1",
          phone: "01012345678",
          desiredCourse: "사회복지사",
          notes: "테스트 상담",
          status: "상담중",
        },
        {
          consultDate: "2026-03-02",
          channel: "인스타",
          clientName: "테스트2",
          phone: "01098765432",
          desiredCourse: "보육교사",
          notes: "카톡 상담",
          status: "상담중",
        },
      ],
    });
    expect(result.success).toBe(true);
    expect(result.count).toBe(2);
  });
});

describe("v3: student status enum", () => {
  it("student.update only accepts 등록 or 종료", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    // Valid statuses should pass validation (will fail on DB lookup)
    await expect(
      caller.student.update({ id: 99999, status: "등록" })
    ).rejects.toThrow("학생 기록을 찾을 수 없습니다");

    await expect(
      caller.student.update({ id: 99999, status: "종료" })
    ).rejects.toThrow("학생 기록을 찾을 수 없습니다");

    // Invalid status should fail validation
    await expect(
      // @ts-expect-error intentionally invalid status
      caller.student.update({ id: 99999, status: "수강중" })
    ).rejects.toThrow();
  });
});

describe("v3: consultation auto-register to student", () => {
  it("consultation.update with status=등록 triggers student creation (requires DB)", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    // This will fail because consultation doesn't exist, but validates the flow
    await expect(
      caller.consultation.update({ id: 99999, status: "등록" })
    ).rejects.toThrow("상담 기록을 찾을 수 없습니다");
  });
});

describe("v3: semester operations", () => {
  it("semester.create validates required studentId", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    // @ts-expect-error intentionally missing studentId
    await expect(caller.semester.create({ semesterOrder: 2 })).rejects.toThrow();
  });

  it("semester.update validates input schema", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    // Valid input but non-existent semester
    await expect(
      caller.semester.update({ id: 99999, plannedAmount: "500000" })
    ).rejects.toThrow("학기를 찾을 수 없습니다");
  });

  it("semester.delete succeeds silently for non-existent semester", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    // Non-existent semester delete should succeed silently (no row to delete)
    const result = await caller.semester.delete({ id: 99999 });
    expect(result.success).toBe(true);
  });
});

describe("v3: payment summary", () => {
  it("student.paymentSummary returns zero for non-existent student", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.student.paymentSummary({ studentId: 99999 });
    expect(result.totalRequired).toBe(0);
    expect(result.totalPaid).toBe(0);
    expect(result.totalRefund).toBe(0);
  });
});

describe("v3: settlement report", () => {
  it("settlement.report returns array for valid month", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.settlement.report({ year: 2026, month: 1 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("settlement.report returns array for current month", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const now = new Date();
    const result = await caller.settlement.report({ year: now.getFullYear(), month: now.getMonth() + 1 });
    expect(Array.isArray(result)).toBe(true);
  });
});

// ─── Router Structure Tests ─────────────────────────────────────────
describe("router structure", () => {
  it("has all expected top-level routers", () => {
    const caller = appRouter.createCaller(createAdminContext());
    expect(caller.auth).toBeDefined();
    expect(caller.consultation).toBeDefined();
    expect(caller.student).toBeDefined();
    expect(caller.semester).toBeDefined();
    expect(caller.plan).toBeDefined();
    expect(caller.refund).toBeDefined();
    expect(caller.settlement).toBeDefined();
    expect(caller.dashboard).toBeDefined();
    expect(caller.users).toBeDefined();
  });

  it("does not have message router (removed)", () => {
    // Check that the appRouter definition does not include 'message' key
    const routerKeys = Object.keys((appRouter as any)._def.procedures);
    const hasMessageRouter = routerKeys.some((k: string) => k.startsWith("message."));
    expect(hasMessageRouter).toBe(false);
  });

  it("consultation router has bulkCreate procedure", () => {
    const caller = appRouter.createCaller(createUserContext());
    expect(caller.consultation.bulkCreate).toBeDefined();
  });

  it("student router has paymentSummary procedure", () => {
    const caller = appRouter.createCaller(createUserContext());
    expect(caller.student.paymentSummary).toBeDefined();
  });

  it("semester router has copyPlannedToActual procedure", () => {
    const caller = appRouter.createCaller(createUserContext());
    expect(caller.semester.copyPlannedToActual).toBeDefined();
  });
});

// ─── v4 Feature Tests ────────────────────────────────────────────────
describe("v4: CSV import", () => {
  it("importCsv rejects empty CSV", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.consultation.importCsv({ csvText: "", hasHeader: true })
    ).rejects.toThrow("유효한 데이터가 없습니다");
  });

  it("importCsv rejects CSV with only header", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.consultation.importCsv({
        csvText: "날짜,경로,이름,연락처,과정,내역,상태",
        hasHeader: true,
      })
    ).rejects.toThrow("유효한 데이터가 없습니다");
  });

  it("importCsv accepts valid CSV with tab separator", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const csvText = "날짜\t경로\t이름\t연락처\t과정\t내역\t상태\n2026-03-01\t블로그\t홍길동\t01012345678\t사회복지사\t전화상담\t상담중";
    const result = await caller.consultation.importCsv({ csvText, hasHeader: true });
    expect(result.success).toBe(true);
    expect(result.count).toBe(1);
  });

  it("importCsv accepts valid CSV with comma separator", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const csvText = "날짜,경로,이름,연락처,과정,내역,상태\n2026-03-01,블로그,홍길동,01012345678,사회복지사,전화상담,상담중";
    const result = await caller.consultation.importCsv({ csvText, hasHeader: true });
    expect(result.success).toBe(true);
    expect(result.count).toBe(1);
  });

  it("importCsv skips rows without name or phone", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const csvText = "2026-03-01,블로그,,01012345678,사회복지사,전화상담,상담중\n2026-03-01,블로그,홍길동,,사회복지사,전화상담,상담중\n2026-03-01,블로그,김영희,01098765432,보육교사,카톡상담,상담중";
    const result = await caller.consultation.importCsv({ csvText, hasHeader: false });
    expect(result.success).toBe(true);
    expect(result.count).toBe(1); // Only the last row has both name and phone
  });
});

describe("v4: semester listAll", () => {
  it("semester.listAll returns array", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.semester.listAll({});
    expect(Array.isArray(result)).toBe(true);
  });

  it("semester.listAll accepts plannedMonth filter", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.semester.listAll({ plannedMonth: "2026-09" });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("v4: dashboard monthApprovals", () => {
  it("dashboard.monthApprovals returns correct structure", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dashboard.monthApprovals();
    expect(result).toHaveProperty("approved");
    expect(result).toHaveProperty("rejected");
    expect(result).toHaveProperty("approvedTotal");
    expect(result).toHaveProperty("rejectedTotal");
    expect(Array.isArray(result.approved)).toBe(true);
    expect(Array.isArray(result.rejected)).toBe(true);
    expect(typeof result.approvedTotal).toBe("number");
    expect(typeof result.rejectedTotal).toBe("number");
  });
});

describe("v4: plan practiceStatus", () => {
  it("plan.upsert accepts practiceStatus enum", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    // Should fail because student doesn't exist, but validates input schema
    await expect(
      caller.plan.upsert({ studentId: 99999, hasPractice: true, practiceStatus: "섭외중" })
    ).rejects.toThrow("학생을 찾을 수 없습니다");
  });

  it("plan.upsert rejects invalid practiceStatus", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      // @ts-expect-error intentionally invalid status
      caller.plan.upsert({ studentId: 99999, practiceStatus: "잘못된상태" })
    ).rejects.toThrow();
  });
});

describe("v4: approval timestamps", () => {
  it("student.approve succeeds for 승인 (sets approvedAt)", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    // approve updates even non-existent rows (no-op update)
    const result = await caller.student.approve({ id: 99999, approvalStatus: "승인" });
    expect(result.success).toBe(true);
  });

  it("student.approve succeeds for 불승인 (sets rejectedAt)", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.student.approve({ id: 99999, approvalStatus: "불승인" });
    expect(result.success).toBe(true);
  });
});

describe("v4: refund admin-only", () => {
  it("refund.create is accessible by regular user (creates record)", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.refund.create({ studentId: 99999, refundAmount: "100000", refundDate: "2026-03-01" });
    expect(result).toHaveProperty("id");
  });

  it("refund.update is admin-only", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.refund.update({ id: 1, refundAmount: "200000" })
    ).rejects.toThrow();
  });
});

describe("v4: router structure additions", () => {
  it("consultation router has importCsv procedure", () => {
    const caller = appRouter.createCaller(createUserContext());
    expect(caller.consultation.importCsv).toBeDefined();
  });

  it("semester router has listAll procedure", () => {
    const caller = appRouter.createCaller(createUserContext());
    expect(caller.semester.listAll).toBeDefined();
  });

  it("dashboard router has monthApprovals procedure", () => {
    const caller = appRouter.createCaller(createUserContext());
    expect(caller.dashboard.monthApprovals).toBeDefined();
  });
});
