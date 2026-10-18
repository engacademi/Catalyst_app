"use client";
import Link from "next/link";
import {
  SignInButton,
  SignUpButton,
  UserButton,
  useUser,
  useClerk,
} from "@clerk/nextjs";
import { AccountDashboard } from "../account-dashboard";
import { useQueries } from "@tanstack/react-query";
import { useEventSelections } from "@/lib/preferences";
import { usePreference } from "@/lib/preferences";
import { allEventTeams, useEvents } from "@/lib/queries";
import { AccountRole } from "../account-dashboard";
import { Card } from "../ui";
import { formatDateRange } from "@/lib/format";

function Account() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { openUserProfile, signOut } = useClerk();
  const [intent, setIntent] = usePreference("signup-intent", "spectator");
  if (!isLoaded) return <p>Loading account…</p>;
  if (!isSignedIn)
    return (
      <>
        <h2>Make yourself at home.</h2>
        <p className="section-description">
          Browse everything as a guest, or sign in to manage your account.
        </p>
        <fieldset className="my-4">
          <legend className="mb-2">Join as</legend>
          <div className="segmented">
            {["spectator", "player", "officer"].map((type) => (
              <button
                type="button"
                key={type}
                aria-pressed={intent === type}
                onClick={() => setIntent(type)}
              >
                {type === "player"
                  ? "Athlete"
                  : type === "officer"
                    ? "Team Lead"
                    : "Spectator"}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-wrap gap-3">
          <SignInButton mode="modal">
            <button className="primary-link">Log in</button>
          </SignInButton>
          <SignUpButton mode="modal" forceRedirectUrl="/profile">
            <button className="secondary-link">Register</button>
          </SignUpButton>
        </div>
      </>
    );
  return (
    <>
      <div className="flex items-center gap-3">
        <UserButton />
        <h2>{user.firstName ? `Hi, ${user.firstName}.` : "Your account"}</h2>
      </div>
      <p className="mt-2 text-sm text-muted">
        {user.primaryEmailAddress?.emailAddress} <AccountRole />
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button className="secondary-link" onClick={() => openUserProfile()}>
          Manage account & security
        </button>
        <button className="secondary-link" onClick={() => signOut()}>
          Log out
        </button>
      </div>
    </>
  );
}
export function ProfileView({ clerkEnabled }: { clerkEnabled: boolean }) {
  const [interests, setInterests] = usePreference<string[]>("interests", []);
  const [saved] = usePreference<string[]>("saved-events", []);
  const [attended] = usePreference<string[]>("attended", []);
  const events = useEvents();
  const selected = useEventSelections(events.data?.data ?? []);
  const teamEvents = (events.data?.data ?? []).filter((e) =>
    (selected.get(e.slug) ?? []).some((id) => !id.startsWith("division:")),
  );
  const teamQueries = useQueries({
    queries: teamEvents.map((event) => ({
      queryKey: ["profile-saved-teams", event.slug],
      queryFn: () => allEventTeams(event.slug),
    })),
  });
  return (
    <main id="main" className="platform-main profile-page">
      <div className="discovery-heading">
        <h1>My Profile</h1>
      </div>
      <Card>
        {clerkEnabled ? (
          <Account />
        ) : (
          <>
            <h2>Welcome, courtside.</h2>
            <p>
              Guest browsing and saving are ready. Account registration will be
              available once sign-in is configured.
            </p>
          </>
        )}
      </Card>
      {clerkEnabled && (
        <Card className="mt-5">
          <AccountDashboard />
        </Card>
      )}
      <section>
        <h2>Your interests</h2>
        <p className="section-description">
          Pick what you love. Recommendations use these choices on this device.
        </p>
        <div className="segmented">
          {["indoor", "beach"].map((k) => (
            <button
              key={k}
              aria-pressed={interests.includes(k)}
              onClick={() =>
                setInterests(
                  interests.includes(k)
                    ? interests.filter((x) => x !== k)
                    : [...interests, k],
                )
              }
            >
              {k === "indoor" ? "Indoor volleyball" : "Beach volleyball"}
            </button>
          ))}
        </div>
      </section>
      <section>
        <h2>Saved tournaments</h2>
        <ul className="profile-list">
          {events.data?.data
            .filter((e) => saved.includes(e.slug))
            .map((e) => (
              <li key={e.id}>
                <Link href={`/events/${e.slug}`}>
                  <strong>{e.title}</strong>
                  <small>{formatDateRange(e.start_date, e.end_date)}</small>
                </Link>
              </li>
            ))}
        </ul>
        {!saved.length && (
          <Link className="secondary-link" href="/tournaments">
            Find a tournament to save
          </Link>
        )}
      </section>
      <section>
        <h2>Saved teams</h2>
        <ul className="profile-list">
          {teamEvents.flatMap((event, i) =>
            (teamQueries[i].data?.data ?? [])
              .filter((t) => selected.get(event.slug)?.includes(t.id))
              .map((team) => (
                <li key={team.id}>
                  <Link href={`/events/${event.slug}/teams/${team.id}`}>
                    <strong>{team.team_name}</strong>
                    <small>{event.title}</small>
                  </Link>
                </li>
              )),
          )}
        </ul>
        {!teamEvents.length && (
          <p className="empty-inline">
            Follow a team from a tournament to save it here.
          </p>
        )}
      </section>
      <section>
        <h2>Events you attended</h2>
        <p className="section-description">
          {attended.length
            ? `${attended.length} marked as attended. Change this on the tournament overview.`
            : "Mark an event as attended on its overview to improve your recommendations."}
        </p>
      </section>
      <Card className="mt-6">
        <h2>Staff & Team Leads</h2>
        <p className="section-description">
          Manage event details, delays, announcements, imports, brackets,
          rosters and venue information. Access follows your OVA role.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin" className="primary-link">
            Open staff portal →
          </Link>
          <Link href="/admin/assignments" className="secondary-link">
            My assignments
          </Link>
          <Link href="/admin/roster-reviews" className="secondary-link">
            Roster reviews
          </Link>
        </div>
      </Card>
      <p className="mt-5 text-xs text-muted">
        Saved events, follows, interests, attendance and notification read
        status stay in this browser. Signing in does not yet sync them across
        devices. Manage your identity, password, sessions and account deletion
        in account settings.
      </p>
    </main>
  );
}
