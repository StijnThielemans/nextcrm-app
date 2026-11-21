import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { getSessionCookie } from "better-auth/cookies";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isDevPasswordSignIn, isDevTrustedOrigin } from "@/lib/dev-password-sign-in";
import { isPartnerAllowedPath } from "@/lib/partner-routes";

const intlMiddleware = createMiddleware(routing);

// Admin-only API paths — cookie presence checked here, role checked server-side
const ADMIN_ONLY_PATHS = [
  "/api/user/activateAdmin",
  "/api/user/deactivateAdmin",
  "/api/user/activate",
  "/api/user/deactivate",
  "/api/user/inviteuser",
  "/api/admin",
];

// Writes here authenticate with a token or signature of their own, or come
// from mail links; the Origin check below does not apply to them.
// (/api/auth and /api/inngest return before it.)
const ORIGIN_CHECK_EXEMPT = [
  "/api/mcp",
  "/api/campaigns/unsubscribe",
  "/api/crm/leads/create-lead-from-web",
  "/api/crm/contacts/create-from-remote",
];

/**
 * A cookie-authenticated write to /api must come from the app's own origin.
 * A page on a same-site host (files.<domain>) can make the browser send the
 * session cookie, but its Origin is its own. Browsers send Origin on every
 * POST/PUT/PATCH/DELETE fetch, so a missing one is refused too. An
 * Authorization header does not exempt it: token callers (MCP, API tokens)
 * send no session cookie, so they never reach the check.
 */
// A quick tunnel terminates TLS on 443 and proxies to this dev server.
// Next fills in x-forwarded-port with 3000, and next-intl copies that onto
// the locale redirect. The phone then opens https://<tunnel>:3000 and the
// page after login never loads.
function dropTunnelDevPort(res: NextResponse) {
  const location = res.headers.get("location");
  if (!location) return res;
  try {
    const url = new URL(location);
    if (url.port === "3000" && url.hostname.endsWith(".trycloudflare.com")) {
      url.port = "";
      res.headers.set("location", url.toString());
    }
  } catch {
    return res;
  }
  return res;
}

function isCrossOriginWrite(req: NextRequest, path: string, hasSessionCookie: boolean) {
  if (!hasSessionCookie || ["GET", "HEAD", "OPTIONS"].includes(req.method)) return false;
  if (path.includes("/webhooks/") || ORIGIN_CHECK_EXEMPT.some((p) => path.startsWith(p))) return false;
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const appOrigin = process.env.BETTER_AUTH_URL
    ? new URL(process.env.BETTER_AUTH_URL).origin
    : req.nextUrl.origin;
  if (origin === appOrigin) return false;
  // Document uploads are cookie writes to /api. On this dev server the page
  // is opened on localhost or on whichever trycloudflare tunnel is up, while
  // BETTER_AUTH_URL can still name an older tunnel. That 403 was shown as
  // "Het bestand opslaan is mislukt". Production keeps the configured origin.
  return !(isDevPasswordSignIn() && isDevTrustedOrigin(origin));
}

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Inngest webhook — pass through, Inngest handles its own auth via signing key
  if (path.startsWith("/api/inngest")) {
    return dropTunnelDevPort(NextResponse.next());
  }

  // better-auth API routes — pass through to better-auth handler
  if (path.startsWith("/api/auth")) {
    return dropTunnelDevPort(NextResponse.next());
  }

  const sessionCookie = getSessionCookie(req);

  // Partners get only the routes in lib/partner-routes.ts, refused here on the
  // server for pages and API alike (deny by default). The session is looked up
  // only off the allow-list, so partner pages and cookie-less calls cost nothing.
  if (sessionCookie && !isPartnerAllowedPath(path)) {
    const session = await auth.api.getSession({ headers: req.headers });
    if (session?.user.role === "partner") {
      if (path.startsWith("/api")) {
        return dropTunnelDevPort(NextResponse.json({ error: "Forbidden" }, { status: 403 }));
      }
      return dropTunnelDevPort(NextResponse.redirect(new URL("/", req.nextUrl)));
    }
  }

  if (path.startsWith("/api") && isCrossOriginWrite(req, path, !!sessionCookie)) {
    return dropTunnelDevPort(NextResponse.json({ error: "Forbidden" }, { status: 403 }));
  }

  // Admin-only routes — require session cookie (role checked server-side)
  if (ADMIN_ONLY_PATHS.some((p) => path.startsWith(p))) {
    if (!sessionCookie) {
      return dropTunnelDevPort(NextResponse.json({ error: "Unauthenticated" }, { status: 401 }));
    }
    return dropTunnelDevPort(NextResponse.next());
  }

  // Non-API routes — redirect to sign-in if no session cookie
  if (!path.startsWith("/api")) {
    if (!sessionCookie) {
      // Allow auth pages (sign-in, register, pending, inactive)
      const authPaths = ["/sign-in", "/register", "/pending", "/inactive"];
      const isAuthPage = authPaths.some((p) => path.includes(p));
      if (!isAuthPage) {
        return dropTunnelDevPort(NextResponse.redirect(new URL("/sign-in", req.nextUrl)));
      }
    }
  }

  // Other API routes authenticate themselves
  if (path.startsWith("/api")) {
    return dropTunnelDevPort(NextResponse.next());
  }

  // Non-API routes — delegate to next-intl
  return dropTunnelDevPort(intlMiddleware(req));
}

export const config = {
  matcher: [
    // Admin-only API paths
    "/api/user/activateAdmin/:path*",
    "/api/user/deactivateAdmin/:path*",
    "/api/user/activate/:path*",
    "/api/user/deactivate/:path*",
    "/api/user/inviteuser",
    "/api/admin/:path*",
    // Every other API route, for the partner allow-list
    "/api/:path*",
    // better-auth API
    "/api/auth/:path*",
    // All non-API routes (existing intl matcher)
    "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
  ],
};
