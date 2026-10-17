"use client";
import { useState } from "react";
import type { Venue } from "@/lib/api";
import { useAdminMutation } from "./hooks";
import { Field, FormError, inputClass, PrimaryButton } from "./form";
import { ContentEditor } from "./content-editor";
export function VenueCourts({ venue }: { venue: Venue }) {
  const [label, setLabel] = useState("");
  const create = useAdminMutation(
    "POST",
    `/v1/admin/venues/${venue.id}/courts`,
  );
  return (
    <details className="mt-3">
      <summary className="min-h-11 text-brand font-semibold cursor-pointer">
        Manage courts
      </summary>
      <ul className="space-y-3">
        {venue.courts.map((court) => (
          <li key={court.id}>
            <strong>{court.label}</strong>
            <ContentEditor
              path={`/v1/admin/courts/${court.id}`}
              method="PATCH"
              initial={{
                label: court.base_label ?? court.label,
                area_label: court.area_label ?? null,
              }}
              fields={[
                {
                  name: "label",
                  label: "Court name",
                  required: true,
                  maxLength: 100,
                },
                { name: "area_label", label: "Area", maxLength: 100 },
              ]}
            />
          </li>
        ))}
      </ul>
      <form
        className="grid gap-3 mt-3"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate({ label }, { onSuccess: () => setLabel("") });
        }}
      >
        <Field label="New court">
          <input
            className={inputClass}
            required
            maxLength={100}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </Field>
        <FormError error={create.error} />
        <PrimaryButton pending={create.isPending}>Add court</PrimaryButton>
      </form>
    </details>
  );
}
