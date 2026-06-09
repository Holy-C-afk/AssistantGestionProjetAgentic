import { msalInstance } from '../auth/msalInstance';
import { mailRequest }  from '../auth/authConfig';

/**
 * Sends an email via Microsoft Graph API (POST /me/sendMail).
 * Uses the currently logged-in user's MSAL token — no password needed.
 *
 * @param {string}   to       - Recipient email address
 * @param {string}   subject  - Email subject
 * @param {string}   html     - HTML body
 */
export async function sendMailViaGraph(to, subject, html) {
  try {
    // Acquire token silently (uses cached MSAL token)
    const accounts = msalInstance.getAllAccounts();
    if (!accounts.length) return;

    const result = await msalInstance.acquireTokenSilent({
      ...mailRequest,
      account: accounts[0],
    });

    const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${result.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          subject,
          body:         { contentType: 'HTML', content: html },
          toRecipients: [{ emailAddress: { address: to } }],
        },
        saveToSentItems: false,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[Graph sendMail error]', response.status, err);
    }
  } catch (err) {
    // If silent token fails (consent needed), log but don't crash
    console.warn('[Graph sendMail]', err?.message ?? err);
  }
}

/**
 * Sends the same email to multiple recipients.
 */
export async function sendMailToMany(recipients, subject, html) {
  for (const addr of recipients) {
    await sendMailViaGraph(addr, subject, html);
  }
}
