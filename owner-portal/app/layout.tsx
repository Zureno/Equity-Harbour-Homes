import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// ✅ All imports at the top
import LogoutButton from "@/components/owner/LogoutButton";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EquityHarbor Homes – Owner Portal",
  description: "Owner dashboard for tracking rent, Section 8 and tenants.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-neutral-950 text-neutral-50`}
      >
        {/* Top owner header */}
        <header className="flex items-center justify-between px-6 py-3 border-b border-neutral-800">
          <div className="text-sm font-semibold">
            EquityHarbor Homes – Owner Portal
          </div>

          <LogoutButton />
        </header>

        {/* Page content */}
        {children}
      </body>
    </html>
  );
}
