// Thin helpers around D1. Most queries are written inline with c.env.DB
// for clarity. Add shared helpers here only when they'd be called from
// multiple routes.

export function activeYear(db: D1Database): Promise<{ year: number } | null> {
  return db
    .prepare('SELECT year FROM vbs_settings WHERE active = 1 LIMIT 1')
    .first<{ year: number }>();
}
