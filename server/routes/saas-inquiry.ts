import type { Express, Request, Response } from "express";
import { createSaasInquiry } from "../saasdb";

function getClientIp(req: Request) {
  return (
    req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    null
  );
}

export function registerSaasInquiryRoutes(app: Express) {
  app.post("/api/saas-inquiry", async (req: Request, res: Response) => {
    try {
      const body = req.body || {};

      const clientName = String(body.clientName || "").trim();
      const phone = String(body.phone || "").trim();

      if (!clientName || !phone) {
        return res.status(400).json({
          ok: false,
          message: "이름과 연락처는 필수입니다.",
        });
      }

      const result = await createSaasInquiry({
        inquiryType: body.inquiryType || "beta",
        clientName,
        phone,
        companyName: body.companyName || null,
        businessType: body.businessType || null,
        email: body.email || null,
        message: body.message || null,
        source: body.source || "homepage",
        pagePath: body.pagePath || null,
        utmSource: body.utmSource || null,
        utmMedium: body.utmMedium || null,
        utmCampaign: body.utmCampaign || null,
        ipAddress: getClientIp(req),
        userAgent: req.headers["user-agent"] || null,
      });

      return res.json(result);
    } catch (error: any) {
      console.error("[SAAS_INQUIRY_CREATE_ERROR]", error);

      return res.status(500).json({
        ok: false,
        message: "문의 저장 중 오류가 발생했습니다.",
      });
    }
  });
}