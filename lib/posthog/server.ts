import { PostHog } from "posthog-node";

let posthog: PostHog | null = null;

export function getPostHogServerClient() {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;

  if (!key) {
    return null;
  }

  posthog ??= new PostHog(key, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    flushAt: 20,
    flushInterval: 10_000,
  });

  // Server analytics must stay metadata-only. Do not send proposal content,
  // transcripts, call notes, client names, emails, or deal financial details.
  return posthog;
}
