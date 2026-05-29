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
    '4YO': '4 Years Old',
    PK: 'Pre-K',
    K: 'Kindergarten',
    '1': '1st Grade',
    '2': '2nd Grade',
    '3': '3rd Grade',
    '4': '4th Grade',
    '5': '5th Grade',
    '6': '6th Grade',
    '7': '7th Grade',
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
    `Thank you so much for registering your child for Illumination Station VBS at Ridgeview Baptist Church! We are absolutely thrilled to have them join us for a week of fun with friends learning about Jesus—the light of the world!`,
    '',
    'Here are the quick details you need to know:',
    '  • Dates: June 15th – 19th',
    '  • Time: 6:00 PM – 8:30 PM nightly',
    '  • Drop-off/Pick-up at the locations listed below',
    '',
    'Children Registered:',
    childListText,
    '',
    'VBS Schedule:',
    sessionListText,
    '',
    'Nightly Check-In Locations',
    'To help make drop-off as smooth as possible each evening, please check your child in at their designated location based on the grade they just completed this school year:',
    '',
    '  4 Years Old – Beginning Kindergarten  →  Preschool Entrance',
    '  Completed K – Completed 4th Grade     →  Sanctuary Foyer (pre-registered/Check-in line)',
    '  Middle School (Completed 5th–7th)     →  Outside by the Soccer Field Bus Awning',
    '',
    'To ensure a safe and secure environment for all of our kids, every VBS volunteer undergoes a background check. Because of these safety protocols, we kindly ask that parents do not remain with the children during VBS but rather join our adult VBS Bible study in the sanctuary. Thank you so much for helping us keep our kids safe!',
    '',
    'Our Theme for VBS',
    'At Illumination Station VBS, kids will be challenged to answer Jesus\' important question to His disciples, "Who do you say that I am?" As they explore all the ways light brightens, illuminates, reflects, and reveals, kids will discover that Jesus is the light who brings hope to a dark world.',
    '',
    'Our anchor verse for the week is:',
    '"Jesus spoke to them again: \'I am the light of the world. Anyone who follows me will never walk in the darkness but will have the light of life.\'" — John 8:12',
    '',
    "We are praying for a powerful, bright week and can't wait to see your family on Monday, June 15th! Keep an eye on your inbox closer to the event for any final reminders.",
    '',
    "We'd love for you to join us in prayer for this week. Download our VBS prayer guide (https://drive.google.com/file/d/1OlfyjHVStRozzboiADIsZzWENgyoJN4N/view?usp=sharing) and pray with us in the days leading up to VBS.",
    '',
    'If you have any questions in the meantime, please don\'t hesitate to reach out.',
    '',
    'Shining bright,',
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

    <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.7;">Thank you so much for registering your child for <strong>Illumination Station VBS</strong> at Ridgeview Baptist Church! We are absolutely thrilled to have them join us for a week of fun with friends learning about Jesus&mdash;the light of the world!</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:8px;margin-bottom:28px;overflow:hidden;">
      <tr><td style="padding:14px 18px;">
        <p style="margin:0 0 8px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#6366f1;">Quick Details</p>
        <p style="margin:0 0 4px;font-size:14px;color:#111827;"><strong>Dates:</strong> June 15th &ndash; 19th</p>
        <p style="margin:0 0 4px;font-size:14px;color:#111827;"><strong>Time:</strong> 6:00 PM &ndash; 8:30 PM nightly</p>
        <p style="margin:0;font-size:14px;color:#111827;"><strong>Drop-off/Pick-up</strong> at the locations listed below</p>
      </td></tr>
    </table>

    <p style="margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;">Children Registered</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;margin-bottom:28px;overflow:hidden;">
      ${childRows}
    </table>

    <p style="margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;">VBS Schedule</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;margin-bottom:28px;overflow:hidden;">
      ${sessionRows}
    </table>

    <p style="margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;">Nightly Check-In Locations</p>
    <p style="margin:0 0 12px;font-size:14px;color:#374151;line-height:1.6;">To help make drop-off as smooth as possible each evening, please check your child in at their designated location based on the grade they just completed this school year:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;margin-bottom:24px;overflow:hidden;">
      <tr style="background:#f9fafb;">
        <th style="padding:9px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;text-align:left;">Age / Grade Level</th>
        <th style="padding:9px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;text-align:left;">Check-In Location</th>
      </tr>
      <tr style="border-top:1px solid #e5e7eb;">
        <td style="padding:10px 14px;font-size:14px;color:#111827;">4 Years Old &ndash; Beginning Kindergarten</td>
        <td style="padding:10px 14px;font-size:14px;color:#374151;">Preschool Entrance</td>
      </tr>
      <tr style="border-top:1px solid #e5e7eb;">
        <td style="padding:10px 14px;font-size:14px;color:#111827;">Completed K &ndash; Completed 4th Grade</td>
        <td style="padding:10px 14px;font-size:14px;color:#374151;">Sanctuary Foyer <span style="color:#6b7280;font-size:13px;">(pre-registered/Check-in line)</span></td>
      </tr>
      <tr style="border-top:1px solid #e5e7eb;">
        <td style="padding:10px 14px;font-size:14px;color:#111827;">Middle School (Completed 5th &ndash; 7th Grade)</td>
        <td style="padding:10px 14px;font-size:14px;color:#374151;">Outside by the Soccer Field Bus Awning</td>
      </tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;margin-bottom:28px;overflow:hidden;">
      <tr><td style="padding:14px 18px;">
        <p style="margin:0;font-size:14px;color:#374151;line-height:1.7;">To ensure a safe and secure environment for all of our kids, every VBS volunteer undergoes a background check. Because of these safety protocols, we kindly ask that <strong>parents do not remain with the children during VBS</strong> but rather join our adult VBS Bible study in the sanctuary. Thank you so much for helping us keep our kids safe!</p>
      </td></tr>
    </table>

    <p style="margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;">Our Theme for VBS</p>
    <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.7;">At Illumination Station VBS, kids will be challenged to answer Jesus&rsquo; important question to His disciples, &ldquo;Who do you say that I am?&rdquo; As they explore all the ways light brightens, illuminates, reflects, and reveals, kids will discover that Jesus is the light who brings hope to a dark world.</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border-left:4px solid #22c55e;margin-bottom:28px;overflow:hidden;">
      <tr><td style="padding:14px 18px;">
        <p style="margin:0 0 6px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#16a34a;">Anchor Verse</p>
        <p style="margin:0 0 6px;font-size:15px;color:#111827;line-height:1.7;font-style:italic;">&ldquo;Jesus spoke to them again: &lsquo;I am the light of the world. Anyone who follows me will never walk in the darkness but will have the light of life.&rsquo;&rdquo;</p>
        <p style="margin:0;font-size:13px;color:#16a34a;font-weight:600;">— John 8:12</p>
      </td></tr>
    </table>

    <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.7;">We are praying for a powerful, bright week and can&rsquo;t wait to see your family on <strong>Monday, June 15th!</strong> Keep an eye on your inbox closer to the event for any final reminders.</p>

    <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.7;">We&rsquo;d love for you to join us in prayer for this week. <a href="https://drive.google.com/file/d/1OlfyjHVStRozzboiADIsZzWENgyoJN4N/view?usp=sharing" style="color:#4F46E5;font-weight:600;">Download our VBS prayer guide</a> and pray with us in the days leading up to VBS.</p>

    <p style="margin:0 0 4px;font-size:15px;color:#374151;line-height:1.7;">If you have any questions in the meantime, please don&rsquo;t hesitate to reach out.</p>

  </td></tr>

  <tr><td style="background:#f9fafb;border:1px solid #e5e7eb;border-top:1px solid #e5e7eb;border-radius:0 0 12px 12px;padding:24px 32px;text-align:center;">
    <p style="margin:0 0 4px;font-size:15px;color:#374151;font-weight:600;">Shining bright,</p>
    <p style="margin:0 0 18px;font-size:15px;color:#111827;font-weight:700;">Ridgeview Baptist Church</p>
    <a href="https://vbs.ridgeviewbaptist.org" style="display:inline-block;background:#4F46E5;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:11px 28px;border-radius:50px;">vbs.ridgeviewbaptist.org</a>
    <p style="margin:18px 0 0;font-size:12px;color:#9ca3af;">Ridgeview Baptist Church &nbsp;·&nbsp; June 15–19, 2026</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  await env.SEND_EMAIL.send({
    from: 'RBC VBS <noreply@vbs.ridgeviewbaptist.org>',
    to,
    subject,
    text,
    html,
  });
}
