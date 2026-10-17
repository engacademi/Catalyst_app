import { Suspense } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { DiscoverView } from "@/components/views/discover";
export default function Home() {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  return key ? (
    <Suspense fallback={<p className="p-6">Loading courtside…</p>}>
      <ClerkProvider publishableKey={key}>
        <DiscoverView personalized />
      </ClerkProvider>
    </Suspense>
  ) : (
    <DiscoverView />
  );
}
