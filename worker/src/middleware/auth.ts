import type { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { verifyJwt } from '../lib/auth';
import type { HonoEnv, Role } from '../types';

export async function authMiddleware(c: Context<HonoEnv>, next: Next) {
  const token = getCookie(c, 'auth_token');
  if (!token) return c.json({ error: 'Unauthorized' }, 401);

  const payload = await verifyJwt(token, c.env.JWT_SECRET);
  if (!payload) return c.json({ error: 'Invalid or expired token' }, 401);

  c.set('user', payload);
  await next();
}

export function requireRole(...roles: Role[]) {
  return async (c: Context<HonoEnv>, next: Next) => {
    const user = c.get('user');
    if (!user || !roles.includes(user.role)) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    await next();
  };
}
