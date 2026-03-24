import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import axios from "axios";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get("session_id")?.value;
    const accessToken = cookieStore.get("access_token")?.value;

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL;

    // Call backend logout to invalidate the session
    if (sessionId) {
      try {
        await axios.post(
          `${backendUrl}/auth/logout`,
          { sessionId },
          {
            headers: accessToken
              ? { Authorization: `Bearer ${accessToken}` }
              : undefined,
          },
        );
      } catch {
        // Always clear cookies even if backend logout fails
      }
    }

    // Clear cookies with matching attributes to ensure proper deletion
    // Must match the same path, httpOnly, secure, sameSite used when setting
    const isProduction = process.env.NODE_ENV === "production";

    cookieStore.set("access_token", "", {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    cookieStore.set("session_id", "", {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
