import { Hono } from 'hono';
import { authMiddleware, requireRole } from '../middleware/auth';
import { activeYear } from '../lib/db';
import type { HonoEnv } from '../types';

const checkin = new Hono<HonoEnv>();

checkin.use('/*', authMiddleware);

checkin.get('/search', async (c) => {
  const q = (c.req.query('q') ?? '').trim();
  const yearParam = c.req.query('year');

  const settings = await activeYear(c.env.DB);
  const vbsYear = yearParam ? parseInt(yearParam) : settings?.year;

  if (!q || !vbsYear) return c.json({ families: [], session_id: null });

  const families = await c.env.DB.prepare(
    `SELECT f.*, COUNT(ch.id) as child_count
     FROM families f
     LEFT JOIN children ch ON ch.family_id = f.id
     WHERE f.vbs_year = ? AND (f.parent_name LIKE ? OR f.phone LIKE ?)
     GROUP BY f.id
     ORDER BY f.parent_name
     LIMIT 20`,
  )
    .bind(vbsYear, `%${q}%`, `%${q}%`)
    .all<Record<string, unknown>>();

  const familyIds = families.results.map((f) => f.id as number);

  const children =
    familyIds.length > 0
      ? await c.env.DB.prepare(
          `SELECT * FROM children WHERE family_id IN (${familyIds.map(() => '?').join(',')}) ORDER BY last_name, first_name`,
        )
          .bind(...familyIds)
          .all<Record<string, unknown>>()
      : { results: [] as Record<string, unknown>[] };

  const today = new Date().toISOString().split('T')[0];
  const todaySession = await c.env.DB.prepare(
    'SELECT id FROM sessions WHERE vbs_year = ? AND date = ? LIMIT 1',
  )
    .bind(vbsYear, today)
    .first<{ id: number }>();

  const sessionId =
    todaySession?.id ??
    (
      await c.env.DB.prepare(
        'SELECT id FROM sessions WHERE vbs_year = ? ORDER BY date DESC LIMIT 1',
      )
        .bind(vbsYear)
        .first<{ id: number }>()
    )?.id ??
    null;

  const childIds = children.results.map((ch) => ch.id as number);
  const attendance =
    childIds.length > 0 && sessionId
      ? await c.env.DB.prepare(
          `SELECT child_id, checked_in_at, id as attendance_id FROM attendance WHERE session_id = ? AND child_id IN (${childIds.map(() => '?').join(',')})`,
        )
          .bind(sessionId, ...childIds)
          .all<{ child_id: number; checked_in_at: string; attendance_id: number }>()
      : { results: [] as { child_id: number; checked_in_at: string; attendance_id: number }[] };

  const checkedInMap = new Map(
    attendance.results.map((a) => [a.child_id, { checked_in_at: a.checked_in_at, attendance_id: a.attendance_id }]),
  );

  const childrenByFamily = new Map<number, unknown[]>();
  for (const child of children.results) {
    const familyId = child.family_id as number;
    const ci = checkedInMap.get(child.id as number);
    const enriched = { ...child, checked_in_at: ci?.checked_in_at ?? null, attendance_id: ci?.attendance_id ?? null };
    if (!childrenByFamily.has(familyId)) childrenByFamily.set(familyId, []);
    childrenByFamily.get(familyId)!.push(enriched);
  }

  const result = families.results.map((f) => ({
    ...f,
    children: childrenByFamily.get(f.id as number) ?? [],
  }));

  return c.json({ families: result, session_id: sessionId });
});

checkin.post('/', async (c) => {
  const { child_id, session_id } = await c.req.json<{ child_id: number; session_id: number }>();
  if (!child_id || !session_id) return c.json({ error: 'child_id and session_id required' }, 400);

  try {
    const result = await c.env.DB.prepare(
      'INSERT INTO attendance (child_id, session_id) VALUES (?, ?)',
    )
      .bind(child_id, session_id)
      .run();
    return c.json({ ok: true, attendance_id: result.meta.last_row_id });
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes('UNIQUE')) {
      return c.json({ error: 'Already checked in' }, 409);
    }
    throw e;
  }
});

checkin.delete('/:id', requireRole('super_admin'), async (c) => {
  await c.env.DB.prepare('DELETE FROM attendance WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ ok: true });
});

export default checkin;
