import {
  createHash,
  timingSafeEqual,
} from "node:crypto";

export type KakaoAiDeveloperAccessResult = {
  allowed:
    boolean;

  organizationMatched:
    boolean;

  userMatched:
    boolean;

  reason:
    | "allowed"
    | "organization_not_allowed"
    | "developer_user_not_configured"
    | "user_not_allowed";
};

function normalizePositiveInteger(
  value:
    unknown
): number | null {
  const numberValue =
    Math.floor(
      Number(
        value ||
        0
      )
    );

  if (
    !Number.isFinite(
      numberValue
    ) ||
    numberValue <=
      0
  ) {
    return null;
  }

  return numberValue;
}

function normalizeText(
  value:
    unknown
): string {
  return String(
    value ??
    ""
  ).trim();
}

function sha256(
  value:
    string
): string {
  return createHash(
    "sha256"
  )
    .update(
      value,
      "utf8"
    )
    .digest(
      "hex"
    );
}

function safeEqual(
  left:
    string,

  right:
    string
): boolean {
  const leftBuffer =
    Buffer.from(
      left,
      "utf8"
    );

  const rightBuffer =
    Buffer.from(
      right,
      "utf8"
    );

  if (
    leftBuffer.length !==
      rightBuffer.length
  ) {
    return false;
  }

  return timingSafeEqual(
    leftBuffer,
    rightBuffer
  );
}

/**
 * EduCanvas Kakao AI 개발자 테스트 계정 판별.
 *
 * 보안 원칙:
 *
 * 1. organizationId가 지정된 회사와 정확히 같아야 한다.
 * 2. 현재 Kakao channelUserKey의 SHA-256이
 *    환경변수에 등록된 값과 정확히 같아야 한다.
 * 3. AI 모델은 이 권한을 부여할 수 없다.
 * 4. 명령어 문자열을 아는 것만으로는 사용할 수 없다.
 */
export function checkKakaoAiDeveloperAccess(
  params: {
    organizationId:
      number;

    channelUserKey:
      string;
  }
): KakaoAiDeveloperAccessResult {
  const organizationId =
    normalizePositiveInteger(
      params.organizationId
    );

    const allowedOrganizationId =
    1;

  /**
   * 회사 제한.
   *
   * 위드원교육 organizationId만
   * 개발자 테스트 명령을 허용한다.
   */
  if (
    !organizationId ||
    !allowedOrganizationId ||
    organizationId !==
      allowedOrganizationId
  ) {
    return {
      allowed:
        false,

      organizationMatched:
        false,

      userMatched:
        false,

      reason:
        "organization_not_allowed",
    };
  }

    const configuredHash =
    "8611f82ec54f49acad7594f27a4d0f3f2c54ce80a8f61e07eb36dea88445fea3";

  if (
    !configuredHash
  ) {
    return {
      allowed:
        false,

      organizationMatched:
        true,

      userMatched:
        false,

      reason:
        "developer_user_not_configured",
    };
  }

  const channelUserKey =
    normalizeText(
      params.channelUserKey
    );

  if (
    !channelUserKey
  ) {
    return {
      allowed:
        false,

      organizationMatched:
        true,

      userMatched:
        false,

      reason:
        "user_not_allowed",
    };
  }

  const currentHash =
    sha256(
      channelUserKey
    ).toLowerCase();

  const userMatched =
    safeEqual(
      currentHash,
      configuredHash
    );

  return {
    allowed:
      userMatched,

    organizationMatched:
      true,

    userMatched,

    reason:
      userMatched
        ? "allowed"
        : "user_not_allowed",
  };
}