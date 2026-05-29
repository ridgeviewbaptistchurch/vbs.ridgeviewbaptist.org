import { Hono } from 'hono';
import { authMiddleware, requireRole } from '../middleware/auth';
import { activeYear } from '../lib/db';
import { sendConfirmationEmail } from '../lib/email';
import type { HonoEnv, Session, VbsSettings } from '../types';

const admin = new Hono<HonoEnv>();

admin.use('/*', authMiddleware, requireRole('staff_admin', 'super_admin'));

admin.get('/stats', async (c) => {
  const yearParam = c.req.query('year');
  const settings = await activeYear(c.env.DB);
  const vbsYear = yearParam ? parseInt(yearParam) : settings?.year;

  const [familyCount, childCount, byGrade, byChurch, nightly] = await Promise.all([
    c.env.DB.prepare('SELECT COUNT(*) as count FROM families WHERE vbs_year = ?')
      .bind(vbsYear)
      .first<{ count: number }>(),
    c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM children ch JOIN families f ON f.id = ch.family_id WHERE f.vbs_year = ?',
    )
      .bind(vbsYear)
      .first<{ count: number }>(),
    c.env.DB.prepare(
      'SELECT ch.grade, COUNT(*) as count FROM children ch JOIN families f ON f.id = ch.family_id WHERE f.vbs_year = ? GROUP BY ch.grade ORDER BY ch.grade',
    )
      .bind(vbsYear)
      .all(),
    c.env.DB.prepare(
      'SELECT f.home_church, COUNT(*) as count FROM families f WHERE f.vbs_year = ? GROUP BY f.home_church ORDER BY count DESC',
    )
      .bind(vbsYear)
      .all(),
    c.env.DB.prepare(
      'SELECT s.label, s.date, COUNT(a.id) as count FROM sessions s LEFT JOIN attendance a ON a.session_id = s.id WHERE s.vbs_year = ? GROUP BY s.id ORDER BY s.date ASC',
    )
      .bind(vbsYear)
      .all(),
  ]);

  return c.json({
    families: familyCount?.count ?? 0,
    children: childCount?.count ?? 0,
    by_grade: byGrade.results,
    by_church: byChurch.results,
    nightly_attendance: nightly.results,
  });
});

admin.post('/resend-confirmations', async (c) => {
  const settings = await c.env.DB.prepare('SELECT * FROM vbs_settings WHERE active = 1 LIMIT 1')
    .first<VbsSettings>();
  if (!settings) return c.json({ error: 'No active VBS year' }, 500);

  const sessions = await c.env.DB.prepare(
    'SELECT * FROM sessions WHERE vbs_year = ? ORDER BY date ASC',
  )
    .bind(settings.year)
    .all<Session>();

  const families = await c.env.DB.prepare(
    "SELECT * FROM families WHERE vbs_year = ? AND email != '' AND email IS NOT NULL",
  )
    .bind(settings.year)
    .all<{ id: number; parent_name: string; email: string }>();

  let sent = 0;
  for (const family of families.results) {
    const children = await c.env.DB.prepare(
      'SELECT first_name, last_name, grade FROM children WHERE family_id = ?',
    )
      .bind(family.id)
      .all<{ first_name: string; last_name: string; grade: string }>();

    c.executionCtx.waitUntil(
      sendConfirmationEmail(c.env, {
        to: family.email,
        parentName: family.parent_name,
        children: children.results,
        settings,
        sessions: sessions.results,
      }),
    );
    sent++;
  }

  return c.json({ ok: true, sent });
});

export default admin;
