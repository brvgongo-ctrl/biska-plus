"use client";

import { useActionState } from "react";
import { pt } from "@biska/shared";
import { submitKyc } from "./actions";

export function SubmitForm({ missing, consented }: { missing: string[]; consented: boolean }) {
  const [state, action, pending] = useActionState(submitKyc, null);
  const blocked = missing.length > 0;

  return (
    <form action={action} className="flex flex-col gap-4">
      {blocked && (
        <p className="rounded-xl bg-amber-soft p-3 text-sm text-amber-text">
          {pt.pro.missing}: {missing.join(", ")}.
        </p>
      )}
      <label className="flex items-start gap-3 text-sm leading-relaxed">
        <input
          type="checkbox"
          name="consent"
          required={!consented}
          defaultChecked={consented}
          disabled={consented}
          className="mt-1 size-5 shrink-0 accent-navy"
        />
        {pt.pro.consent}
      </label>
      <button
        type="submit"
        disabled={pending || blocked}
        className="h-13 rounded-2xl bg-amber px-6 font-bold text-navy disabled:opacity-60"
      >
        {pt.pro.submit}
      </button>
      {state?.error && (
        <p role="alert" className="rounded-xl bg-[#FDECEA] p-3 text-sm text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
