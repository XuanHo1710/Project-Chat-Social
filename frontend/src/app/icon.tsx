import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
    return new ImageResponse(
        (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, #1877F2 0%, #0053BF 100%)',
                    borderRadius: '8px',
                }}
            >
                {/* Chat bubble */}
                <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                >
                    <path
                        d="M12 2C6.48 2 2 5.82 2 10.5c0 2.78 1.64 5.25 4.17 6.86L5 21l3.64-2c1.07.29 2.2.44 3.36.44 5.52 0 10-3.82 10-8.5S17.52 2 12 2z"
                        fill="white"
                    />
                    <circle cx="8.5" cy="10.5" r="1.4" fill="#1877F2" />
                    <circle cx="12" cy="10.5" r="1.4" fill="#1877F2" />
                    <circle cx="15.5" cy="10.5" r="1.4" fill="#1877F2" />
                </svg>
            </div>
        ),
        { ...size }
    );
}
