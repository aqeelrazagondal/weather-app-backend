export class ApiException extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiException';
  }
}

// rate-limit.exception.ts
export class RateLimitException extends ApiException {
  constructor(message = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

// timeout.exception.ts
export class TimeoutException extends ApiException {
  constructor(message = 'Request timeout') {
    super(message, 504, 'REQUEST_TIMEOUT');
  }
}
