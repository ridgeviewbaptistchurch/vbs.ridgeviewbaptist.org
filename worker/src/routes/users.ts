import { Hono } from 'hono';
import { authMiddleware, requireRole } from '../middleware/auth';
import { hashPassword } from '../lib/auth';
import type { HonoEnv } from '../types';

const users = new Hono<HonoEnv>();

users.use('/*', authMiddleware, requireRole('super_admin'));

users.get('/', async (c) => {
  const rows = await c.env.DB.prepare(
    'SELECT id, name, email, role, created_at, last_login FROM users ORDER BY created_at ASC',
  ).all();
  return c.json({ users: rows.results });
});

users.post('/', async (c) => {
  const { name, email, password, role } = await c.req.json<{
    name: string;
    email: string;
    password: string;
    role: string;
  }>();
  const validRoles = ['super_admin', 'staff_admin', 'kiosk'];
  if (!name || !email || !password || !validRoles.includes(role)) {
    return c.json({ error: 'Invalid user data' }, 400);
  }

  const hash = await hashPassword(password);
  try {
    const result = await c.env.DB.prepare(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
    )
      .bind(name, email, hash, role)
      .run();
    return c.json({ ok: true, id: result.meta.last_row_id });
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes('UNIQUE')) {
      return c.json({ error: 'Email already exists' }, 409);
    }
    throw e;
  }
});

users.put('/:id', async (c) => {
  const { name, role, password } = await c.req.json<{
    name: string;
    role: string;
    password?: string;
  }>();

  if (password) {
    const hash = await hashPassword(password);
    await c.env.DB.prepare('UPDATE users SET name = ?, role = ?, password_hash = ? WHERE id = ?')
      .bind(name, role, hash, c.req.param('id'))
      .run();
  } else {
    await c.env.DB.prepare('UPDATE users SET name = ?, role = ? WHERE id = ?')
      .bind(name, role, c.req.param('id'))
      .run();
  }
  return c.json({ ok: true });
});

users.delete('/:id', async (c) => {
  const id = c.req.param('id');
  if (id === c.get('user').sub) {
    return c.json({ error: 'Cannot delete your own account' }, 400);
  }
  await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
  return c.json({ ok: true });
});

export default users;
