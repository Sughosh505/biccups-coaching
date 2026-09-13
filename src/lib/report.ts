/**
 * Server-side error reporting.
 *
 * Postgres error text can name columns, constraints and policies, so it is logged
 * here and never returned to the browser — callers surface the generic string this
 * returns instead.
 *
 * Output is one line of JSON rather than prose because the only place these land
 * is Vercel's function logs, where searching for `"event":"app_error"` or a
 * particular `context` is the difference between finding a failure and scrolling
 * for it. There is no error monitoring service wired up yet
 * (docs/production-readiness.md §5); this is what makes the logs usable until
 * there is.
 */

type Reportable = { message: string; code?: string };

function emit(fields: Record<string, unknown>) {
  console.error(JSON.stringify({ event: "app_error", at: new Date().toISOString(), ...fields }));
}

/** Logs the real error, returns the sentence the user is allowed to see. */
export function report(context: string, error: Reportable): string {
  emit({ context, code: error.code ?? null, message: error.message });
  return `${context} failed. Please try again.`;
}

/** Same log, no user-facing string — for paths that swallow the failure. */
export function reportOnly(context: string, error: Reportable): void {
  emit({ context, code: error.code ?? null, message: error.message });
}

/**
 * A render that threw. `digest` is the hash Next puts on a server-side error and
 * the ONLY handle shared between the page the user saw and the stack trace in the
 * logs, so it is logged here and shown on screen for them to quote back.
 */
export function reportRenderError(error: Error & { digest?: string }): void {
  emit({ context: "Rendering", digest: error.digest ?? null, message: error.message });
}
