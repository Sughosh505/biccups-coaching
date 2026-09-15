import { createHash, timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { answers, LIMITS, MAX_BODY_BYTES, str } from "@/lib/consultation-input";

/**
 * Consultation intake — the Google Form's Apps Script POSTs here on submit.
 *
 * This route is PUBLIC. src/proxy.ts excludes /api from its matcher, so there is no
 * session, no role and no redirect here: the shared secret below is the entire
 * authentication. Everything in the body is untrusted input from the open internet.
 *
 * It answers with bare status codes and never a descriptive body — an error message
 * that distinguishes "bad secret" from "bad payload" is a probing aid.
 */

/* MAX_BODY_BYTES, MAX_FIELDS, LIMITS, str() and answers() are shared with the coach's
   manual entry form — see src/lib/consultation-input.ts for why. */

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 10;
/** Bounds the map itself, so a flood of unique IPs cannot grow it without limit. */
const RATE_MAX_KEYS = 5_000;

const hits = new Map<string, number[]>();

/**
 * In-memory sliding window. On Vercel this is per serverless instance, so it is a
 * speed bump rather than a guarantee — recorded in docs/production-readiness.md §5.
 * A shared store would need a new dependency and a new service.
 */
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);

  if (recent.length >= RATE_MAX) {
    hits.set(ip, recent);
    return true;
  }

  recent.push(now);
  hits.set(ip, recent);

  if (hits.size > RATE_MAX_KEYS) {
    for (const [key, stamps] of hits) {
      if (stamps.every((t) => now - t >= RATE_WINDOW_MS)) hits.delete(key);
      if (hits.size <= RATE_MAX_KEYS) break;
    }
  }

  return false;
}

/**
 * Compare via sha256 digests so both buffers are 32 bytes. timingSafeEqual throws on
 * a length mismatch, and that throw would itself leak the secret's length.
 */
function secretMatches(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/**
 * Read the body with a hard ceiling. Route handlers have no built-in limit
 * (next.config.ts's serverActions.bodySizeLimit does not apply here), and
 * content-length can be absent or a lie, so the cap is enforced while streaming.
 */
async function readBody(request: NextRequest): Promise<string | null> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return null;

  const body = request.body;
  if (!body) return "";

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    // stream: true so a multi-byte character split across chunks survives.
    text += decoder.decode(value, { stream: true });
  }

  return text + decoder.decode();
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) return new Response(null, { status: 429 });

  const expected = process.env.CONSULTATION_WEBHOOK_SECRET;
  if (!expected) {
    // Missing configuration must never read as "no secret required".
    console.error("[consultation-intake] CONSULTATION_WEBHOOK_SECRET is not set");
    return new Response(null, { status: 500 });
  }

  const provided = request.headers.get("x-webhook-secret");
  if (!provided || !secretMatches(provided, expected)) {
    return new Response(null, { status: 401 });
  }

  const raw = await readBody(request);
  if (raw === null) return new Response(null, { status: 413 });

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response(null, { status: 400 });
  }
  if (typeof payload !== "object" || payload === null) {
    return new Response(null, { status: 400 });
  }

  const body = payload as Record<string, unknown>;
  const fields = answers(body.fields);
  const name = str(body.name, LIMITS.name);

  if (!name && fields.length === 0) {
    // Nothing identifiable and nothing to read — a row like this is only noise.
    return new Response(null, { status: 400 });
  }

  // No RLS policy admits an anonymous insert, so this needs the service role. The
  // secret check above is what stands in for requireCoach() on a coach action.
  const admin = createAdminClient();

  const { error } = await admin.from("consultation_clients").insert({
    name,
    email: str(body.email, LIMITS.email),
    phone: str(body.phone, LIMITS.phone),
    form_response_id: str(body.responseId, LIMITS.responseId),
    form_responses: { fields },
    status: "new",
  });

  if (error) {
    // 23505 — this submission is already recorded. A retrying Apps Script must not
    // create the same person twice, so a replay is a success, not an error.
    if (error.code === "23505") return new Response(null, { status: 200 });

    console.error(`[consultation-intake] ${error.code ?? "error"}: ${error.message}`);
    return new Response(null, { status: 500 });
  }

  // Moves the sidebar's "new consultations" badge without waiting for a redeploy.
  revalidatePath("/coach", "layout");

  return new Response(null, { status: 201 });
}
