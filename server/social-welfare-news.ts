import { XMLParser } from "fast-xml-parser";
import { load } from "cheerio";
import { createHash } from "node:crypto";

export type NewsCategory =
  | "policy"
  | "education"
  | "employment";

export type WelfareNews = {
  id: string;
  title: string;
  summary: string;
  source: string;
  originalUrl: string;
  imageUrl: string;
  publishedAt: string;
  category: NewsCategory;
};

const REFRESH_INTERVAL = 30 * 60 * 1000;
const MAX_PER_CATEGORY = 30;
const REQUEST_TIMEOUT = 8000;
const MAX_FEED_BYTES = 2 * 1024 * 1024;

const SOURCES = [
  {
    name: "보건복지부",
    url: "https://www.mohw.go.kr/rss/board.es?mid=a10503000000&bid=0027&info",
    category: "policy" as NewsCategory,
    allowSummary: false,
    allowImages: false,
  },
  {
    name: "보건복지부 공지사항",
    url: "https://www.mohw.go.kr/rss/board.es?mid=a10501010000&bid=0003&cg_code=C01&info",
    category: "policy" as NewsCategory,
    allowSummary: false,
    allowImages: false,
  },
  {
    name: "보건복지부 채용공고",
    url: "https://www.mohw.go.kr/rss/board.es?mid=a10501040000&bid=0003&cg_code=C03&info",
    category: "employment" as NewsCategory,
    allowSummary: false,
    allowImages: false,
  },
  {
    name: "보건복지부 법령·지침",
    url: "https://www.mohw.go.kr/rss/board.es?mid=a10409020000&update=&cg_code=&bid=0026",
    category: "policy" as NewsCategory,
    allowSummary: false,
    allowImages: false,
  },
  {
    name: "고용노동부 공지사항",
    url: "https://www.moel.go.kr/rss/notice.do",
    category: "employment" as NewsCategory,
    allowSummary: false,
    allowImages: false,
  },
  {
    name: "고용노동부 정책자료",
    url: "https://www.moel.go.kr/rss/policy.do",
    category: "policy" as NewsCategory,
    allowSummary: false,
    allowImages: false,
  },
];

const parser = new XMLParser({
  ignoreAttributes: false,
  processEntities: false,
  trimValues: true,
});

let newsCache: WelfareNews[] = [];
let lastUpdatedAt: string | null = null;
let refreshing = false;
let schedulerStarted = false;

function plainText(value: unknown): string {
  if (typeof value !== "string") return "";

  const $ = load(value);
  $("script, style").remove();

  return $.root().text().replace(/\s+/g, " ").trim();
}

function safeUrl(value: unknown): string {
  if (typeof value !== "string") return "";

  try {
    const url = new URL(
  value.trim().replace(/&amp;/g, "&")
);

    if (
      url.protocol !== "https:" &&
      url.protocol !== "http:"
    ) {
      return "";
    }

    if (url.username || url.password) return "";

    return url.href;
  } catch {
    return "";
  }
}

function extractNewsImage(
  item: any,
  originalUrl: string
): string {
  const candidates: unknown[] = [];

  const toArray = (value: any) =>
    Array.isArray(value)
      ? value
      : value
        ? [value]
        : [];

  // RSS 미디어 썸네일
  for (const media of toArray(item["media:thumbnail"])) {
    candidates.push(media["@_url"]);
  }

  // RSS 미디어 콘텐츠
  for (const media of toArray(item["media:content"])) {
    const type = String(media["@_type"] || "");
    const medium = String(media["@_medium"] || "");

    if (
      type.startsWith("image/") ||
      medium === "image"
    ) {
      candidates.push(media["@_url"]);
    }
  }

  // RSS 첨부 이미지
  for (const enclosure of toArray(item.enclosure)) {
    const type = String(enclosure["@_type"] || "");

    if (type.startsWith("image/")) {
      candidates.push(enclosure["@_url"]);
    }
  }

  // RSS 본문에 포함된 이미지
  for (const content of [
    item.description,
    item["content:encoded"],
  ]) {
    if (typeof content !== "string") continue;

    const $ = load(content);

    $("img").each((_, element) => {
      candidates.push(
        $(element).attr("data-src") ||
        $(element).attr("src")
      );
    });
  }

  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;

    try {
      const url = new URL(candidate, originalUrl);

      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password
      ) {
        continue;
      }

      return url.href;
    } catch {
      continue;
    }
  }

  return "";
}

function isWelfareRelated(title: string): boolean {
  return /사회복지|복지시설|복지서비스|복지정책|사회서비스|돌봄|요양|장애인|노인|고령자|아동|청소년|보육|저소득|취약계층|자립지원|기초생활|지역사회|사회보장|수급자|생활지원사|활동지원사|직업재활|장기요양|가족센터|다문화|학점은행제|현장실습|보수교육|사회복지사|복지관|복지센터|복지제도|복지지원|복지사업/.test(title.replace(/\s+/g, ""));
}

function classifyNews(
  title: string,
  fallback: NewsCategory
): NewsCategory {
  if (
    /사회복지사.*(자격|시험|교육)|학점은행제|보수교육|자격증|현장실습/.test(title)
  ) {
    return "education";
  }

  if (
    /채용|취업|일자리|처우개선|처우 개선|호봉|급여|근무환경|종사자/.test(title)
  ) {
    return "employment";
  }

  return fallback;
}

async function fetchFeed(url: string): Promise<string> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    redirect: "error",
    headers: {
      Accept: "application/rss+xml, application/xml, text/xml",
    },
  });

  if (!response.ok || !response.body) {
    throw new Error(`RSS HTTP ${response.status}`);
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      total += value.byteLength;

      if (total > MAX_FEED_BYTES) {
        throw new Error("RSS response too large");
      }

      chunks.push(value);
    }

    return Buffer.concat(chunks).toString("utf8");
  } finally {
    await reader.cancel().catch(() => {});
  }
}

async function collectSource(
  source: (typeof SOURCES)[number]
): Promise<WelfareNews[]> {
  const xml = await fetchFeed(source.url);

  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) {
    throw new Error("Unsupported XML declaration");
  }

  const parsed = parser.parse(xml);

if (!parsed?.rss?.channel) {
  throw new Error("Invalid RSS feed format");
}

const rawItems = parsed.rss.channel.item;

  const items = Array.isArray(rawItems)
    ? rawItems
    : rawItems
      ? [rawItems]
      : [];

  const result: WelfareNews[] = [];

  for (const item of items.slice(0, 60)) {
    const title = plainText(item.title).slice(0, 300);
    const originalUrl = safeUrl(item.link);

    if (!title || !originalUrl) continue;

if (!isWelfareRelated(title)) continue;

    const publishedTime = Date.parse(
      String(item.pubDate || item["dc:date"] || "")
    );

    if (!Number.isFinite(publishedTime)) continue;

    const category = classifyNews(
      title,
      source.category
    );

    result.push({
      id: createHash("sha256")
        .update(originalUrl)
        .digest("hex")
        .slice(0, 24),

      title,

      summary: source.allowSummary
        ? plainText(item.description).slice(0, 1500)
        : "",

      source: source.name,
      originalUrl,
      category,
      imageUrl: source.allowImages
  ? extractNewsImage(item, originalUrl)
  : "",

      publishedAt: new Date(
        publishedTime
      ).toISOString(),
    });
  }

  return result;
}

export async function refreshWelfareNews() {
  if (refreshing) return;

  refreshing = true;

  try {
    const collected: WelfareNews[] = [];
    let successCount = 0;

    // 순차 수집으로 외부 요청 부하 제한
    for (const source of SOURCES) {
      try {
        const articles = await collectSource(source);

console.log(
  `[WELFARE NEWS SOURCE] ${source.name}: ${articles.length} articles`
);

if (articles.length === 0) continue;

collected.push(...articles);
successCount++;
      } catch (error) {
        console.warn(
          "[WELFARE NEWS SOURCE]",
          source.name,
          error
        );
      }
    }

    // 수집 실패 시 기존 캐시 유지
if (successCount === 0) {
  console.warn(
    "[WELFARE NEWS] No articles collected. Keeping existing cache."
  );
  return;
}

    const unique = new Map<string, WelfareNews>();

    for (const article of [...newsCache, ...collected]) {
      unique.set(article.id, article);
    }

    const sorted = [...unique.values()].sort(
      (a, b) =>
        Date.parse(b.publishedAt) -
        Date.parse(a.publishedAt)
    );

    const categories: NewsCategory[] = [
      "policy",
      "education",
      "employment",
    ];

    newsCache = categories
      .flatMap(category =>
        sorted
          .filter(item => item.category === category)
          .slice(0, MAX_PER_CATEGORY)
      )
      .sort(
        (a, b) =>
          Date.parse(b.publishedAt) -
          Date.parse(a.publishedAt)
      );

    lastUpdatedAt = new Date().toISOString();

    console.log(
      "[WELFARE NEWS] Cached:",
      newsCache.length
    );
  } catch (error) {
    console.error("[WELFARE NEWS ERROR]", error);
  } finally {
    refreshing = false;
  }
}

export function startWelfareNewsScheduler() {
  if (schedulerStarted) return;

  schedulerStarted = true;

  // 서버 시작 직후 부하 분산
  const initialTimer = setTimeout(() => {
    void refreshWelfareNews();
  }, 15000);

  initialTimer.unref();

  const interval = setInterval(() => {
    void refreshWelfareNews();
  }, REFRESH_INTERVAL);

  interval.unref();
}

export function getWelfareNewsList(
  category: NewsCategory | "all" = "all",
  limit = 10,
  offset = 0
) {
  const filtered =
    category === "all"
      ? newsCache
      : newsCache.filter(
          item => item.category === category
        );

  return {
    items: filtered.slice(offset, offset + limit),
    total: filtered.length,
    hasMore: offset + limit < filtered.length,
    lastUpdatedAt,
  };
}

export function getWelfareNewsDetail(id: string) {
  return newsCache.find(item => item.id === id) ?? null;
}