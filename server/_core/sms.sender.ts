import axios from "axios";

export async function sendBulkSms(phones: string[], message: string) {
  const url = "https://apis.aligo.in/send/";

  const normalized = phones
    .map((p) => String(p || "").replace(/\D/g, ""))
    .filter((p) => p.length >= 10);

  const unique = [...new Set(normalized)];

  let success = 0;
  let fail = 0;

  for (const phone of unique) {
    try {
      const res = await axios.post(
        url,
        null,
        {
          params: {
            key: process.env.ALIGO_API_KEY,
            user_id: process.env.ALIGO_USER_ID,
            sender: process.env.ALIGO_SENDER,
            receiver: phone,
            msg: message,
          },
          timeout: 5000,
        }
      );

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