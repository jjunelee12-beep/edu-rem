import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendVerificationEmail(params: {
  to: string;
  code: string;
  purpose: string;
}) {
  const title =
    params.purpose === "find_id"
      ? "아이디 찾기 인증코드"
      : "비밀번호 재설정 인증코드";

  const html = `
    <div style="font-family: Arial, sans-serif; padding: 24px;">
      <h2>${title}</h2>

      <p>아래 인증코드를 입력해주세요.</p>

      <div
        style="
          margin-top: 16px;
          margin-bottom: 16px;
          padding: 18px;
          background: #f3f4f6;
          border-radius: 12px;
          font-size: 28px;
          font-weight: bold;
          letter-spacing: 6px;
          text-align: center;
        "
      >
        ${params.code}
      </div>

      <p>인증코드는 5분 후 만료됩니다.</p>

      <p style="color:#6b7280;font-size:12px;margin-top:24px;">
        EduCanvas SaaS Platform
      </p>
    </div>
  `;

  await resend.emails.send({
    from: process.env.MAIL_FROM || "onboarding@resend.dev",
    to: params.to,
    subject: title,
    html,
  });
}