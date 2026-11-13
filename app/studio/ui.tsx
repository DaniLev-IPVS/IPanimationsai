"use client";

/// <reference types="react-dom/canary" />

import { useFormStatus } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";

export type NavLabels = { spend: string; projects: string; clients: string; settings: string };

export function NavLinks({ labels }: { labels: NavLabels }) {
  const path = usePathname() || "";
  const items = [
    { href: "/studio", label: labels.spend, on: path === "/studio" },
    { href: "/studio/projects", label: labels.projects, on: path.startsWith("/studio/projects") },
    { href: "/studio/clients", label: labels.clients, on: path.startsWith("/studio/clients") },
    { href: "/studio/settings", label: labels.settings, on: path.startsWith("/studio/settings") },
  ];
  return (
    <nav className="st-nav" aria-label="Studio">
      {items.map((i) => (
        <Link key={i.href} href={i.href} aria-current={i.on ? "page" : undefined}>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}

/**
 * The language buttons. Picking one saves it and re-renders the page in that
 * language; the label says so while the translation is being fetched.
 */
export function LangSwitch({
  current,
  langs,
  label,
  busyLabel,
  action,
}: {
  current: string;
  langs: [code: string, name: string][];
  label: string;
  busyLabel: string;
  action: (lang: string) => Promise<void>;
}) {
  const [pending, start] = useTransition();
  const [picked, setPicked] = useState(current);
  const shown = pending ? picked : current;
  return (
    <div className="st-lang" role="group" aria-label={label}>
      <span className="st-lang-label" aria-live="polite">{pending ? busyLabel : label}</span>
      <div className="st-seg">
        {langs.map(([code, name]) => (
          <button
            key={code}
            type="button"
            lang={code}
            aria-pressed={shown === code}
            disabled={pending}
            onClick={() => {
              if (code === current) return;
              setPicked(code);
              start(() => action(code));
            }}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}

/** A dropdown that saves as soon as it changes. */
export function AutoSelect({
  name,
  defaultValue,
  label,
  children,
}: {
  name: string;
  defaultValue: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      aria-label={label}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
    >
      {children}
    </select>
  );
}

export function SubmitButton({ children, className = "st-btn", pendingLabel }: { children: ReactNode; className?: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button className={className} type="submit" disabled={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}

/** Runs a server action and shows what it returns, once, with a copy button. */
export function RevealAction({
  action,
  label,
  note,
  className = "st-btn",
}: {
  action: () => Promise<string>;
  label: string;
  note?: string;
  className?: string;
}) {
  const [value, setValue] = useState("");
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  if (value) {
    return (
      <div className="st-reveal">
        <input readOnly value={value} aria-label="Copy this" onFocus={(e) => e.currentTarget.select()} />
        <button
          type="button"
          className="st-btn"
          onClick={() => {
            navigator.clipboard.writeText(value).then(() => setCopied(true));
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
        {note ? <p className="st-muted st-small">{note}</p> : null}
      </div>
    );
  }
  return (
    <button
      type="button"
      className={className}
      disabled={pending}
      onClick={() => start(async () => setValue(await action()))}
    >
      {pending ? "Working…" : label}
    </button>
  );
}
