"use client";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiAuthGet } from "@/lib/api";
import { useAuth, useUser } from "@clerk/nextjs";
export function DiscoveryGreeting({
  illustration,
}: {
  illustration?: ReactNode;
}) {
  const { isLoaded, isSignedIn, user } = useUser();
  const { userId, getToken } = useAuth();
  const profile = useQuery({
    queryKey: ["account", userId],
    enabled: !!isSignedIn,
    queryFn: () =>
      apiAuthGet<{ data: { display_name: string } }>(
        async (): Promise<Record<string, string>> => {
          const token = await getToken();
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
        "/v1/me/profile",
      ),
  });
  if (!isLoaded || !isSignedIn)
    return <h1>Find your next game.{illustration}</h1>;
  const name =
    profile.data?.data.display_name ||
    user.username ||
    user.firstName ||
    user.fullName ||
    "there";
  return (
    <>
      <h1>
        Hello {name}!{illustration}
      </h1>
      <p className="greeting-next">Are you ready for your next game?</p>
    </>
  );
}
