import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// A role with no entry here has no home, and the block below signs it out rather
// than guessing — which is what retires a consultation_client account left over
// from before Phase 10 removed the role.
const ROLE_HOME: Record<string, string> = {
  coach: "/coach",
  coaching_client: "/client",
};

const PUBLIC_PATHS = ["/login"];

export async function updateSession(request: NextRequest) {
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublicPath = PUBLIC_PATHS.includes(pathname);

  if (!user) {
    if (isPublicPath) return response;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(url);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

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

  return response;
}
