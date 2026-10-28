"use client";

import { useActionState } from "react";
import { CATEGORIES, pt, type Zone } from "@biska/shared";
import { saveProfile } from "./actions";

export interface ProfileDefaults {
  fullName: string;
  category: string;
  years: number | null;
  dailyRate: number | null;
  bio: string;
  zoneIds: number[];
}

export function ProfileForm({
  defaults,
  zones,
  categoryLocked,
  nameLocked,
  readOnly,
}: {
  defaults: ProfileDefaults;
  zones: Zone[];
  categoryLocked: boolean;
  nameLocked: boolean;
  readOnly: boolean;
}) {
  const [state, action, pending] = useActionState(saveProfile, null);
  const field =
    "w-full rounded-xl border border-line bg-white px-4 py-3 outline-none focus:border-navy disabled:bg-ground disabled:text-muted";

  return (
    <form action={action} className="flex flex-col gap-4">
      <fieldset disabled={readOnly || pending} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {pt.pro.fullName}
          <input
            name="full_name"
            required
            minLength={3}
            maxLength={120}
            autoComplete="name"
            defaultValue={defaults.fullName}
            readOnly={nameLocked}
            className={`${field} font-normal read-only:bg-ground read-only:text-muted`}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {pt.pro.category}
          <select
            name="category"
            required
            defaultValue={defaults.category}
            disabled={categoryLocked}
            className={`${field} font-normal`}
          >
            <option value="" disabled>
              —
            </option>
            {CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
          {categoryLocked && (
            <>
              {/* Um <select> desactivado não é enviado; a BD mantém a categoria de qualquer forma. */}
              <input type="hidden" name="category" value={defaults.category} />
              <span className="text-xs font-normal text-muted">{pt.pro.categoryLocked}</span>
            </>
          )}
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            {pt.pro.years}
            <input
              name="years_experience"
              type="number"
              min={0}
              max={60}
              inputMode="numeric"
              defaultValue={defaults.years ?? ""}
              className={`${field} font-normal`}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            {pt.pro.dailyRate}
            <input
              name="daily_rate_kz"
              type="number"
              min={1}
              step={500}
              inputMode="numeric"
              defaultValue={defaults.dailyRate ?? ""}
              className={`${field} font-normal`}
            />
          </label>
        </div>

        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {pt.pro.bio}
          <textarea
            name="bio"
            rows={4}
            maxLength={1200}
            placeholder={pt.pro.bioPlaceholder}
            defaultValue={defaults.bio}
            className={`${field} font-normal`}
          />
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-semibold">{pt.pro.zones}</legend>
          <div className="flex flex-wrap gap-2">
            {zones.map((z) => (
              <label
                key={z.id}
                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line bg-white px-4 text-sm has-checked:border-navy has-checked:bg-navy has-checked:text-white"
              >
                <input
                  type="checkbox"
                  name="zones"
                  value={z.id}
                  defaultChecked={defaults.zoneIds.includes(z.id)}
                  className="sr-only"
                />
                {z.name}
              </label>
            ))}
          </div>
        </fieldset>
      </fieldset>

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="h-12 rounded-xl bg-navy px-6 font-bold text-white disabled:opacity-60"
          >
            {pt.pro.save}
          </button>
          <p aria-live="polite" className="text-sm">
            {state?.ok && <span className="text-ok-text">{pt.pro.saved}</span>}
            {state?.error && <span className="text-danger">{state.error}</span>}
          </p>
        </div>
      )}
    </form>
  );
}
