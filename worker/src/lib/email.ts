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

  const childRows = children
    .map(
      (c, i) =>
        `<tr style="${i > 0 ? 'border-top:1px solid #e5e7eb;' : ''}">` +
        `<td style="padding:10px 16px;color:#111827;font-size:15px;">${c.first_name} ${c.last_name}</td>` +
        `<td style="padding:10px 16px;color:#6b7280;font-size:13px;text-align:right;white-space:nowrap;">${gradeLabel(c.grade)}</td>` +
        `</tr>`,
    )
    .join('');

  const sessionRows = sessions
    .map(
      (s, i) =>
        `<tr style="${i > 0 ? 'border-top:1px solid #e5e7eb;' : ''}">` +
        `<td style="padding:9px 16px;color:#6b7280;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;white-space:nowrap;width:90px;">${s.label}</td>` +
        `<td style="padding:9px 16px;color:#111827;font-size:14px;">${formatDate(s.date)}</td>` +
        `</tr>`,
    )
    .join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:system-ui,-apple-system,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 16px 48px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

  <tr><td style="background:linear-gradient(160deg,#eef2ff 0%,#e0f2fe 100%);border-radius:12px 12px 0 0;padding:40px 32px 32px;text-align:center;border:1px solid #e5e7eb;border-bottom:none;">
    <img src="https://vbs.ridgeviewbaptist.org/01_IlluminationStation_FullColor.png" alt="Illumination Station VBS" width="260" style="max-width:74%;height:auto;display:block;margin:0 auto 14px;">
    <p style="margin:0;font-size:13px;color:#6b7280;font-weight:500;">Ridgeview Baptist Church</p>
  </td></tr>

  <tr><td style="background:#4F46E5;padding:22px 32px;text-align:center;">
    <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">You're registered!</p>
    <p style="margin:6px 0 0;font-size:14px;color:rgba(255,255,255,.75);">Hi ${parentName} — we can't wait to see your family.</p>
  </td></tr>

  <tr><td style="background:#ffffff;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;padding:28px 32px 24px;">

    <p style="margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;">Children Registered</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;margin-bottom:28px;overflow:hidden;">
      ${childRows}
    </table>

    <p style="margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;">VBS Schedule</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      ${sessionRows}
    </table>

  </td></tr>

  <tr><td style="background:#f9fafb;border:1px solid #e5e7eb;border-top:1px solid #e5e7eb;border-radius:0 0 12px 12px;padding:24px 32px;text-align:center;">
    <p style="margin:0 0 18px;font-size:14px;color:#6b7280;line-height:1.6;">We look forward to seeing your family at<br><strong style="color:#111827;">Illumination Station</strong>!</p>
    <a href="https://vbs.ridgeviewbaptist.org" style="display:inline-block;background:#4F46E5;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:11px 28px;border-radius:50px;">vbs.ridgeviewbaptist.org</a>
    <p style="margin:18px 0 0;font-size:12px;color:#9ca3af;">Ridgeview Baptist Church &nbsp;·&nbsp; June 16–20, 2026</p>
  </td></tr>

</table>
</td></tr>
</table>
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
