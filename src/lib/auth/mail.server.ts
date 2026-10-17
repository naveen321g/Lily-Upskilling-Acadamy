// Outgoing email (password reset links). Server-only.
//
// Uses SMTP when SMTP_HOST is set; otherwise prints the email to the server
// console so local setups work without a mail account.

export async function sendMail(message: {
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  const host = process.env.SMTP_HOST;
  if (!host) {
    console.log(
      `\n[mail] SMTP_HOST not set — email not sent. Would have sent:\n  To: ${message.to}\n  Subject: ${message.subject}\n\n${message.text}\n`,
    );
    return;
  }

  const nodemailer = await import("nodemailer");
  const port = Number(process.env.SMTP_PORT ?? 587);
  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });
  await transport.sendMail({
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "no-reply@localhost",
    ...message,
  });
}
