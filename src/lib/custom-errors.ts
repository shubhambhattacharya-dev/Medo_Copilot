/**
 * custom-errors.ts
 * 
 * Standardizing audit failure reasons for better UX and debugging.
 */

export class AuditError extends Error {
  public code: string;
  public status: number;
  public retryable: boolean;

  constructor(message: string, code: string = 'INTERNAL_ERROR', status: number = 500, retryable: boolean = true) {
    super(message);
    this.name = 'AuditError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

export class ValidationError extends AuditError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400, false);
  }
}

export class RateLimitError extends AuditError {
  constructor(resetInMs: number) {
    const seconds = Math.ceil(resetInMs / 1000);
    super(`Too many requests. Please try again in ${seconds} seconds.`, 'RATE_LIMIT_ERROR', 429, true);
  }
}

export class BrowserError extends AuditError {
  constructor(message: string = 'Failed to load the page. The site might be blocking automated audits.') {
    super(message, 'BROWSER_ERROR', 500, true);
  }
}

export class AIProviderError extends AuditError {
  constructor(provider: string, message: string) {
    super(`AI Provider (${provider}) error: ${message}`, 'AI_PROVIDER_ERROR', 500, true);
  }
}

export class DatabaseError extends AuditError {
  constructor(message: string = 'Failed to store or retrieve audit data.') {
    super(message, 'DATABASE_ERROR', 500, false);
  }
}
