import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
    try {
        const cookieStore = await cookies();
        const refreshToken = cookieStore.get('refresh_token')?.value;
        const accessToken = cookieStore.get('access_token')?.value;

        if (!refreshToken && !accessToken) {
            return NextResponse.json(
                { user: null, isAuthenticated: false },
                { status: 401 }
            );
        }

        // Call backend to get user profile
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL;
        const response = await fetch(`${backendUrl}/auth/profile`, {
            headers: {
                'Cookie': `refresh_token=${refreshToken}; access_token=${accessToken}`,
            },
            credentials: 'include',
        });

        if (!response.ok) {
            return NextResponse.json(
                { user: null, isAuthenticated: false },
                { status: 401 }
            );
        }

        const data = await response.json();

        return NextResponse.json({
            user: data,
            isAuthenticated: true,
        });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        return NextResponse.json(
            { user: null, isAuthenticated: false },
            { status: 500 }
        );
    }
}
