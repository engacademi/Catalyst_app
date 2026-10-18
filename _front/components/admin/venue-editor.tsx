"use client";
import { useState } from "react";
import type { Venue } from "@/lib/api";
import { useAdminMutation } from "./hooks";
import { Field, FormError, inputClass, PrimaryButton } from "./form";
export function VenueEditor({ venue }: { venue: Venue }) {
  const [form, setForm] = useState({
    name: venue.name,
    address: venue.address ?? "",
    city: venue.city ?? "",
    latitude: venue.latitude?.toString() ?? "",
    longitude: venue.longitude?.toString() ?? "",
    accessible_entrance: venue.accessible_entrance ?? "",
    directions: venue.directions ?? "",
    map_url: venue.map_url ?? "",
    photo_url: venue.photo_url ?? "",
    photo_credit: venue.photo_credit ?? "",
  });
  const update = useAdminMutation("PATCH", `/v1/admin/venues/${venue.id}`);
  return (
    <details className="mt-3">
      <summary className="min-h-11 cursor-pointer text-sm font-semibold text-brand">
        Edit venue & discovery location
      </summary>
      <form
        className="grid gap-3 pt-3"
        onSubmit={(e) => {
          e.preventDefault();
          update.mutate({
            ...form,
            latitude: form.latitude === "" ? null : Number(form.latitude),
            longitude: form.longitude === "" ? null : Number(form.longitude),
            map_url: form.map_url || null,
            photo_url: form.photo_url || null,
            photo_credit: form.photo_credit || null,
          });
        }}
      >
        {Object.entries(form).map(([key, value]) => (
          <Field key={key} label={key.replaceAll("_", " ")}>
            <input
              className={inputClass}
              type={
                key === "map_url"
                  ? "url"
                  : ["latitude", "longitude"].includes(key)
                    ? "number"
                    : "text"
              }
              step="any"
              min={
                key === "latitude"
                  ? -90
                  : key === "longitude"
                    ? -180
                    : undefined
              }
              max={
                key === "latitude" ? 90 : key === "longitude" ? 180 : undefined
              }
              required={
                key === "name" ||
                (key === "latitude" && !!form.longitude) ||
                (key === "longitude" && !!form.latitude)
              }
              value={value}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            />
          </Field>
        ))}
        <p className="text-xs text-muted">
          Add both coordinates to include this venue in nearby discovery. The
          photo shows on the event tile and venue guide; credit the
          photographer when the licence asks for it.
        </p>
        <FormError error={update.error} />
        {update.isSuccess && <p role="status">Venue updated.</p>}
        <PrimaryButton pending={update.isPending}>Save venue</PrimaryButton>
      </form>
    </details>
  );
}
