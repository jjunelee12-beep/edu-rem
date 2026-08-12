import * as db from "../db";

import type {
  KakaoAiCustomerContext,
} from "./kakao-ai-customer-resolver";

/**
 * 카카오 AI에서 고객에게 제공할
 * 실습기관 최소 공개정보.
 *
 * DB Row 전체를 그대로 AI에 넘기지 않는다.
 */
export type KakaoAiPracticeInstitutionItem = {
  id:
    number;

  institutionType:
    "education" |
    "institution";

  name:
    string;

  address:
    string | null;

  detailAddress:
    string | null;

  phone:
    string | null;

  distanceKm:
    number | null;

  price:
    number | null;

  availableCourse:
    string | null;

  practiceAvailabilityType:
    string | null;

  selectionStatus:
    string | null;

  selectionValidFrom:
    string | null;

  selectionValidTo:
    string | null;
};

/**
 * 등록회원 실습배정지원센터 조회 결과.
 *
 * educationCenters:
 * 실습교육원
 *
 * practiceInstitutions:
 * 실제 현장실습기관
 */
export type KakaoAiPracticeCenterResult = {
  organizationId:
    number;

  studentId:
    number;

  educationCenters:
    KakaoAiPracticeInstitutionItem[];

  practiceInstitutions:
    KakaoAiPracticeInstitutionItem[];
};

function normalizePositiveInteger(
  value:
    unknown,

  fallback:
    number
): number {
  const normalized =
    Math.floor(
      Number(
        value ||
        0
      )
    );

  if (
    !Number.isFinite(
      normalized
    ) ||
    normalized <=
      0
  ) {
    return fallback;
  }

  return normalized;
}

function normalizeNullableText(
  value:
    unknown
): string | null {
  const normalized =
    String(
      value ??
      ""
    ).trim();

  return normalized ||
    null;
}

function normalizeNullableNumber(
  value:
    unknown
): number | null {
  if (
    value ===
      null ||
    value ===
      undefined ||
    value ===
      ""
  ) {
    return null;
  }

  const normalized =
    Number(
      value
    );

  return Number.isFinite(
    normalized
  )
    ? normalized
    : null;
}

function normalizeDateText(
  value:
    unknown
): string | null {
  if (
    value ===
      null ||
    value ===
      undefined ||
    value ===
      ""
  ) {
    return null;
  }

  if (
    value instanceof
      Date
  ) {
    return value
      .toISOString()
      .slice(
        0,
        10
      );
  }

  const normalized =
    String(
      value
    ).trim();

  return normalized ||
    null;
}

/**
 * DB Row를 카카오 AI용 안전한 형태로 줄인다.
 *
 * DB 내부 메모나 관리용 컬럼,
 * 좌표 등은 AI에게 그대로 넘기지 않는다.
 */
function mapPracticeInstitution(
  row:
    any,

  institutionType:
    "education" |
    "institution"
): KakaoAiPracticeInstitutionItem {
  return {
    id:
      Number(
        row?.id ||
        0
      ),

    institutionType,

    name:
      String(
        row?.name ||
        ""
      ).trim(),

    address:
      normalizeNullableText(
        row?.address
      ),

    detailAddress:
      normalizeNullableText(
        row?.detailAddress
      ),

    phone:
      normalizeNullableText(
        row?.phone
      ),

    distanceKm:
      normalizeNullableNumber(
        row?.distanceKm
      ),

    price:
      normalizeNullableNumber(
        row?.price
      ),

    availableCourse:
      normalizeNullableText(
        row?.availableCourse
      ),

    practiceAvailabilityType:
      normalizeNullableText(
        row?.practiceAvailabilityType
      ),

    selectionStatus:
      normalizeNullableText(
        row?.selectionStatus
      ),

    selectionValidFrom:
      normalizeDateText(
        row?.selectionValidFrom
      ),

    selectionValidTo:
      normalizeDateText(
        row?.selectionValidTo
      ),
  };
}

/**
 * 카카오 등록회원 본인의 위치를 기준으로
 * 실습배정지원센터의 가까운 기관을 조회한다.
 *
 * 중요:
 *
 * - 신규 고객 호출 금지
 * - 인증된 customer.studentId만 사용
 * - AI가 전달한 studentId 사용 금지
 * - 조회만 수행
 * - 기관 자동선택 / 배정 / 수정 금지
 */
export async function resolveKakaoAiPracticeCenter(
  params: {
    customer:
      KakaoAiCustomerContext;

    limitPerType?:
      number;
  }
): Promise<KakaoAiPracticeCenterResult> {
  const customer =
    params.customer;

  if (
    customer.customerType !==
      "registered" ||
    customer.verified !==
      true ||
    customer.verificationStatus !==
      "registered"
  ) {
    throw new Error(
      "등록회원 인증이 필요합니다."
    );
  }

  const organizationId =
    normalizePositiveInteger(
      customer.organizationId,
      0
    );

  const studentId =
    normalizePositiveInteger(
      customer.studentId,
      0
    );

  if (
    organizationId <=
      0
  ) {
    throw new Error(
      "등록회원 회사 정보가 올바르지 않습니다."
    );
  }

  if (
    studentId <=
      0
  ) {
    throw new Error(
      "등록회원 학생 정보가 올바르지 않습니다."
    );
  }

  const limitPerType =
    Math.min(
      normalizePositiveInteger(
        params.limitPerType,
        10
      ),
      30
    );

  /**
   * 기존 실습배정지원센터 거리계산 DB 함수를
   * 그대로 재사용한다.
   *
   * 학생의 CRM 등록 좌표를 기준으로
   * 가까운 순으로 반환된다.
   */
  const [
    educationRows,
    institutionRows,
  ] = await Promise.all([
    db.listNearbyPracticeInstitutions({
      organizationId,

      studentId,

      institutionType:
        "education",

      limit:
        limitPerType,
    }),

    db.listNearbyPracticeInstitutions({
      organizationId,

      studentId,

      institutionType:
        "institution",

      limit:
        limitPerType,
    }),
  ]);

  return {
    organizationId,

    studentId,

    educationCenters:
      (
        educationRows ||
        []
      ).map(
        (
          row:
            any
        ) =>
          mapPracticeInstitution(
            row,
            "education"
          )
      ),

    practiceInstitutions:
      (
        institutionRows ||
        []
      ).map(
        (
          row:
            any
        ) =>
          mapPracticeInstitution(
            row,
            "institution"
          )
      ),
  };
}