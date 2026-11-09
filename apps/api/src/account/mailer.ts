import { createTransport, type Transporter } from 'nodemailer';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** Sends email. SMTP when configured; otherwise the message is logged (development). */
export interface Mailer {
  send(m: MailMessage): Promise<void>;
}

/** Development: prints the email (and its sign-in link) to the API log instead of sending it. */
export class LogMailer implements Mailer {
  async send(m: MailMessage): Promise<void> {
    console.log(`[mail] to ${m.to}: ${m.subject}\n${m.text}`);
  }
}

/** Any SMTP service (Brevo, Resend, Amazon SES, Zoho, …), configured with `SMTP_URL` and `MAIL_FROM`. */
export class SmtpMailer implements Mailer {
  private readonly transport: Transporter;

  constructor(
    url: string,
    private readonly from: string,
  ) {
    this.transport = createTransport(url);
  }

  async send(m: MailMessage): Promise<void> {
    await this.transport.sendMail({
      from: this.from,
      to: m.to,
      subject: m.subject,
      text: m.text,
      ...(m.html ? { html: m.html } : {}),
    });
  }
}

export function mailerFromEnv(env: Record<string, string | undefined>): Mailer {
  if (env.SMTP_URL) return new SmtpMailer(env.SMTP_URL, env.MAIL_FROM ?? 'TripSaver <no-reply@localhost>');
  return new LogMailer();
}
