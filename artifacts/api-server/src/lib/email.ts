/**
 * Email helper for Ascend.
 * Currently stubs all emails by logging to console.
 * To activate real email sending, set the RESEND_API_KEY environment variable.
 */

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(payload: EmailPayload): Promise<{ id: string } | null> {
  const resendKey = process.env.RESEND_API_KEY;

  if (!resendKey) {
    console.log("[EMAIL STUB] Would send email:");
    console.log(`  To: ${payload.to}`);
    console.log(`  Subject: ${payload.subject}`);
    console.log(`  HTML: ${payload.html.slice(0, 200)}...`);
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
        from: "Ascend <onboarding@resend.dev>",
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text ?? payload.html.replace(/<[^>]*>/g, ""),
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
  return {
    to: email,
    subject: "Reset your Ascend password",
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h1 style="font-size: 24px; font-weight: 700; margin-bottom: 16px;">Reset your password</h1>
        <p style="font-size: 16px; color: #555; margin-bottom: 24px;">
          You requested a password reset for your Ascend account. Click the button below to set a new password.
        </p>
        <a href="${resetUrl}" style="display: inline-block; background: #F59E0B; color: #000; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Reset Password
        </a>
        <p style="font-size: 14px; color: #888; margin-top: 24px;">
          This link expires in 1 hour and can only be used once. If you didn't request this, you can safely ignore this email.
        </p>
        <p style="font-size: 14px; color: #888; margin-top: 16px;">
          ${resetUrl}
        </p>
      </div>
    `,
  };
}
