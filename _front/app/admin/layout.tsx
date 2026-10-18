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
            colorPrimary: "#24272a",
            colorForeground: "#24272a",
            colorMutedForeground: "#5c6166",
            colorBorder: "#dfdfdf",
            colorBackground: "#ffffff",
            borderRadius: "1rem",
            fontFamily: "var(--font-body)",
          },
        }}
      >
        <AdminShell mode="clerk">{children}</AdminShell>
      </ClerkProvider>
    </Suspense>
  );
}
