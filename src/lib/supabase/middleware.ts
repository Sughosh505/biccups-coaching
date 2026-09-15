import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { span, timed } from "@/lib/timing";

// A role with no entry here has no home, and the block below signs it out rather
// than guessing — which is what retires a consultation_client account left over
// from before Phase 10 removed the role.
const ROLE_HOME: Record<string, string> = {
  coach: "/coach",
  coaching_client: "/client",
};

const PUBLIC_PATHS = ["/login"];

export async function updateSession(request: NextRequest) {
  const done = span(`proxy ${request.nextUrl.pathname}`);
  const kind = request.headers.get("next-router-prefetch")
    ? "PREFETCH"
    : request.headers.get("rsc")
      ? "rsc-nav"
      : "document";
  const rsc = request.nextUrl.searchParams.get("_rsc");

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Verified against the project's ES256 JWKS, not taken on trust from the
  // cookie, and still refreshed when expired — see the note on getActor in
  // src/lib/auth.ts. This runs on every request the matcher covers, so the
  // round trip getUser() used to make here was the single most repeated call
  // in the app.
  const { data: claims } = await timed("  proxy getClaims", () => supabase.auth.getClaims());
  const userId = claims?.claims?.sub ?? null;

  const { pathname } = request.nextUrl;
  const isPublicPath = PUBLIC_PATHS.includes(pathname);

  if (!userId) {
    if (isPublicPath) return response;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(url);
  }

  const { data: profile } = await timed("  proxy profiles.single", () =>
    supabase.from("profiles").select("role").eq("id", userId).single(),
  );

  const role = profile?.role as string | undefined;
  const home = role ? ROLE_HOME[role] : undefined;

  if (!role || !home) {
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "no-profile");
    return NextResponse.redirect(url);
  }

  if (isPublicPath || pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = home;
    // Drop the old path's query. Carrying it over turned /login?error=... into
    // /client?error=..., so a login-page error surfaced as a check-in error.
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Fail CLOSED: an authenticated user may only be inside their own namespace.
  // Anything else — including any route added later — bounces to their home rather
  // than being allowed through by default. The `/` boundary check stops `/coach`
  // from also matching a route like `/coachable`.
  const inOwnNamespace = pathname === home || pathname.startsWith(`${home}/`);

  if (!inOwnNamespace) {
    const url = request.nextUrl.clone();
    url.pathname = home;
    url.search = "";
    return NextResponse.redirect(url);
  }

  done(`${kind} _rsc=${rsc ?? "-"}`);
  return response;
}
