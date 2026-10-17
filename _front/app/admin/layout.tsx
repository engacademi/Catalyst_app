import { Suspense } from "react";
import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { AdminShell } from "@/components/admin/auth";
import { Loading } from "@/components/ui";

export const metadata: Metadata = {
  title: "Staff workspace",
  robots: { index: false },
};

const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  if (!clerkKey) return <AdminShell mode="dev">{children}</AdminShell>;
  return (
    <Suspense fallback={<Loading />}>
      <ClerkProvider
        publishableKey={clerkKey}
        appearance={{
          variables: {
            colorPrimary: "#164c3b",
            colorForeground: "#1d332b",
            colorMutedForeground: "#5d6c63",
            colorBorder: "#dce4da",
            colorBackground: "#ffffff",
            borderRadius: "1rem",
            fontFamily: "var(--font-body), sans-serif",
          },
        }}
      >
        <AdminShell mode="clerk">{children}</AdminShell>
      </ClerkProvider>
    </Suspense>
  );
}
