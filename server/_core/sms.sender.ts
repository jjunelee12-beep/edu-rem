import axios from "axios";

type SmsProviderSettings = {
  provider?: string | null;
  apiKey?: string | null;
  userId?: string | null;
  senderNumber?: string | null;
  isActive?: boolean | null;
};

export async function sendBulkSms(
  phones: string[],
  message: string,
  settings?: SmsProviderSettings | null
) {
  const url = "https://apis.aligo.in/send/";

  const apiKey = settings?.apiKey || process.env.ALIGO_API_KEY || "";
  const userId = settings?.userId || process.env.ALIGO_USER_ID || "";
  const sender = settings?.senderNumber || process.env.ALIGO_SENDER || "";

  if (settings && settings.isActive === false) {
    throw new Error("문자 발송 설정이 비활성화되어 있습니다.");
  }

  if (!apiKey || !userId || !sender) {
    throw new Error("문자 API 설정이 없습니다. API Key, User ID, 발신번호를 먼저 저장해주세요.");
  }

  const normalized = phones
    .map((p) => String(p || "").replace(/\D/g, ""))
    .filter((p) => p.length >= 10);

  const unique = [...new Set(normalized)];

  let success = 0;
  let fail = 0;

  for (const phone of unique) {
    try {
      const res = await axios.post(url, null, {
        params: {
          key: apiKey,
          user_id: userId,
          sender,
          receiver: phone,
          msg: message,
        },
        timeout: 5000,
      });

      if (res.data?.result_code === "1") {
        success++;
      } else {
        fail++;
        console.error("SMS ERROR", phone, res.data);
      }
    } catch (err) {
      fail++;
      console.error("SMS FAIL", phone, err);
    }
  }

  return {
    success,
    fail,
  };
}