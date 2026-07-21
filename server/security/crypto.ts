import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

/**
 * 개인정보 암호화 유틸
 *
 * 암호화 알고리즘:
 * - AES-256-GCM
 *
 * 검색용 해시:
 * - HMAC-SHA256
 *
 * 저장 형식:
 * - enc:v1:{iv}:{authTag}:{ciphertext}
 *
 * 중요:
 * - 암호화 키와 해시 키는 반드시 서로 다른 값을 사용해야 합니다.
 * - PERSONAL_DATA_ENCRYPTION_KEY를 분실하면 기존 암호문 복구가 불가능합니다.
 * - 운영 서버와 마이그레이션 스크립트는 반드시 동일한 키를 사용해야 합니다.
 */

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const ENCRYPTION_VERSION = "v1";
const ENCRYPTED_VALUE_PREFIX = `enc:${ENCRYPTION_VERSION}:`;

const ENCRYPTION_KEY_LENGTH = 32;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

const HASH_ALGORITHM = "sha256";
const HASH_HEX_LENGTH = 64;

let cachedEncryptionKey: Buffer | null = null;
let cachedHashSecret: string | null = null;

/**
 * 암호화 관련 오류를 일반 오류와 구분하기 위한 클래스입니다.
 */
export class PersonalDataCryptoError extends Error {
  public readonly code:
    | "ENCRYPTION_KEY_MISSING"
    | "ENCRYPTION_KEY_INVALID"
    | "HASH_SECRET_MISSING"
    | "HASH_SECRET_INVALID"
    | "ENCRYPTION_FAILED"
    | "DECRYPTION_FAILED"
    | "INVALID_ENCRYPTED_VALUE";

  constructor(
    code:
      | "ENCRYPTION_KEY_MISSING"
      | "ENCRYPTION_KEY_INVALID"
      | "HASH_SECRET_MISSING"
      | "HASH_SECRET_INVALID"
      | "ENCRYPTION_FAILED"
      | "DECRYPTION_FAILED"
      | "INVALID_ENCRYPTED_VALUE",
    message: string,
    options?: {
      cause?: unknown;
    }
  ) {
    super(message, options);

    this.name = "PersonalDataCryptoError";
    this.code = code;
  }
}

/**
 * 문자열을 안전하게 변환합니다.
 *
 * null, undefined는 null로 반환합니다.
 */
function toNullableString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return String(value);
}

/**
 * 유니코드를 NFKC 형식으로 정규화합니다.
 *
 * 전각 문자, 호환 문자 등의 차이를 줄여서
 * 같은 입력값이 서로 다른 해시를 생성하는 문제를 줄입니다.
 */
function normalizeUnicode(value: string): string {
  return value.normalize("NFKC");
}

/**
 * 암호화 키 문자열을 32바이트 Buffer로 변환합니다.
 *
 * 지원 형식:
 *
 * 1. Base64
 * PERSONAL_DATA_ENCRYPTION_KEY=xxxxxxxx
 *
 * 2. 접두사 포함 Base64
 * PERSONAL_DATA_ENCRYPTION_KEY=base64:xxxxxxxx
 *
 * 3. 64자리 HEX
 * PERSONAL_DATA_ENCRYPTION_KEY=abcdef...
 *
 * 4. 접두사 포함 HEX
 * PERSONAL_DATA_ENCRYPTION_KEY=hex:abcdef...
 */
function parseEncryptionKey(rawValue: string): Buffer {
  const value = rawValue.trim();

  if (!value) {
    throw new PersonalDataCryptoError(
      "ENCRYPTION_KEY_MISSING",
      "PERSONAL_DATA_ENCRYPTION_KEY 환경변수가 비어 있습니다."
    );
  }

  let key: Buffer;

  try {
    if (value.startsWith("base64:")) {
      key = Buffer.from(value.slice("base64:".length), "base64");
    } else if (value.startsWith("hex:")) {
      key = Buffer.from(value.slice("hex:".length), "hex");
    } else if (/^[0-9a-fA-F]{64}$/.test(value)) {
      key = Buffer.from(value, "hex");
    } else {
      key = Buffer.from(value, "base64");
    }
  } catch (error) {
    throw new PersonalDataCryptoError(
      "ENCRYPTION_KEY_INVALID",
      "PERSONAL_DATA_ENCRYPTION_KEY 형식을 해석할 수 없습니다.",
      {
        cause: error,
      }
    );
  }

  if (key.length !== ENCRYPTION_KEY_LENGTH) {
    throw new PersonalDataCryptoError(
      "ENCRYPTION_KEY_INVALID",
      [
        "PERSONAL_DATA_ENCRYPTION_KEY는 복호화 후 정확히 32바이트여야 합니다.",
        `현재 키 길이: ${key.length}바이트`,
        "32바이트 랜덤 키를 Base64 형식으로 생성해서 사용해주세요.",
      ].join(" ")
    );
  }

  return key;
}

/**
 * AES-256-GCM 암호화 키를 가져옵니다.
 *
 * 실제 암호화 함수가 실행될 때 환경변수를 확인하는 지연 로딩 방식입니다.
 * 따라서 모듈 import만으로 서버가 바로 종료되지 않습니다.
 */
function getEncryptionKey(): Buffer {
  if (cachedEncryptionKey) {
    return cachedEncryptionKey;
  }

  const rawKey = String(
    process.env.PERSONAL_DATA_ENCRYPTION_KEY || ""
  ).trim();

  if (!rawKey) {
    throw new PersonalDataCryptoError(
      "ENCRYPTION_KEY_MISSING",
      "PERSONAL_DATA_ENCRYPTION_KEY 환경변수가 설정되지 않았습니다."
    );
  }

  cachedEncryptionKey = parseEncryptionKey(rawKey);

  return cachedEncryptionKey;
}

/**
 * 검색용 HMAC 비밀키를 가져옵니다.
 *
 * 우선순위:
 * 1. PERSONAL_DATA_HASH_SECRET
 * 2. 기존 PHONE_HASH_SECRET
 *
 * 기존 문자 수신거부 기능에서 PHONE_HASH_SECRET를 사용하고 있으므로
 * 초기 전환 과정에서는 기존 값을 그대로 재사용할 수 있게 구성했습니다.
 *
 * 단, 암호화 키인 PERSONAL_DATA_ENCRYPTION_KEY와는 절대 같은 값을
 * 사용하면 안 됩니다.
 */
function getHashSecret(): string {
  if (cachedHashSecret) {
    return cachedHashSecret;
  }

  const secret = String(
    process.env.PERSONAL_DATA_HASH_SECRET ||
      process.env.PHONE_HASH_SECRET ||
      ""
  ).trim();

  if (!secret) {
    throw new PersonalDataCryptoError(
      "HASH_SECRET_MISSING",
      [
        "PERSONAL_DATA_HASH_SECRET 환경변수가 설정되지 않았습니다.",
        "기존 PHONE_HASH_SECRET가 있다면 임시로 해당 값이 사용됩니다.",
      ].join(" ")
    );
  }

  if (Buffer.byteLength(secret, "utf8") < 32) {
    throw new PersonalDataCryptoError(
      "HASH_SECRET_INVALID",
      "PERSONAL_DATA_HASH_SECRET는 최소 32바이트 이상이어야 합니다."
    );
  }

  cachedHashSecret = secret;

  return cachedHashSecret;
}

/**
 * 테스트 또는 환경변수 변경 후 캐시된 키를 초기화할 때 사용합니다.
 *
 * 일반 운영 코드에서는 호출할 필요가 없습니다.
 */
export function clearPersonalDataCryptoCache(): void {
  cachedEncryptionKey = null;
  cachedHashSecret = null;
}

/**
 * 값이 AES 암호문 형식인지 확인합니다.
 */
export function isEncryptedPersonalData(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }

  return value.startsWith(ENCRYPTED_VALUE_PREFIX);
}

/**
 * 개인정보를 AES-256-GCM으로 암호화합니다.
 *
 * 같은 값이라도 매번 새로운 IV를 생성하므로 결과 암호문은 매번 달라집니다.
 *
 * 검색은 암호문 비교가 아니라 createPersonalHash 계열 함수를 사용해야 합니다.
 */
export function encryptPersonalData(value: string): string;
export function encryptPersonalData(
  value: null | undefined
): null;
export function encryptPersonalData(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const plainText = String(value);

  /**
   * 이미 암호화된 값을 다시 암호화하지 않습니다.
   *
   * 업데이트 코드에서 기존 DB 값을 그대로 전달하는 경우
   * 이중 암호화를 방지하기 위한 처리입니다.
   */
  if (isEncryptedPersonalData(plainText)) {
    return plainText;
  }

  /**
   * 빈 문자열은 암호화하지 않고 그대로 유지합니다.
   *
   * null과 빈 문자열을 구분하는 기존 시스템 동작을 유지하기 위함입니다.
   */
  if (plainText === "") {
    return "";
  }

  try {
    const key = getEncryptionKey();
    const iv = randomBytes(IV_LENGTH);

    const cipher = createCipheriv(
      ENCRYPTION_ALGORITHM,
      key,
      iv,
      {
        authTagLength: AUTH_TAG_LENGTH,
      }
    );

    const encryptedBuffer = Buffer.concat([
      cipher.update(plainText, "utf8"),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    return [
      "enc",
      ENCRYPTION_VERSION,
      iv.toString("base64url"),
      authTag.toString("base64url"),
      encryptedBuffer.toString("base64url"),
    ].join(":");
  } catch (error) {
    if (error instanceof PersonalDataCryptoError) {
      throw error;
    }

    throw new PersonalDataCryptoError(
      "ENCRYPTION_FAILED",
      "개인정보 암호화 처리에 실패했습니다.",
      {
        cause: error,
      }
    );
  }
}

/**
 * 개인정보 암호문을 복호화합니다.
 *
 * 중요한 호환 기능:
 * - enc:v1으로 시작하지 않는 기존 평문은 그대로 반환합니다.
 *
 * 따라서 기존 평문과 신규 암호문이 함께 존재하는
 * 단계적 마이그레이션 기간에도 사용할 수 있습니다.
 */
export function decryptPersonalData(value: string): string;
export function decryptPersonalData(
  value: null | undefined
): null;
export function decryptPersonalData(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const storedValue = String(value);

  if (storedValue === "") {
    return "";
  }

  /**
   * 기존 평문 데이터는 그대로 반환합니다.
   *
   * 기존 데이터 마이그레이션이 끝나기 전까지 반드시 필요합니다.
   */
  if (!isEncryptedPersonalData(storedValue)) {
    return storedValue;
  }

  const parts = storedValue.split(":");

  if (parts.length !== 5) {
    throw new PersonalDataCryptoError(
      "INVALID_ENCRYPTED_VALUE",
      "암호화된 개인정보 저장 형식이 올바르지 않습니다."
    );
  }

  const [prefix, version, ivText, authTagText, cipherText] =
    parts;

  if (prefix !== "enc" || version !== ENCRYPTION_VERSION) {
    throw new PersonalDataCryptoError(
      "INVALID_ENCRYPTED_VALUE",
      `지원하지 않는 개인정보 암호화 버전입니다: ${version}`
    );
  }

  try {
    const key = getEncryptionKey();

    const iv = Buffer.from(ivText, "base64url");
    const authTag = Buffer.from(authTagText, "base64url");
    const encryptedBuffer = Buffer.from(
      cipherText,
      "base64url"
    );

    if (iv.length !== IV_LENGTH) {
      throw new PersonalDataCryptoError(
        "INVALID_ENCRYPTED_VALUE",
        `암호문의 IV 길이가 올바르지 않습니다: ${iv.length}`
      );
    }

    if (authTag.length !== AUTH_TAG_LENGTH) {
      throw new PersonalDataCryptoError(
        "INVALID_ENCRYPTED_VALUE",
        `암호문의 인증 태그 길이가 올바르지 않습니다: ${authTag.length}`
      );
    }

    const decipher = createDecipheriv(
      ENCRYPTION_ALGORITHM,
      key,
      iv,
      {
        authTagLength: AUTH_TAG_LENGTH,
      }
    );

    decipher.setAuthTag(authTag);

    const decryptedBuffer = Buffer.concat([
      decipher.update(encryptedBuffer),
      decipher.final(),
    ]);

    return decryptedBuffer.toString("utf8");
  } catch (error) {
    if (error instanceof PersonalDataCryptoError) {
      throw error;
    }

    /**
     * AES-GCM 인증 실패는 다음 원인일 수 있습니다.
     *
     * - 암호화 키가 변경됨
     * - 암호문이 훼손됨
     * - 다른 서버의 키로 생성된 데이터
     */
    throw new PersonalDataCryptoError(
      "DECRYPTION_FAILED",
      [
        "개인정보 복호화에 실패했습니다.",
        "암호화 키가 변경됐거나 암호문이 훼손됐을 수 있습니다.",
      ].join(" "),
      {
        cause: error,
      }
    );
  }
}

/**
 * 화면 조회 과정에서 복호화 실패로 전체 목록이 깨지는 것을
 * 방지하고 싶은 경우 사용할 수 있습니다.
 *
 * 복호화 실패 시 fallback 값을 반환합니다.
 *
 * 보안상 실제 오류 메시지나 암호문은 화면에 노출하지 않습니다.
 */
export function safeDecryptPersonalData(
  value: string | null | undefined,
  fallback = "[복호화 실패]"
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  try {
    return decryptPersonalData(value);
  } catch {
    return fallback;
  }
}

/**
 * HMAC-SHA256 검색용 해시를 생성합니다.
 *
 * 해시는 64자리 HEX 문자열입니다.
 *
 * 주의:
 * - 암호화가 아닙니다.
 * - 복호화할 수 없습니다.
 * - 정확히 일치하는 검색에만 사용합니다.
 */
export function createPersonalHash(
  normalizedValue: string
): string;
export function createPersonalHash(
  normalizedValue: null | undefined
): null;
export function createPersonalHash(
  normalizedValue: string | null | undefined
): string | null {
  if (normalizedValue === null || normalizedValue === undefined) {
    return null;
  }

  const value = String(normalizedValue);

  if (!value) {
    return null;
  }

  const hash = createHmac(
    HASH_ALGORITHM,
    getHashSecret()
  )
    .update(value, "utf8")
    .digest("hex");

  if (hash.length !== HASH_HEX_LENGTH) {
    throw new PersonalDataCryptoError(
      "HASH_SECRET_INVALID",
      "검색용 개인정보 해시 생성 결과의 길이가 올바르지 않습니다."
    );
  }

  return hash;
}

/**
 * 두 HMAC 해시를 타이밍 공격에 비교적 안전한 방식으로 비교합니다.
 *
 * 일반 DB 검색에서는 eq(column, hash)를 사용하면 되므로
 * 필수 함수는 아니지만 인증·검증 코드에서 사용할 수 있습니다.
 */
export function comparePersonalHashes(
  leftHash: string | null | undefined,
  rightHash: string | null | undefined
): boolean {
  if (!leftHash || !rightHash) {
    return false;
  }

  const left = Buffer.from(leftHash, "utf8");
  const right = Buffer.from(rightHash, "utf8");

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

/**
 * 이름 정규화
 *
 * 처리 내용:
 * - NFKC 유니코드 정규화
 * - 앞뒤 공백 제거
 * - 중복 공백 하나로 축소
 * - 영문 이름의 대소문자 차이 제거
 *
 * 예:
 * "  홍   길동  " → "홍 길동"
 */
export function normalizeName(value: unknown): string {
  const raw = toNullableString(value);

  if (raw === null) {
    return "";
  }

  return normalizeUnicode(raw)
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("ko-KR");
}

/**
 * 이메일 정규화
 *
 * 처리 내용:
 * - NFKC 정규화
 * - 공백 제거
 * - 소문자 변환
 *
 * 예:
 * " TEST@Example.COM " → "test@example.com"
 */
export function normalizeEmail(value: unknown): string {
  const raw = toNullableString(value);

  if (raw === null) {
    return "";
  }

  return normalizeUnicode(raw)
    .trim()
    .toLowerCase();
}

/**
 * 전화번호 정규화
 *
 * 숫자를 제외한 모든 문자를 제거합니다.
 *
 * 예:
 * "010-1234-5678" → "01012345678"
 */
export function normalizePhone(value: unknown): string {
  const raw = toNullableString(value);

  if (raw === null) {
    return "";
  }

  return normalizeUnicode(raw)
    .replace(/\D/g, "");
}

/**
 * 계좌번호 정규화
 *
 * 숫자를 제외한 모든 문자를 제거합니다.
 *
 * 예:
 * "123-456-789012" → "123456789012"
 */
export function normalizeBankAccount(value: unknown): string {
  const raw = toNullableString(value);

  if (raw === null) {
    return "";
  }

  return normalizeUnicode(raw)
    .replace(/\D/g, "");
}

/**
 * 학생 교육원 로그인 아이디 정규화
 *
 * 일반적으로 로그인 아이디는 대소문자를 구분하지 않는다고 보고
 * 소문자로 정규화합니다.
 */
export function normalizeStudentLoginId(
  value: unknown
): string {
  const raw = toNullableString(value);

  if (raw === null) {
    return "";
  }

  return normalizeUnicode(raw)
    .trim()
    .toLowerCase();
}

/**
 * 일반 개인정보 문자열 정규화
 *
 * 주소처럼 대소문자 변환이나 숫자 추출을 하면 안 되는 값에 사용합니다.
 */
export function normalizePersonalText(
  value: unknown
): string {
  const raw = toNullableString(value);

  if (raw === null) {
    return "";
  }

  return normalizeUnicode(raw).trim();
}

/**
 * 이름 검색용 HMAC
 */
export function createNameHash(
  value: string
): string;
export function createNameHash(
  value: null | undefined
): null;
export function createNameHash(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = normalizeName(value);

  return normalized
    ? createPersonalHash(normalized)
    : null;
}

/**
 * 이메일 검색용 HMAC
 */
export function createEmailHash(
  value: string
): string;
export function createEmailHash(
  value: null | undefined
): null;
export function createEmailHash(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = normalizeEmail(value);

  return normalized
    ? createPersonalHash(normalized)
    : null;
}

/**
 * 전화번호 검색용 HMAC
 */
export function createPhoneHash(
  value: string
): string;
export function createPhoneHash(
  value: null | undefined
): null;
export function createPhoneHash(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = normalizePhone(value);

  return normalized
    ? createPersonalHash(normalized)
    : null;
}

/**
 * 계좌번호 검색·중복확인용 HMAC
 */
export function createBankAccountHash(
  value: string
): string;
export function createBankAccountHash(
  value: null | undefined
): null;
export function createBankAccountHash(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = normalizeBankAccount(value);

  return normalized
    ? createPersonalHash(normalized)
    : null;
}

/**
 * 학생 로그인 아이디 검색용 HMAC
 *
 * 현재 schema에 studentLoginIdHash 컬럼은 없지만
 * 추후 필요할 경우 바로 사용할 수 있도록 포함했습니다.
 */
export function createStudentLoginIdHash(
  value: string
): string;
export function createStudentLoginIdHash(
  value: null | undefined
): null;
export function createStudentLoginIdHash(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = normalizeStudentLoginId(value);

  return normalized
    ? createPersonalHash(normalized)
    : null;
}

/**
 * 문자열 마지막 네 자리를 반환합니다.
 */
function getLast4FromNormalizedValue(
  normalizedValue: string
): string | null {
  if (normalizedValue.length < 4) {
    return null;
  }

  return normalizedValue.slice(-4);
}

/**
 * 전화번호 마지막 4자리
 */
export function getPhoneLast4(
  value: unknown
): string | null {
  return getLast4FromNormalizedValue(
    normalizePhone(value)
  );
}

/**
 * 계좌번호 마지막 4자리
 */
export function getBankAccountLast4(
  value: unknown
): string | null {
  return getLast4FromNormalizedValue(
    normalizeBankAccount(value)
  );
}

/**
 * 객체의 지정 필드들을 일괄 복호화합니다.
 *
 * 원본 객체는 변경하지 않고 새로운 객체를 반환합니다.
 *
 * 사용 예:
 *
 * const student = decryptPersonalFields(row, [
 *   "clientName",
 *   "phone",
 *   "address",
 *   "detailAddress",
 *   "studentLoginId",
 * ]);
 */
export function decryptPersonalFields<
  T extends Record<string, any>
>(
  row: T,
  fields: readonly (keyof T)[]
): T {
  if (!row) {
    return row;
  }

  const result = {
    ...row,
  };

  for (const field of fields) {
    const value = result[field];

    if (
      typeof value === "string" ||
      value === null ||
      value === undefined
    ) {
      result[field] = safeDecryptPersonalData(
        value
      ) as T[keyof T];
    }
  }

  return result;
}

/**
 * 객체 목록의 지정 필드들을 일괄 복호화합니다.
 */
export function decryptPersonalFieldList<
  T extends Record<string, any>
>(
  rows: readonly T[],
  fields: readonly (keyof T)[]
): T[] {
  return rows.map((row) =>
    decryptPersonalFields(row, fields)
  );
}

/**
 * 개발·배포 환경에서 암호화 설정이 올바른지 점검합니다.
 *
 * 실제 개인정보를 사용하지 않고 테스트 문자열로
 * 암호화 → 복호화 → 해시 생성 검증을 수행합니다.
 */
export function validatePersonalDataCryptoConfig(): {
  encryptionConfigured: true;
  hashConfigured: true;
  roundTripPassed: true;
} {
  const testValue = "EduCanvas 개인정보 암호화 테스트";

  const encrypted = encryptPersonalData(testValue);
  const decrypted = decryptPersonalData(encrypted);
  const hash = createPersonalHash(testValue);

  if (decrypted !== testValue) {
    throw new PersonalDataCryptoError(
      "DECRYPTION_FAILED",
      "개인정보 암호화 설정 검증 중 원문 복원에 실패했습니다."
    );
  }

  if (
    !hash ||
    hash.length !== HASH_HEX_LENGTH
  ) {
    throw new PersonalDataCryptoError(
      "HASH_SECRET_INVALID",
      "개인정보 해시 설정 검증에 실패했습니다."
    );
  }

  return {
    encryptionConfigured: true,
    hashConfigured: true,
    roundTripPassed: true,
  };
}