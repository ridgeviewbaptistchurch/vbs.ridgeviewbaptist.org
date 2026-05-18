import type { Env, VbsSettings, Session } from '../types';

interface EmailParams {
  to: string;
  parentName: string;
  children: Array<{ first_name: string; last_name: string; grade: string }>;
  settings: VbsSettings;
  sessions: Session[];
}

const gradeLabel = (grade: string): string => {
  const map: Record<string, string> = {
    PK: 'Pre-K',
    K: 'Kindergarten',
    '1': '1st Grade',
    '2': '2nd Grade',
    '3': '3rd Grade',
    '4': '4th Grade',
    '5': '5th Grade',
  };
  return map[grade] ?? grade;
};

const formatDate = (dateStr: string): string =>
  new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

export async function sendConfirmationEmail(env: Env, params: EmailParams): Promise<void> {
  const { to, parentName, children, settings, sessions } = params;

  const childListText = children
    .map((c) => `  • ${c.first_name} ${c.last_name} (${gradeLabel(c.grade)})`)
    .join('\n');

  const sessionListText = sessions
    .map((s) => `  ${s.label}: ${formatDate(s.date)}`)
    .join('\n');

  const subject = `You're registered for ${settings.theme_name}!`;

  const text = [
    `Hi ${parentName},`,
    '',
    `You're registered for ${settings.theme_name}!`,
    '',
    'Children registered:',
    childListText,
    '',
    'VBS Schedule:',
    sessionListText,
    '',
    "We look forward to seeing your family!",
    '',
    'Ridgeview Baptist Church',
    'vbs.ridgeviewbaptist.org',
  ].join('\n');

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:1rem;color:#111827">
  <p>Hi ${parentName},</p>
  <p>You're registered for <strong>${settings.theme_name}</strong>!</p>
  <p><strong>Children registered:</strong></p>
  <ul>
    ${children.map((c) => `<li>${c.first_name} ${c.last_name} (${gradeLabel(c.grade)})</li>`).join('')}
  </ul>
  <p><strong>VBS Schedule:</strong></p>
  <ul>
    ${sessions.map((s) => `<li>${s.label}: ${formatDate(s.date)}</li>`).join('')}
  </ul>
  <p>We look forward to seeing your family!</p>
  <p>Ridgeview Baptist Church<br>
  <a href="https://vbs.ridgeviewbaptist.org">vbs.ridgeviewbaptist.org</a></p>
</body>
</html>`;

  await env.SEND_EMAIL.send({
    from: 'noreply@vbs.ridgeviewbaptist.org',
    to,
    subject,
    text,
    html,
  });
}
