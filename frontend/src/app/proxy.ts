import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Middleware for handling authentication and routing
 * Checks session/access cookies for authentication status
 *
 * @author: Social Chat Team
 * @date: 2025-01-24
 */

// Routes that require authentication (protected routes)
const protectedPaths = ["/chat"];

// Auth-related routes (login, register, etc.)
const authPaths = ["/auth/login", "/auth/register"];

export function proxy(request: NextRequest) {
  const sessionId = request.cookies.get("session_id")?.value;
  const accessToken = request.cookies.get("access_token")?.value;
  const pathname = request.nextUrl.pathname;

  // Check if user is trying to access protected routes without auth session
  if (
    protectedPaths.some((path) => pathname.startsWith(path)) &&
    !sessionId &&
    !accessToken
  ) {
    // Redirect to login if not authenticated
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  // If user is authenticated and trying to access auth pages
  // Redirect them to chat page
  if (
    authPaths.some((path) => pathname.startsWith(path)) &&
    (sessionId || accessToken)
  ) {
    return NextResponse.redirect(new URL("/chat", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except static files and API routes
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
