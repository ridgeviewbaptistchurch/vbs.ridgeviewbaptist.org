import * as Sentry from 'https://esm.sh/@sentry/browser@8';

const SENTRY_DSN = 'https://f297ec96714c427bee06a98ab0a99cbc@o4509799469547520.ingest.us.sentry.io/4511286935093248'; // Fill in your Sentry Browser project DSN

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 1.0,
    replaysOnErrorSampleRate: 1.0,
  });
}

export { Sentry };
