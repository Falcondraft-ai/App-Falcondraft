"use client";

import posthog from "posthog-js";

let initialized = false;

export function initPostHog() {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;

  if (!key || initialized) {
    return initialized ? posthog : null;
  }

  posthog.init(key, {
    api_host:
      process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    capture_pageview: false,
    person_profiles: "identified_only",
  });

  initialized = true;

  // Never capture call notes, transcripts, proposal content, pricing details,
  // or client-sensitive commercial data in analytics events.
  return posthog;
}
