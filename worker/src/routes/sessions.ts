import { Hono } from 'hono';
import { authMiddleware, requireRole } from '../middleware/auth';
import { activeYear } from '../lib/db';
import type { HonoEnv } from '../types';

const sessions = new Hono<HonoEnv>();

sessions.use('/*', authMiddleware, requireRole('staff_admin', 'super_admin'));

sessions.get('/', async (c) => {
  const yearParam = c.req.query('year');
  const settings = await activeYear(c.env.DB);
  const vbsYear = yearParam ? parseInt(yearParam) : settings?.year;

  const rows = await c.env.DB.prepare(
    'SELECT * FROM sessions WHERE vbs_year = ? ORDER BY date ASC',
  )
    .bind(vbsYear)
    .all();

  return c.json({ sessions: rows.results });
});

sessions.put('/:id', requireRole('super_admin'), async (c) => {
  const { label, date } = await c.req.json<{ label: string; date: string }>();
  await c.env.DB.prepare('UPDATE sessions SET label = ?, date = ? WHERE id = ?')
    .bind(label, date, c.req.param('id'))
    .run();
  return c.json({ ok: true });
});

export default sessions;
