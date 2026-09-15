/**
 * Dev-only request timing, to answer "where did the 400ms go" without guessing.
 *
 * Off unless PERF_LOG=1, so it never reaches production logs. Only labels and
 * durations are ever printed — never a row, a name or a check-in value, so
 * turning it on cannot leak client health data into a terminal or a log drain.
 */
const ENABLED = process.env.PERF_LOG === "1";

function log(label: string, ms: number, note: string) {
  const stamp = new Date().toISOString().slice(11, 23);
  console.log(
    `[perf] ${stamp} ${label.padEnd(38)} ${ms.toFixed(0).padStart(5)}ms${note ? `  ${note}` : ""}`,
  );
}

/** Times one awaited call. Returns the value untouched when disabled. */
export async function timed<T>(label: string, fn: () => PromiseLike<T>, note = ""): Promise<T> {
  if (!ENABLED) return fn();
  const t0 = performance.now();
  try {
    return await fn();
  } finally {
    log(label, performance.now() - t0, note);
  }
}

/**
 * Opens a span for a render. Call the returned function when it finishes —
 * the gap between two spans for the same label is a re-render.
 */
export function span(label: string): (note?: string) => void {
  if (!ENABLED) return () => {};
  const t0 = performance.now();
  return (note = "") => log(label, performance.now() - t0, note);
}
