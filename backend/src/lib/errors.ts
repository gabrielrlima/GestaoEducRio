export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
  }

  toJSON() {
    return { error: { code: this.code, message: this.message } };
  }
}

export const notFound = (code: string, message: string) => new ApiError(404, code, message);
export const badRequest = (code: string, message: string) => new ApiError(400, code, message);
export const conflict = (code: string, message: string) => new ApiError(409, code, message);
