import * as Sentry from "@sentry/nextjs";

const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const tracesSampleRate = process.env.NODE_ENV === "development" ? 1.0 : 0.1;
const healthTransactionPattern = /^(?:GET )?\/api\/health(?:\/.*)?$/;

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
    sendDefaultPii: false,
    tracesSampleRate,
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        maskAllInputs: true,
        blockAllMedia: true,
        networkDetailAllowUrls: [],
        networkCaptureBodies: false,
        networkRequestHeaders: [],
        networkResponseHeaders: [],
      }),
    ],
    replaysSessionSampleRate: process.env.NODE_ENV === "development" ? 0 : 0.1,
    replaysOnErrorSampleRate: 1.0,
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
      return healthTransactionPattern.test(event.transaction || "")
        ? null
        : event;
    },
    beforeBreadcrumb(breadcrumb) {
      return breadcrumb.category === "console" ? null : breadcrumb;
    },
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
