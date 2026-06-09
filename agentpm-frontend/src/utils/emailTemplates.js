// HTML email templates (mirrors the C# SprintEmailTemplates, built in the browser)

const wrap = (accentColor, icon, body) => `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <tr><td style="background:${accentColor};padding:28px 32px;text-align:center;">
          <div style="font-size:36px;margin-bottom:8px;">${icon}</div>
          <h1 style="color:#fff;font-size:20px;margin:0;font-weight:700;">AgentPM</h1>
        </td></tr>
        <tr><td style="padding:32px;">${body}</td></tr>
        <tr><td style="background:#f9fafb;padding:16px 32px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="font-size:12px;color:#9ca3af;margin:0;">
            Cet e-mail a été envoyé automatiquement par AgentPM. Ne pas répondre.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const esc = (s) => (s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

const PRIO = {
  critical: "<span style='color:#dc2626;font-weight:700;'>🔴 Critique</span>",
  high:     "<span style='color:#ea580c;font-weight:700;'>🟠 Haute</span>",
  medium:   "<span style='color:#2563eb;font-weight:700;'>🔵 Moyenne</span>",
  low:      "<span style='color:#6b7280;font-weight:700;'>⚪ Faible</span>",
};

// ── Task assignment ───────────────────────────────────────────────────────
export function buildAssignmentEmail(assigneeName, taskTitle, taskDesc,
                                     priority, projectName, sprintName, assignerName) {
  const descHtml = taskDesc ? `
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:12px 16px;margin-top:12px;">
      <p style="margin:0;font-size:13px;color:#374151;">${esc(taskDesc)}</p>
    </div>` : '';

  const body = `
    <h2 style="margin:0 0 8px;font-size:18px;color:#111827;">Bonjour ${esc(assigneeName)},</h2>
    <p style="margin:0 0 16px;color:#6b7280;font-size:14px;">
      <strong>${esc(assignerName)}</strong> vous a assigné une nouvelle tâche
      dans le projet <strong style="color:#4f46e5;">${esc(projectName)}</strong>.
    </p>
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0 0 6px;font-weight:700;font-size:16px;color:#1e3a8a;">
        📋 ${esc(taskTitle)}
      </p>
      <p style="margin:4px 0 0;font-size:13px;color:#3b82f6;">
        Sprint : ${esc(sprintName)} &nbsp;|&nbsp; Priorité : ${PRIO[priority] ?? PRIO.medium}
      </p>
      ${descHtml}
    </div>
    <p style="margin:0;color:#6b7280;font-size:14px;">
      Connectez-vous à AgentPM pour voir les détails et mettre à jour le statut.
    </p>`;

  return wrap('#4f46e5', '📋', body);
}

// ── Sprint J-1 warning ───────────────────────────────────────────────────
export function buildSprintDueTomorrowEmail(assigneeName, sprintName, projectName,
                                             endDate, taskTitles) {
  const list = taskTitles.map(t => `<li style="margin-bottom:6px;">${esc(t)}</li>`).join('');
  const body = `
    <h2 style="margin:0 0 8px;font-size:18px;color:#111827;">Bonjour ${esc(assigneeName)},</h2>
    <p style="margin:0 0 16px;color:#6b7280;font-size:14px;">
      Le sprint <strong style="color:#4f46e5;">${esc(sprintName)}</strong>
      du projet <strong>${esc(projectName)}</strong>
      se termine <strong style="color:#f59e0b;">demain (${endDate})</strong>.
    </p>
    <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0;font-weight:700;color:#92400e;">
        📅 Il vous reste moins de 24 h pour terminer vos tâches.
      </p>
    </div>
    <p style="font-weight:600;color:#374151;margin:0 0 8px;">Vos tâches en cours :</p>
    <ul style="margin:0 0 16px;padding-left:20px;">${list}</ul>`;

  return wrap('#f59e0b', '📅', body);
}

// ── Sprint overdue ────────────────────────────────────────────────────────
export function buildOverdueEmail(assigneeName, sprintName, projectName,
                                   endDate, taskTitles) {
  const list = taskTitles.map(t => `<li style="margin-bottom:6px;">${esc(t)}</li>`).join('');
  const body = `
    <h2 style="margin:0 0 8px;font-size:18px;color:#111827;">Rappel urgent — Bonjour ${esc(assigneeName)},</h2>
    <p style="margin:0 0 16px;color:#6b7280;font-size:14px;">
      Le délai du sprint <strong style="color:#4f46e5;">${esc(sprintName)}</strong>
      (${esc(projectName)}) est <strong style="color:#ef4444;">dépassé</strong>.
    </p>
    <div style="background:#fee2e2;border:1px solid #fca5a5;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0;color:#7f1d1d;font-size:14px;">
        ⏰ Date limite dépassée : <strong>${endDate}</strong>
      </p>
    </div>
    <p style="font-weight:600;color:#374151;margin:0 0 8px;">Vos tâches en retard :</p>
    <ul style="margin:0 0 16px;padding-left:20px;">${list}</ul>`;

  return wrap('#ef4444', '⏰', body);
}
