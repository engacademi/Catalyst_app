"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { SignInButton, UserButton, useAuth } from "@clerk/nextjs";
import type { AuthHeaders } from "@/lib/api";

type AdminAuth = { auth: AuthHeaders; identity: string };
const Ctx = createContext<AdminAuth | null>(null);

export function useAdminAuth(): AdminAuth {
  const value = useContext(Ctx);
  if (!value) throw new Error("useAdminAuth outside AdminShell");
  return value;
}

function Frame({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-4">
      <header className="mb-6 flex items-center justify-between gap-3 border-b border-border pb-3">
        <Link href="/admin" className="flex items-center gap-3">
          <Image src="/brand/ova-logo.png" alt="" width={24} height={34} />
          <span className="font-semibold">Staff workspace</span>
        </Link>
        {right}
      </header>
      <main id="main">{children}</main>
    </div>
  );
}

/** Production: Clerk session tokens, sent as a bearer header and never stored by us. */
function ClerkBridge({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, getToken, userId } = useAuth();
  const auth = useCallback(async (): Promise<Record<string, string>> => {
    const token = await getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [getToken]);
  if (!isLoaded) return <Frame>Loading…</Frame>;
  if (!isSignedIn)
    return (
      <Frame>
        <div className="mx-auto max-w-sm rounded-xl border border-border bg-surface p-6 text-center">
          <p className="font-semibold">Sign in to manage event content</p>
          <p className="mt-1 text-sm text-muted">Access depends on the roles OVA has granted to your account.</p>
          <SignInButton mode="modal">
            <button className="mt-4 min-h-11 rounded-full bg-brand px-5 font-semibold text-white">Sign in</button>
          </SignInButton>
        </div>
      </Frame>
    );
  return (
    <Ctx.Provider value={{ auth, identity: userId ?? "" }}>
      <Frame right={<UserButton />}>{children}</Frame>
    </Ctx.Provider>
  );
}

/** Local development only: the API trusts X-Dev-User when it runs with AUTH_MODE=dev. */
function DevBridge({ children }: { children: ReactNode }) {
  const [user, setUser] = useState(() => {
    if (typeof window === "undefined") return "dev-admin";
    try {
      return window.sessionStorage.getItem("courtside:dev-user") ?? "dev-admin";
    } catch {
      return "dev-admin";
    }
  });
  const auth = useCallback(async () => ({ "X-Dev-User": user }), [user]);
  const right = (
    <label className="flex items-center gap-2 text-xs text-muted">
      Dev user
      <select
        value={user}
        onChange={(e) => {
          setUser(e.target.value);
          try {
            window.sessionStorage.setItem("courtside:dev-user", e.target.value);
          } catch {}
        }}
        className="rounded border border-border bg-surface px-2 py-1 text-foreground"
      >
        <option value="dev-admin">dev-admin</option>
        <option value="dev-official">dev-official</option>
        <option value="guest">guest (no roles)</option>
      </select>
    </label>
  );
  return (
    <Ctx.Provider value={{ auth, identity: user }}>
      <Frame right={right}>
        <p className="mb-4 rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">
          Development sign-in. Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY to use Clerk.
        </p>
        {children}
      </Frame>
    </Ctx.Provider>
  );
}

export function AdminShell({ mode, children }: { mode: "clerk" | "dev"; children: ReactNode }) {
  return mode === "clerk" ? <ClerkBridge>{children}</ClerkBridge> : <DevBridge>{children}</DevBridge>;
}
