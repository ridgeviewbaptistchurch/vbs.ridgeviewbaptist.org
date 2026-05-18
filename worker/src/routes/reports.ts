import { Hono } from 'hono';
import { authMiddleware, requireRole } from '../middleware/auth';
import { activeYear } from '../lib/db';
import type { HonoEnv } from '../types';

const reports = new Hono<HonoEnv>();

reports.use('/*', authMiddleware, requireRole('staff_admin', 'super_admin'));

reports.get('/grades', async (c) => {
  const grade = c.req.query('grade');
  const yearParam = c.req.query('year');
  const settings = await activeYear(c.env.DB);
  const vbsYear = yearParam ? parseInt(yearParam) : settings?.year;

  const rows = grade
    ? await c.env.DB.prepare(
        `SELECT ch.first_name, ch.last_name, ch.grade, ch.allergies, ch.notes, f.parent_name, f.phone, f.church_interest
         FROM children ch JOIN families f ON f.id = ch.family_id
         WHERE f.vbs_year = ? AND ch.grade = ?
         ORDER BY ch.last_name, ch.first_name`,
      )
        .bind(vbsYear, grade)
        .all()
    : await c.env.DB.prepare(
        `SELECT ch.first_name, ch.last_name, ch.grade, ch.allergies, ch.notes, f.parent_name, f.phone, f.church_interest
         FROM children ch JOIN families f ON f.id = ch.family_id
         WHERE f.vbs_year = ?
         ORDER BY ch.grade, ch.last_name, ch.first_name`,
      )
        .bind(vbsYear)
        .all();

  return c.json({ children: rows.results });
});

reports.get('/attendance', async (c) => {
  const sessionId = c.req.query('session_id');
  if (!sessionId) return c.json({ error: 'session_id required' }, 400);

  const rows = await c.env.DB.prepare(
    `SELECT ch.first_name, ch.last_name, ch.grade, ch.allergies, f.parent_name, f.phone, a.checked_in_at
     FROM children ch
     JOIN families f ON f.id = ch.family_id
     LEFT JOIN attendance a ON a.child_id = ch.id AND a.session_id = ?
     WHERE f.vbs_year = (SELECT year FROM vbs_settings WHERE active = 1)
     ORDER BY ch.last_name, ch.first_name`,
  )
    .bind(sessionId)
    .all();

  return c.json({ children: rows.results });
});

reports.get('/export/families', async (c) => {
  const yearParam = c.req.query('year');
  const settings = await activeYear(c.env.DB);
  const vbsYear = yearParam ? parseInt(yearParam) : settings?.year;

  const rows = await c.env.DB.prepare(
    `SELECT f.parent_name, f.phone, f.email, f.home_church, f.church_interest, f.registered_at,
            ch.first_name, ch.last_name, ch.grade, ch.allergies, ch.notes
     FROM families f JOIN children ch ON ch.family_id = f.id
     WHERE f.vbs_year = ?
     ORDER BY f.parent_name, ch.last_name`,
  )
    .bind(vbsYear)
    .all<Record<string, string>>();

  const headers = ['Parent Name', 'Phone', 'Email', 'Home Church', 'Church Interest', 'Registered At', 'Child First Name', 'Child Last Name', 'Grade', 'Allergies', 'Notes'];
  const lines = [headers.join(',')];
  for (const r of rows.results) {
    lines.push(
      [r.parent_name, r.phone, r.email, r.home_church ?? '', r.church_interest === '1' || r.church_interest === 1 ? 'Yes' : 'No', r.registered_at, r.first_name, r.last_name, r.grade, r.allergies ?? '', r.notes ?? '']
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    );
  }

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="families-${vbsYear}.csv"`,
    },
  });
});

reports.get('/export/attendance', async (c) => {
  const yearParam = c.req.query('year');
  const settings = await activeYear(c.env.DB);
  const vbsYear = yearParam ? parseInt(yearParam) : settings?.year;

  const rows = await c.env.DB.prepare(
    `SELECT ch.first_name, ch.last_name, ch.grade, s.label, s.date, a.checked_in_at
     FROM attendance a
     JOIN children ch ON ch.id = a.child_id
     JOIN sessions s ON s.id = a.session_id
     JOIN families f ON f.id = ch.family_id
     WHERE f.vbs_year = ?
     ORDER BY s.date, ch.last_name`,
  )
    .bind(vbsYear)
    .all<Record<string, string>>();

  const headers = ['First Name', 'Last Name', 'Grade', 'Session', 'Date', 'Checked In At'];
  const lines = [headers.join(',')];
  for (const r of rows.results) {
    lines.push(
      [r.first_name, r.last_name, r.grade, r.label, r.date, r.checked_in_at]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    );
  }

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="attendance-${vbsYear}.csv"`,
    },
  });
});

export default reports;
