import { HttpErrorResponse } from '@angular/common/http';

export function expenseErrors(error: unknown, fallback: string): string[] {
  let body: unknown = error instanceof HttpErrorResponse ? error.error : null;
  if (typeof body === 'string') {
    try { body = JSON.parse(body) as unknown; } catch { return [fallback]; }
  }
  if (body && typeof body === 'object' && 'errors' in body && Array.isArray(body.errors) &&
    body.errors.length && body.errors.every((message: unknown) => typeof message === 'string')) {
    return body.errors;
  }
  if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') return [body.error];
  return [fallback];
}
