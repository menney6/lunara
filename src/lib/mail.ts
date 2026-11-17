import crypto from "node:crypto";
import nodemailer from "nodemailer";
import { run } from "./db";

/**
 * Outbound email for Lunara — login notifications, password resets and
 * signup confirmations.
 *
 * Delivery is SMTP-based and configured entirely through the environment:
 *
 *   SMTP_HOST=smtp.gmail.com     SMTP_PORT=465
 *   SMTP_USER=you@gmail.com      SMTP_PASS=<gmail app password>
 *   MAIL_FROM="Lunara <you@gmail.com>"
 *
 * When those are absent (local dev, or Vercel before the secrets are set)
 * the module runs in *demo mode*: nothing is sent, the message is logged and
 * flows that return a link hand it back to the caller so the UI can show a
 * "demo delivery" panel — the same pattern the password-reset flow already
 * used. Adding the secrets to Vercel turns everything on with no code change.
 */

/** True when real email delivery is configured. */
export function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

/**
 * Whether new registrations must confirm their email before first sign-in.
 * On whenever emails can actually be delivered — and always in development,
 * so the whole flow stays testable without SMTP credentials. With no SMTP
 * configured in production, registration stays instant (nobody could receive
 * a confirmation link, so blocking them would strand every new account).
 */
export function confirmationRequired(): boolean {
  return smtpConfigured() || process.env.NODE_ENV !== "production";
}

export interface MailPayload {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** Template output — the caller decides the recipient. */
export type MailContent = Omit<MailPayload, "to">;

/**
 * Sends an email. Never throws — a mail problem must not break login or
 * registration. Returns true when a real provider accepted the message,
 * false in demo mode or on failure (both are logged).
 */
export async function sendMail(payload: MailPayload): Promise<boolean> {
  if (!smtpConfigured()) {
    console.info(`[lunara] demo email → ${payload.to} :: ${payload.subject}`);
    return false;
  }
  try {
    const port = Number(process.env.SMTP_PORT ?? 465);
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transport.sendMail({
      from: process.env.MAIL_FROM ?? process.env.SMTP_USER,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html ?? wrap(payload.subject, payload.text),
    });
    console.info(`[lunara] email sent → ${payload.to} :: ${payload.subject}`);
    return true;
  } catch (err) {
    console.error(
      `[lunara] email FAILED → ${payload.to} ::`,
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}

/* ---------------------------------------------------------------- templates */

/** Absolute URL helper — uses the origin the request arrived on. */
export function absoluteUrl(req: Request, path: string): string {
  return new URL(path, req.url).toString();
}

/**
 * Issues a single-use signup-confirmation token (24h) and emails the link.
 * Returns a demo link for the UI to render when there's no SMTP configured
 * outside production, or null when delivery is — or should have been — by
 * email. Never throws: a mail failure must not break registration.
 */
export async function sendConfirmationEmail(
  req: Request,
  userId: number,
  email: string,
  name: string,
): Promise<string | null> {
  const token = crypto.randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + 24 * 60 * 60_000)
    .toISOString()
    .replace("T", " ")
    .slice(0, 19);
  await run(
    "INSERT INTO email_confirmations (token_hash, user_id, expires_at) VALUES (?,?,?)",
    crypto.createHash("sha256").update(token).digest("hex"),
    userId,
    expires,
  );
  const url = absoluteUrl(req, `/api/auth/confirm?token=${token}`);
  const sent = await sendMail({ ...emails.confirmEmail(name, url), to: email });
  if (sent || process.env.NODE_ENV === "production") return null;
  return `/api/auth/confirm?token=${token}`;
}

export const emails = {
  newLogin(opts: {
    name: string;
    time: string;
    device: string;
    ip: string;
    resetUrl: string;
  }): MailContent {
    const text = `Hi ${opts.name},

A new sign-in to your Lunara account was recorded:

  Time:   ${opts.time} (UTC)
  Device: ${opts.device}
  IP:     ${opts.ip}

If this was you, no action is needed. If you don't recognise this sign-in,
reset your password right away:

  ${opts.resetUrl}

— Lunara`;
    return {
      subject: "New sign-in to your Lunara account",
      text,
      html: wrap("New sign-in", text),
    };
  },

  passwordReset(name: string, url: string): MailContent {
    const text = `Hi ${name},

We received a request to reset your Lunara password. Open this link to choose a new one:

  ${url}

The link expires in 45 minutes. If you didn't ask for this, you can safely
ignore this email — your password stays unchanged.

— Lunara`;
    return {
      subject: "Reset your Lunara password",
      text,
      html: wrap("Reset your password", text),
    };
  },

  confirmEmail(name: string, url: string): MailContent {
    const text = `Hi ${name},

Welcome to Lunara! Confirm your email address to finish setting up your account:

  ${url}

The link expires in 24 hours. Once confirmed you can sign in with the
password you chose.

— Lunara`;
    return {
      subject: "Confirm your Lunara account",
      text,
      html: wrap("Confirm your account", text),
    };
  },
};

/** Minimal branded HTML wrapper around a plain-text body. */
function wrap(headline: string, text: string): string {
  const body = text
    .split("\n")
    .map((line) =>
      line.trim() === ""
        ? "<br/><br/>"
        : line.startsWith("  ")
          ? `<span style="font-family:monospace">${escapeHtml(line.trim())}</span><br/>`
          : `${escapeHtml(line)}<br/>`,
    )
    .join("");
  return `<!doctype html>
<html><body style="margin:0;padding:32px;background:#f6f4fb;font-family:Georgia,serif;color:#2c1b3d;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;border:1px solid #e7ddf5;">
    <p style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#7b5ea7;margin:0 0 16px;">Lunara</p>
    <h1 style="font-size:20px;margin:0 0 16px;font-weight:normal;">${escapeHtml(headline)}</h1>
    <p style="font-size:14.5px;line-height:1.65;margin:0;">${body}</p>
    <p style="font-size:12.5px;color:#8a7f9c;margin-top:28px;border-top:1px solid #efe9f8;padding-top:16px;">
      You received this email because it relates to your Lunara account.
    </p>
  </div>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
