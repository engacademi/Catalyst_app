import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

const clerk = clerkMiddleware();

// Keep guest browsing and local development available without Clerk keys.
export default function proxy(...args: Parameters<typeof clerk>) {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return NextResponse.next();
  return clerk(...args);
}

export const config = {
  matcher: ["/admin/:path*", "/officials/:path*"],
};
