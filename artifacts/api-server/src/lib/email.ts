export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendEmail(payload: EmailPayload): Promise<{ id: string } | null> {
  const resendKey = process.env.RESEND_API_KEY;

  if (!resendKey) {
    console.log("[EMAIL STUB] Would send email:");
    console.log(`  To: ${payload.to}`);
    console.log(`  Subject: ${payload.subject}`);
    return null;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: "Ascend Support <support@ascendfit.fitness>",
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[EMAIL] Resend API error:", err);
      return null;
    }

    const data = (await res.json()) as { id: string };
    return { id: data.id };
  } catch (err) {
    console.error("[EMAIL] Failed to send:", err);
    return null;
  }
}

export function buildPasswordResetEmail({ resetUrl, email }: { resetUrl: string; email: string }): EmailPayload {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset your password</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">

          <!-- Header -->
          <tr>
            <td style="padding-bottom:24px;text-align:center;">
              <span style="font-size:20px;font-weight:800;letter-spacing:-0.5px;color:#111;">Ascend</span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border-radius:12px;padding:40px 36px;border:1px solid #e4e4e7;">

              <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#111;letter-spacing:-0.3px;">
                Password reset request
              </h1>

              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#52525b;">
                We received a request to reset the password for your Ascend account associated with this email address.
              </p>

              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#52525b;">
                Click the button below to choose a new password. This link is valid for <strong>1 hour</strong>.
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background:#3b82f6;border-radius:8px;">
                    <a href="${resetUrl}"
                       style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:-0.1px;">
                      Reset my password
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#71717a;">
                If the button above does not work, copy and paste this link into your browser:
              </p>
              <p style="margin:0 0 28px;font-size:12px;word-break:break-all;color:#3b82f6;">
                ${resetUrl}
              </p>

              <hr style="border:none;border-top:1px solid #e4e4e7;margin:0 0 24px;" />

              <p style="margin:0;font-size:13px;line-height:1.5;color:#a1a1aa;">
                If you did not request a password reset, you can safely ignore this email. Your password will not change.
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:24px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;line-height:1.6;">
                Ascend &mdash; Your AI Coach for Body, Energy, and Focus<br />
                Questions? Reply to this email or contact
                <a href="mailto:support@ascendfit.fitness" style="color:#3b82f6;text-decoration:none;">support@ascendfit.fitness</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `Password reset request — Ascend

We received a request to reset the password for your Ascend account (${email}).

To choose a new password, open this link in your browser (valid for 1 hour):
${resetUrl}

If you did not request a password reset, you can safely ignore this email. Your password will not change.

---
Ascend — Your AI Coach for Body, Energy, and Focus
support@ascendfit.fitness`;

  return {
    to: email,
    subject: "Reset your Ascend password",
    html,
    text,
  };
}
