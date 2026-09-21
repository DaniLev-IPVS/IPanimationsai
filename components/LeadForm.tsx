"use client";

import { useState } from "react";
import { BUDGET_OPTIONS, PURPOSE_OPTIONS } from "@/content/site";

type Status = "idle" | "sending" | "sent" | "error";

export default function LeadForm({
  source,
  cta = "Send it",
}: {
  source: "hero" | "closing";
  cta?: string;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "sending") return;

    const fd = new FormData(e.currentTarget);
    setStatus("sending");
    setError(null);

    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(fd.get("name") ?? "").trim(),
          email: String(fd.get("email") ?? "").trim(),
          phone: String(fd.get("phone") ?? "").trim(),
          budget: String(fd.get("budget") ?? ""),
          purpose: String(fd.get("purpose") ?? ""),
          comment: String(fd.get("comment") ?? "").trim(),
          source_section: source,
          // honeypot — real people leave this empty
          company_website: String(fd.get("company_website") ?? ""),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Something went wrong.");
      }
      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  if (status === "sent") {
    return (
      <div className="form form--done" role="status">
        <p className="label">RECEIVED</p>
        <p className="display-sm" style={{ marginTop: "0.6rem" }}>
          Got it.
        </p>
        <p className="lede" style={{ marginTop: "0.9rem" }}>
          We&rsquo;ll call you within one business day. If it&rsquo;s urgent, the
          fastest route is just to reply to the confirmation email.
        </p>
      </div>
    );
  }

  return (
    <form className="form" onSubmit={onSubmit} noValidate={false}>
      <Field label="Name" name="name" autoComplete="name" required />
      <Field label="Email" name="email" type="email" autoComplete="email" required />
      <Field
        label="Phone number"
        name="phone"
        type="tel"
        autoComplete="tel"
        required
        hint="Include your country code — we call, we don't just email."
      />

      <Select label="Budget range" name="budget" options={[...BUDGET_OPTIONS]} required />
      <Select
        label="Animation needed for"
        name="purpose"
        options={[...PURPOSE_OPTIONS]}
        required
      />

      <label className="field">
        <span className="label">
          Anything else <em className="field__opt">optional</em>
        </span>
        <textarea
          name="comment"
          rows={3}
          className="control"
          placeholder="What are you making, and when do you need it?"
        />
      </label>

      {/* honeypot: visually and semantically hidden from real users */}
      <div aria-hidden="true" className="hp">
        <label htmlFor={`cw-${source}`}>Company website</label>
        <input id={`cw-${source}`} name="company_website" tabIndex={-1} autoComplete="off" />
      </div>

      <button className="btn" type="submit" disabled={status === "sending"}>
        {status === "sending" ? "Sending…" : cta}
      </button>

      {status === "error" && (
        <p className="form__error" role="alert">
          {error} — or email us directly and we&rsquo;ll pick it up.
        </p>
      )}
    </form>
  );
}

function Field({
  label,
  name,
  hint,
  ...rest
}: {
  label: string;
  name: string;
  hint?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      <input name={name} className="control" {...rest} />
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  );
}

function Select({
  label,
  name,
  options,
  required,
}: {
  label: string;
  name: string;
  options: string[];
  required?: boolean;
}) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      <div className="control control--select">
        <select name={name} required={required} defaultValue="">
          <option value="" disabled>
            Choose one
          </option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <svg width="12" height="8" viewBox="0 0 12 8" aria-hidden="true">
          <path d="M1 1 6 6l5-5" stroke="currentColor" strokeWidth="1.8" fill="none" />
        </svg>
      </div>
    </label>
  );
}
