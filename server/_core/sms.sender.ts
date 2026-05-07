import axios from "axios";

type SmsProviderSettings = {
  provider?: string | null;
  apiKey?: string | null;
  apiSecret?: string | null;
  userId?: string | null;
  accessKey?: string | null;
  secretKey?: string | null;
  serviceId?: string | null;
  senderNumber?: string | null;
  senderName?: string | null;
  isActive?: boolean | null;
};

type SmsSendResult = {
  success: number;
  fail: number;
};

function normalizePhone(phone: string) {
  return String(phone || "").replace(/\D/g, "");
}

export async function sendBulkSms(
  phones: string[],
  message: string,
  settings?: SmsProviderSettings | null
): Promise<SmsSendResult> {
  if (settings && settings.isActive === false) {
    throw new Error("문자 발송 설정이 비활성화되어 있습니다.");
  }

  const normalized = phones
    .map((p) => normalizePhone(p))
    .filter((p) => p.length >= 10);

  const unique = [...new Set(normalized)];

  if (unique.length === 0) {
    return { success: 0, fail: 0 };
  }

  const provider = settings?.provider || "aligo";

  if (provider === "aligo") {
    return sendAligoSms(unique, message, settings);
  }

  if (provider === "solapi") {
    throw new Error("솔라피 발송 모듈은 아직 연결되지 않았습니다.");
  }

  if (provider === "naverCloud") {
    throw new Error("네이버 클라우드 SMS 발송 모듈은 아직 연결되지 않았습니다.");
  }

  if (provider === "toast") {
    throw new Error("NHN Toast SMS 발송 모듈은 아직 연결되지 않았습니다.");
  }

  throw new Error(`지원하지 않는 문자 제공사입니다: ${provider}`);
}

async function sendAligoSms(
  phones: string[],
  message: string,
  settings?: SmsProviderSettings | null
): Promise<SmsSendResult> {
  const url = "https://apis.aligo.in/send/";

  // Railway 서버가 외부로 나갈 때 사용하는 공인 IP 확인용
  try {
    const ipRes = await axios.get("https://api.ipify.org?format=json", {
      timeout: 5000,
    });

    console.log("[SERVER PUBLIC IP]", ipRes.data);
  } catch (ipErr) {
    console.error("[SERVER PUBLIC IP CHECK FAIL]", {
      response: (ipErr as any)?.response?.data,
      error: ipErr,
    });
  }

  const apiKey = settings?.apiKey || process.env.ALIGO_API_KEY || "";
  const userId = settings?.userId || process.env.ALIGO_USER_ID || "";
  const sender = settings?.senderNumber || process.env.ALIGO_SENDER || "";

  if (!apiKey || !userId || !sender) {
    throw new Error(
      "알리고 API 설정이 없습니다. API Key, User ID, 발신번호를 먼저 저장해주세요."
    );
  }

  let success = 0;
  let fail = 0;

  for (const phone of phones) {
    try {
      const res = await axios.post(url, null, {
        params: {
          key: apiKey,
          user_id: userId,
          sender,
          receiver: phone,
          msg: message,
        },
        timeout: 10000,
      });

      if (res.data?.result_code === "1") {
        success++;

        console.log("[ALIGO SMS SUCCESS]", {
          phone,
          result: res.data,
        });
      } else {
        fail++;

        console.error("[ALIGO SMS ERROR]", {
          phone,
          result_code: res.data?.result_code,
          message: res.data?.message,
          msg: res.data?.msg,
          result_msg: res.data?.result_msg,
          full: res.data,
        });
      }
    } catch (err) {
      fail++;

      console.error("[ALIGO SMS FAIL]", {
        phone,
        response: (err as any)?.response?.data,
        error: err,
      });
    }
  }

  return {
    success,
    fail,
  };
}