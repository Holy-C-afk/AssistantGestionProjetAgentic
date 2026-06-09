namespace AgentPM.Api.Services;

/// <summary>HTML email templates for sprint notifications (French UI).</summary>
public static class SprintEmailTemplates
{
    // ── Shared layout ────────────────────────────────────────────────────────
    private static string Wrap(string accentColor, string iconHtml, string body) => $"""
        <!DOCTYPE html>
        <html lang="fr">
        <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
        <body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
            <tr><td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">

                <!-- Header -->
                <tr><td style="background:{accentColor};padding:28px 32px;text-align:center;">
                  <div style="font-size:36px;margin-bottom:8px;">{iconHtml}</div>
                  <h1 style="color:#fff;font-size:20px;margin:0;font-weight:700;">AgentPM</h1>
                </td></tr>

                <!-- Body -->
                <tr><td style="padding:32px;">{body}</td></tr>

                <!-- Footer -->
                <tr><td style="background:#f9fafb;padding:16px 32px;text-align:center;border-top:1px solid #e5e7eb;">
                  <p style="font-size:12px;color:#9ca3af;margin:0;">
                    Cet e-mail a été envoyé automatiquement par AgentPM. Ne pas répondre.
                  </p>
                </td></tr>

              </table>
            </td></tr>
          </table>
        </body>
        </html>
        """;

    // ────────────────────────────────────────────────────────────────────────
    /// <summary>Email sent to an assignee when their task is unfinished at sprint close attempt.</summary>
    public static string AssigneeNotification(
        string assigneeName,
        string sprintName,
        string projectName,
        IEnumerable<string> taskTitles,
        DateOnly? endDate)
    {
        var taskList = string.Join("", taskTitles.Select(t =>
            $"<li style='margin-bottom:6px;color:#374151;'>{System.Net.WebUtility.HtmlEncode(t)}</li>"));

        var deadline = endDate.HasValue
            ? $"<p style='margin:16px 0 0;color:#ef4444;font-size:14px;'>⏰ Date de fin du sprint : <strong>{endDate.Value:dd/MM/yyyy}</strong></p>"
            : "";

        var body = $"""
            <h2 style="margin:0 0 8px;font-size:18px;color:#111827;">Bonjour {System.Net.WebUtility.HtmlEncode(assigneeName)},</h2>
            <p style="margin:0 0 16px;color:#6b7280;font-size:14px;">
              Une tentative de clôture du sprint a été effectuée dans le projet
              <strong style="color:#4f46e5;">{System.Net.WebUtility.HtmlEncode(projectName)}</strong>.
            </p>

            <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
              <p style="margin:0 0 8px;font-weight:700;color:#92400e;">⚠️ Sprint : {System.Net.WebUtility.HtmlEncode(sprintName)}</p>
              <p style="margin:0;color:#78350f;font-size:14px;">
                Le sprint ne peut pas être clôturé car des tâches qui vous sont assignées ne sont pas encore terminées.
              </p>
            </div>

            <p style="font-weight:600;color:#374151;margin:0 0 8px;">Tâches en attente :</p>
            <ul style="margin:0 0 16px;padding-left:20px;">
              {taskList}
            </ul>

            <p style="margin:0;color:#6b7280;font-size:14px;">
              Merci de mettre à jour le statut de vos tâches dès que possible afin de permettre la clôture du sprint.
            </p>
            {deadline}
            """;

        return Wrap("#f59e0b", "⚠️", body);
    }

    // ────────────────────────────────────────────────────────────────────────
    /// <summary>Email sent to the Chef de projet when a sprint close is blocked.</summary>
    public static string ChefDeProjetNotification(
        string chefName,
        string sprintName,
        string projectName,
        int unfinishedCount,
        IEnumerable<(string TaskTitle, string AssigneeName)> tasks,
        DateOnly? endDate)
    {
        var rows = string.Join("", tasks.Select(t => $"""
            <tr>
              <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#374151;">{System.Net.WebUtility.HtmlEncode(t.TaskTitle)}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#6b7280;">{System.Net.WebUtility.HtmlEncode(t.AssigneeName)}</td>
            </tr>
            """));

        var deadline = endDate.HasValue
            ? $"<p style='margin:16px 0 0;color:#ef4444;font-size:14px;'>⏰ Date de fin du sprint : <strong>{endDate.Value:dd/MM/yyyy}</strong></p>"
            : "";

        var body = $"""
            <h2 style="margin:0 0 8px;font-size:18px;color:#111827;">Bonjour {System.Net.WebUtility.HtmlEncode(chefName)},</h2>
            <p style="margin:0 0 16px;color:#6b7280;font-size:14px;">
              Une tentative de clôture du sprint a été bloquée dans le projet
              <strong style="color:#4f46e5;">{System.Net.WebUtility.HtmlEncode(projectName)}</strong>.
            </p>

            <div style="background:#fee2e2;border:1px solid #fca5a5;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
              <p style="margin:0 0 4px;font-weight:700;color:#991b1b;">🚫 Sprint : {System.Net.WebUtility.HtmlEncode(sprintName)}</p>
              <p style="margin:0;color:#7f1d1d;font-size:14px;">
                <strong>{unfinishedCount}</strong> tâche(s) non terminée(s) empêchent la clôture.
              </p>
            </div>

            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:16px;">
              <tr style="background:#f9fafb;">
                <th style="padding:10px 12px;text-align:left;font-size:13px;color:#6b7280;font-weight:600;">Tâche</th>
                <th style="padding:10px 12px;text-align:left;font-size:13px;color:#6b7280;font-weight:600;">Assigné à</th>
              </tr>
              {rows}
            </table>

            <p style="margin:0;color:#6b7280;font-size:14px;">
              Les notifications ont été envoyées aux personnes concernées.
            </p>
            {deadline}
            """;

        return Wrap("#ef4444", "🚫", body);
    }

    // ────────────────────────────────────────────────────────────────────────
    /// <summary>Reminder email for an overdue sprint (deadline passed, tasks still open).</summary>
    public static string OverdueReminderAssignee(
        string assigneeName,
        string sprintName,
        string projectName,
        DateOnly endDate,
        IEnumerable<string> taskTitles)
    {
        var taskList = string.Join("", taskTitles.Select(t =>
            $"<li style='margin-bottom:6px;color:#374151;'>{System.Net.WebUtility.HtmlEncode(t)}</li>"));

        var body = $"""
            <h2 style="margin:0 0 8px;font-size:18px;color:#111827;">Rappel urgent — Bonjour {System.Net.WebUtility.HtmlEncode(assigneeName)},</h2>
            <p style="margin:0 0 16px;color:#6b7280;font-size:14px;">
              Le délai du sprint dans le projet
              <strong style="color:#4f46e5;">{System.Net.WebUtility.HtmlEncode(projectName)}</strong> est dépassé.
            </p>

            <div style="background:#fee2e2;border:1px solid #fca5a5;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
              <p style="margin:0 0 4px;font-weight:700;color:#991b1b;">⏰ Sprint : {System.Net.WebUtility.HtmlEncode(sprintName)}</p>
              <p style="margin:0;color:#7f1d1d;font-size:14px;">
                Date limite dépassée : <strong>{endDate:dd/MM/yyyy}</strong>
              </p>
            </div>

            <p style="font-weight:600;color:#374151;margin:0 0 8px;">Vos tâches en retard :</p>
            <ul style="margin:0 0 16px;padding-left:20px;">
              {taskList}
            </ul>

            <p style="margin:0;color:#6b7280;font-size:14px;">
              Veuillez terminer vos tâches ou contacter votre chef de projet.
            </p>
            """;

        return Wrap("#ef4444", "⏰", body);
    }

    /// <summary>Reminder email for the Chef de projet when a sprint is overdue.</summary>
    public static string OverdueReminderChef(
        string chefName,
        string sprintName,
        string projectName,
        DateOnly endDate,
        IEnumerable<(string TaskTitle, string AssigneeName)> tasks)
    {
        var rows = string.Join("", tasks.Select(t => $"""
            <tr>
              <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#374151;">{System.Net.WebUtility.HtmlEncode(t.TaskTitle)}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#6b7280;">{System.Net.WebUtility.HtmlEncode(t.AssigneeName)}</td>
            </tr>
            """));

        var body = $"""
            <h2 style="margin:0 0 8px;font-size:18px;color:#111827;">Rappel urgent — Bonjour {System.Net.WebUtility.HtmlEncode(chefName)},</h2>
            <p style="margin:0 0 16px;color:#6b7280;font-size:14px;">
              Le sprint
              <strong style="color:#4f46e5;">{System.Net.WebUtility.HtmlEncode(sprintName)}</strong>
              du projet <strong>{System.Net.WebUtility.HtmlEncode(projectName)}</strong>
              a dépassé sa date limite et contient encore des tâches non terminées.
            </p>

            <div style="background:#fee2e2;border:1px solid #fca5a5;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
              <p style="margin:0;color:#7f1d1d;font-size:14px;">
                ⏰ Date limite dépassée : <strong>{endDate:dd/MM/yyyy}</strong>
              </p>
            </div>

            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:16px;">
              <tr style="background:#f9fafb;">
                <th style="padding:10px 12px;text-align:left;font-size:13px;color:#6b7280;font-weight:600;">Tâche en retard</th>
                <th style="padding:10px 12px;text-align:left;font-size:13px;color:#6b7280;font-weight:600;">Assigné à</th>
              </tr>
              {rows}
            </table>

            <p style="margin:0;color:#6b7280;font-size:14px;">
              Prenez les mesures nécessaires pour débloquer la situation.
            </p>
            """;

        return Wrap("#ef4444", "⏰", body);
    }

    // ────────────────────────────────────────────────────────────────────────
    /// <summary>Warning email sent J-1 (one day before sprint end date).</summary>
    public static string SprintDueTomorrowAssignee(
        string assigneeName,
        string sprintName,
        string projectName,
        DateOnly endDate,
        IEnumerable<string> taskTitles)
    {
        var taskList = string.Join("", taskTitles.Select(t =>
            $"<li style='margin-bottom:6px;color:#374151;'>{System.Net.WebUtility.HtmlEncode(t)}</li>"));

        var body = $"""
            <h2 style="margin:0 0 8px;font-size:18px;color:#111827;">Bonjour {System.Net.WebUtility.HtmlEncode(assigneeName)},</h2>
            <p style="margin:0 0 16px;color:#6b7280;font-size:14px;">
              Le sprint <strong style="color:#4f46e5;">{System.Net.WebUtility.HtmlEncode(sprintName)}</strong>
              du projet <strong>{System.Net.WebUtility.HtmlEncode(projectName)}</strong>
              se termine <strong style="color:#f59e0b;">demain ({endDate:dd/MM/yyyy})</strong>.
            </p>

            <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
              <p style="margin:0;font-weight:700;color:#92400e;">
                📅 Il vous reste moins de 24 h pour terminer vos tâches.
              </p>
            </div>

            <p style="font-weight:600;color:#374151;margin:0 0 8px;">Vos tâches en cours :</p>
            <ul style="margin:0 0 16px;padding-left:20px;">
              {taskList}
            </ul>

            <p style="margin:0;color:#6b7280;font-size:14px;">
              Merci de mettre à jour le statut de vos tâches avant la fin de la journée.
            </p>
            """;

        return Wrap("#f59e0b", "📅", body);
    }

    /// <summary>Warning email sent J-1 to the Chef de projet.</summary>
    public static string SprintDueTomorrowChef(
        string chefName,
        string sprintName,
        string projectName,
        DateOnly endDate,
        IEnumerable<(string TaskTitle, string AssigneeName)> tasks)
    {
        var rows = string.Join("", tasks.Select(t => $"""
            <tr>
              <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#374151;">{System.Net.WebUtility.HtmlEncode(t.TaskTitle)}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#6b7280;">{System.Net.WebUtility.HtmlEncode(t.AssigneeName)}</td>
            </tr>
            """));

        var body = $"""
            <h2 style="margin:0 0 8px;font-size:18px;color:#111827;">Bonjour {System.Net.WebUtility.HtmlEncode(chefName)},</h2>
            <p style="margin:0 0 16px;color:#6b7280;font-size:14px;">
              Le sprint <strong style="color:#4f46e5;">{System.Net.WebUtility.HtmlEncode(sprintName)}</strong>
              du projet <strong>{System.Net.WebUtility.HtmlEncode(projectName)}</strong>
              se termine <strong style="color:#f59e0b;">demain ({endDate:dd/MM/yyyy})</strong>.
              {tasks.Count()} tâche(s) ne sont pas encore terminées.
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:16px;">
              <tr style="background:#fef3c7;">
                <th style="padding:10px 12px;text-align:left;font-size:13px;color:#92400e;font-weight:600;">Tâche</th>
                <th style="padding:10px 12px;text-align:left;font-size:13px;color:#92400e;font-weight:600;">Assigné à</th>
              </tr>
              {rows}
            </table>

            <p style="margin:0;color:#6b7280;font-size:14px;">
              Les membres concernés ont également été notifiés.
            </p>
            """;

        return Wrap("#f59e0b", "📅", body);
    }

    // ────────────────────────────────────────────────────────────────────────
    /// <summary>Email sent to a user when a task is assigned to them.</summary>
    public static string TaskAssigned(
        string assigneeName,
        string taskTitle,
        string? taskDescription,
        string priority,
        string projectName,
        string sprintName,
        string assignedByName)
    {
        var priorityLabel = priority switch
        {
            "critical" => "<span style='color:#dc2626;font-weight:700;'>🔴 Critique</span>",
            "high"     => "<span style='color:#ea580c;font-weight:700;'>🟠 Haute</span>",
            "medium"   => "<span style='color:#2563eb;font-weight:700;'>🔵 Moyenne</span>",
            _          => "<span style='color:#6b7280;font-weight:700;'>⚪ Faible</span>",
        };

        var descHtml = string.IsNullOrWhiteSpace(taskDescription) ? "" : $"""
            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:12px 16px;margin-top:12px;">
              <p style="margin:0;font-size:13px;color:#374151;">{System.Net.WebUtility.HtmlEncode(taskDescription)}</p>
            </div>
            """;

        var body = $"""
            <h2 style="margin:0 0 8px;font-size:18px;color:#111827;">Bonjour {System.Net.WebUtility.HtmlEncode(assigneeName)},</h2>
            <p style="margin:0 0 16px;color:#6b7280;font-size:14px;">
              <strong>{System.Net.WebUtility.HtmlEncode(assignedByName)}</strong> vous a assigné une nouvelle tâche
              dans le projet <strong style="color:#4f46e5;">{System.Net.WebUtility.HtmlEncode(projectName)}</strong>.
            </p>

            <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
              <p style="margin:0 0 6px;font-weight:700;font-size:16px;color:#1e3a8a;">
                📋 {System.Net.WebUtility.HtmlEncode(taskTitle)}
              </p>
              <p style="margin:4px 0 0;font-size:13px;color:#3b82f6;">
                Sprint : {System.Net.WebUtility.HtmlEncode(sprintName)} &nbsp;|&nbsp; Priorité : {priorityLabel}
              </p>
              {descHtml}
            </div>

            <p style="margin:0;color:#6b7280;font-size:14px;">
              Connectez-vous à AgentPM pour voir les détails et mettre à jour le statut.
            </p>
            """;

        return Wrap("#4f46e5", "📋", body);
    }
}
