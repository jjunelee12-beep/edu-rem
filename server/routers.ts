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
import { publicLeadRouter } from "./publicLead.router";
import bcrypt from "bcryptjs";
import { smsRouter } from "./_core/sms.router";
import Tesseract from "tesseract.js";
import OpenAI from "openai";
import { attendanceRouter } from "./attendance.router";
import { noticeRouter } from "./routes/notice.router";
import { scheduleRouter } from "./routes/schedule.router";
import { approvalRouter } from "./routes/approval.router";

function isAdminOrHost(user: any) {
  return (
    user?.role === "admin" ||
    user?.role === "host" ||
    user?.role === "superhost"
  );
}

function isSuperhost(user: any) {
  return user?.role === "superhost";
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
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

export const appRouter = router({
  system: systemRouter,
  leadForm: publicLeadRouter,
  sms: smsRouter,
attendance: attendanceRouter,
notice: noticeRouter,
schedule: scheduleRouter,
  approval: approvalRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, {
        ...cookieOptions,
        maxAge: -1,
      });
      return { success: true } as const;
    }),
  }),

  users: router({
  list: protectedProcedure.query(async () => {
    return db.getUsersWithOrg();
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

  changeMyPassword: protectedProcedure
    .input(
      z.object({
        newPassword: z.string().min(8),
        newPasswordConfirm: z.string().min(8),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.newPassword !== input.newPasswordConfirm) {
        throw new Error("새 비밀번호가 서로 일치하지 않습니다.");
      }

      return await db.changeMyPassword({
        userId: Number(ctx.user.id),
        newPassword: input.newPassword,
      });
    }),

  create: hostProcedure
    .input(
      z.object({
        openId: z.string().min(1),
        username: z.string().min(1),
        password: z.string().min(4),
        name: z.string().min(1),
        email: z.string().optional(),
        phone: z.string().optional(),
        role: z.enum(["staff", "admin", "host"]).default("staff"),
        bankName: z.string().optional(),
        bankAccount: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const passwordHash = await bcrypt.hash(input.password, 10);

      await db.createUserAccount({
        openId: input.openId.trim(),
        username: input.username.trim(),
        passwordHash,
        name: input.name.trim(),
        email: input.email?.trim() || null,
        phone: input.phone?.trim() || null,
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

      let passwordHash: string | undefined = undefined;

      if (password !== undefined && password.trim() !== "") {
        passwordHash = await bcrypt.hash(password, 10);
      }

      await db.updateUserAccountProtected({
        actorRole: ctx.user.role,
        targetUserId: id,
        data: {
          username: rest.username?.trim(),
          name: rest.name?.trim(),
          email: rest.email?.trim(),
          phone: rest.phone?.trim(),
          bankName: rest.bankName?.trim(),
          bankAccount: rest.bankAccount?.trim(),
          passwordHash,
        },
      });

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
      await db.updateUserRoleProtected({
        actorRole: ctx.user.role,
        targetUserId: input.id,
        role: input.role,
      });

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
      await db.updateUserActiveProtected({
        actorRole: ctx.user.role,
        targetUserId: input.id,
        isActive: input.isActive,
      });

      return { success: true };
    }),
}),

org: router({
  teams: router({
    list: protectedProcedure.query(async () => {
      return db.listTeams();
    }),

    create: superHostProcedure
      .input(
        z.object({
          name: z.string().min(1),
          sortOrder: z.number().optional(),
          isActive: z.boolean().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const id = await db.createTeam({
          name: input.name,
          sortOrder: input.sortOrder ?? 0,
          isActive: input.isActive ?? true,
        });

        return { success: true, id };
      }),

    update: superHostProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          sortOrder: z.number().optional(),
          isActive: z.boolean().optional(),
        })
      )
      .mutation(async ({ input }) => {
        await db.updateTeam(input.id, {
          name: input.name,
          sortOrder: input.sortOrder,
          isActive: input.isActive,
        });

        return { success: true };
      }),

    delete: superHostProcedure
      .input(
        z.object({
          id: z.number(),
        })
      )
      .mutation(async ({ input }) => {
        await db.deleteTeam(input.id);
        return { success: true };
      }),
  }),

  positions: router({
    list: protectedProcedure.query(async () => {
      return db.listPositions();
    }),

    create: superHostProcedure
      .input(
        z.object({
          name: z.string().min(1),
          sortOrder: z.number().optional(),
          isActive: z.boolean().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const id = await db.createPosition({
          name: input.name,
          sortOrder: input.sortOrder ?? 0,
          isActive: input.isActive ?? true,
        });

        return { success: true, id };
      }),

    update: superHostProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          sortOrder: z.number().optional(),
          isActive: z.boolean().optional(),
        })
      )
      .mutation(async ({ input }) => {
        await db.updatePosition(input.id, {
          name: input.name,
          sortOrder: input.sortOrder,
          isActive: input.isActive,
        });

        return { success: true };
      }),

    delete: superHostProcedure
      .input(
        z.object({
          id: z.number(),
        })
      )
      .mutation(async ({ input }) => {
        await db.deletePosition(input.id);
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
      .query(async ({ input }) => {
        return db.getUserOrgMapping(input.userId);
      }),

    upsert: superHostProcedure
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
          actorRole: ctx.user.role,
          targetUserId: input.userId,
          teamId: input.teamId ?? null,
          positionId: input.positionId ?? null,
          sortOrder: input.sortOrder ?? 0,
        });

        return { success: true, id };
      }),

    delete: superHostProcedure
      .input(
        z.object({
          userId: z.number(),
        })
      )
      .mutation(async ({ input }) => {
        await db.deleteUserOrgMapping(input.userId);
        return { success: true };
      }),
  }),
}),

messenger: router({
  myRooms: protectedProcedure.query(async ({ ctx }) => {
    return db.listMyChatRooms(Number(ctx.user.id));
  }),

  directRoom: protectedProcedure
    .input(
      z.object({
        userId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const room = await db.getOrCreateDirectChatRoom({
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
      return db.listChatMessages(input.roomId, Number(ctx.user.id));
    }),

  members: protectedProcedure
    .input(
      z.object({
        roomId: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      return db.listChatRoomMembers(input.roomId, Number(ctx.user.id));
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
      const messageId = await db.createChatMessage({
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
      await db.markChatRoomRead({
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
    .mutation(async ({ input }) => {
      const id = await db.createChatAttachment({
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
    .query(async ({ input }) => {
      return db.listLeadForms(input.formType);
    }),

  create: hostProcedure
    .input(z.object({
      assigneeId: z.number(),
      formType: z.enum(["landing", "ad"]),
    }))
    .mutation(async ({ input }) => {
      return db.createLeadForm(input.assigneeId, input.formType);
    }),

  updateActive: hostProcedure
    .input(z.object({
      id: z.number(),
      isActive: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      return db.updateLeadFormActive(input.id, input.isActive);
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
        throw new Error("유효하지 않은 폼입니다.");
      }

      const id = await db.createConsultation({
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
    return db.listNotifications(Number(ctx.user.id));
  }),

  markRead: protectedProcedure
    .input(
      z.object({
        id: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await db.markNotificationRead(input.id, Number(ctx.user.id));
      return { success: true };
    }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    await db.markAllNotificationsRead(Number(ctx.user.id));
    return { success: true };
  }),
}),

branding: router({
  getPublic: publicProcedure.query(async () => {
    return db.getBrandingSettings();
  }),

  get: protectedProcedure.query(async () => {
    return db.getBrandingSettings();
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
        throw new Error("인증에 실패했습니다.");
      }

      const id = await db.upsertDeviceToken({
        userId: input.userId,
        platform: input.platform,
        expoPushToken: input.expoPushToken,
      });

      return { success: true, id };
    }),
}),

  educationInstitution: router({
    list: protectedProcedure.query(async () => {
      return db.listEducationInstitutions();
    }),

    create: hostProcedure
      .input(
        z.object({
          name: z.string().min(1),
          sortOrder: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const id = await db.createEducationInstitution({
          name: input.name.trim(),
          isActive: true,
          sortOrder: input.sortOrder ?? 0,
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
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...rest } = input;
        await db.updateEducationInstitution(id, rest);
        return { success: true };
      }),
  }),

  ai: router({
    /**
     * AI 페이지 초기 진입용
     * 현재 로그인 유저 기준으로 사용 가능 기능 요약
     */
    bootstrap: protectedProcedure.query(async ({ ctx }) => {
      return {
        success: true,
        user: {
          id: Number(ctx.user.id),
          name: ctx.user.name,
          role: ctx.user.role,
        },
        capabilities: {
          canSearchStudents: true,
          canSearchConsultations: true,
          canReadNotifications: true,
          canCreateTransferSubject: true,
          canCreatePlanSemester: true,
          canRecommendPracticePlace: true,
          canModifyServer: false,
          canDeleteData: false,
          canAlterSchema: false,
        },
      };
    }),

    /**
     * 학생 / 상담 자연어 검색용 1차 버전
     */
    search: protectedProcedure
      .input(
        z.object({
          query: z.string().min(1),
        })
      )
      .query(async ({ ctx, input }) => {
        const q = input.query.trim();
        const assigneeId = isAdminOrHost(ctx.user)
          ? undefined
          : Number(ctx.user.id) || 1;

        const [students, consultations] = await Promise.all([
          db.listStudents(assigneeId),
          db.listConsultations(assigneeId),
        ]);

        const qLower = q.toLowerCase();
        const qDigits = q.replace(/\D/g, "");

        const matchedStudents = (students || []).filter((item: any) => {
          return (
            String(item.clientName || "").toLowerCase().includes(qLower) ||
            String(item.phone || "").replace(/\D/g, "").includes(qDigits) ||
            String(item.course || "").toLowerCase().includes(qLower)
          );
        });

        const matchedConsultations = (consultations || []).filter((item: any) => {
          return (
            String(item.clientName || "").toLowerCase().includes(qLower) ||
            String(item.phone || "").replace(/\D/g, "").includes(qDigits) ||
            String(item.desiredCourse || "").toLowerCase().includes(qLower) ||
            String(item.notes || "").toLowerCase().includes(qLower)
          );
        });

        return {
          success: true,
          query: q,
          students: matchedStudents.slice(0, 20),
          consultations: matchedConsultations.slice(0, 20),
        };
      }),

    /**
     * AI 알림/누락 브리핑용
     */
    alerts: protectedProcedure.query(async ({ ctx }) => {
      const assigneeId = isAdminOrHost(ctx.user)
        ? undefined
        : Number(ctx.user.id) || 1;

      const [students, consultations, semesters] = await Promise.all([
        db.listStudents(assigneeId),
        db.listConsultations(assigneeId),
        db.listAllSemesters(assigneeId, undefined),
      ]);

      const paymentDateMissing = (students || []).filter(
        (s: any) => s.status === "등록" && !s.paymentDate
      );

      const paymentAmountMissing = (students || []).filter(
        (s: any) => s.status === "등록" && !s.paymentAmount
      );

      const consultationAssigneeMissing = (consultations || []).filter(
        (c: any) => !c.assigneeId
      );

      const practiceUnassigned = (semesters || []).filter(
        (s: any) => s.practiceStatus === "미섭외"
      );

      return {
        success: true,
        summary: {
          paymentDateMissingCount: paymentDateMissing.length,
          paymentAmountMissingCount: paymentAmountMissing.length,
          consultationAssigneeMissingCount: consultationAssigneeMissing.length,
          practiceUnassignedCount: practiceUnassigned.length,
        },
        items: {
          paymentDateMissing: paymentDateMissing.slice(0, 20),
          paymentAmountMissing: paymentAmountMissing.slice(0, 20),
          consultationAssigneeMissing: consultationAssigneeMissing.slice(0, 20),
          practiceUnassigned: practiceUnassigned.slice(0, 20),
        },
      };
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
        const student = await db.getStudent(input.studentId);
        if (!student) throw new Error("학생을 찾을 수 없습니다");

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          throw new Error("권한이 없습니다");
        }

        const existing = await db.listTransferSubjects(input.studentId);
        if ((existing?.length ?? 0) >= 100) {
          throw new Error("전적대 과목은 최대 100개까지 등록할 수 있습니다");
        }

        const id = await db.createTransferSubject({
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
    const student = await db.getStudent(input.studentId);
    if (!student) throw new Error("학생 없음");

    if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
      throw new Error("권한 없음");
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
        const student = await db.getStudent(input.studentId);
        if (!student) throw new Error("학생을 찾을 수 없습니다");

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          throw new Error("권한이 없습니다");
        }

        const existing = await db.listPlanSemesters(input.studentId);
        const semesterCount = existing.filter(
          (x: any) => Number(x.semesterNo) === Number(input.semesterNo)
        ).length;

        if (semesterCount >= 8) {
          throw new Error("우리 플랜은 학기당 최대 8과목까지 등록할 수 있습니다");
        }

        const id = await db.createPlanSemester({
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
        if (!db.getPracticeRecommendationsForStudent) {
          throw new Error("db.ts에 getPracticeRecommendationsForStudent 함수를 먼저 추가해야 합니다.");
        }

        const student = await db.getStudent(input.studentId);
        if (!student) throw new Error("학생을 찾을 수 없습니다");

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          throw new Error("권한이 없습니다");
        }

        const result = await db.getPracticeRecommendationsForStudent(input.studentId);

        if (db.createAiActionLog) {
          await db.createAiActionLog({
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

    chat: protectedProcedure
      .input(
        z.object({
          message: z.string().min(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const assigneeId = isAdminOrHost(ctx.user)
          ? undefined
          : Number(ctx.user.id) || 1;

        const [students, consultations] = await Promise.all([
          db.listStudents(assigneeId),
          db.listConsultations(assigneeId),
        ]);
const userName = ctx.user.name || "사용자";

        const msg = input.message.trim();
        const msgLower = msg.toLowerCase();

        if (msg.includes("찾아")) {
          const keyword = msg.replace("찾아줘", "").replace("찾아", "").trim();
          const keywordLower = keyword.toLowerCase();
          const keywordDigits = keyword.replace(/\D/g, "");

          const matchedStudents = (students || []).filter((item: any) => {
            return (
              String(item.clientName || "").toLowerCase().includes(keywordLower) ||
              String(item.phone || "").replace(/\D/g, "").includes(keywordDigits) ||
              String(item.course || "").toLowerCase().includes(keywordLower)
            );
          });

          const matchedConsultations = (consultations || []).filter((item: any) => {
            return (
              String(item.clientName || "").toLowerCase().includes(keywordLower) ||
              String(item.phone || "").replace(/\D/g, "").includes(keywordDigits) ||
              String(item.desiredCourse || "").toLowerCase().includes(keywordLower)
            );
          });

          return {
            success: true,
            mode: "search",
            answer: `검색어 "${keyword}" 기준으로 학생 ${matchedStudents.length}건, 상담 ${matchedConsultations.length}건을 찾았어요.`,
            data: {
              students: matchedStudents.slice(0, 10),
              consultations: matchedConsultations.slice(0, 10),
            },
          };
        }

        if (msg.includes("누락") || msg.includes("결제")) {
          const paymentDateMissing = (students || []).filter(
            (s: any) => s.status === "등록" && !s.paymentDate
          );
          const paymentAmountMissing = (students || []).filter(
            (s: any) => s.status === "등록" && !s.paymentAmount
          );

          return {
            success: true,
            mode: "alert",
            answer: `확인해봤어요. 결제일 누락 ${paymentDateMissing.length}건, 결제금액 누락 ${paymentAmountMissing.length}건입니다.`,
            data: {
              paymentDateMissing: paymentDateMissing.slice(0, 10),
              paymentAmountMissing: paymentAmountMissing.slice(0, 10),
            },
          };
        }

        if (msgLower.includes("실습") && (msgLower.includes("가까운") || msgLower.includes("교육원") || msgLower.includes("기관"))) {
          return {
            success: true,
            mode: "general",
            answer: "실습 추천은 학생을 먼저 선택한 뒤 실행하는 방식으로 연결하는 것이 안전합니다. 프론트에서 recommend_practice_place 액션으로 연결해주세요.",
          };
        }

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
  `너는 학점은행제 CRM 내부 AI 작업도우미다. 현재 대화 상대 이름은 ${userName}이다. ` +
  "말투는 너무 기계적이지 않게 자연스럽고 간결하게 답해라. " +
  "모르는 것은 모른다고 하고, 현재 연결된 기능과 연결되지 않은 기능을 구분해서 안내해라. " +
  "현재 CRM에서 가능한 기능은 학생/상담 검색, 누락/결제 점검, 전적대 과목 입력, 우리 플랜 입력, 실습 추천이다.",
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: input.message,
          },
        ],
      },
    ],
  });

  return {
    success: true,
    mode: "general",
    answer:
      response.output_text?.trim() ||
      "답변을 생성하지 못했습니다.",
  };
} catch (err) {
  console.error("[ai.chat][openai error]", err);

  return {
    success: true,
    mode: "general",
    answer:
      "지금은 AI 답변 연결 중 오류가 있어서 기본 안내만 드릴게요. 학생/상담 검색, 누락/결제 점검, 전적대 과목 입력, 우리 플랜 입력, 실습 추천 기능부터 사용할 수 있어요.",
  };
}
      }),

    saveLearning: protectedProcedure
      .input(
        z.object({
          learningType: z.string().min(1),
          inputText: z.string().min(1),
          normalizedKey: z.string().min(1),
          targetStudentId: z.number().optional(),
          targetStudentName: z.string().optional(),
          payload: z.any(),
          feedback: z.string().optional(),
          isApproved: z.boolean().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (!db.createAiLearningEntry) {
          throw new Error("db.ts에 createAiLearningEntry 함수를 먼저 추가해야 합니다.");
        }

        await db.createAiLearningEntry({
          userId: Number(ctx.user.id),
          userName: ctx.user.name,
          learningType: input.learningType,
          inputText: input.inputText,
          normalizedKey: input.normalizedKey,
          targetStudentId: input.targetStudentId ?? null,
          targetStudentName: input.targetStudentName ?? null,
          payload: input.payload,
          feedback: input.feedback ?? null,
          isApproved: input.isApproved ?? true,
        });

        return { success: true };
      }),

    getLearningExamples: protectedProcedure
      .input(
        z.object({
          learningType: z.string().min(1),
          normalizedKey: z.string().optional(),
          keyword: z.string().optional(),
        })
      )
      .query(async ({ input }) => {
        if (!db.findSimilarAiLearning) {
          throw new Error("db.ts에 findSimilarAiLearning 함수를 먼저 추가해야 합니다.");
        }

        const examples = await db.findSimilarAiLearning({
          learningType: input.learningType,
          normalizedKey: input.normalizedKey,
          keyword: input.keyword,
        });

        return {
          success: true,
          examples,
        };
      }),

    logs: superHostProcedure.query(async () => {
      return [];
    }),

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
        const assigneeId = isAdminOrHost(ctx.user)
          ? undefined
          : Number(ctx.user.id) || 1;

        const students = await db.listStudents(assigneeId);
        const keyword = input.studentKeyword.trim();
        const keywordLower = keyword.toLowerCase();
        const keywordDigits = keyword.replace(/\D/g, "");

        let matchedStudents: any[] = [];

        if (input.selectedStudentId) {
          const selected = (students || []).find(
            (item: any) => Number(item.id) === Number(input.selectedStudentId)
          );

          if (!selected) {
            throw new Error("선택한 학생을 찾을 수 없습니다.");
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
          throw new Error("해당 학생을 찾을 수 없습니다.");
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
            throw new Error("전적대 과목 구분이 필요합니다.");
          }

          const id = await db.createTransferSubject({
            studentId: student.id,
            schoolName: null,
            subjectName: input.subjectName.trim(),
            transferCategory: input.category,
            transferRequirementType: null,
            credits: 3,
            sortOrder: 0,
            attachmentName: null,
            attachmentUrl: null,
          } as any);

          if (db.createAiActionLog) {
            await db.createAiActionLog({
              userId: Number(ctx.user.id),
              userName: ctx.user.name,
              action: "create_transfer_subject",
              targetStudentId: student.id,
              targetStudentName: student.clientName,
              payload: input,
            });
          }

          if (db.createAiLearningEntry) {
            await db.createAiLearningEntry({
              userId: Number(ctx.user.id),
              userName: ctx.user.name,
              learningType: "transfer_subject_input",
              inputText: `${student.clientName} 전적대 ${input.subjectName} ${input.category}`,
              normalizedKey: `transfer_subject|${input.category}`,
              targetStudentId: student.id,
              targetStudentName: student.clientName,
              payload: input,
              feedback: null,
              isApproved: true,
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
            throw new Error("학기 정보가 필요합니다.");
          }

          if (!input.category) {
            throw new Error("플랜 과목 구분이 필요합니다.");
          }

          const existing = await db.listPlanSemesters(student.id);
          const semesterCount = (existing || []).filter(
            (x: any) => Number(x.semesterNo) === Number(input.semesterNo)
          ).length;

          if (semesterCount >= 8) {
            throw new Error("우리 플랜은 학기당 최대 8과목까지 등록할 수 있습니다.");
          }

          const id = await db.createPlanSemester({
            studentId: student.id,
            semesterNo: input.semesterNo,
            subjectName: input.subjectName.trim(),
            planCategory: input.category,
            planRequirementType: null,
            credits: 3,
            sortOrder: 0,
          } as any);

          if (db.createAiActionLog) {
            await db.createAiActionLog({
              userId: Number(ctx.user.id),
              userName: ctx.user.name,
              action: "create_plan_semester",
              targetStudentId: student.id,
              targetStudentName: student.clientName,
              payload: input,
            });
          }

          if (db.createAiLearningEntry) {
            await db.createAiLearningEntry({
              userId: Number(ctx.user.id),
              userName: ctx.user.name,
              learningType: "plan_semester_input",
              inputText: `${student.clientName} ${input.semesterNo}학기 ${input.subjectName} ${input.category}`,
              normalizedKey: `plan_semester|${input.semesterNo}|${input.category}`,
              targetStudentId: student.id,
              targetStudentName: student.clientName,
              payload: input,
              feedback: null,
              isApproved: true,
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
            throw new Error("db.ts에 getPracticeRecommendationsForStudent 함수를 먼저 추가해야 합니다.");
          }

          const recommendations = await db.getPracticeRecommendationsForStudent(student.id);

          if (db.createAiActionLog) {
            await db.createAiActionLog({
              userId: Number(ctx.user.id),
              userName: ctx.user.name,
              action: "recommend_practice_place",
              targetStudentId: student.id,
              targetStudentName: student.clientName,
              payload: input,
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

        throw new Error("지원하지 않는 액션입니다.");
      }),
  }),
  dashboard: router({
    monthApprovals: protectedProcedure.query(async ({ ctx }) => {
      const isAdminHost = isAdminOrHost(ctx.user);
      const assigneeId = isAdminHost ? undefined : Number(ctx.user.id);

      const stats = await db.getDashboardStats(assigneeId);
      const monthEntries = await db.getMonthSalesEntries(assigneeId);
      const students = await db.listStudents(assigneeId);

      const approved = (students || []).filter((s: any) => s.approvalStatus === "승인");
      const rejected = (students || []).filter((s: any) => s.approvalStatus === "불승인");
      const pending = (students || []).filter((s: any) => s.approvalStatus === "대기");

      const approvedTotal = approved.reduce(
        (sum: number, s: any) => sum + Number(s.netPaidAmount || s.paidAmount || 0),
        0
      );

      const rejectedTotal = rejected.reduce(
        (sum: number, s: any) => sum + Number(s.netPaidAmount || s.paidAmount || 0),
        0
      );

      const pendingTotal = pending.reduce(
        (sum: number, s: any) => sum + Number(s.netPaidAmount || s.paidAmount || 0),
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
      return db.getDashboardStats(Number(ctx.user.id));
    }),

    totalStats: hostProcedure.query(async () => {
      return db.getDashboardStats(undefined);
    }),

    monthSalesEntries: protectedProcedure.query(async ({ ctx }) => {
      return db.getMonthSalesEntries(Number(ctx.user.id));
    }),

    totalMonthSalesEntries: hostProcedure.query(async () => {
      return db.getMonthSalesEntries(undefined);
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
      const showAll = !!input?.showAll;
      const myId = Number(ctx.user.id) || 1;

      const assigneeId =
        isAdminOrHost(ctx.user) && showAll ? undefined : myId;

      return db.listConsultations(assigneeId);
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
        const assigneeId = Number(ctx.user.id);
        const safeAssigneeId =
          Number.isFinite(assigneeId) && assigneeId > 0 ? assigneeId : 1;

        const id = await db.createConsultation({
          ...input,
          consultDate: new Date(input.consultDate),
          finalEducation: input.finalEducation ?? "",
          assigneeId: safeAssigneeId,
        } as any);

        return { id };
      }),

    bulkCreate: protectedProcedure
      .input(
        z.object({
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
          throw new Error("유효한 데이터가 없습니다");
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
        const item = await db.getConsultation(input.id);

        if (!item) {
          throw new Error("상담 기록을 찾을 수 없습니다");
        }

        const myId = Number(ctx.user.id) || 1;

        if (!isAdminOrHost(ctx.user) && item.assigneeId !== myId) {
          throw new Error("권한이 없습니다");
        }

        const { id, ...rest } = input;
        const data: any = { ...rest };

      if (ctx.user.role === "staff") {
  const allowedForStaff: any = {};

  if (rest.notes !== undefined) {
    allowedForStaff.notes = rest.notes;
  }

  if (rest.status !== undefined) {
    allowedForStaff.status = rest.status;
  }

  if (rest.status === "등록예정") {
    const existing = await db.getConsultation(id);

    if (
      existing &&
      existing.status !== "등록예정" &&
      existing.status !== "등록"
    ) {
      await db.createStudent({
        clientName: existing.clientName,
        phone: existing.phone,
        course: existing.desiredCourse || "",
        assigneeId: existing.assigneeId,
        consultationId: id,
      });

      allowedForStaff.status = "등록예정";
    }
  }

  await db.updateConsultation(id, allowedForStaff);
  return { success: true };
}

        if (rest.consultDate) {
          data.consultDate = new Date(rest.consultDate);
        }

        if (rest.status === "등록예정") {
          const existing = await db.getConsultation(id);

          if (existing && existing.status !== "등록예정" && existing.status !== "등록") {
            await db.createStudent({
              clientName: existing.clientName,
              phone: existing.phone,
              course: existing.desiredCourse || "",
              assigneeId: existing.assigneeId,
              consultationId: id,
            });

            data.status = "등록예정";
          }
        }

        await db.updateConsultation(id, data);

        return { success: true };
      }),

    reassign: hostProcedure
      .input(
        z.object({
          id: z.number(),
          assigneeId: z.number(),
        })
      )
      .mutation(async ({ input }) => {
        await db.reassignConsultationAndLinkedStudent(
          input.id,
          input.assigneeId
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
      .mutation(async ({ input }) => {
        await db.bulkReassignConsultationsAndLinkedStudents(
          input.fromAssigneeId,
          input.toAssigneeId
        );

        return { success: true };
      }),

    delete: hostProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const item = await db.getConsultation(input.id);

        if (!item) {
          throw new Error("상담 기록을 찾을 수 없습니다");
        }

        const myId = Number(ctx.user.id) || 1;

        if (!isAdminOrHost(ctx.user) && item.assigneeId !== myId) {
          throw new Error("권한이 없습니다");
        }

        await db.deleteConsultation(input.id);

        return { success: true };
      }),
  }),

  student: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const assigneeId = isAdminOrHost(ctx.user)
        ? undefined
        : Number(ctx.user.id) || 1;

      return db.listStudents(assigneeId);
    }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const item = await db.getStudent(input.id);
        if (!item) return null;

        if (!isAdminOrHost(ctx.user) && item.assigneeId !== Number(ctx.user.id)) {
          return null;
        }

        return item;
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
          address: z.string().optional(),
          detailAddress: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        console.log("[student.update] input =", input);

        const item = await db.getStudent(input.id);
        if (!item) throw new Error("학생 기록을 찾을 수 없습니다");

        const myId = Number(ctx.user.id) || 1;
        if (!isAdminOrHost(ctx.user) && item.assigneeId !== myId) {
          throw new Error("권한이 없습니다");
        }

        const { id, ...rest } = input;
        const data: any = { ...rest };

        if (rest.startDate) data.startDate = new Date(rest.startDate);
        if (rest.paymentDate) data.paymentDate = new Date(rest.paymentDate);

        console.log("[student.update] data =", data);

        await db.updateStudent(id, data);
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
        const item = await db.getStudent(input.studentId);
        if (!item) throw new Error("학생 기록을 찾을 수 없습니다");

        const myId = Number(ctx.user.id) || 1;
        if (!isAdminOrHost(ctx.user) && item.assigneeId !== myId) {
          throw new Error("권한이 없습니다");
        }

        await db.updateStudentAddressAndCoords(input);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const item = await db.getStudent(input.id);
        if (!item) throw new Error("학생 기록을 찾을 수 없습니다");

        const myId = Number(ctx.user.id) || 1;
        if (!isAdminOrHost(ctx.user) && item.assigneeId !== myId) {
          throw new Error("권한이 없습니다");
        }

        await db.deleteStudent(input.id);
        return { success: true };
      }),

    registrationSummary: protectedProcedure
      .input(z.object({ studentId: z.number() }))
      .query(async ({ ctx, input }) => {
        const student = await db.getStudent(input.studentId);
        if (!student) return null;

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          return null;
        }

        return db.getStudentRegistrationSummary(input.studentId);
      }),

    approve: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          approvalStatus: z.enum(["승인", "불승인"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrHost(ctx.user)) {
          throw new Error("관리자 또는 호스트만 처리할 수 있습니다");
        }

        const now = new Date();
        const updateData: any = { approvalStatus: input.approvalStatus };

        if (input.approvalStatus === "승인") {
          updateData.approvedAt = now;
          updateData.rejectedAt = null;
	updateData.status = "등록";
        } else {
          updateData.rejectedAt = now;
          updateData.approvedAt = null;
        }

        await db.updateStudent(input.id, updateData);

	if (input.approvalStatus === "승인") {
  const approvedStudent = await db.getStudent(input.id);

  if (approvedStudent?.consultationId) {
    await db.updateConsultation(approvedStudent.consultationId, {
      status: "등록",
    });
  }
}

        if (input.approvalStatus === "승인") {
          const sems = await db.listSemesters(input.id);
          for (const sem of sems) {
            if (!sem.isLocked) {
              await db.updateSemester(sem.id, { isLocked: true });
            }
          }
        }

        return { success: true };
      }),
  }),

  plan: router({
    get: protectedProcedure
      .input(z.object({ studentId: z.number() }))
      .query(async ({ ctx, input }) => {
        const student = await db.getStudent(input.studentId);
        console.log("[plan.get] student =", student);

        if (!student) {
          console.log("[plan.get] no student");
          return null;
        }

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          console.log("[plan.get] no permission", {
            userId: ctx.user.id,
            assigneeId: student.assigneeId,
          });
          return null;
        }

        const plan = await db.getPlan(input.studentId);
        console.log("[plan.get] plan =", plan);

        return plan ?? null;
      }),

    upsert: protectedProcedure
      .input(
        z.object({
          studentId: z.number(),
          desiredCourse: z.string().optional(),
          finalEducation: z.string().optional(),
          totalTheorySubjects: z.number().optional(),
          hasPractice: z.boolean().optional(),
          practiceHours: z.number().optional(),
          practiceDate: z.string().optional(),
          practiceArranged: z.boolean().optional(),
          practiceStatus: z.enum(["미섭외", "섭외중", "섭외완료"]).optional(),
          specialNotes: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const student = await db.getStudent(input.studentId);
        if (!student) throw new Error("학생을 찾을 수 없습니다");

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          throw new Error("권한이 없습니다");
        }

        const id = await db.upsertPlan(input as any);
        return { id, success: true };
      }),
  }),

  semester: router({
    list: protectedProcedure
      .input(z.object({ studentId: z.number() }))
      .query(async ({ ctx, input }) => {
        const student = await db.getStudent(input.studentId);
        if (!student) return [];

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          return [];
        }

        return db.listSemesters(input.studentId);
      }),

    listAll: protectedProcedure
      .input(
        z.object({
          plannedMonth: z.string().optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        const assigneeId = isAdminOrHost(ctx.user)
          ? undefined
          : Number(ctx.user.id) || 1;

        return db.listAllSemesters(assigneeId, input.plannedMonth);
      }),

    create: protectedProcedure
      .input(
        z.object({
          studentId: z.number(),
          semesterOrder: z.number(),
          plannedMonth: z.string().optional(),
          plannedInstitution: z.string().optional(),
          plannedInstitutionId: z.number().optional(),
          plannedSubjectCount: z.number().optional(),
          plannedAmount: z.string().optional(),
          practiceStatus: z.enum(["미섭외", "섭외중", "섭외완료"]).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const student = await db.getStudent(input.studentId);
        if (!student) throw new Error("학생을 찾을 수 없습니다");

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          throw new Error("권한이 없습니다");
        }

        const id = await db.createSemester({
          ...input,
          status: "등록",
          practiceStatus: input.practiceStatus ?? "미섭외",
        } as any);

        if (input.plannedSubjectCount !== undefined && input.plannedSubjectCount > 0) {
          await db.syncPlanSemestersByCount(
            input.studentId,
            input.semesterOrder,
            input.plannedSubjectCount
          );
        }

        return { id, success: true };
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          plannedMonth: z.string().optional(),
          plannedInstitution: z.string().optional(),
          plannedSubjectCount: z.number().optional(),
          plannedAmount: z.string().optional(),
          plannedInstitutionId: z.number().optional(),
          actualInstitutionId: z.number().optional(),
          actualStartDate: z.string().optional(),
          actualInstitution: z.string().optional(),
          actualSubjectCount: z.number().optional(),
          actualAmount: z.string().optional(),
          actualPaymentDate: z.string().optional(),
          isCompleted: z.boolean().optional(),
          status: z.enum(["등록", "종료", "등록 종료"]).optional(),
          practiceStatus: z.enum(["미섭외", "섭외중", "섭외완료"]).optional(),
          practiceSupportRequestId: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const sem = await db.getSemester(input.id);
        if (!sem) throw new Error("학기를 찾을 수 없습니다");

        const allSemsForStatusCheck = await db.listSemesters(sem.studentId);
        const sortedSemsForStatusCheck = [...allSemsForStatusCheck].sort(
          (a: any, b: any) => Number(a.semesterOrder) - Number(b.semesterOrder)
        );
        const lastSem = sortedSemsForStatusCheck[sortedSemsForStatusCheck.length - 1];

        if (input.status === "등록 종료") {
          if (!lastSem || Number(lastSem.id) !== Number(sem.id)) {
            throw new Error("마지막 학기에서만 등록 종료할 수 있습니다");
          }
        }

        if (
          input.status !== undefined &&
          input.status !== "등록" &&
          input.status !== "종료" &&
          input.status !== "등록 종료"
        ) {
          throw new Error("올바르지 않은 상태값입니다");
        }

        if (sem.isLocked) {
          const {
            id,
            actualStartDate,
            actualInstitution,
            actualSubjectCount,
            actualAmount,
            actualPaymentDate,
            isCompleted,
            status,
            practiceStatus,
            practiceSupportRequestId,
            ...plannedFields
          } = input;

          const hasPlannedChanges = Object.values(plannedFields).some(
            (v) => v !== undefined
          );
          if (hasPlannedChanges) {
            throw new Error("승인된 예정표는 수정할 수 없습니다");
          }
        }

        const { id, ...rest } = input;
        const data: any = { ...rest };

        if (rest.actualStartDate) data.actualStartDate = new Date(rest.actualStartDate);
        if (rest.actualPaymentDate) data.actualPaymentDate = new Date(rest.actualPaymentDate);

        await db.updateSemester(id, data);

        if (input.plannedSubjectCount !== undefined) {
          await db.syncPlanSemestersByCount(
            sem.studentId,
            sem.semesterOrder,
            input.plannedSubjectCount
          );
        }

        if (input.status !== undefined) {
          const refreshedSems = await db.listSemesters(sem.studentId);
          const sortedRefreshedSems = [...refreshedSems].sort(
            (a: any, b: any) => Number(a.semesterOrder) - Number(b.semesterOrder)
          );
          const refreshedLastSem =
            sortedRefreshedSems[sortedRefreshedSems.length - 1];

          const studentStatus =
            refreshedLastSem?.status === "등록 종료" ? "등록 종료" : "등록";

          await db.updateStudent(sem.studentId, {
            status: studentStatus,
          });
        }

        const allSems = await db.listSemesters(sem.studentId);

        const firstActual = allSems
          .filter(
            (s: any) =>
              s.actualStartDate ||
              s.actualInstitutionId ||
              s.actualAmount ||
              s.actualPaymentDate
          )
          .sort((a: any, b: any) => Number(a.semesterOrder) - Number(b.semesterOrder))[0];

        if (firstActual) {
          let institutionName: string | undefined = undefined;

          if (firstActual.actualInstitutionId) {
            const institutions = await db.listEducationInstitutions();
            const found = institutions.find(
              (x: any) => Number(x.id) === Number(firstActual.actualInstitutionId)
            );
            institutionName = found?.name;
          }

          const refreshedSems = await db.listSemesters(sem.studentId);
          const sortedRefreshedSems = [...refreshedSems].sort(
            (a: any, b: any) => Number(a.semesterOrder) - Number(b.semesterOrder)
          );
          const refreshedLastSem =
            sortedRefreshedSems[sortedRefreshedSems.length - 1];

          const studentStatus =
            refreshedLastSem?.status === "등록 종료" ? "등록 종료" : "등록";

          await db.updateStudent(sem.studentId, {
            startDate: firstActual.actualStartDate || undefined,
            institutionId: firstActual.actualInstitutionId || undefined,
            institution: institutionName || undefined,
            subjectCount: firstActual.actualSubjectCount || undefined,
            paymentAmount: firstActual.actualAmount || undefined,
            paymentDate: firstActual.actualPaymentDate || undefined,
            status: studentStatus,
          });
        }

        if (input.isCompleted) {
          await db.checkAndAutoComplete(sem.studentId);
        }

        return { success: true };
      }),

    copyPlannedToActual: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const sem = await db.getSemester(input.id);
        if (!sem) throw new Error("학기를 찾을 수 없습니다");

        const raw = String(sem.plannedMonth || "").replace(/[^0-9]/g, "");
        const actualStartDate =
          raw.length === 6 ? new Date(`${raw.slice(0, 4)}-${raw.slice(4, 6)}-01`) : undefined;

        await db.updateSemester(input.id, {
          actualStartDate,
          actualInstitutionId: sem.plannedInstitutionId,
          actualInstitution: sem.plannedInstitution,
          actualSubjectCount: sem.plannedSubjectCount,
          actualAmount: sem.plannedAmount,
        });

        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const sem = await db.getSemester(input.id);
        if (sem?.isLocked) throw new Error("승인된 학기는 삭제할 수 없습니다");

        await db.deleteSemester(input.id);
        return { success: true };
      }),
  }),

  refund: router({
    listByStudent: protectedProcedure
      .input(z.object({ studentId: z.number() }))
      .query(async ({ ctx, input }) => {
        const student = await db.getStudent(input.studentId);
        if (!student) return [];

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          return [];
        }

        return db.listRefundsByStudent(input.studentId);
      }),

    listPending: protectedProcedure.query(async ({ ctx }) => {
      if (!isAdminOrHost(ctx.user)) {
throw new Error("관리자, 호스트 또는 슈퍼호스트만 확인할 수 있습니다");
      }

      return db.listPendingRefunds();
    }),

    create: protectedProcedure
      .input(
        z.object({
          studentId: z.number(),
          semesterId: z.number().optional(),
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
        const student = await db.getStudent(input.studentId);
        if (!student) throw new Error("학생을 찾을 수 없습니다");

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          throw new Error("권한이 없습니다");
        }

        const id = await db.createRefund({
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
          throw new Error("관리자 또는 호스트만 승인할 수 있습니다");
        }

        await db.approveRefund(input.id, Number(ctx.user.id));
        return { success: true };
      }),

    reject: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrHost(ctx.user)) {
          throw new Error("관리자 또는 호스트만 불승인 처리할 수 있습니다");
        }

        await db.rejectRefund(input.id, Number(ctx.user.id));
        return { success: true };
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
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
      .mutation(async ({ input }) => {
        const data: any = {};

        if (input.refundAmount !== undefined) data.refundAmount = input.refundAmount;
        if (input.refundDate !== undefined) data.refundDate = new Date(input.refundDate);
        if (input.reason !== undefined) data.reason = input.reason;
        if (input.refundType !== undefined) data.refundType = input.refundType;
        if (input.attachmentName !== undefined) data.attachmentName = input.attachmentName;
        if (input.attachmentUrl !== undefined) data.attachmentUrl = input.attachmentUrl;

        await db.updateRefund(input.id, data);
        return { success: true };
      }),

    delete: hostProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteRefund(input.id);
        return { success: true };
      }),
  }),

  planSemester: router({
    list: protectedProcedure
      .input(z.object({ studentId: z.number() }))
      .query(async ({ ctx, input }) => {
        const student = await db.getStudent(input.studentId);
        if (!student) return [];

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          return [];
        }

        return db.listPlanSemesters(input.studentId);
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
        })
      )
      .mutation(async ({ ctx, input }) => {
        const student = await db.getStudent(input.studentId);
        if (!student) throw new Error("학생을 찾을 수 없습니다");

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          throw new Error("권한이 없습니다");
        }

        const existing = await db.listPlanSemesters(input.studentId);
        const semesterCount = existing.filter(
          (x: any) => Number(x.semesterNo) === Number(input.semesterNo)
        ).length;

        if (semesterCount >= 8) {
          throw new Error("우리 플랜은 학기당 최대 8과목까지 등록할 수 있습니다");
        }

        const id = await db.createPlanSemester({
          studentId: input.studentId,
          semesterNo: input.semesterNo,
          subjectName: input.subjectName.trim(),
          planCategory: input.category,
          planRequirementType: input.requirementType ?? null,
          credits: 3,
          sortOrder: input.sortOrder ?? 0,
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
        })
      )
      .mutation(async ({ input }) => {
        const data: any = {};

        if (input.subjectName !== undefined) data.subjectName = input.subjectName.trim();
        if (input.category !== undefined) data.planCategory = input.category;
        if (input.requirementType !== undefined) data.planRequirementType = input.requirementType;
        if (input.semesterNo !== undefined) data.semesterNo = input.semesterNo;
        if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;

        await db.updatePlanSemester(input.id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deletePlanSemester(input.id);
        return { success: true };
      }),
  }),

  transferSubject: router({
    list: protectedProcedure
      .input(z.object({ studentId: z.number() }))
      .query(async ({ ctx, input }) => {
        const student = await db.getStudent(input.studentId);
        if (!student) return [];

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          return [];
        }

        return db.listTransferSubjects(input.studentId);
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
        const student = await db.getStudent(input.studentId);
        if (!student) throw new Error("학생을 찾을 수 없습니다");

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          throw new Error("권한이 없습니다");
        }

        const existing = await db.listTransferSubjects(input.studentId);
        if ((existing?.length ?? 0) >= 100) {
          throw new Error("전적대 과목은 최대 100개까지 등록할 수 있습니다");
        }

        const id = await db.createTransferSubject({
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
        const student = await db.getStudent(input.studentId);
        if (!student) throw new Error("학생을 찾을 수 없습니다");

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          throw new Error("권한이 없습니다");
        }

        const existing = await db.listTransferSubjects(input.studentId);
        const existingCount = existing?.length ?? 0;

        if (existingCount + input.count > 100) {
          throw new Error("전적대 과목은 최대 100개까지 등록할 수 있습니다");
        }

        const rows = Array.from({ length: input.count }).map((_, i) => ({
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
      .mutation(async ({ input }) => {
        const data: any = {};

        if (input.schoolName !== undefined) data.schoolName = input.schoolName.trim();
        if (input.subjectName !== undefined) data.subjectName = input.subjectName.trim();
        if (input.category !== undefined) data.transferCategory = input.category;
        if (input.requirementType !== undefined) data.transferRequirementType = input.requirementType;
        if (input.credits !== undefined) data.credits = input.credits;
        if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
        if (input.attachmentName !== undefined) data.attachmentName = input.attachmentName.trim();
        if (input.attachmentUrl !== undefined) data.attachmentUrl = input.attachmentUrl.trim();

        await db.updateTransferSubject(input.id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteTransferSubject(input.id);
        return { success: true };
      }),
  }),

  transferAttachment: router({
    list: protectedProcedure
      .input(z.object({ studentId: z.number() }))
      .query(async ({ ctx, input }) => {
        const student = await db.getStudent(input.studentId);
        if (!student) return [];

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          return [];
        }

        return db.listTransferAttachments(input.studentId);
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
        const student = await db.getStudent(input.studentId);
        if (!student) throw new Error("학생을 찾을 수 없습니다");

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          throw new Error("권한이 없습니다");
        }

        const existing = await db.listTransferAttachments(input.studentId);
        if ((existing?.length ?? 0) >= 4) {
          throw new Error("첨부파일은 최대 4개까지 등록할 수 있습니다");
        }

        const id = await db.createTransferAttachment({
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
            courseKey: z.string().optional(),
          })
          .optional()
      )
      .query(async ({ input }) => {
        return db.listCourseSubjectTemplates(input?.courseKey);
      }),

    create: hostProcedure
      .input(
        z.object({
          courseKey: z.string().min(1),
          subjectName: z.string().min(1),
          category: z.enum(["전공", "교양", "일반"]),
          requirementType: z.enum(["전공필수", "전공선택", "교양", "일반"]).optional(),
          sortOrder: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const id = await db.createCourseSubjectTemplate({
          courseKey: input.courseKey.trim(),
          subjectName: input.subjectName.trim(),
          category: input.category,
          requirementType: input.requirementType ?? null,
          sortOrder: input.sortOrder ?? 0,
          isActive: true,
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
        const student = await db.getStudent(input.studentId);
        if (!student) throw new Error("학생을 찾을 수 없습니다");

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          throw new Error("권한이 없습니다");
        }

        const result = await db.bulkCreatePlanSemestersFromTemplate({
          studentId: input.studentId,
          semesterNo: input.semesterNo,
          subjectIds: input.subjectIds,
        } as any);

        return { success: true, count: result.count };
      }),
  }),

  privateCertificate: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const assigneeId = isAdminOrHost(ctx.user) ? undefined : Number(ctx.user.id) || 1;
      return db.listPrivateCertificateRequests(assigneeId);
    }),

    listByStudent: protectedProcedure
      .input(z.object({ studentId: z.number() }))
      .query(async ({ ctx, input }) => {
        const student = await db.getStudent(input.studentId);
        if (!student) return [];

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          return [];
        }

        return db.listPrivateCertificateRequestsByStudent(input.studentId);
      }),

    create: protectedProcedure
      .input(
        z.object({
          studentId: z.number(),
          certificateName: z.string().min(1),
          inputAddress: z.string().optional(),
          note: z.string().optional(),
          feeAmount: z.string().optional(),
          attachmentName: z.string().optional(),
          attachmentUrl: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const student = await db.getStudent(input.studentId);
        if (!student) throw new Error("학생을 찾을 수 없습니다");

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          throw new Error("권한이 없습니다");
        }

        const assignee = await db.getUserById(student.assigneeId);

        const id = await db.createPrivateCertificateRequest({
          studentId: input.studentId,
          assigneeId: student.assigneeId,
          clientName: student.clientName,
          phone: student.phone,
          assigneeName: assignee?.name || null,
          certificateName: input.certificateName.trim(),
          inputAddress: input.inputAddress?.trim() || null,
          note: input.note || null,
          requestStatus: "요청",
          feeAmount: input.feeAmount || "0",
          paymentStatus: "결제대기",
          attachmentName: input.attachmentName || null,
          attachmentUrl: input.attachmentUrl || null,
        } as any);

        return { id, success: true };
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          certificateName: z.string().optional(),
          inputAddress: z.string().optional(),
          note: z.string().optional(),
          requestStatus: z
            .enum(["요청", "안내완료", "입금대기", "입금확인", "진행중", "완료", "취소"])
            .optional(),
          feeAmount: z.string().optional(),
          paymentStatus: z.enum(["결제대기", "입금확인", "완료", "취소"]).optional(),
          paidAt: z.string().optional(),
          attachmentName: z.string().optional(),
          attachmentUrl: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrHost(ctx.user)) {
          throw new Error("관리자 또는 호스트만 수정할 수 있습니다");
        }

        const data: any = {};
        if (input.certificateName !== undefined) data.certificateName = input.certificateName.trim();
        if (input.inputAddress !== undefined) data.inputAddress = input.inputAddress.trim();
        if (input.note !== undefined) data.note = input.note;
        if (input.requestStatus !== undefined) data.requestStatus = input.requestStatus;
        if (input.feeAmount !== undefined) data.feeAmount = input.feeAmount;
        if (input.paymentStatus !== undefined) data.paymentStatus = input.paymentStatus;
        if (input.paidAt !== undefined) data.paidAt = input.paidAt ? new Date(input.paidAt) : null;
        if (input.attachmentName !== undefined) data.attachmentName = input.attachmentName;
        if (input.attachmentUrl !== undefined) data.attachmentUrl = input.attachmentUrl;

        await db.updatePrivateCertificateRequest(input.id, data);
        return { success: true };
      }),

    delete: hostProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deletePrivateCertificateRequest(input.id);
        return { success: true };
      }),
  }),

  practiceSupport: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const assigneeId = isAdminOrHost(ctx.user) ? undefined : Number(ctx.user.id) || 1;
      return db.listPracticeSupportRequests(assigneeId);
    }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const item = await db.getPracticeSupportRequest(input.id);
        if (!item) return null;

        const student = await db.getStudent(item.studentId);
        if (!student) return null;

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          return null;
        }

        return item;
      }),

    listByStudent: protectedProcedure
      .input(z.object({ studentId: z.number() }))
      .query(async ({ ctx, input }) => {
        const student = await db.getStudent(input.studentId);
        if (!student) return [];

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          return [];
        }

        return db.listPracticeSupportRequestsByStudent(input.studentId);
      }),

    create: protectedProcedure
      .input(
        z.object({
          studentId: z.number(),
          semesterId: z.number().optional(),
          inputAddress: z.string().optional(),
          detailAddress: z.string().optional(),
          managerName: z.string().optional(),
          practiceHours: z.number().optional(),
          includeEducationCenter: z.boolean().optional(),
          includePracticeInstitution: z.boolean().optional(),
          note: z.string().optional(),
          feeAmount: z.string().optional(),
          attachmentName: z.string().optional(),
          attachmentUrl: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const student = await db.getStudent(input.studentId);
        if (!student) throw new Error("학생을 찾을 수 없습니다");

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          throw new Error("권한이 없습니다");
        }

        const assignee = await db.getUserById(student.assigneeId);

        const id = await db.createPracticeSupportRequest({
          studentId: input.studentId,
          semesterId: input.semesterId ?? null,
          assigneeId: student.assigneeId,
          clientName: student.clientName,
          phone: student.phone,
          assigneeName: assignee?.name || null,
          managerName: input.managerName ?? assignee?.name ?? null,
          course: student.course || "사회복지사",
          inputAddress: input.inputAddress?.trim() || student.address || null,
          detailAddress: input.detailAddress?.trim() || student.detailAddress || null,
          practiceHours: input.practiceHours ?? null,
          includeEducationCenter: input.includeEducationCenter ?? true,
          includePracticeInstitution: input.includePracticeInstitution ?? true,
          coordinationStatus: "미섭외",
          feeAmount: input.feeAmount || "0",
          paymentStatus: "미결제",
          note: input.note || null,
          attachmentName: input.attachmentName || null,
          attachmentUrl: input.attachmentUrl || null,
        } as any);

        if (input.semesterId) {
          await db.updateSemester(input.semesterId, {
            practiceStatus: "미섭외",
            practiceSupportRequestId: id,
          } as any);
        }

        await db.upsertPlan({
          studentId: input.studentId,
          hasPractice: true,
          practiceHours: input.practiceHours ?? undefined,
          practiceStatus: "미섭외",
        } as any);

        return { id, success: true };
      }),

    upsertByStudent: protectedProcedure
      .input(
        z.object({
          studentId: z.number(),
          semesterId: z.number().optional().nullable(),
          assigneeId: z.number(),
          clientName: z.string(),
          phone: z.string(),
          course: z.string(),
          inputAddress: z.string().optional().nullable(),
          detailAddress: z.string().optional().nullable(),
          assigneeName: z.string().optional().nullable(),
          managerName: z.string().optional().nullable(),
          practiceHours: z.number().optional().nullable(),
          includeEducationCenter: z.boolean().optional(),
          includePracticeInstitution: z.boolean().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const student = await db.getStudent(input.studentId);
        if (!student) throw new Error("학생을 찾을 수 없습니다");

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          throw new Error("권한이 없습니다");
        }

        const id = await db.upsertPracticeSupportRequestByStudent(input);
        return { id, success: true };
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          semesterId: z.number().optional(),
          inputAddress: z.string().optional(),
          detailAddress: z.string().optional(),
          managerName: z.string().optional(),
          practiceHours: z.number().optional(),
          coordinationStatus: z.enum(["미섭외", "섭외중", "섭외완료"]).optional(),
          selectedEducationCenterId: z.number().optional(),
          selectedEducationCenterName: z.string().optional(),
          selectedEducationCenterAddress: z.string().optional(),
          selectedEducationCenterDistanceKm: z.string().optional(),
          selectedPracticeInstitutionId: z.number().optional(),
          selectedPracticeInstitutionName: z.string().optional(),
          selectedPracticeInstitutionAddress: z.string().optional(),
          selectedPracticeInstitutionDistanceKm: z.string().optional(),
          feeAmount: z.string().optional(),
          paymentStatus: z.enum(["미결제", "결제"]).optional(),
          paidAt: z.string().optional(),
          note: z.string().optional(),
          attachmentName: z.string().optional(),
          attachmentUrl: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrHost(ctx.user)) {
          throw new Error("관리자 또는 호스트만 수정할 수 있습니다");
        }

        const data: any = {};
        if (input.semesterId !== undefined) data.semesterId = input.semesterId;
        if (input.inputAddress !== undefined) data.inputAddress = input.inputAddress.trim();
        if (input.detailAddress !== undefined) data.detailAddress = input.detailAddress.trim();
        if (input.managerName !== undefined) data.managerName = input.managerName.trim();
        if (input.practiceHours !== undefined) data.practiceHours = input.practiceHours;
        if (input.coordinationStatus !== undefined) data.coordinationStatus = input.coordinationStatus;
        if (input.selectedEducationCenterId !== undefined) data.selectedEducationCenterId = input.selectedEducationCenterId;
        if (input.selectedEducationCenterName !== undefined) data.selectedEducationCenterName = input.selectedEducationCenterName.trim();
        if (input.selectedEducationCenterAddress !== undefined) data.selectedEducationCenterAddress = input.selectedEducationCenterAddress.trim();
        if (input.selectedEducationCenterDistanceKm !== undefined) data.selectedEducationCenterDistanceKm = input.selectedEducationCenterDistanceKm || null;
        if (input.selectedPracticeInstitutionId !== undefined) data.selectedPracticeInstitutionId = input.selectedPracticeInstitutionId;
        if (input.selectedPracticeInstitutionName !== undefined) data.selectedPracticeInstitutionName = input.selectedPracticeInstitutionName.trim();
        if (input.selectedPracticeInstitutionAddress !== undefined) data.selectedPracticeInstitutionAddress = input.selectedPracticeInstitutionAddress.trim();
        if (input.selectedPracticeInstitutionDistanceKm !== undefined) data.selectedPracticeInstitutionDistanceKm = input.selectedPracticeInstitutionDistanceKm || null;
        if (input.feeAmount !== undefined) data.feeAmount = input.feeAmount;
        if (input.paymentStatus !== undefined) data.paymentStatus = input.paymentStatus;
        if (input.paidAt !== undefined) data.paidAt = input.paidAt ? new Date(input.paidAt) : null;
        if (input.note !== undefined) data.note = input.note;
        if (input.attachmentName !== undefined) data.attachmentName = input.attachmentName;
        if (input.attachmentUrl !== undefined) data.attachmentUrl = input.attachmentUrl;

        await db.updatePracticeSupportRequest(input.id, data);

        if (input.coordinationStatus !== undefined) {
          await db.updatePracticeSupportStatusAndSyncSemester({
            practiceSupportRequestId: input.id,
            coordinationStatus: input.coordinationStatus,
          });
        }

        return { success: true };
      }),

    updateStatus: protectedProcedure
      .input(
        z.object({
          practiceSupportRequestId: z.number(),
          coordinationStatus: z.enum(["미섭외", "섭외중", "섭외완료"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrHost(ctx.user)) {
          throw new Error("관리자 또는 호스트만 수정할 수 있습니다");
        }

        await db.updatePracticeSupportStatusAndSyncSemester(input);
        return { success: true };
      }),

    selectInstitution: protectedProcedure
      .input(
        z.object({
          practiceSupportRequestId: z.number(),
          institutionId: z.number(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrHost(ctx.user)) {
          throw new Error("관리자 또는 호스트만 선택할 수 있습니다");
        }

        await db.selectPracticeInstitutionForRequest(input);
        return { success: true };
      }),

    nearbyInstitutions: protectedProcedure
      .input(
        z.object({
          studentId: z.number(),
          institutionType: z.enum(["education", "institution"]),
          limit: z.number().optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        const student = await db.getStudent(input.studentId);
        if (!student) return [];

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          return [];
        }

        return db.listNearbyPracticeInstitutions(input);
      }),

    delete: hostProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deletePracticeSupportRequest(input.id);
        return { success: true };
      }),
  }),
practiceEducationCenter: router({
  list: protectedProcedure.query(async () => {
    return db.listPracticeEducationCenters();
  }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return db.getPracticeEducationCenter(input.id);
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
        throw new Error("관리자 또는 호스트만 등록할 수 있습니다");
      }

      const id = await db.createPracticeEducationCenter({
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
        throw new Error("관리자 또는 호스트만 수정할 수 있습니다");
      }

      const { id, ...rest } = input;
      await db.updatePracticeEducationCenter(id, rest as any);
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
        throw new Error("관리자 또는 호스트만 수정할 수 있습니다");
      }

      await db.updatePracticeEducationCenterAvailability(input.id, {
        isInactive: input.isInactive,
        inactiveReason: input.inactiveReason ?? null,
        inactiveStartDate: input.inactiveStartDate ?? null,
        inactiveEndDate: input.inactiveEndDate ?? null,
        hideOnMapWhenInactive: input.hideOnMapWhenInactive ?? true,
      });

      return { success: true };
    }),

  delete: hostProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deletePracticeEducationCenter(input.id);
      return { success: true };
    }),
}),
  practiceInstitution: router({
    list: protectedProcedure
      .input(
        z.object({
          institutionType: z.enum(["education", "institution"]).optional(),
        }).optional()
      )
      .query(async ({ input }) => {
        return db.listPracticeInstitutions(input?.institutionType);
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getPracticeInstitution(input.id);
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
          throw new Error("관리자 또는 호스트만 등록할 수 있습니다");
        }

        const id = await db.createPracticeInstitution({
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
          rows: z.array(
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
          ),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrHost(ctx.user)) {
          throw new Error("관리자 또는 호스트만 등록할 수 있습니다");
        }

        await db.bulkCreatePracticeInstitutions(
          input.rows.map((row) => ({
            institutionType: row.institutionType,
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
          })) as any
        );

        return { success: true, count: input.rows.length };
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
          throw new Error("관리자 또는 호스트만 수정할 수 있습니다");
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

        await db.updatePracticeInstitution(id, data);
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
        throw new Error("관리자 또는 호스트만 수정할 수 있습니다");
      }

      await db.updatePracticeInstitutionAvailability(input.id, {
        isInactive: input.isInactive,
        inactiveReason: input.inactiveReason ?? null,
        inactiveStartDate: input.inactiveStartDate ?? null,
        inactiveEndDate: input.inactiveEndDate ?? null,
        hideOnMapWhenInactive: input.hideOnMapWhenInactive ?? true,
      });

      return { success: true };
    }),

    delete: hostProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deletePracticeInstitution(input.id);
        return { success: true };
      }),
  }),

  jobSupport: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const assigneeId = isAdminOrHost(ctx.user) ? undefined : Number(ctx.user.id) || 1;
      return db.listJobSupportRequests(assigneeId);
    }),

    listByStudent: protectedProcedure
      .input(z.object({ studentId: z.number() }))
      .query(async ({ ctx, input }) => {
        const student = await db.getStudent(input.studentId);
        if (!student) return [];

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          return [];
        }

        return db.listJobSupportRequestsByStudent(input.studentId);
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
        const student = await db.getStudent(input.studentId);
        if (!student) throw new Error("학생을 찾을 수 없습니다");

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          throw new Error("권한이 없습니다");
        }

        const assignee = await db.getUserById(student.assigneeId);

        const id = await db.createJobSupportRequest({
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
          throw new Error("관리자 또는 호스트만 수정할 수 있습니다");
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

        await db.updateJobSupportRequest(input.id, data);
        return { success: true };
      }),

    delete: hostProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteJobSupportRequest(input.id);
        return { success: true };
      }),
  }),

  settlement: router({
    report: adminProcedure
      .input(
        z.object({
          year: z.number(),
          month: z.number(),
          assigneeId: z.number().optional(),
        })
      )
      .query(async ({ input, ctx }) => {
        const canSeeAll = isAdminOrHost(ctx.user);

        return db.getSettlementReport(
          input.year,
          input.month,
          canSeeAll ? input.assigneeId : Number(ctx.user.id)
        );
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
     * superhost 전용 유저 생성
     * host는 절대 superhost 유저를 만들 수 없게 분리
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
      .mutation(async ({ input }) => {
    const existingUsers = await db.getAllUsersDetailed();
    const hasSuperhost = existingUsers.some((u: any) => u.role === "superhost");

    if (hasSuperhost && input.role === "superhost") {
      throw new Error("슈퍼호스트 계정은 1개만 생성 가능합니다.");
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

        await db.createUserAccount({
          openId: input.openId.trim(),
          username: input.username.trim(),
          passwordHash,
          name: input.name.trim(),
          email: input.email?.trim() || null,
          phone: input.phone?.trim() || null,
          role: input.role,
          bankName: input.bankName?.trim() || null,
          bankAccount: input.bankAccount?.trim() || null,
          loginMethod: "manual",
          isActive: true,
        });

        return { success: true };
      }),

    /**
     * superhost 전용 권한 변경
     */
    updateUserRole: superHostProcedure
      .input(
        z.object({
          id: z.number(),
          role: z.enum(["staff", "admin", "host", "superhost"]),
        })
      )
      .mutation(async ({ input }) => {
	// 이미 존재하는 superhost 개수 확인
const users = await db.getAllUsersDetailed();
const superhostCount = users.filter((u: any) => u.role === "superhost").length;

// superhost로 변경하려는 경우
if (input.role === "superhost") {
  // 현재 대상이 이미 superhost가 아닌데 추가 생성하려는 경우
  const target = users.find((u: any) => u.id === input.id);

  if (!target) throw new Error("유저 없음");

  if (target.role !== "superhost" && superhostCount >= 1) {
    throw new Error("슈퍼호스트는 1명만 가능합니다.");
  }
}
        await db.updateUserRole(input.id, input.role);
        return { success: true };
      }),

    /**
     * 전체 사용자 목록
     * 필요하면 나중에 tenantId 기준으로 분리
     */
    listUsers: superHostProcedure.query(async () => {
      return db.getAllUsersDetailed();
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

console.log("[ROUTER OK] planSemester loaded");
console.log("[ROUTER OK] transferSubject loaded");
console.log("[ROUTER OK] transferAttachment loaded");
console.log("[ROUTER OK] courseTemplate loaded");
console.log("[ROUTER OK] privateCertificate loaded");
console.log("[ROUTER OK] practiceSupport loaded");
console.log("[ROUTER OK] practiceInstitution loaded");
console.log("[ROUTER OK] jobSupport loaded");

export type AppRouter = typeof appRouter;