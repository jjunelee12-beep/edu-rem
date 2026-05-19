import { throwAppError } from "./appError";
import { ERROR_CODES } from "./errorCodes";
import { ENV } from "./env";

export type NotificationPayload = {
  title: string;
  content: string;
};

const TITLE_MAX_LENGTH = 1200;
const CONTENT_MAX_LENGTH = 20000;

const trimValue = (value: string): string => value.trim();
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const buildEndpointUrl = (baseUrl: string): string => {
  const normalizedBase = baseUrl.endsWith("/")
    ? baseUrl
    : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};

const validatePayload = (input: NotificationPayload): NotificationPayload => {
  if (!isNonEmptyString(input.title)) {
    throwAppError(
  ERROR_CODES.INVALID_INPUT,
  "Notification title is required.",
  400
);
  }
  if (!isNonEmptyString(input.content)) {
    throwAppError(
  ERROR_CODES.INVALID_INPUT,
  "Notification content is required.",
  400
);
  }

  const title = trimValue(input.title);
  const content = trimValue(input.content);

  if (title.length > TITLE_MAX_LENGTH) {
    throwAppError(
  ERROR_CODES.INVALID_INPUT,
  `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`,
  400
);
  }

  if (content.length > CONTENT_MAX_LENGTH) {
    throwAppError(
  ERROR_CODES.INVALID_INPUT,
  `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`,
  400
);
  }

  return { title, content };
};

/**
 * Dispatches a project-owner notification through the Manus Notification Service.
 * Returns `true` if the request was accepted, `false` when the upstream service
 * cannot be reached (callers can fall back to email/slack). Validation errors
 * bubble up as TRPC errors so callers can fix the payload.
 */
export async function notifyOwner(
  payload: NotificationPayload
): Promise<boolean> {
  const { title, content } = validatePayload(payload);

  if (!ENV.forgeApiUrl) {
   throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "Notification service URL is not configured.",
  500
);
  }

  if (!ENV.forgeApiKey) {
    throwAppError(
  ERROR_CODES.INTERNAL_SERVER_ERROR,
  "Notification service API key is not configured.",
  500
);
  }

  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1",
      },
      body: JSON.stringify({ title, content }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${
          detail ? `: ${detail}` : ""
        }`
      );
      return false;
    }

    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}
