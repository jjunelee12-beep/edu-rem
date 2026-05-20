import { db } from "../db";
import {
  teams,
  positions,
  systemSettings,
  educationInstitutions,
} from "../../drizzle/schema";

export async function bootstrapOrganization(params: {
  organizationId: number;
  ownerUserId: number;
}) {
  const { organizationId } = params;

  // 기본 팀 생성
  await db.insert(teams).values([
    {
      organizationId,
      name: "상담팀",
    },
    {
      organizationId,
      name: "학사팀",
    },
    {
      organizationId,
      name: "정산팀",
    },
  ]);

  // 기본 직급 생성
  await db.insert(positions).values([
    {
      organizationId,
      name: "staff",
    },
    {
      organizationId,
      name: "admin",
    },
    {
      organizationId,
      name: "host",
    },
  ]);

  // 기본 시스템 설정
  await db.insert(systemSettings).values({
    organizationId,
    payoutDay: 25,
  });

  // 기본 교육원
  await db.insert(educationInstitutions).values({
    organizationId,
    name: "기본 교육원",
    settlementType: "subject",
    normalSubjectPrice: "75000",
  });
}