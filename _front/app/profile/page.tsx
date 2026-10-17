import { Suspense } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { ProfileView } from "@/components/views/profile";
export default function Profile() {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  return key ? (
    <Suspense fallback={<p>Loading profile…</p>}>
      <ClerkProvider publishableKey={key}>
        <ProfileView clerkEnabled />
      </ClerkProvider>
    </Suspense>
  ) : (
    <ProfileView clerkEnabled={false} />
  );
}
