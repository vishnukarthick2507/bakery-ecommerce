import nodemailer from "nodemailer";

const OTP_EXPIRY_MINUTES = 10;

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;
  const fromName = process.env.SMTP_FROM_NAME || "S.V. Bakery";

  if (!host || !user || !pass || !from) {
    throw new Error("SMTP configuration is incomplete. Check SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM env vars.");
  }

  return { host, port, user, pass, from, fromName };
}

export async function sendOtpEmail(
  to: string,
  otp: string,
  purpose: "LOGIN" | "REGISTER"
): Promise<void> {
  const { host, port, user, pass, from, fromName } = getSmtpConfig();

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });

  const purposeLabel = purpose === "LOGIN" ? "login" : "account creation";

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="center" style="padding: 20px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px;">
              <tr>
                <td align="center" style="padding: 24px; background-color: #0B2744; border-radius: 8px 8px 0 0;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: bold;">S.V. Bakery</h1>
                  <p style="color: #c7d2fe; margin: 8px 0 0; font-size: 14px;">Freshly Baked. Made With Love.</p>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding: 32px; background-color: #ffffff; border-radius: 0 0 8px 8px;">
                  <h2 style="color: #1f2937; margin: 0 0 16px; font-size: 20px;">Your OTP Code</h2>
                  <p style="color: #4b5563; margin: 0 0 24px; font-size: 16px;">
                    Use this code to ${purposeLabel} at S.V. Bakery:
                  </p>
                  <div style="display: inline-block; padding: 16px 32px; background-color: #0B2744; border-radius: 8px; font-size: 32px; font-weight: bold; color: #ffffff; letter-spacing: 8px;">
                    ${otp}
                  </div>
                  <p style="color: #6b7280; margin: 24px 0 0; font-size: 14px;">
                    This code expires in ${OTP_EXPIRY_MINUTES} minutes. If you didn't request this, please ignore this email.
                  </p>
                  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
                  <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                    S.V. Sweets & Bakers<br>
                    Freshly Baked. Made With Love.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: `"${fromName}" <${from}>`,
    to,
    subject: `Your S.V. Bakery OTP Code: ${otp}`,
    html,
  });
}
