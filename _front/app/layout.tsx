import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { DM_Sans, Manrope } from "next/font/google";
import "./globals.css";
import { PlatformShell } from "@/components/platform-shell";
import { Providers } from "./providers";

const bodyFont = DM_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});
const headingFont = Manrope({
  variable: "--font-heading",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Olley Catalyst", template: "%s · Olley Catalyst" },
  icons: { icon: "/ova-trillium.png", apple: "/ova-trillium.png" },
  description: "Your teams, your next match, your event, in one place.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#164c3b",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-CA"
      className={`${bodyFont.variable} ${headingFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        <Providers>
          <Suspense fallback={<p className="p-6">Loading courtside…</p>}>
            <PlatformShell>{children}</PlatformShell>
          </Suspense>
        </Providers>
      </body>
    </html>
  );
}
