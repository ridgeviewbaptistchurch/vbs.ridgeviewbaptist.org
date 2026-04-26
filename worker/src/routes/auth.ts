import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { verifyPassword, signJwt, verifyJwt } from '../lib/auth';
import type { HonoEnv, User } from '../types';

const auth = new Hono<HonoEnv>();

auth.post('/login', async (c) => {
  const { email, password } = await c.req.json<{ email: string; password: string }>();
  if (!email || !password) return c.json({ error: 'Email and password required' }, 400);

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?')
    .bind(email)
    .first<User>();

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const isKiosk = user.role === 'kiosk';
  const token = await signJwt(
    { sub: String(user.id), email: user.email, role: user.role, name: user.name },
    c.env.JWT_SECRET,
    isKiosk ? '30d' : '8h',
  );

  await c.env.DB.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?")
    .bind(user.id)
    .run();

  setCookie(c, 'auth_token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    maxAge: isKiosk ? 60 * 60 * 24 * 30 : 60 * 60 * 8,
    path: '/',
  });

  return c.json({ role: user.role, name: user.name });
});

auth.post('/logout', (c) => {
  deleteCookie(c, 'auth_token', { path: '/' });
  return c.json({ ok: true });
});

auth.get('/me', async (c) => {
  const token = getCookie(c, 'auth_token');
  if (!token) return c.json({ error: 'Unauthorized' }, 401);
  const payload = await verifyJwt(token, c.env.JWT_SECRET);
  if (!payload) return c.json({ error: 'Unauthorized' }, 401);
  return c.json(payload);
});

export default auth;
