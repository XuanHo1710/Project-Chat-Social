import { ADMIN_PATH } from "@/constants/paths";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Middleware for handling authentication and routing
 * Following Spring Boot rules and security conventions
 *
 * @author: Insurance System Team
 * @date: 9/28/2025
 */

// Routes that require authentication
const protectedPaths = ["/admin"];
// Auth-related routes
const authPaths = [ADMIN_PATH.LOGIN];

export function proxy(request: NextRequest) {
    // const refreshToken = request.cookies.get("refreshToken")?.value;
    // const pathname = request.nextUrl.pathname;

    // // Check if user is trying to access protected routes without authentication
    // if (
    //     protectedPaths.some((path) => pathname.startsWith(path)) &&
    //     !refreshToken &&
    //     pathname !== "/admin/login"
    // ) {
    //     return NextResponse.redirect(new URL("/admin/login", request.url));
    // }

    // // If user is authenticated and trying to access auth pages, redirect to home
    // if (authPaths.some((path) => pathname.startsWith(path)) && refreshToken) {
    //     return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    // }

    return NextResponse.next();
}

export const config = {
    matcher: [
        // "/admin/:path*",
        "/((?!api|_next/static|_next/image|favicon.ico).*)",
    ],
};

//  "/admin/:path*",
//         "/((?!api|_next/static|_next/image|favicon.ico).*)",