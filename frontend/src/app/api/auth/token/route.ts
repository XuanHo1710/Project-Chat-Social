import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
    try {
        const { accessToken } = await request.json();
        const cookieStore = await cookies();
        const refreshToken = cookieStore.get('refresh_token')?.value;

        // Nếu không có refresh_token cookie thì return null
        if (!refreshToken) {
            return NextResponse.json(null, { status: 401 });
        }

        // Call backend để verify và có thể refresh token
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL;

        try {
            // Thử get profile với access token hiện tại
            const profileResponse = await fetch(`${backendUrl}/auth/profile`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Cookie': `refresh_token=${refreshToken}`,
                },
                credentials: 'include',
            });

            if (profileResponse.ok) {
                const accountData = await profileResponse.json();

                return NextResponse.json({
                    accessToken: accessToken, // Giữ nguyên access token
                    data: {
                        account: accountData.data || accountData
                    }
                });
            }

            // Nếu access token hết hạn, thử refresh
            const refreshResponse = await fetch(`${backendUrl}/auth/refresh-token`, {
                method: 'POST',
                headers: {
                    'Cookie': `refresh_token=${refreshToken}`,
                },
                credentials: 'include',
            });

            if (refreshResponse.ok) {
                const refreshData = await refreshResponse.json();
                const newAccessToken = refreshData.data?.access_token || refreshData.access_token;

                // Lấy lại profile với token mới
                const newProfileResponse = await fetch(`${backendUrl}/auth/profile`, {
                    headers: {
                        'Authorization': `Bearer ${newAccessToken}`,
                        'Cookie': `refresh_token=${refreshToken}`,
                    },
                    credentials: 'include',
                });

                if (newProfileResponse.ok) {
                    const accountData = await newProfileResponse.json();

                    return NextResponse.json({
                        accessToken: newAccessToken, // Trả về access token mới
                        data: {
                            account: accountData.data || accountData
                        }
                    });
                }
            }

            // Nếu cả 2 đều fail thì return null
            return NextResponse.json(null, { status: 401 });

        } catch (error) {
            console.error('Backend API error:', error);
            return NextResponse.json(null, { status: 401 });
        }

    } catch (error) {
        console.error('Error verifying token:', error);
        return NextResponse.json(null, { status: 500 });
    }
}
