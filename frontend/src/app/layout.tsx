import type { Metadata } from "next";
import "./globals.css";

import localFont from "next/font/local";
import { Toaster } from "sonner";
import { QueryProvider } from "@/hooks/QueryProvider";
import { AuthProvider } from "@/contexts/AuthProvider";

const myFont = localFont({
  src: [
    {
      path: "./Roboto-Thin.ttf",
      weight: "100",
    },
    {
      path: "./Roboto-Regular.ttf",
      weight: "400",
    },
  ],
  display: "swap",
  variable: "--font-roboto",
});

export const metadata: Metadata = {
  title: "Social Chat - Kết nối mọi người",
  description: "Ứng dụng chat real-time giúp bạn kết nối với bạn bè và người thân",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body
        suppressHydrationWarning className={`${myFont.variable} font-sans antialiased`}
      >
        <QueryProvider>
          <AuthProvider>
            {children}
            <Toaster
              position="top-right"
              richColors
              closeButton
              duration={4000}
            />
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}

