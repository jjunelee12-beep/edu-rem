const TOSS_BILLING_ISSUE_URL =
  "https://api.tosspayments.com/v1/billing/authorizations/issue";
const TOSS_BILLING_PAYMENT_URL =
  "https://api.tosspayments.com/v1/billing";

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

export type TossBillingPaymentResponse = {
  paymentKey: string;
  orderId: string;
  orderName?: string;
  status?: string;
  totalAmount?: number;
  approvedAt?: string;
  method?: string;
};

export async function chargeTossBilling(input: {
  billingKey: string;
  customerKey: string;
  amount: number;
  orderId: string;
  orderName: string;
  idempotencyKey?: string;
}): Promise<TossBillingPaymentResponse> {
  if (!input.billingKey?.trim()) {
    throw new Error("billingKey가 없습니다.");
  }

  if (!input.customerKey?.trim()) {
    throw new Error("customerKey가 없습니다.");
  }

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("결제 금액이 올바르지 않습니다.");
  }

  if (!input.orderId?.trim()) {
    throw new Error("orderId가 없습니다.");
  }

  const response = await fetch(
    `${TOSS_BILLING_PAYMENT_URL}/${encodeURIComponent(
      input.billingKey.trim()
    )}`,
    {
      method: "POST",
      headers: {
  Authorization: getAuthorizationHeader(),
  "Content-Type": "application/json",
  ...(input.idempotencyKey
    ? {
        "Idempotency-Key":
          input.idempotencyKey,
      }
    : {}),
},
      body: JSON.stringify({
        customerKey: input.customerKey.trim(),
        amount: input.amount,
        orderId: input.orderId.trim(),
        orderName: input.orderName.trim(),
      }),
    }
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const code =
      data?.code || "TOSS_BILLING_PAYMENT_FAILED";

    const message =
      data?.message ||
      "토스페이먼츠 자동결제 승인에 실패했습니다.";

    const error = new Error(message) as Error & {
      code?: string;
      tossResponse?: unknown;
    };

    error.code = code;
    error.tossResponse = data;

    throw error;
  }

  if (!data?.paymentKey) {
    throw new Error(
      "토스페이먼츠 결제 응답에 paymentKey가 없습니다."
    );
  }

  if (data.orderId !== input.orderId) {
    throw new Error(
      "토스페이먼츠 결제 응답의 orderId가 일치하지 않습니다."
    );
  }

  return data;
}