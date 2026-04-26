import { Hono } from 'hono';
import { sendConfirmationEmail } from '../lib/email';
import type { HonoEnv, VbsSettings, Session } from '../types';

const register = new Hono<HonoEnv>();

const VALID_GRADES = ['PK', 'K', '1', '2', '3', '4', '5'] as const;

register.post('/', async (c) => {
  const body = await c.req.json<{
    parent_name: string;
    phone: string;
    email: string;
    home_church: string;
    children: Array<{ first_name: string; last_name: string; grade: string; notes?: string }>;
  }>();

  const { parent_name, phone, email, home_church, children } = body;

  if (!parent_name?.trim() || !phone?.trim() || !email?.trim() || !home_church?.trim() || !children?.length) {
    return c.json({ error: 'Missing required fields' }, 400);
  }

  for (const child of children) {
    if (!child.first_name?.trim() || !child.last_name?.trim() || !(VALID_GRADES as readonly string[]).includes(child.grade)) {
      return c.json({ error: 'Invalid child data' }, 400);
    }
  }

  const settings = await c.env.DB.prepare('SELECT * FROM vbs_settings WHERE active = 1 LIMIT 1')
    .first<VbsSettings>();
  if (!settings) return c.json({ error: 'No active VBS year' }, 500);

  const familyResult = await c.env.DB.prepare(
    'INSERT INTO families (parent_name, phone, email, home_church, vbs_year) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(parent_name, phone, email, home_church, settings.year)
    .run();

  const familyId = familyResult.meta.last_row_id;

  await c.env.DB.batch(
    children.map((child) =>
      c.env.DB.prepare(
        'INSERT INTO children (family_id, first_name, last_name, grade, notes) VALUES (?, ?, ?, ?, ?)',
      ).bind(familyId, child.first_name, child.last_name, child.grade, child.notes ?? null),
    ),
  );

  const sessions = await c.env.DB.prepare(
    'SELECT * FROM sessions WHERE vbs_year = ? ORDER BY date ASC',
  )
    .bind(settings.year)
    .all<Session>();

  c.executionCtx.waitUntil(
    sendConfirmationEmail(c.env, {
      to: email,
      parentName: parent_name,
      children,
      settings,
      sessions: sessions.results,
    }),
  );

  return c.json({ ok: true, family_id: familyId });
});

export default register;
