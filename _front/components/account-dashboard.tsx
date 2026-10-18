"use client";
import { useState } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiAuthGet, apiSend } from "@/lib/api";
import { usePreference } from "@/lib/preferences";
import { allEventTeams, useEvents } from "@/lib/queries";
import { ErrorState } from "./ui";

type Profile = {
  user_id: string;
  display_name: string;
  account_type: "spectator" | "player" | "officer" | null;
  officer_type: "coach" | "referee" | null;
  team_entry_id: string | null;
  team_name: string | null;
  discoverable: boolean;
  followers: { id: string; display_name: string }[];
};
export function AccountDashboard() {
  const { userId, getToken, isSignedIn } = useAuth();
  const { user } = useUser();
  const client = useQueryClient();
  const [intent] = usePreference("signup-intent", "spectator");

  const auth = async (): Promise<Record<string, string>> => {
    const token = await getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  };
  const profile = useQuery({
    queryKey: ["account", userId],
    queryFn: () => apiAuthGet<{ data: Profile }>(auth, "/v1/me/profile"),
    enabled: !!isSignedIn,
  });
  if (!isSignedIn) return null;
  if (profile.error) return <ErrorState error={profile.error} />;
  if (!profile.data) return <p>Loading account dashboard…</p>;
  return (
    <AccountForm
      key={`${userId}-${JSON.stringify(profile.data.data)}`}
      profile={profile.data.data}
      intent={intent}
      defaultName={user?.username || user?.fullName || ""}
      auth={auth}
      onSave={() => client.invalidateQueries({ queryKey: ["account", userId] })}
    />
  );
}
function AccountForm({
  profile,
  defaultName,
  auth,
  onSave,
  intent,
}: {
  intent: string;
  profile: Profile;
  defaultName: string;
  auth: () => Promise<Record<string, string>>;
  onSave: () => void;
}) {
  const [form, setForm] = useState({
    display_name:
      profile.display_name === "Volleyball fan"
        ? defaultName
        : profile.display_name,
    account_type:
      profile.account_type ??
      (["spectator", "player", "officer"].includes(intent)
        ? (intent as "spectator" | "player" | "officer")
        : "spectator"),
    officer_type: profile.officer_type ?? "coach",
    team_entry_id: profile.team_entry_id ?? "",
    discoverable: profile.discoverable,
  });
  const [event, setEvent] = useState("");
  const events = useEvents();
  const teams = useQuery({
    queryKey: ["account-teams", event],
    queryFn: () => allEventTeams(event),
    enabled: !!event,
  });
  const [search, setSearch] = useState("");
  const players = useQuery({
    queryKey: ["account-players", profile.user_id, search],
    queryFn: () =>
      apiAuthGet<{
        data: {
          id: string;
          display_name: string;
          team_name: string | null;
          following: boolean;
        }[];
      }>(auth, `/v1/me/players?q=${encodeURIComponent(search)}`),
  });
  const client = useQueryClient();
  const save = useMutation({
    mutationFn: () =>
      apiSend(auth, "PUT", "/v1/me/profile", {
        ...form,
        team_entry_id: form.team_entry_id || null,
        officer_type:
          form.account_type === "officer" ? form.officer_type : null,
      }),
    onSuccess: () => {
      onSave();
      client.invalidateQueries({ queryKey: ["account-players"] });
    },
  });
  const follow = useMutation({
    mutationFn: ({ id, following }: { id: string; following: boolean }) =>
      apiSend(
        auth,
        following ? "DELETE" : "PUT",
        `/v1/me/players/${id}/follow`,
      ),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["account-players"] }),
  });
  return (
    <section className="account-dashboard">
      <h2>
        {profile.account_type
          ? "Your dashboard"
          : "Choose how you join the game"}
      </h2>
      <form
        className="grid gap-4 mt-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <label className="grid gap-1">
          Display name
          <input
            required
            maxLength={100}
            className="account-input"
            value={form.display_name}
            onChange={(e) => setForm({ ...form, display_name: e.target.value })}
          />
        </label>
        <fieldset>
          <legend className="mb-2">I’m joining as</legend>
          <div className="segmented">
            {(["spectator", "player", "officer"] as const).map((type) => (
              <button
                key={type}
                type="button"
                aria-pressed={form.account_type === type}
                onClick={() => setForm({ ...form, account_type: type })}
              >
                {type === "player"
                  ? "Athlete"
                  : type === "officer"
                    ? "Lead"
                    : "Spectator"}
              </button>
            ))}
          </div>
        </fieldset>
        {form.account_type === "officer" && (
          <>
            <p className="text-sm text-muted">
              OVA must grant access to your tournaments before you can edit them
              in the staff portal.
            </p>
          </>
        )}
        {form.account_type === "player" && (
          <>
            <p className="text-sm">
              {profile.team_name
                ? `Your team: ${profile.team_name}`
                : "Choose the team you play with."}
            </p>
            <label className="grid gap-1">
              Tournament
              <select value={event} onChange={(e) => setEvent(e.target.value)}>
                <option value="">Select tournament</option>
                {events.data?.data.map((e) => (
                  <option key={e.id} value={e.slug}>
                    {e.title}
                  </option>
                ))}
              </select>
            </label>
            {event && (
              <label className="grid gap-1">
                My team
                <select
                  value={form.team_entry_id}
                  onChange={(e) =>
                    setForm({ ...form, team_entry_id: e.target.value })
                  }
                >
                  <option value="">No team</option>
                  {teams.data?.data.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.team_name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button
              type="button"
              className="secondary-link justify-self-start"
              onClick={() => setForm({ ...form, team_entry_id: "" })}
            >
              Clear team
            </button>
            <label className="flex gap-2 items-center">
              <input
                type="checkbox"
                checked={form.discoverable}
                onChange={(e) =>
                  setForm({ ...form, discoverable: e.target.checked })
                }
              />
              Let signed-in accounts find and follow my display name and team
            </label>
          </>
        )}
        {save.error && <ErrorState error={save.error} />}
        <button
          className="primary-link justify-self-start"
          disabled={save.isPending}
        >
          {save.isPending ? "Saving…" : "Save account preferences"}
        </button>
      </form>
      {profile.account_type === "player" && (
        <div className="mt-5">
          <h3>Accounts following you · {profile.followers.length}</h3>
          <ul className="profile-list mt-3">
            {profile.followers.map((f) => (
              <li className="p-3" key={f.id}>
                {f.display_name}
              </li>
            ))}
          </ul>
          {!profile.followers.length && (
            <p className="text-sm text-muted">No followers yet.</p>
          )}
        </div>
      )}
      <div className="mt-6">
        <h3>Find athletes</h3>
        <input
          className="account-input mt-3"
          aria-label="Find athletes by display name"
          placeholder="Search athletes"
          value={search}
          maxLength={100}
          onChange={(e) => setSearch(e.target.value)}
        />
        {players.error && <ErrorState error={players.error} />}
        <ul className="profile-list mt-3">
          {players.data?.data.map((p) => (
            <li className="p-3 flex gap-3 justify-between" key={p.id}>
              <span>
                {p.display_name}
                {p.team_name && <small className="block">{p.team_name}</small>}
              </span>
              <button
                className="secondary-link"
                disabled={follow.isPending}
                onClick={() =>
                  follow.mutate({ id: p.id, following: p.following })
                }
              >
                {p.following ? "Unfollow" : "Follow"}
              </button>
            </li>
          ))}
        </ul>
        {players.data?.data.length === 0 && (
          <p className="text-sm text-muted mt-3">
            No athletes have shared a profile matching your search.
          </p>
        )}
        {follow.error && <ErrorState error={follow.error} />}
      </div>
    </section>
  );
}

export function AccountRole() {
  const { userId, getToken, isSignedIn } = useAuth();
  const profile = useQuery({
    queryKey: ["account", userId],
    queryFn: () =>
      apiAuthGet<{ data: Profile }>(
        async (): Promise<Record<string, string>> => {
          const token = await getToken();
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
        "/v1/me/profile",
      ),
    enabled: !!isSignedIn,
  });
  const type = profile.data?.data.account_type;
  return type ? (
    <span className="account-role">
      {type === "player"
        ? "Athlete"
        : type === "officer"
          ? "Lead"
          : "Spectator"}
    </span>
  ) : null;
}
