"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";

/** ISO "YYYY-MM-DD" → display "JJ/MM/AAAA" (day first). */
function isoToDisplay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return "";
  const [, y, mo, d] = m;
  return `${d}/${mo}/${y}`;
}

/** Display "JJ/MM/AAAA" → ISO "YYYY-MM-DD", or null when incomplete/invalid. */
function displayToIso(display: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (year < 1900 || year > 2100) return null;
  // Reject impossible dates (e.g. 31/02).
  const probe = new Date(year, month - 1, day);
  if (probe.getDate() !== day || probe.getMonth() !== month - 1) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** Inserts slashes as the user types digits: 12041985 → 12/04/1985. */
function maskDigits(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)];
  return parts.filter(Boolean).join("/");
}

/**
 * Day-first date field (JJ/MM/AAAA) that always renders day before month,
 * independent of the browser locale — unlike a native `<input type="date">`.
 * The committed value is ISO "YYYY-MM-DD" (or "" while incomplete).
 */
export function DateField({
  id,
  value,
  onChange,
  disabled,
}: {
  id?: string;
  value: string;
  onChange: (iso: string) => void;
  disabled?: boolean;
}) {
  const [text, setText] = React.useState(() => isoToDisplay(value));

  // Keep the field in sync when the parent value changes externally.
  React.useEffect(() => {
    setText(isoToDisplay(value));
  }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const masked = maskDigits(e.target.value);
    setText(masked);
    const iso = displayToIso(masked);
    onChange(iso ?? "");
  }

  return (
    <Input
      id={id}
      inputMode="numeric"
      autoComplete="off"
      placeholder="JJ/MM/AAAA"
      value={text}
      onChange={handleChange}
      disabled={disabled}
    />
  );
}
