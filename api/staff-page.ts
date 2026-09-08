
type StaffProfileResponse = {
  success: boolean;
  profile?: {
    displayName?: string | null;
    publicPositionName?: string | null;
    headline?: string | null;
    profileImageUrl?: string | null;
    companyName?: string | null;
    companyLogoUrl?: string | null;
  };
};

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function normalizeToken(value: unknown): string {
  if (Array.isArray(value)) {
    return String(value[0] ?? "").trim();
  }

  return String(value ?? "").trim();
}

function toAbsoluteUrl(
  rawValue: unknown,
  origin: string
): string {
  const raw = String(rawValue ?? "").trim();

  if (!raw) {
    return "";
  }

  if (
    raw.startsWith("http://") ||
    raw.startsWith("https://")
  ) {
    return raw;
  }

  if (raw.startsWith("//")) {
    return `https:${raw}`;
  }

  if (!origin) {
    return raw;
  }

  return raw.startsWith("/")
    ? `${origin}${raw}`
    : `${origin}/${raw}`;
}

function removeExistingMetadata(html: string): string {
  let next = html;

  next = next.replace(
    /<meta\s+[^>]*property=["']og:(?:title|description|image|site_name|url|type)["'][^>]*>\s*/gi,
    ""
  );

  next = next.replace(
    /<meta\s+[^>]*name=["']twitter:(?:card|title|description|image)["'][^>]*>\s*/gi,
    ""
  );

  return next;
}

function getRequestOrigin(req: any): string {
  const forwardedProto = String(
    req.headers?.["x-forwarded-proto"] || "https"
  )
    .split(",")[0]
    .trim();

  const forwardedHost = String(
    req.headers?.["x-forwarded-host"] ||
      req.headers?.host ||
      ""
  )
    .split(",")[0]
    .trim();

  if (!forwardedHost) {
    return "";
  }

  return `${forwardedProto}://${forwardedHost}`;
}

async function loadIndexHtml(
  req: any
): Promise<string> {
  const origin = getRequestOrigin(req);

  if (!origin) {
    throw new Error(
      "Vercel origin을 확인할 수 없습니다."
    );
  }

  const response = await fetch(
    `${origin}/index.html`,
    {
      method: "GET",
      headers: {
        Accept: "text/html",
        "User-Agent":
          "EduCanvas-Staff-OG/1.0",
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `index.html fetch failed: ${response.status}`
    );
  }

  return await response.text();
}

export default async function handler(
  req: any,
  res: any
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");

    return res.status(405).json({
      success: false,
      message: "Method Not Allowed",
    });
  }

  try {
    const token = normalizeToken(
      req.query?.token
    );

    if (!token) {
      return res.status(400).send(
        "프로필 토큰이 필요합니다."
      );
    }

    const railwayBaseUrl =
      "https://edu-crm-api-production.up.railway.app";

    const profileResponse = await fetch(
      `${railwayBaseUrl}/api/public/staff-profile/${encodeURIComponent(
        token
      )}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      }
    );

    if (!profileResponse.ok) {
      console.error(
        "[STAFF PAGE PROFILE FETCH FAILED]",
        {
          token,
          status: profileResponse.status,
        }
      );

      return res.status(404).send(
        "담당자 프로필을 찾을 수 없습니다."
      );
    }

    const data =
      (await profileResponse.json()) as StaffProfileResponse;

    if (
      !data?.success ||
      !data?.profile
    ) {
      return res.status(404).send(
        "담당자 프로필을 찾을 수 없습니다."
      );
    }

    const profile = data.profile;

    const displayName = String(
      profile.displayName ||
        "담당자"
    ).trim();

    const positionName = String(
      profile.publicPositionName ||
        ""
    ).trim();

    const headline = String(
      profile.headline ||
        ""
    ).trim();

    const companyName = String(
      profile.companyName ||
        ""
    ).trim();

    const origin =
      getRequestOrigin(req);

    const title =
      positionName
        ? `${displayName} | ${positionName}`
        : displayName;

    const description =
      headline ||
      `${displayName} 담당자 소개`;

    const profileImageUrl =
      toAbsoluteUrl(
        profile.profileImageUrl,
        origin
      );

    const companyLogoUrl =
      toAbsoluteUrl(
        profile.companyLogoUrl,
        origin
      );

    const imageUrl =
      profileImageUrl ||
      companyLogoUrl;

    const canonicalUrl =
      origin
        ? `${origin}/staff/${encodeURIComponent(
            token
          )}`
        : "";

    let html =
  await loadIndexHtml(req);

    html =
      removeExistingMetadata(html);

    if (
      /<title>[\s\S]*?<\/title>/i.test(
        html
      )
    ) {
      html = html.replace(
        /<title>[\s\S]*?<\/title>/i,
        `<title>${escapeHtml(
          title
        )}</title>`
      );
    }

    const tags = [
      `<meta property="og:type" content="website" />`,

      `<meta property="og:title" content="${escapeHtml(
        title
      )}" />`,

      `<meta property="og:description" content="${escapeHtml(
        description
      )}" />`,

      companyName
        ? `<meta property="og:site_name" content="${escapeHtml(
            companyName
          )}" />`
        : "",

      imageUrl
        ? `<meta property="og:image" content="${escapeHtml(
            imageUrl
          )}" />`
        : "",

      canonicalUrl
        ? `<meta property="og:url" content="${escapeHtml(
            canonicalUrl
          )}" />`
        : "",

      `<meta name="twitter:card" content="summary_large_image" />`,

      `<meta name="twitter:title" content="${escapeHtml(
        title
      )}" />`,

      `<meta name="twitter:description" content="${escapeHtml(
        description
      )}" />`,

      imageUrl
        ? `<meta name="twitter:image" content="${escapeHtml(
            imageUrl
          )}" />`
        : "",
    ]
      .filter(Boolean)
      .join("\n    ");

    if (
      html.includes("</head>")
    ) {
      html = html.replace(
        "</head>",
        `    ${tags}\n  </head>`
      );
    }

    res.setHeader(
      "Content-Type",
      "text/html; charset=utf-8"
    );

    res.setHeader(
      "Cache-Control",
      "public, s-maxage=60, stale-while-revalidate=300"
    );

    return res
      .status(200)
      .send(html);
  } catch (error: any) {
    console.error(
      "[VERCEL STAFF PAGE ERROR]",
      error
    );

    return res.status(500).send(
      "담당자 프로필 페이지를 불러오지 못했습니다."
    );
  }
}