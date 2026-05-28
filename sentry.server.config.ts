import * as Sentry from "@sentry/nextjs";

const sentryDsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
const tracesSampleRate = process.env.NODE_ENV === "development" ? 1.0 : 0.1;
const healthTransactionPattern = /^GET \/api\/health(?:\/.*)?$/;

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
    release: process.env.SENTRY_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA,
    sendDefaultPii: false,
    tracesSampleRate,
    beforeSend(event) {
      if (event.user) {
        event.user = { id: event.user.id };
      }

      if (event.request) {
        delete event.request.cookies;
        delete event.request.data;
        delete event.request.headers;
      }

      return event;
    },
    beforeSendTransaction(event) {
      if (
        event.transaction === "/api/health" ||
        healthTransactionPattern.test(event.transaction || "")
      ) {
        return null;
      }

      return event;
    },
    beforeBreadcrumb(breadcrumb) {
      return breadcrumb.category === "console" ? null : breadcrumb;
    },
  });
}
