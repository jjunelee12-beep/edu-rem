import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";
import {
  getBrandingSettings,
  getStaffPublicProfileByToken,
  getStaffPublicProfileOrganizationIdByToken,
  getPublicStudentPortalBySlug,
  getPublicBrandingBySlug,
} from "../db";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getRequestOrigin(req: express.Request): string {
  const configuredOrigin = String(
    process.env.FRONTEND_URL || ""
  )
    .trim()
    .replace(/\/+$/, "");

  if (configuredOrigin) {
    return configuredOrigin;
  }

  const forwardedProto = String(
    req.headers["x-forwarded-proto"] || ""
  )
    .split(",")[0]
    .trim();

  const protocol =
    forwardedProto ||
    req.protocol ||
    "https";

  const host = String(
    req.get("host") || ""
  ).trim();

  if (!host) {
    return "";
  }

  return `${protocol}://${host}`;
}

function toAbsoluteUrl(
  req: express.Request,
  rawValue: unknown
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

  const origin = getRequestOrigin(req);

  if (!origin) {
    return raw;
  }

  return raw.startsWith("/")
    ? `${origin}${raw}`
    : `${origin}/${raw}`;
}

function removeExistingSocialMeta(
  html: string
): string {
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

async function injectStaffProfileMetadata(
  req: express.Request,
  html: string
): Promise<string> {
  const pathname = String(req.path || "").trim();

  const match = pathname.match(
    /^\/staff\/([^/]+)\/?$/
  );

  if (!match) {
    return html;
  }

  let token = "";

  try {
    token = decodeURIComponent(
      String(match[1] || "")
    ).trim();
  } catch {
    token = String(match[1] || "").trim();
  }

  if (!token) {
    return html;
  }

  try {
    const [
      profile,
      organizationId,
    ] = await Promise.all([
      getStaffPublicProfileByToken(token),

      getStaffPublicProfileOrganizationIdByToken(
        token
      ),
    ]);

    if (
      !profile ||
      !organizationId
    ) {
      return html;
    }

    const branding =
      await getBrandingSettings({
        organizationId,
      });

    const displayName = String(
      (profile as any)?.displayName ||
      "담당자"
    ).trim();

    const positionName = String(
      (profile as any)?.publicPositionName ||
      ""
    ).trim();

    const headline = String(
      (profile as any)?.headline ||
      ""
    ).trim();

    const companyName = String(
      (branding as any)?.companyName ||
      ""
    ).trim();

    const profileImageUrl =
      toAbsoluteUrl(
        req,
        (profile as any)?.profileImageUrl
      );

    const companyLogoUrl =
      toAbsoluteUrl(
        req,
        (branding as any)?.companyLogoUrl
      );

    const imageUrl =
      profileImageUrl ||
      companyLogoUrl;

    const title =
      positionName
        ? `${displayName} | ${positionName}`
        : displayName;

    const description =
      headline ||
      `${displayName} 담당자 소개`;

    const origin =
      getRequestOrigin(req);

    const canonicalUrl =
      origin
        ? `${origin}${pathname}`
        : "";

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

    let next =
      removeExistingSocialMeta(html);

    if (
      /<title>[\s\S]*?<\/title>/i.test(
        next
      )
    ) {
      next = next.replace(
        /<title>[\s\S]*?<\/title>/i,
        `<title>${escapeHtml(
          title
        )}</title>`
      );
    }

    if (
      next.includes("</head>")
    ) {
      next = next.replace(
        "</head>",
        `    ${tags}\n  </head>`
      );
    }

    return next;
  } catch (error) {
    console.error(
      "[STAFF OG METADATA ERROR]",
      {
        path: pathname,
        error,
      }
    );

    // OG 생성 실패가 전체 사이트 장애로
    // 이어지면 안 되므로 기존 HTML 반환.
    return html;
  }
}

async function injectPortalMetadata(
  req: express.Request,
  html: string
): Promise<string> {
  const pathname =
    String(
      req.path || ""
    ).trim();

  const studentPortalMatch =
    pathname.match(
      /^\/portal\/([^/]+)\/?$/
    );

  const hostPortalMatch =
    pathname.match(
      /^\/([^/]+)\/portal-management\/community\/?$/
    );

  if (
    !studentPortalMatch &&
    !hostPortalMatch
  ) {
    return html;
  }

  try {
    let slug = "";

    if (studentPortalMatch) {
      try {
        slug =
          decodeURIComponent(
            String(
              studentPortalMatch[1] ||
              ""
            )
          )
            .trim()
            .toLowerCase();
      } catch {
        slug =
          String(
            studentPortalMatch[1] ||
            ""
          )
            .trim()
            .toLowerCase();
      }

      console.log("[PORTAL OG HIT]", {
        pathname,
        slug,
      });
    } else if (hostPortalMatch) {
      try {
        slug =
          decodeURIComponent(
            String(
              hostPortalMatch[1] ||
              ""
            )
          )
            .trim()
            .toLowerCase();
      } catch {
        slug =
          String(
            hostPortalMatch[1] ||
            ""
          )
            .trim()
            .toLowerCase();
      }
    }

    if (!slug) {
      return html;
    }

    let title = "";
    let description = "";
    let siteName = "";
    let shareImageUrl = "";
    let companyLogoUrl = "";

    if (studentPortalMatch) {
      const portal =
  await getPublicStudentPortalBySlug(
    slug
  );

console.log("[PORTAL OG LOOKUP]", {
  slug,
  found: Boolean(portal),
  portalName: portal?.portalName ?? null,
  companyName: portal?.companyName ?? null,
  shareImageUrl: portal?.shareImageUrl ?? null,
});

if (!portal) {
  return html;
}

      title =
        String(
          portal.portalName ||
          portal.companyName ||
          "업무포탈"
        ).trim();

      description =
        "등록회원 전용 업무포탈입니다.";

      siteName =
        String(
          portal.companyName ||
          portal.portalName ||
          "EduCanvas"
        ).trim();

      shareImageUrl =
        String(
          portal.shareImageUrl ||
          ""
        ).trim();

      companyLogoUrl =
        String(
          portal.companyLogoUrl ||
          ""
        ).trim();
    } else {
      const [
        branding,
        portal,
      ] =
        await Promise.all([
          getPublicBrandingBySlug(
            slug
          ),

          getPublicStudentPortalBySlug(
            slug
          ),
        ]);

      if (!branding) {
        return html;
      }

      const companyName =
        String(
          branding.companyName ||
          "EduCanvas"
        ).trim();

      const portalName =
        String(
          portal?.portalName ||
          companyName
        ).trim();

      title =
        `${portalName} Host 공용포탈`;

      description =
        "담당자 전용 업무포탈입니다.";

      siteName =
        companyName;

      shareImageUrl =
        String(
          branding.shareImageUrl ||
          ""
        ).trim();

      companyLogoUrl =
        String(
          branding.companyLogoUrl ||
          ""
        ).trim();
    }

    const imageUrl =
      toAbsoluteUrl(
        req,
        shareImageUrl
      ) ||
      toAbsoluteUrl(
        req,
        companyLogoUrl
      ) ||
      toAbsoluteUrl(
        req,
        process.env.OG_DEFAULT_IMAGE_URL
      ) ||
      toAbsoluteUrl(
        req,
        "/favicon.ico"
      );

    const origin =
      getRequestOrigin(req);

    const canonicalUrl =
      origin
        ? `${origin}${pathname}`
        : "";

    const tags = [
      `<meta property="og:locale" content="ko_KR" />`,

      `<meta property="og:type" content="website" />`,

      `<meta property="og:title" content="${escapeHtml(
        title
      )}" />`,

      `<meta property="og:description" content="${escapeHtml(
        description
      )}" />`,

      siteName
        ? `<meta property="og:site_name" content="${escapeHtml(
            siteName
          )}" />`
        : "",

      imageUrl
        ? `<meta property="og:image" content="${escapeHtml(
            imageUrl
          )}" />`
        : "",

      imageUrl
        ? `<meta property="og:image:width" content="1200" />`
        : "",

      imageUrl
        ? `<meta property="og:image:height" content="630" />`
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

    let next =
      removeExistingSocialMeta(
        html
      );

    if (
      /<title>[\s\S]*?<\/title>/i.test(
        next
      )
    ) {
      next =
        next.replace(
          /<title>[\s\S]*?<\/title>/i,
          `<title>${escapeHtml(
            title
          )}</title>`
        );
    }

    if (
      next.includes(
        "</head>"
      )
    ) {
      next =
        next.replace(
          "</head>",
          `    ${tags}\n  </head>`
        );
    }

    return next;
  } catch (error) {
    console.error(
      "[PORTAL OG METADATA ERROR]",
      {
        path: pathname,
        error,
      }
    );

    return html;
  }
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      let page =
  await vite.transformIndexHtml(
    url,
    template
  );

page =
  await injectStaffProfileMetadata(
    req,
    page
  );

page =
  await injectPortalMetadata(
    req,
    page
  );

res
  .status(200)
  .set({
    "Content-Type": "text/html",
  })
  .end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
app.use("*", async (req, res, next) => {
  try {
    const indexPath =
      path.resolve(
        distPath,
        "index.html"
      );

    let html =
      await fs.promises.readFile(
        indexPath,
        "utf-8"
      );

   html =
  await injectStaffProfileMetadata(
    req,
    html
  );

html =
  await injectPortalMetadata(
    req,
    html
  );

res
  .status(200)
      .set({
        "Content-Type":
          "text/html",
      })
      .send(html);
  } catch (error) {
    next(error);
  }
});
}
