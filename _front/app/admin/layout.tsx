import { Suspense } from "react";
import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { AdminShell } from "@/components/admin/auth";
import { Loading } from "@/components/ui";

export const metadata: Metadata = { title: "Staff workspace", robots: { index: false } };

const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  if (!clerkKey) return <AdminShell mode="dev">{children}</AdminShell>;
  return (
    <Suspense fallback={<Loading />}>
      <ClerkProvider publishableKey={clerkKey}>
        <AdminShell mode="clerk">{children}</AdminShell>
      </ClerkProvider>
    </Suspense>
  );
}
