import type { Metadata } from "next";
import "./globals.css";
import React from 'react';

import { Toaster } from "sonner";
import { QueryProvider } from "@/hooks/QueryProvider";
import { AuthProvider } from "@/contexts/AuthProvider";
import { SocketProvider } from "@/contexts/SocketContext";
import { MediaUploadProvider } from "@/contexts/MediaUploadContext";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import FirebaseNotification from "@/components/FirebaseNotification";

export const metadata: Metadata = {
  title: {
    default: "Social Chat - Mạng xã hội kết nối bạn bè",
    template: "%s | Social Chat",
  },
  description: "Social Chat - Nền tảng mạng xã hội miễn phí giúp bạn kết nối với bạn bè, gia đình và cộng đồng. Chia sẻ khoảnh khắc, nhắn tin, video call và khám phá nội dung thú vị.",
  keywords: ["mạng xã hội", "social media", "kết nối bạn bè", "chat", "messenger", "video call", "chia sẻ ảnh", "chia sẻ video", "cộng đồng", "social network"],
  authors: [{ name: "Social Chat Team" }],
  creator: "Social Chat",
  publisher: "Social Chat",
  openGraph: {
    type: "website",
    locale: "vi_VN",
    siteName: "Social Chat",
    title: "Social Chat - Kết nối mọi người",
    description: "Tham gia cộng đồng hàng triệu người dùng. Chia sẻ, kết nối và khám phá thế giới xung quanh bạn.",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Social Chat",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Social Chat - Mạng xã hội kết nối bạn bè",
    description: "Kết nối với bạn bè, chia sẻ khoảnh khắc và khám phá cộng đồng.",
    images: ["/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "your-google-verification-code",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body
        suppressHydrationWarning className="font-sans antialiased"
      >
        <QueryProvider>
          <ThemeProvider>
            <AuthProvider>
              <FirebaseNotification />
              <SocketProvider>
                <MediaUploadProvider>
                  {children}
                  <Toaster
                    position="top-right"
                    richColors
                    closeButton
                    duration={4000}
                  />
                </MediaUploadProvider>
              </SocketProvider>
            </AuthProvider>
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
