"use client";
import { useState } from "react";
import { useAdminMutation, useAdminQuery } from "./hooks";
import { Card, ErrorState, Loading } from "../ui";
import { Field, FormError, inputClass, PrimaryButton } from "./form";
import type { AdminEventData } from "./admin-event";
export function EventAccess({ event }: { event: AdminEventData }) {
  const path = `/v1/admin/events/${event.id}/access`;
  const data = useAdminQuery<{
    data: {
      id: string;
      user_id: string;
      role: string;
      entry_id: string | null;
    }[];
    users: { id: string; display_name: string }[];
  }>(path);
  const save = useAdminMutation("POST", path);
  const remove = useAdminMutation<{ id: string }>(
    "DELETE",
    (body) => `${path}/${body.id}`,
  );
  const [form, setForm] = useState({
    user_id: "",
    role: "staff",
    entry_id: "",
  });
  if (data.isPending) return <Loading />;
  if (data.error) return <ErrorState error={data.error} />;
  return (
    <Card>
      <h2>Event access</h2>
      <form
        className="grid gap-3 mt-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate({
            ...form,
            role:
              form.role === "staff"
                ? "staff"
                : form.entry_id
                  ? "coach"
                  : "official",
            entry_id:
              form.role !== "staff" && form.entry_id ? form.entry_id : null,
          });
        }}
      >
        <Field label="Account">
          <select
            required
            className={inputClass}
            value={form.user_id}
            onChange={(e) => setForm({ ...form, user_id: e.target.value })}
          >
            <option value="">Choose an account</option>
            {data.data.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.display_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Role">
          <select
            className={inputClass}
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            <option value="staff">Staff</option>
            <option value="team_lead">Team Lead</option>
          </select>
        </Field>
        {form.role === "team_lead" && (
          <Field label="Team for roster reviews (optional)">
            <select
              className={inputClass}
              value={form.entry_id}
              onChange={(e) => setForm({ ...form, entry_id: e.target.value })}
            >
              <option value="">Event operations only</option>
              {event.entries.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.team_name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <FormError error={save.error ?? remove.error} />
        <PrimaryButton pending={save.isPending}>
          Grant event access
        </PrimaryButton>
      </form>
      <ul className="profile-list mt-5">
        {data.data.data.map((g) => (
          <li key={g.id} className="p-3 flex justify-between gap-3">
            <span>
              {data.data.users.find((u) => u.id === g.user_id)?.display_name ??
                "Account"}{" "}
              ·{" "}
              {g.role === "coach" || g.role === "official"
                ? "Team Lead"
                : g.role}
              {g.entry_id &&
                ` · ${event.entries.find((t) => t.id === g.entry_id)?.team_name}`}
            </span>
            <button
              className="text-danger"
              disabled={remove.isPending}
              onClick={() => remove.mutate({ id: g.id })}
            >
              Revoke
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
