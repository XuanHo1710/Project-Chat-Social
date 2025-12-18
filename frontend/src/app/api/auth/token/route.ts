import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import axios from 'axios';

export async function POST() {
    try {
        const cookieStore = await cookies();
        const refreshToken = cookieStore.get('refresh_token')?.value;

        // Nếu không có refresh_token cookie thì return null
        if (!refreshToken) {
            return NextResponse.json(null, { status: 401 });
        }

        // Call backend để verify và có thể refresh token
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL;

        try {

            // Nếu refresh cho access token
            const refreshResponse = await axios.post(`${backendUrl}/auth/refresh-token`, { refreshToken: refreshToken});

            if (refreshResponse.status === 201 && refreshResponse.data?.data?.access_token) {
                const accessToken =  refreshResponse.data?.data?.access_token;
                const accountData = refreshResponse.data?.data?.payload;

                return NextResponse.json({
                    accessToken: accessToken, 
                    data: {
                        account: accountData.data || accountData
                    }
                });
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
