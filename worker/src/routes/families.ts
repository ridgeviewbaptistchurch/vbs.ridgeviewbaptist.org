import { Hono } from 'hono';
import { authMiddleware, requireRole } from '../middleware/auth';
import { activeYear } from '../lib/db';
import type { HonoEnv } from '../types';

const families = new Hono<HonoEnv>();

families.use('/*', authMiddleware, requireRole('staff_admin', 'super_admin'));

families.get('/', async (c) => {
  const q = (c.req.query('q') ?? '').trim();
  const yearParam = c.req.query('year');
  const settings = await activeYear(c.env.DB);
  const vbsYear = yearParam ? parseInt(yearParam) : settings?.year;

  const sql = q
    ? `SELECT f.*, COUNT(ch.id) as child_count FROM families f
       LEFT JOIN children ch ON ch.family_id = f.id
       WHERE f.vbs_year = ? AND (f.parent_name LIKE ? OR f.email LIKE ? OR f.phone LIKE ?)
       GROUP BY f.id ORDER BY f.registered_at DESC LIMIT 500`
    : `SELECT f.*, COUNT(ch.id) as child_count FROM families f
       LEFT JOIN children ch ON ch.family_id = f.id
       WHERE f.vbs_year = ?
       GROUP BY f.id ORDER BY f.registered_at DESC LIMIT 500`;

  const rows = q
    ? await c.env.DB.prepare(sql).bind(vbsYear, `%${q}%`, `%${q}%`, `%${q}%`).all()
    : await c.env.DB.prepare(sql).bind(vbsYear).all();

  return c.json({ families: rows.results });
});

families.get('/:id', async (c) => {
  const id = c.req.param('id');
  const family = await c.env.DB.prepare('SELECT * FROM families WHERE id = ?').bind(id).first();
  if (!family) return c.json({ error: 'Not found' }, 404);

  const children = await c.env.DB.prepare(
    'SELECT * FROM children WHERE family_id = ? ORDER BY last_name, first_name',
  )
    .bind(id)
    .all();

  return c.json({ family, children: children.results });
});

families.put('/:id', async (c) => {
  const { parent_name, phone, email, home_church } = await c.req.json<{
    parent_name: string;
    phone: string;
    email: string;
    home_church: string;
  }>();
  await c.env.DB.prepare(
    'UPDATE families SET parent_name = ?, phone = ?, email = ?, home_church = ? WHERE id = ?',
  )
    .bind(parent_name, phone, email, home_church, c.req.param('id'))
    .run();
  return c.json({ ok: true });
});

families.delete('/:id', requireRole('super_admin'), async (c) => {
  await c.env.DB.prepare('DELETE FROM families WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ ok: true });
});

export default families;
