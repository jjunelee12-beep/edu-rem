const TOSS_BILLING_ISSUE_URL =
  "https://api.tosspayments.com/v1/billing/authorizations/issue";

function getTossSecretKey() {
  const secretKey = process.env.TOSS_SECRET_KEY?.trim();

  if (!secretKey) {
    throw new Error("TOSS_SECRET_KEY 환경변수가 설정되어 있지 않습니다.");
  }

  return secretKey;
}

function getAuthorizationHeader() {
  const secretKey = getTossSecretKey();

  const encoded = Buffer.from(`${secretKey}:`).toString("base64");

  return `Basic ${encoded}`;
}

export type TossBillingIssueResponse = {
  mId?: string;
  customerKey: string;
  authenticatedAt?: string;
  method?: string;
  billingKey: string;
  card?: {
    issuerCode?: string;
    acquirerCode?: string;
    number?: string;
    cardType?: string;
    ownerType?: string;
  };
};

export async function issueTossBillingKey(input: {
  authKey: string;
  customerKey: string;
}): Promise<TossBillingIssueResponse> {
  const response = await fetch(TOSS_BILLING_ISSUE_URL, {
    method: "POST",
    headers: {
      Authorization: getAuthorizationHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      authKey: input.authKey,
      customerKey: input.customerKey,
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data?.message ||
      data?.code ||
      "토스페이먼츠 빌링키 발급에 실패했습니다.";

    throw new Error(message);
  }

  if (!data?.billingKey) {
    throw new Error("토스페이먼츠 응답에 billingKey가 없습니다.");
  }

  if (data.customerKey !== input.customerKey) {
    throw new Error("토스페이먼츠 customerKey가 일치하지 않습니다.");
  }

  return data;
}