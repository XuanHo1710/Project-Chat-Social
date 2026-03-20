import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import axios from "axios";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get("session_id")?.value;
    const accessTokenFromCookie = cookieStore.get("access_token")?.value;

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL;

    // Fast path: existing access token cookie still valid
    if (accessTokenFromCookie) {
      try {
        const profileResponse = await axios.get(`${backendUrl}/auth/profile`, {
          headers: {
            Authorization: `Bearer ${accessTokenFromCookie}`,
          },
        });

        if (profileResponse.status === 200 || profileResponse.status === 201) {
          const accountData =
            profileResponse.data?.data || profileResponse.data;
          return NextResponse.json({
            accessToken: accessTokenFromCookie,
            data: {
              account: accountData,
            },
          });
        }
      } catch {
        // Access token expired, continue with session refresh flow below
      }
    }

    if (!sessionId) {
      return NextResponse.json(null, { status: 401 });
    }

    try {
      const refreshResponse = await axios.post(
        `${backendUrl}/auth/refresh-token`,
        {
          sessionId,
        },
      );

      if (
        (refreshResponse.status === 200 || refreshResponse.status === 201) &&
        refreshResponse.data?.data?.access_token
      ) {
        const accessToken = refreshResponse.data?.data?.access_token;
        const accountData = refreshResponse.data?.data?.payload;

        cookieStore.set("access_token", accessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60,
        });

        return NextResponse.json({
          accessToken: accessToken,
          data: {
            account: accountData.data || accountData,
          },
        });
      }

      return NextResponse.json(null, { status: 401 });
    } catch (error) {
      console.error("Backend API error:", error);
      return NextResponse.json(null, { status: 401 });
    }
  } catch (error) {
    console.error("Error verifying token:", error);
    return NextResponse.json(null, { status: 500 });
  }
}
