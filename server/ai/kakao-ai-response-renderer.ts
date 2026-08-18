import * as db from "../db";

import type {
  KakaoAiConversationOrchestratorResult,
} from "./kakao-ai-conversation-orchestrator";

type KakaoOutput =
  Record<string, any>;

export type KakaoAiRenderedResponse = {
  version:
    "2.0";

  template: {
    outputs:
      KakaoOutput[];
  };
};

function normalizeText(
  value:
    unknown
): string {
  return String(
    value ??
    ""
  ).trim();
}

function normalizePositiveInteger(
  value:
    unknown
): number | null {
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
    return null;
  }

  return normalized;
}

function buildSimpleTextOutput(
  text:
    string
): KakaoOutput {
  return {
    simpleText: {
      text,
    },
  };
}

/**
 * 담당자 공개페이지 URL.
 *
 * 중요:
 * AI가 URL을 생성하지 않고
 * 서버 Renderer가 publicToken으로 확정한다.
 *
 * 현재 CRM 공개페이지 경로가 다르다면
 * 아래 pathname 한 곳만 실제 경로에 맞게 변경한다.
 */
function buildStaffPublicProfileUrl(
  params: {
    origin:
      string;

    publicToken:
      string;
  }
): string | null {
  const origin =
    normalizeText(
      params.origin
    ).replace(
      /\/+$/,
      ""
    );

  const publicToken =
    normalizeText(
      params.publicToken
    );

  if (
    !origin ||
    !publicToken
  ) {
    return null;
  }

  return (
    `${origin}/staff/${encodeURIComponent(
      publicToken
    )}`
  );
}

async function loadPublicStaffProfile(
  params: {
    organizationId:
      number;

    userId:
      number;
  }
) {
  const profile =
    await db.getStaffPublicProfile({
      organizationId:
        params.organizationId,

      userId:
        params.userId,
    });

  if (
    !profile ||
    profile.isActive !==
      true
  ) {
    return null;
  }

  return profile;
}

function buildStaffDescription(
  profile:
    any
): string {
  const headline =
    normalizeText(
      profile?.headline
    );

  if (
    headline
  ) {
    return headline;
  }

  const consultationStyle =
    normalizeText(
      profile?.consultationStyle
    );

  if (
    consultationStyle
  ) {
    return consultationStyle;
  }

  const specialties =
    Array.isArray(
      profile?.specialties
    )
      ? profile.specialties
          .map(
            normalizeText
          )
          .filter(
            Boolean
          )
          .slice(
            0,
            3
          )
      : [];

  if (
    specialties.length >
    0
  ) {
    return specialties.join(
      " · "
    );
  }

  const introduction =
    normalizeText(
      profile?.introduction
    );

  if (
    introduction
  ) {
    return introduction
      .slice(
        0,
        120
      );
  }

  return "상담 담당자";
}

function buildStaffTitle(
  profile:
    any
): string {
  const name =
    normalizeText(
      profile?.displayName
    );

  const position =
    normalizeText(
      profile?.publicPositionName
    );

  return [
    name,
    position,
  ]
    .filter(
      Boolean
    )
    .join(
      " "
    ) ||
    "상담 담당자";
}

/**
 * 카카오 basicCard.
 *
 * 담당자 프로필의 공개 설정만 사용한다.
 */
function buildStaffBasicCard(
  params: {
    profile:
      any;

    profileUrl:
      string | null;
  }
): KakaoOutput {
  const profile =
    params.profile;

  const buttons:
    any[] = [];

  if (
    params.profileUrl
  ) {
    buttons.push({
      action:
        "webLink",

      label:
        "담당자 소개 보기",

      webLinkUrl:
        params.profileUrl,
    });
  }

  const consultationUrl =
    normalizeText(
      profile?.consultationUrl
    );

  if (
    profile
      ?.showConsultationButton ===
      true &&
    consultationUrl
  ) {
    buttons.push({
      action:
        "webLink",

      label:
        "상담하기",

      webLinkUrl:
        consultationUrl,
    });
  }

  const card:
    Record<string, any> = {
    title:
      buildStaffTitle(
        profile
      ),

    description:
      buildStaffDescription(
        profile
      ),
  };

  const imageUrl =
    normalizeText(
      profile?.profileImageUrl
    );

  if (
    imageUrl
  ) {
    card.thumbnail = {
      imageUrl,
    };
  }

  if (
    buttons.length >
    0
  ) {
    card.buttons =
      buttons.slice(
        0,
        3
      );
  }

  return {
    basicCard:
      card,
  };
}

async function buildRecommendedStaffOutputs(
  params: {
    organizationId:
      number;

    result:
      KakaoAiConversationOrchestratorResult;

    origin:
      string;
  }
): Promise<KakaoOutput[]> {
  const userId =
    normalizePositiveInteger(
      params.result
        .staffAction
        ?.recommendedStaff
        ?.userId ||
      params.result
        .resolvedContext
        ?.staffContext
        ?.recommendedStaff
        ?.userId
    );

  if (
    !userId
  ) {
    return [];
  }

  const profile =
    await loadPublicStaffProfile({
      organizationId:
        params.organizationId,

      userId,
    });

  if (
    !profile
  ) {
    return [];
  }

  const profileUrl =
    buildStaffPublicProfileUrl({
      origin:
        params.origin,

      publicToken:
        normalizeText(
          profile.publicToken
        ),
    });

  return [
    buildStaffBasicCard({
      profile,
      profileUrl,
    }),
  ];
}

async function buildStaffListOutputs(
  params: {
    organizationId:
      number;

    result:
      KakaoAiConversationOrchestratorResult;

    origin:
      string;
  }
): Promise<KakaoOutput[]> {
  const candidates =
    params.result
      .staffAction
      ?.candidates ||
    params.result
      .resolvedContext
      ?.staffContext
      ?.candidates ||
    [];

  const profiles:
    Array<{
      profile:
        any;

      profileUrl:
        string | null;
    }> = [];

  /**
   * 카카오 카드가 너무 길어지지 않도록
   * 우선 최대 10명까지만 Renderer에서 처리한다.
   */
  for (
    const candidate of
    candidates.slice(
      0,
      10
    )
  ) {
    const userId =
      normalizePositiveInteger(
        candidate?.userId
      );

    if (
      !userId
    ) {
      continue;
    }

    const profile =
      await loadPublicStaffProfile({
        organizationId:
          params.organizationId,

        userId,
      });

    if (
      !profile
    ) {
      continue;
    }

    profiles.push({
      profile,

      profileUrl:
        buildStaffPublicProfileUrl({
          origin:
            params.origin,

          publicToken:
            normalizeText(
              profile.publicToken
            ),
        }),
    });
  }

  if (
    profiles.length ===
    0
  ) {
    return [];
  }

  /**
   * 담당자가 1명이면 Carousel 대신
   * BasicCard 하나가 더 자연스럽다.
   */
  if (
    profiles.length ===
    1
  ) {
    return [
      buildStaffBasicCard(
        profiles[0]
      ),
    ];
  }

  const items =
    profiles.map(
      item => {
        const basicCard =
          buildStaffBasicCard(
            item
          ).basicCard;

        return basicCard;
      }
    );

  return [
    {
      carousel: {
        type:
          "basicCard",

        items,
      },
    },
  ];
}

/**
 * Orchestrator 결과를
 * 실제 Kakao SkillResponse JSON으로 변환한다.
 *
 * Composer:
 * "무슨 말을 할 것인가"
 *
 * Renderer:
 * "카카오에서 어떻게 보여줄 것인가"
 */
export async function renderKakaoAiResponse(
  params: {
    result:
      KakaoAiConversationOrchestratorResult;

    origin:
      string;

    fallbackText?:
      string;
  }
): Promise<KakaoAiRenderedResponse> {
  const organizationId =
    normalizePositiveInteger(
      params.result
        .organizationId
    );

  const replyText =
    normalizeText(
      params.result
        .responseComposition
        ?.replyText ||
      params.result
        .registrationVerification
        ?.replyText ||
      params.fallbackText
    ) ||
    "문의 내용을 처리하지 못했습니다. 잠시 후 다시 말씀해주세요.";

  const outputs:
    KakaoOutput[] = [
      buildSimpleTextOutput(
        replyText
      ),
    ];

  /**
   * 담당자 Action이 실제 처리된 경우에만
   * 추가 UI를 붙인다.
   */
  if (
    organizationId &&
    params.result.staffAction
      ?.handled ===
      true &&
    params.result.staffAction
      .success ===
      true
  ) {
    const action =
      params.result
        .staffAction
        .action;

    /**
     * 추천:
     * 자연어 + 추천 담당자 카드 1개.
     */
    if (
      action ===
      "recommend"
    ) {
      const staffOutputs =
        await buildRecommendedStaffOutputs({
          organizationId,

          result:
            params.result,

          origin:
            params.origin,
        });

      outputs.push(
        ...staffOutputs
      );
    }

    /**
     * 목록:
     * 자연어 + 담당자 Carousel.
     */
    if (
      action ===
      "list"
    ) {
      const staffOutputs =
        await buildStaffListOutputs({
          organizationId,

          result:
            params.result,

          origin:
            params.origin,
        });

      outputs.push(
        ...staffOutputs
      );
    }
  }

  return {
    version:
      "2.0",

    template: {
      outputs,
    },
  };
}