import { Hono } from 'hono';
import { sendConfirmationEmail } from '../lib/email';
import type { HonoEnv, VbsSettings, Session } from '../types';

const register = new Hono<HonoEnv>();

const VALID_GRADES = ['4YO', 'PK', 'K', '1', '2', '3', '4', '5', '6', '7'] as const;
const VALID_GENDERS = ['M', 'F'] as const;

register.post('/', async (c) => {
  const body = await c.req.json<{
    parent_name: string;
    phone: string;
    email: string;
    emergency_phone?: string;
    home_church: string | null;
    children: Array<{
      first_name: string;
      last_name: string;
      grade: string;
      gender?: string;
      allergies?: string;
      notes?: string;
    }>;
  }>();

  const { parent_name, phone, email, emergency_phone, home_church, children } = body;

  if (!parent_name?.trim() || !phone?.trim() || !email?.trim() || !children?.length) {
    return c.json({ error: 'Missing required fields' }, 400);
  }

  for (const child of children) {
    if (!child.first_name?.trim() || !child.last_name?.trim() || !(VALID_GRADES as readonly string[]).includes(child.grade)) {
      return c.json({ error: 'Invalid child data' }, 400);
    }
    if (child.gender && !(VALID_GENDERS as readonly string[]).includes(child.gender)) {
      return c.json({ error: 'Invalid gender value' }, 400);
    }
  }

  const settings = await c.env.DB.prepare('SELECT * FROM vbs_settings WHERE active = 1 LIMIT 1')
    .first<VbsSettings>();
  if (!settings) return c.json({ error: 'No active VBS year' }, 500);

  const familyResult = await c.env.DB.prepare(
    'INSERT INTO families (parent_name, phone, email, emergency_phone, home_church, vbs_year) VALUES (?, ?, ?, ?, ?, ?)',
  )
    .bind(parent_name, phone, email, emergency_phone ?? null, home_church ?? null, settings.year)
    .run();

  const familyId = familyResult.meta.last_row_id;

  await c.env.DB.batch(
    children.map((child) =>
      c.env.DB.prepare(
        'INSERT INTO children (family_id, first_name, last_name, grade, gender, allergies, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ).bind(familyId, child.first_name, child.last_name, child.grade, child.gender ?? null, child.allergies ?? null, child.notes ?? null),
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
