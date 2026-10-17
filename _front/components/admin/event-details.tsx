"use client";
import { useState } from "react";
import type { AdminEventData } from "./admin-event";
import { useAdminMutation } from "./hooks";
import { Card } from "../ui";
import { Field, FormError, inputClass, PrimaryButton } from "./form";
export function EventDetailsPanel({ event }: { event: AdminEventData }) {
  const [form, setForm] = useState({
    title: event.title,
    start_date: event.start_date,
    end_date: event.end_date,
    kind: event.kind,
  });
  const save = useAdminMutation("PATCH", `/v1/admin/events/${event.id}`);
  return (
    <Card>
      <h2 className="mb-4 text-lg font-bold">Tournament details</h2>
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate({ ...form, expected_revision: event.revision });
        }}
      >
        <Field label="Title">
          <input
            className={inputClass}
            required
            minLength={3}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </Field>
        <Field label="Type">
          <select
            className={inputClass}
            value={form.kind}
            onChange={(e) =>
              setForm({ ...form, kind: e.target.value as typeof form.kind })
            }
          >
            <option value="indoor">Indoor</option>
            <option value="beach">Beach</option>
          </select>
        </Field>
        <Field label="Start date">
          <input
            className={inputClass}
            required
            type="date"
            value={form.start_date}
            onChange={(e) => setForm({ ...form, start_date: e.target.value })}
          />
        </Field>
        <Field label="End date">
          <input
            className={inputClass}
            required
            type="date"
            min={form.start_date}
            value={form.end_date}
            onChange={(e) => setForm({ ...form, end_date: e.target.value })}
          />
        </Field>
        <FormError error={save.error} />
        {save.isSuccess && <p role="status">Details updated.</p>}
        <PrimaryButton pending={save.isPending}>Save details</PrimaryButton>
      </form>
    </Card>
  );
}
