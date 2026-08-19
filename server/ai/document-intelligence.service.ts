import {
  throwAppError,
} from "../_core/appError";

import {
  ERROR_CODES,
} from "../_core/errorCodes";

import type {
  DocumentIntelligenceDocumentType,
  DocumentIntelligenceInputType,
  DocumentIntelligenceResult,
  DocumentIntelligenceSource,
} from "./document-intelligence.types";

import {
  analyzeDocumentWithVision,
} from "./document-intelligence-vision-adapter";

export interface AnalyzeDocumentIntelligenceInput {
  organizationId:
    number;

  sourceType:
    DocumentIntelligenceSource;

  inputType:
    DocumentIntelligenceInputType;

 /**
 * 카카오 / 원격 업로드 파일.
 * 이후 CRM 업로드/R2 URL도 동일하게 사용.
 */
fileUrl?:
  string |
  null;

/**
 * 기존 CRM 업무비서 이미지 분석용.
 *
 * data URL prefix가 없는 순수 Base64.
 */
imageBase64?:
  string |
  null;

mimeType?:
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | null;

fileName?:
  string |
  null;

  /**
   * 연결된 학생이 있으면 전달.
   * 신규자라면 null 가능.
   */
  studentId?:
    number |
    null;

  /**
   * 사용자가 이미지와 같이 보낸 문맥.
   *
   * 예:
   * "전적대 성적증명서예요"
   * "학습자등록 완료했어요"
   */
  userMessage?:
    string |
    null;

  /**
   * 호출 목적.
   *
   * 모델이 문서를 억지로 특정 종류라고
   * 추측하는 것을 줄이기 위한 보조정보.
   */
  expectedDocumentType?:
    DocumentIntelligenceDocumentType |
    null;
}

function requirePositiveInteger(
  value: unknown,
  label: string
) {
  const number =
    Math.floor(
      Number(value)
    );

  if (
    !Number.isFinite(number) ||
    number <= 0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      `${label} 정보가 올바르지 않습니다.`,
      400
    );
  }

  return number;
}

function normalizeOptionalText(
  value: unknown,
  maxLength: number
): string | null {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const text =
    String(value)
      .trim();

  if (!text) {
    return null;
  }

  return text.slice(
    0,
    maxLength
  );
}

function validateRemoteFileUrl(
  value: unknown
) {
  const normalized =
    String(
      value ||
      ""
    ).trim();

  if (!normalized) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "분석할 파일 URL이 필요합니다.",
      400
    );
  }

  let parsed:
    URL;

  try {
    parsed =
      new URL(
        normalized
      );
  } catch {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "파일 URL 형식이 올바르지 않습니다.",
      400
    );
  }

  if (
    parsed.protocol !==
      "https:" &&
    parsed.protocol !==
      "http:"
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "지원하지 않는 파일 URL 형식입니다.",
      400
    );
  }

  return normalized;
}

function buildImageDataUrl(
  params: {
    imageBase64:
      unknown;

    mimeType:
      unknown;
  }
): string {
  const mimeType =
    String(
      params.mimeType ||
      ""
    ).trim();

  if (
    mimeType !==
      "image/jpeg" &&
    mimeType !==
      "image/png" &&
    mimeType !==
      "image/webp"
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "지원하지 않는 이미지 형식입니다.",
      400
    );
  }

  const base64 =
    String(
      params.imageBase64 ||
      ""
    )
      .replace(
        /\s+/g,
        ""
      )
      .trim();

  if (
    base64.length <
      100
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "분석할 이미지가 없습니다.",
      400
    );
  }

  if (
    base64.length >
      14_000_000
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "이미지 용량이 너무 큽니다.",
      400
    );
  }

  if (
    !/^[A-Za-z0-9+/]+={0,2}$/.test(
      base64
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "이미지 데이터 형식이 올바르지 않습니다.",
      400
    );
  }

  return [
    "data:",
    mimeType,
    ";base64,",
    base64,
  ].join("");
}

/**
 * ---------------------------------------------------------
 * 공통 Document Intelligence Engine
 * ---------------------------------------------------------
 *
 * 신규자 AI / 등록자 AI / 업무비서 AI가
 * 모두 이 Service를 사용한다.
 *
 * 이 계층의 책임:
 *
 * 1. 이미지/PDF/문서 이해
 * 2. OCR/문자 인식
 * 3. 문서 종류 분류
 * 4. 사실 데이터 구조화
 * 5. 증거/확신도 반환
 *
 * 하지 않는 일:
 *
 * - 학점 계산
 * - 학위요건 최종판정
 * - 자격요건 최종판정
 * - 학생 상세페이지 임의 수정
 * - 행정절차 completed 직접 처리
 *
 * 위 작업은 각각 Academic/Rules/Action 계층이 담당한다.
 */
export async function analyzeDocumentIntelligence(
  input:
    AnalyzeDocumentIntelligenceInput
): Promise<DocumentIntelligenceResult> {
  const organizationId =
    requirePositiveInteger(
      input.organizationId,
      "organizationId"
    );

  const studentId =
    input.studentId ===
      null ||
    input.studentId ===
      undefined
      ? null
      : requirePositiveInteger(
          input.studentId,
          "studentId"
        );

  const remoteFileUrl =
  input.fileUrl
    ? validateRemoteFileUrl(
        input.fileUrl
      )
    : null;

const imageDataUrl =
  !remoteFileUrl &&
  input.inputType ===
    "image" &&
  input.imageBase64
    ? buildImageDataUrl({
        imageBase64:
          input.imageBase64,

        mimeType:
          input.mimeType,
      })
    : null;

const fileUrl =
  remoteFileUrl ||
  imageDataUrl;

if (!fileUrl) {
  throwAppError(
    ERROR_CODES.INVALID_REQUEST,
    "분석할 파일이 필요합니다.",
    400
  );
}

  const userMessage =
    normalizeOptionalText(
      input.userMessage,
      5000
    );

  const expectedDocumentType =
    input.expectedDocumentType ??
    null;

  /**
   * 현재 단계에서는 공통 계약/입력 검증까지만 만든다.
   *
   * 다음 단계에서 여기 안에
   * OpenAI Vision 호출 Adapter를 연결한다.
   *
   * Vision Adapter가 반환하는 결과를
   * DocumentIntelligenceResult 구조로
   * 정규화해서 반환하게 된다.
   */
  return analyzeDocumentWithVision({
  sourceType:
    input.sourceType,

  inputType:
    input.inputType,

  fileUrl,

  studentId,

  userMessage,

  expectedDocumentType,
});
}