import { Hono } from 'hono';
import { cors } from 'hono/cors';
import * as Sentry from '@sentry/cloudflare';
import authRoutes from './routes/auth';
import registerRoutes from './routes/register';
import checkinRoutes from './routes/checkin';
import familiesRoutes from './routes/families';
import childrenRoutes from './routes/children';
import reportsRoutes from './routes/reports';
import sessionsRoutes from './routes/sessions';
import settingsRoutes from './routes/settings';
import usersRoutes from './routes/users';
import adminRoutes from './routes/admin';
import type { HonoEnv } from './types';

const app = new Hono<HonoEnv>();

app.use(
  '*',
  cors({
    origin: (origin, c) => {
      const env = c.env;
      if (env.ENVIRONMENT !== 'production' && origin.startsWith('http://localhost')) {
        return origin;
      }
      return origin === 'https://vbs.ridgeviewbaptist.org' ? origin : '';
    },
    credentials: true,
  }),
);

// Serve R2 assets (logos uploaded through settings)
app.get('/api/assets/*', async (c) => {
  if (!c.env.ASSETS) return c.notFound();
  const key = c.req.path.replace('/api/assets/', '');
  const obj = await c.env.ASSETS.get(key);
  if (!obj) return c.notFound();
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  return new Response(obj.body, { headers });
});

app.get('/api/health', (c) => c.json({ ok: true }));

app.get('/api/stats/registrations', async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT COUNT(*) AS total FROM families WHERE vbs_year = (SELECT year FROM vbs_settings WHERE active = 1 LIMIT 1)`,
  ).first<{ total: number }>();
  return c.json({ total: row?.total ?? 0 });
});

app.route('/api/auth', authRoutes);
app.route('/api/settings', settingsRoutes);
app.route('/api/register', registerRoutes);
app.route('/api/families', familiesRoutes);
app.route('/api/children', childrenRoutes);
app.route('/api/checkin', checkinRoutes);
app.route('/api/sessions', sessionsRoutes);
app.route('/api/reports', reportsRoutes);
app.route('/api/admin', adminRoutes);
app.route('/api/users', usersRoutes);

app.onError((err, c) => {
  Sentry.captureException(err);
  return c.json({ error: 'Internal server error' }, 500);
});

export default Sentry.withSentry(
  (env) => ({
    dsn: env.SENTRY_DSN,
    tracesSampleRate: 1.0,
    environment: env.ENVIRONMENT,
  }),
  { fetch: (req, env, ctx) => app.fetch(req, env, ctx) },
);
