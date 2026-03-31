import { Router } from "express";

export const holidayRouter = Router();

function pad2(v: number) {
  return String(v).padStart(2, "0");
}

holidayRouter.get("/:year/:month", async (req, res) => {
  try {
    const year = Number(req.params.year);
    const month = Number(req.params.month);

    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      return res.status(400).json({ message: "year가 올바르지 않습니다." });
    }

    if (!Number.isFinite(month) || month < 1 || month > 12) {
      return res.status(400).json({ message: "month가 올바르지 않습니다." });
    }

    const serviceKey = process.env.PUBLIC_HOLIDAY_API_KEY;
    if (!serviceKey) {
      return res.status(500).json({
        message: "PUBLIC_HOLIDAY_API_KEY 환경변수가 설정되지 않았습니다.",
      });
    }

    const url =
      "https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo" +
      `?serviceKey=${encodeURIComponent(serviceKey)}` +
      `&solYear=${year}` +
      `&solMonth=${pad2(month)}` +
      `&_type=json` +
      `&numOfRows=100`;

    const response = await fetch(url, {
      method: "GET",
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(502).json({
        message: "공휴일 API 호출에 실패했습니다.",
        detail: text,
      });
    }

    const json = await response.json();

    const itemsRaw =
      json?.response?.body?.items?.item ??
      [];

    const items = Array.isArray(itemsRaw) ? itemsRaw : [itemsRaw];

    const holidays = items
      .filter((item: any) => item)
      .map((item: any) => {
        const locdate = String(item.locdate ?? "");
        const yyyy = locdate.slice(0, 4);
        const mm = locdate.slice(4, 6);
        const dd = locdate.slice(6, 8);

        return {
          date: `${yyyy}-${mm}-${dd}`,
          name: String(item.dateName ?? "공휴일"),
          isHoliday: true,
        };
      });

    return res.json({
      year,
      month,
      holidays,
    });
  } catch (error: any) {
    console.error("[holidayRouter] error:", error);
    return res.status(500).json({
      message: error?.message || "공휴일 조회 중 오류가 발생했습니다.",
    });
  }
});

export default holidayRouter;