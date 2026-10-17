"use client";
import { useState } from "react";
import type { AdminEventData } from "./admin-event";
import { useAdminMutation } from "./hooks";
import { Card, SectionTitle } from "../ui";
import {
  Field,
  FormError,
  PrimaryButton,
  SmallButton,
  inputClass,
} from "./form";

export function CourtOperations({ event }: { event: AdminEventData }) {
  const courts = event.venues.flatMap((v) =>
    v.courts.map((c) => ({ ...c, venue: v.name })),
  );
  const [court, setCourt] = useState("");
  const [area, setArea] = useState("");
  const [minutes, setMinutes] = useState(20);
  const [duration, setDuration] = useState(60);
  const [all, setAll] = useState(false);
  const update = useAdminMutation("PATCH", `/v1/admin/courts/${court}/notice`);
  const [clock, setClock] = useState("");
  const changeClock = useAdminMutation(
    "POST",
    `/v1/admin/events/${event.id}/clock`,
  );
  return (
    <div>
      <SectionTitle>Court areas & delay notices</SectionTitle>
      <p className="mb-3 text-sm text-muted">
        Official start times stay unchanged. A delay creates an expiring staff
        estimate beside the source time.
      </p>
      <Card>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            update.mutate({
              area_label: area || null,
              delay_minutes: minutes,
              duration_minutes: duration,
              apply_to_area: all,
            });
          }}
        >
          <Field label="Court">
            <select
              required
              value={court}
              onChange={(e) => {
                setCourt(e.target.value);
                setArea(
                  courts.find((c) => c.id === e.target.value)?.area_label ?? "",
                );
              }}
              className={inputClass}
            >
              <option value="">Choose court</option>
              {courts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}, {c.venue}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Area label">
            <input
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="Hall C, north side"
              className={inputClass}
            />
          </Field>
          <Field label="Approximate delay (minutes)">
            <input
              type="number"
              min={0}
              max={240}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              className={inputClass}
            />
          </Field>
          <Field label="Notice lasts (minutes)">
            <input
              type="number"
              min={1}
              max={1440}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className={inputClass}
            />
          </Field>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={all}
              onChange={(e) => setAll(e.target.checked)}
            />
            Apply to every court in this venue area
          </label>
          <div className="flex flex-wrap gap-2">
            <PrimaryButton pending={update.isPending}>
              Post notice / save area
            </PrimaryButton>
            <SmallButton
              disabled={!court || update.isPending}
              onClick={() =>
                update.mutate({ delay_minutes: 0, duration_minutes: 60 })
              }
            >
              Clear delay
            </SmallButton>
          </div>
          <FormError error={update.error} />
          {update.isSuccess && (
            <p role="status" className="text-sm text-brand">
              Court information updated.
            </p>
          )}
        </form>
      </Card>
      {event.is_demo && (
        <>
          <SectionTitle>Demo clock</SectionTitle>
          <Card>
            <p className="mb-3 text-sm text-muted">
              Set the event&apos;s clock to demonstrate a past schedule. It
              continues ticking forward and appears in a banner for everyone.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                changeClock.mutate({ at: new Date(clock).toISOString() });
              }}
              className="space-y-3"
            >
              <Field
                label="Demo date and time"
                hint="Your device's local timezone"
              >
                <input
                  required
                  type="datetime-local"
                  value={clock}
                  onChange={(e) => setClock(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <div className="flex flex-wrap gap-2">
                <PrimaryButton pending={changeClock.isPending}>
                  Set demo time
                </PrimaryButton>
                <SmallButton
                  onClick={() => changeClock.mutate({ advance_minutes: 15 })}
                >
                  +15 min
                </SmallButton>
                <SmallButton
                  onClick={() => changeClock.mutate({ reset: true })}
                >
                  Use real time
                </SmallButton>
              </div>
              <FormError error={changeClock.error} />
            </form>
          </Card>
        </>
      )}
    </div>
  );
}
