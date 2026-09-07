import type { AuthError } from '@supabase/supabase-js';

/**
 * Minimum password length, shared by signup and reset. These disagreed (6 vs 8),
 * so anyone who registered with six characters was refused at reset time.
 */
export const MIN_PASSWORD_LENGTH = 6;

/**
 * Maps a Supabase auth/database failure to a translation key.
 *
 * Two rules learned from testing against a live project:
 *
 *  - Match on `code`, never on English message text. supabase-js exposes stable
 *    identifiers (`email_not_confirmed`, `over_email_send_rate_limit`); the
 *    prose behind them is not a contract and changes without notice.
 *  - The signup trigger raises `username_taken` under SQLSTATE 23505. Without
 *    this mapping the shop floor sees
 *    `duplicate key value violates unique constraint "user_profiles_username_key"`.
 */
export function authErrorKey(error: Pick<AuthError, 'message'> & { code?: string; status?: number }): string {
  const code = error.code ?? '';
  const message = (error.message ?? '').toLowerCase();

  if (code === 'email_not_confirmed' || message.includes('email not confirmed')) {
    return 'emailNotConfirmed';
  }

  // Supabase's built-in SMTP is capped at a couple of messages per hour and is
  // shared by signup confirmation and password reset.
  if (
    code === 'over_email_send_rate_limit' ||
    code === 'over_request_rate_limit' ||
    error.status === 429 ||
    message.includes('rate limit')
  ) {
    return 'emailRateLimited';
  }

  if (code === '23505' || message.includes('username_taken') || message.includes('user_profiles_username_key')) {
    return 'usernameTaken';
  }

  if (code === 'invalid_credentials' || message.includes('invalid login credentials')) {
    return 'invalidCredentials';
  }

  return '';
}

/**
 * Resolves an auth error to display text: a translated string when the failure
 * is one we recognise, otherwise the backend's own message so nothing is
 * silently swallowed.
 */
export function authErrorMessage(
  error: Pick<AuthError, 'message'> & { code?: string; status?: number },
  t: (key: string) => string,
): string {
  const key = authErrorKey(error);
  return key ? t(key) : error.message || t('unexpectedError');
}
