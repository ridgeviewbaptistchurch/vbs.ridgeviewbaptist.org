import { Hono } from 'hono';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { HonoEnv } from '../types';

const children = new Hono<HonoEnv>();

children.use('/*', authMiddleware, requireRole('staff_admin', 'super_admin'));

children.get('/:id', async (c) => {
  const child = await c.env.DB.prepare('SELECT * FROM children WHERE id = ?')
    .bind(c.req.param('id'))
    .first();
  if (!child) return c.json({ error: 'Not found' }, 404);
  return c.json(child);
});

children.put('/:id', async (c) => {
  const { first_name, last_name, grade, notes } = await c.req.json<{
    first_name: string;
    last_name: string;
    grade: string;
    notes?: string;
  }>();
  await c.env.DB.prepare(
    'UPDATE children SET first_name = ?, last_name = ?, grade = ?, notes = ? WHERE id = ?',
  )
    .bind(first_name, last_name, grade, notes ?? null, c.req.param('id'))
    .run();
  return c.json({ ok: true });
});

children.delete('/:id', requireRole('super_admin'), async (c) => {
  await c.env.DB.prepare('DELETE FROM children WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ ok: true });
});

export default children;
