"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Provider } from "@supabase/supabase-js";
import { formatAngolanPhone, normalizeAngolanPhone, pt } from "@biska/shared";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const socialButtons: { provider: Provider; label: string; className: string }[] = [
  { provider: "google", label: pt.auth.google, className: "bg-white text-navy" },
  { provider: "apple", label: pt.auth.apple, className: "bg-black text-white border border-navy-border" },
  { provider: "facebook", label: pt.auth.facebook, className: "bg-[#1877F2] text-white" },
];

type Step = "choose" | "phone" | "code";

export function LoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("choose");
  const [phoneInput, setPhoneInput] = useState("");
  const [phone, setPhone] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!isSupabaseConfigured) {
    return (
      <p role="alert" className="rounded-xl bg-amber-soft p-4 text-sm text-amber-text">
        O Supabase ainda não está configurado. Copia <code>.env.example</code> para{" "}
        <code>.env.local</code> e preenche as chaves.
      </p>
    );
  }

  async function signInWith(provider: Provider) {
    setError(null);
    setBusy(true);
    const next = new URLSearchParams(window.location.search).get("next") ?? "/";
    const { error } = await createClient().auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setError(pt.auth.error);
      setBusy(false);
    }
  }

  async function sendCode(event: React.FormEvent) {
    event.preventDefault();
    const normalized = normalizeAngolanPhone(phoneInput);
    if (!normalized) {
      setError(pt.auth.phoneInvalid);
      return;
    }
    setError(null);
    setBusy(true);
    const { error } = await createClient().auth.signInWithOtp({ phone: normalized });
    setBusy(false);
    if (error) {
      setError(pt.auth.error);
      return;
    }
    setPhone(normalized);
    setStep("code");
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    if (!phone) return;
    setError(null);
    setBusy(true);
    const { error } = await createClient().auth.verifyOtp({ phone, token: code.trim(), type: "sms" });
    setBusy(false);
    if (error) {
      setError(pt.auth.error);
      return;
    }
    router.push("/");
    router.refresh();
  }

  const primary = "flex h-13 w-full items-center justify-center rounded-2xl font-bold disabled:opacity-60";
  const input =
    "h-12 w-full rounded-xl border border-navy-border bg-navy-2 px-4 text-white outline-none placeholder:text-on-navy-muted focus:border-amber";

  return (
    <div className="flex flex-col gap-3">
      {step === "choose" && (
        <>
          {socialButtons.map((b) => (
            <button
              key={b.provider}
              type="button"
              disabled={busy}
              onClick={() => signInWith(b.provider)}
              className={`${primary} ${b.className}`}
            >
              {b.label}
            </button>
          ))}
          <button
            type="button"
            disabled={busy}
            onClick={() => setStep("phone")}
            className={`${primary} border-[1.5px] border-[#4C6A93] text-white`}
          >
            {pt.auth.phone}
          </button>
        </>
      )}

      {step === "phone" && (
        <form onSubmit={sendCode} className="flex flex-col gap-3">
          <label htmlFor="phone" className="text-sm font-semibold">
            {pt.auth.phoneLabel}
          </label>
          <div className="flex items-center gap-2">
            <span className="text-on-navy-muted">+244</span>
            <input
              id="phone"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder={pt.auth.phonePlaceholder}
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              className={input}
            />
          </div>
          <button type="submit" disabled={busy} className={`${primary} bg-amber text-navy`}>
            {pt.auth.sendCode}
          </button>
          <button type="button" onClick={() => setStep("choose")} className="h-11 text-sm text-on-navy-muted underline">
            {pt.auth.back}
          </button>
        </form>
      )}

      {step === "code" && phone && (
        <form onSubmit={verifyCode} className="flex flex-col gap-3">
          <p className="text-sm text-on-navy-muted">
            {pt.auth.codeSent} <strong className="text-white">{formatAngolanPhone(phone)}</strong>.
          </p>
          <label htmlFor="code" className="text-sm font-semibold">
            {pt.auth.codeLabel}
          </label>
          <input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={`${input} tracking-[0.4em]`}
          />
          <button type="submit" disabled={busy || code.trim().length < 6} className={`${primary} bg-amber text-navy`}>
            {pt.auth.verify}
          </button>
          <button type="button" onClick={() => setStep("phone")} className="h-11 text-sm text-on-navy-muted underline">
            {pt.auth.back}
          </button>
        </form>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-[#FDECEA] p-3 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
