import { Hono } from 'hono';
import { authMiddleware, requireRole } from '../middleware/auth';
import { activeYear } from '../lib/db';
import type { HonoEnv } from '../types';

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

export default admin;
