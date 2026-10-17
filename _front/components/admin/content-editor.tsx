"use client";
import { useState } from "react";
import { useAdminMutation } from "./hooks";
import { Field, FormError, inputClass, PrimaryButton } from "./form";
type Value = string | number | boolean | null;
type EditorField = {
  name: string;
  label: string;
  options?: string[];
  multiline?: boolean;
  type?: "url" | "number" | "datetime-local";
  required?: boolean;
  minLength?: number;
  maxLength?: number;
};
export function ContentEditor({
  path,
  method = "PUT",
  initial,
  fields,
}: {
  path: string;
  method?: "PUT" | "PATCH";
  initial: Record<string, Value>;
  fields: EditorField[];
}) {
  const [values, setValues] = useState(initial);
  const save = useAdminMutation(method, path);
  return (
    <details className="mt-3">
      <summary className="min-h-11 text-brand font-semibold cursor-pointer">
        Edit details
      </summary>
      <form
        className="grid gap-3 mt-3"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(values);
        }}
      >
        {fields.map((f) => (
          <Field key={f.name} label={f.label}>
            {typeof values[f.name] === "boolean" ? (
              <input
                type="checkbox"
                checked={Boolean(values[f.name])}
                onChange={(e) =>
                  setValues({ ...values, [f.name]: e.target.checked })
                }
              />
            ) : f.options ? (
              <select
                className={inputClass}
                value={String(values[f.name] ?? "")}
                onChange={(e) =>
                  setValues({ ...values, [f.name]: e.target.value })
                }
              >
                {f.options.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            ) : f.multiline ? (
              <textarea
                className={inputClass}
                required={f.required}
                minLength={f.minLength}
                maxLength={f.maxLength}
                value={String(values[f.name] ?? "")}
                rows={4}
                onChange={(e) =>
                  setValues({ ...values, [f.name]: e.target.value })
                }
              />
            ) : (
              <input
                className={inputClass}
                type={f.type ?? "text"}
                required={f.required}
                minLength={f.minLength}
                maxLength={f.maxLength}
                value={String(values[f.name] ?? "")}
                onChange={(e) =>
                  setValues({
                    ...values,
                    [f.name]:
                      f.type === "number"
                        ? Number(e.target.value)
                        : e.target.value ||
                          (initial[f.name] === null ? null : ""),
                  })
                }
              />
            )}
          </Field>
        ))}
        <FormError error={save.error} />
        {save.isSuccess && <p role="status">Saved.</p>}
        <PrimaryButton pending={save.isPending}>Save changes</PrimaryButton>
      </form>
    </details>
  );
}
