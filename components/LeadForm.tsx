"use client";

import { useEffect, useRef, useState } from "react";
import { BUDGET_OPTIONS, PURPOSE_OPTIONS } from "@/content/site";
import { emit } from "@/lib/bus";
import { captureAttribution, newEventId, type Attribution } from "@/lib/attribution";

type Status = "idle" | "sending" | "sent" | "error";

/**
 * The one form on the page. Field names, option values and the /api/lead
 * payload are the contract with the Zap: do not rename anything here.
 */
export default function LeadForm({
  source = "hero",
  cta = "Get a quote",
}: {
  source?: "hero" | "closing";
  cta?: string;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const attribution = useRef<Attribution>({});

  // Read the ad's URL parameters on landing, before any in-page navigation.
  useEffect(() => {
    attribution.current = captureAttribution();
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "sending") return;

    const fd = new FormData(e.currentTarget);
    setStatus("sending");
    setError(null);
    // Shared by the browser pixel and the server's Conversions API call so Meta
    // counts the registration once.
    const eventId = newEventId();

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
          event_id: eventId,
          ...attribution.current,
          // honeypot — real people leave this empty
          company_website: String(fd.get("company_website") ?? ""),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Something went wrong.");
      }
      setStatus("sent");
      emit("lead:sent", { eventId });
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  if (status === "sent") {
    return (
      <div className="form form--done" role="status">
        <p className="label">Received</p>
        <p className="h2">
          Got it<span className="dot" />
        </p>
        <p className="body">
          We&rsquo;ll call you within one business day. If it&rsquo;s urgent, reply to the
          confirmation email and it jumps the queue.
        </p>
      </div>
    );
  }

  return (
    // Touching any field counts as starting the form (focus covers keyboard and
    // tap; pointerdown catches clicks on labels and the select chevrons).
    <form
      className="form"
      onSubmit={onSubmit}
      onFocus={() => emit("form:start")}
      onPointerDown={() => emit("form:start")}
    >
      <Field label="Name" name="name" autoComplete="name" required enterKeyHint="next" />
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        enterKeyHint="next"
      />
      <Field
        label="Phone number"
        name="phone"
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        required
        enterKeyHint="next"
        hint="With country code. We call, we don't just email."
      />

      <div className="form__row">
        <Select label="Budget" name="budget" options={[...BUDGET_OPTIONS]} required />
        <Select label="It's for" name="purpose" options={[...PURPOSE_OPTIONS]} required />
      </div>

      <div className={`field field--more ${moreOpen ? "is-open" : ""}`}>
        <button
          type="button"
          className="field__toggle"
          aria-expanded={moreOpen}
          aria-controls="lead-comment"
          onClick={() => setMoreOpen((o) => !o)}
        >
          <span className="label">
            Anything else <em className="field__opt">optional</em>
          </span>
          <svg width="12" height="8" viewBox="0 0 12 8" aria-hidden="true">
            <path d="M1 1 6 6l5-5" stroke="currentColor" strokeWidth="1.8" fill="none" />
          </svg>
        </button>
        <textarea
          id="lead-comment"
          name="comment"
          rows={2}
          className="control"
          placeholder="What are you making, and when do you need it?"
          enterKeyHint="done"
          hidden={!moreOpen}
        />
      </div>

      {/* honeypot: visually and semantically hidden from real users */}
      <div aria-hidden="true" className="hp">
        <label htmlFor={`cw-${source}`}>Company website</label>
        <input id={`cw-${source}`} name="company_website" tabIndex={-1} autoComplete="off" />
      </div>

      <button className="btn btn--block btn--lg" type="submit" disabled={status === "sending"}>
        {status === "sending" ? "Sending…" : cta}
      </button>

      {status === "error" && (
        <p className="form__error" role="alert">
          {error} If it keeps failing, email us and we&rsquo;ll pick it up.
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
