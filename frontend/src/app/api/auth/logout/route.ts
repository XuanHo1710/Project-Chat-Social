import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import axios from "axios";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get("session_id")?.value;
    const accessToken = cookieStore.get("access_token")?.value;

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL;
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

    cookieStore.delete("access_token");
    cookieStore.delete("session_id");

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
