import { Hono } from 'hono';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { HonoEnv } from '../types';

const settings = new Hono<HonoEnv>();

// Public — no auth needed
settings.get('/active', async (c) => {
  const row = await c.env.DB.prepare(
    'SELECT id, year, theme_name, logo_url, accent_color FROM vbs_settings WHERE active = 1 LIMIT 1',
  ).first();
  if (!row) return c.json({ error: 'No active VBS settings' }, 404);
  return c.json(row);
});

settings.put('/', authMiddleware, requireRole('super_admin'), async (c) => {
  const { theme_name, accent_color, logo_url } = await c.req.json<{
    theme_name: string;
    accent_color: string;
    logo_url?: string;
  }>();
  await c.env.DB.prepare(
    'UPDATE vbs_settings SET theme_name = ?, accent_color = ?, logo_url = COALESCE(?, logo_url) WHERE active = 1',
  )
    .bind(theme_name, accent_color, logo_url ?? null)
    .run();
  return c.json({ ok: true });
});

settings.post('/logo', authMiddleware, requireRole('super_admin'), async (c) => {
  if (!c.env.ASSETS) return c.json({ error: 'R2 storage not configured' }, 503);

  const formData = await c.req.formData();
  const file = formData.get('logo') as File | null;
  if (!file) return c.json({ error: 'No file provided' }, 400);

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png';
  const key = `logos/${Date.now()}.${ext}`;

  await c.env.ASSETS.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
  });

  // Served through /api/assets/* route on the Worker
  const url = `/api/assets/${key}`;
  await c.env.DB.prepare('UPDATE vbs_settings SET logo_url = ? WHERE active = 1').bind(url).run();

  return c.json({ ok: true, url });
});

export default settings;
