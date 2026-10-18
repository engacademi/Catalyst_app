"use client";
import type { ReactNode } from "react";
import { useUser } from "@clerk/nextjs";
export function DiscoveryGreeting({
  illustration,
}: {
  illustration?: ReactNode;
}) {
  const { isLoaded, isSignedIn, user } = useUser();
  if (!isLoaded || !isSignedIn)
    return <h1>Find your next game.{illustration}</h1>;
  const name = user.username || user.firstName || user.fullName || "there";
  return (
    <>
      <h1>
        Hello {name}!{illustration}
      </h1>
      <p className="greeting-next">Are you ready for your next game?</p>
    </>
  );
}
