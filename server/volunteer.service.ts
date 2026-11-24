import { XMLParser } from "fast-xml-parser";
import { TRPCError } from "@trpc/server";

export type VolunteerSearchParams = {
  pageNo?: number;
  numOfRows?: number;
  keyword?: string;
  schCateGu?: string;
  schSido?: string;
  schSign1?: string;
  upperClCode?: string;
  nanmClCode?: string;
  progrmBgnde?: string;
  progrmEndde?: string;
  adultPosblAt?: string;
  yngbgsPosblAt?: string;
  actBeginTm?: string;
  actEndTm?: string;
  noticeBgnde?: string;
  noticeEndde?: string;
  actPlace?: string;
  nanmmbyNm?: string;
};

const parser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false,
  trimValues: true,
  processEntities: false,
});

const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_SIZE = 300;

const cache = new Map<
  string,
  {
    expiresAt: number;
    data: any;
  }
>();

const pendingRequests = new Map<string, Promise<any>>();

function getApiConfig() {
  const apiKey = process.env.VOLUNTEER_API_KEY?.trim();

  const apiUrl = (
    process.env.VOLUNTEER_API_URL ||
    "https://apis.data.go.kr/1741000/volunteerPartcptnService"
  ).replace(/\/+$/, "");

  if (!apiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "봉사활동 API 인증키가 설정되지 않았습니다.",
    });
  }

  return {
    apiKey,
    apiUrl,
  };
}

function setCache(key: string, data: any) {
  const now = Date.now();

  for (const [cacheKey, value] of cache) {
    if (value.expiresAt <= now) {
      cache.delete(cacheKey);
    }
  }

  if (cache.size >= CACHE_MAX_SIZE) {
    const firstKey = cache.keys().next().value;

    if (firstKey !== undefined) {
      cache.delete(firstKey);
    }
  }

  cache.set(key, {
    expiresAt: now + CACHE_TTL_MS,
    data,
  });
}

async function requestVolunteerApi(
  endpoint: string,
  params: Record<string, string | number | undefined>
) {
  const { apiKey, apiUrl } = getApiConfig();

  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ""
    ) {
      query.set(key, String(value).trim());
    }
  }

  query.sort();

  const cacheKey = `${endpoint}?${query.toString()}`;

  const cached = cache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const pending = pendingRequests.get(cacheKey);

  if (pending) {
    return pending;
  }

  let decodedKey = apiKey;

  try {
    decodedKey = decodeURIComponent(apiKey);
  } catch {
    // 일반 인증키 그대로 사용
  }

  query.set("serviceKey", decodedKey);

  const url = `${apiUrl}/${endpoint}?${query.toString()}`;

  const request = (async () => {
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/xml",
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: `봉사활동 API 요청 실패 (${response.status})`,
        });
      }

      const xml = await response.text();

      if (/<!DOCTYPE|<!ENTITY/i.test(xml)) {
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: "허용되지 않는 XML 응답입니다.",
        });
      }

      const parsed = parser.parse(xml);

      const result = parsed?.response ?? parsed;

      const header = result?.header;
      const body = result?.body;

      const resultCode = String(
        header?.resultCode ??
        parsed?.OpenAPI_ServiceResponse?.cmmMsgHeader?.returnReasonCode ??
        ""
      ).trim();

      const successCodes = ["0", "00", "0000"];

      if (!successCodes.includes(resultCode) || !body) {
        console.error(
          "[VOLUNTEER API] response error:",
          resultCode
        );

        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: `봉사활동 정보를 조회하지 못했습니다. (${resultCode || "INVALID_RESPONSE"})`,
        });
      }

      const rawItems = body?.items?.item;

      const items = Array.isArray(rawItems)
        ? rawItems
        : rawItems && typeof rawItems === "object"
          ? [rawItems]
          : [];

      const data = {
        items,
        pageNo: Number(body?.pageNo || 1),
        numOfRows: Number(
          body?.numOfRows || items.length
        ),
        totalCount: Number(body?.totalCount || 0),
      };

      setCache(cacheKey, data);

      return data;
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }

      console.error("[VOLUNTEER API] request failed");

      throw new TRPCError({
        code: "BAD_GATEWAY",
        message: "봉사활동 정보 서버에 연결하지 못했습니다.",
      });
    }
  })();

  pendingRequests.set(cacheKey, request);

  try {
    return await request;
  } finally {
    pendingRequests.delete(cacheKey);
  }
}

export async function getVolunteerList(
  params: VolunteerSearchParams = {}
) {
  return requestVolunteerApi(
    "getVltrSearchWordList",
    {
      ...params,
      pageNo: params.pageNo ?? 1,
      numOfRows: params.numOfRows ?? 20,
    }
  );
}

export async function getVolunteerDetail(
  progrmRegistNo: string
) {
  const result = await requestVolunteerApi(
    "getVltrPartcptnItem",
    {
      progrmRegistNo,
      pageNo: 1,
      numOfRows: 1,
    }
  );

  const item = result.items[0];

  if (!item) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "해당 봉사활동 정보를 찾을 수 없습니다.",
    });
  }

  return item;
}