export class AppError extends Error {
  code: string;
  status: number;
  details?: any;

  constructor(
    code: string,
    message: string,
    status = 400,
    details?: any
  ) {
    super(message);

    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function throwAppError(
  code: string,
  message: string,
  status = 400,
  details?: any
): never {
  throw new AppError(code, message, status, details);
}