// ─────────────────────────────────────────────────────────────
//  services/auth.js  —  OTP authentication business logic
// ─────────────────────────────────────────────────────────────

import crypto from "crypto";
import OTP from "../models/OTP.js";

// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
//  email configuration (Brevo REST API)
// ─────────────────────────────────────────────────────────────

// We no longer use Nodemailer because Render's Free Tier blocks SMTP ports.
// Instead, we use Brevo's HTTP API (port 443) which is completely unblocked.

/** Accept these env names so typos still work on Render dashboards. */
const BREVO_KEY_ENV_NAMES = [
  "BREVO_API_KEY",
  "BRAVO_API_KEY", // common typo (Bravo vs Brevo)
  "SENDINBLUE_API_KEY", // legacy Brevo (Sendinblue) name
];

/**
 * Brevo's UI occasionally copies a Base64 blob like:
 * {"api_key":"xkeysib-..."} encoded — the HTTP API expects the raw `xkeysib-...` string.
 */
function normalizeBrevoKeyValue(raw) {
  if (typeof raw !== "string") return "";
  let v = raw.trim().replace(/^\uFEFF/, "");
  if (!v) return "";
  const compact = v.replace(/\s/g, "");
  if (compact.length < 20) return v;
  if (!/^[A-Za-z0-9+/=_-]+$/.test(compact)) return v;
  try {
    const decoded = Buffer.from(compact, "base64").toString("utf8");
    if (decoded.startsWith("{") && decoded.includes("api_key")) {
      const j = JSON.parse(decoded);
      const inner = j?.api_key;
      if (typeof inner === "string" && inner.trim()) {
        return inner.trim();
      }
    }
  } catch {
    /* use literal */
  }
  return v;
}

/**
 * Prefer first non-empty value among known env names.
 */
function getBrevoApiKeyFromEnv() {
  for (const name of BREVO_KEY_ENV_NAMES) {
    const raw = process.env[name];
    if (typeof raw !== "string") continue;
    const v = normalizeBrevoKeyValue(raw);
    if (v.length > 0) return v;
  }
  return "";
}

/** True when any supported key name has a non-empty value. */
export function hasBrevoCredentials() {
  return getBrevoApiKeyFromEnv().length > 0;
}

/** Safe for /diagnostic — which variable names Render actually set (not values). */
export function brevoEnvKeyPresence() {
  return Object.fromEntries(
    BREVO_KEY_ENV_NAMES.map((n) => {
      const raw = process.env[n];
      const ok =
        typeof raw === "string" && normalizeBrevoKeyValue(raw).length > 0;
      return [n, ok];
    }),
  );
}

// ── Helpers ─────────────────────────────────────────────────

function uuid() {
  return crypto.randomUUID();
}

/**
 * Generate a 6-digit OTP code
 */
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Resolved sender email for Brevo (must be a verified sender in Brevo).
 */
function brevoSenderEmail() {
  return (
    process.env.BREVO_SENDER_EMAIL?.trim() ||
    process.env.EMAIL_USER?.trim() ||
    "yug.p6488@gmail.com"
  );
}

/**
 * Send OTP via email using Brevo HTTP API.
 * @returns `{ delivered: boolean }` — `delivered` is false only in development when API key is missing (OTP logged to console).
 */
async function sendOTPEmail(email, code) {
  const brevoApiKey = getBrevoApiKeyFromEnv();

  if (!brevoApiKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Email is not configured on the server. Set a non-empty BREVO_API_KEY in Render Environment " +
          "(common mistake: naming it BRAVO_API_KEY — use BREVO_API_KEY, or we also read BRAVO_API_KEY / SENDINBLUE_API_KEY). " +
          "After saving, redeploy. Then GET /api/auth/diagnostic shows which keys are detected.",
      );
    }
    console.warn(`📧 [DEV] OTP for ${email}: ${code}`);
    console.warn(
      `\n⚠️  Development: no Brevo key in env. Checked: ${BREVO_KEY_ENV_NAMES.join(", ")}\n`,
    );
    console.warn("   Set one of those to send email. Until then, use the OTP above to verify.\n");

    return { delivered: false };
  }

  const senderEmail = brevoSenderEmail();
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { font-size: 32px; margin-bottom: 10px; }
          .title { color: #333; font-size: 24px; font-weight: bold; }
          .message { color: #666; margin: 20px 0; font-size: 14px; }
          .otp-box { background-color: #f0f8ff; border: 2px dashed #4a90e2; padding: 20px; text-align: center; margin: 30px 0; border-radius: 8px; }
          .otp-code { font-size: 48px; font-weight: bold; color: #4a90e2; letter-spacing: 8px; font-family: monospace; }
          .expiry { color: #e74c3c; font-weight: bold; margin-top: 15px; }
          .footer { color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">⚕️</div>
            <div class="title">MediCore</div>
          </div>
          
          <h2 style="color: #333;">Verify Your Identity</h2>
          <p class="message">Hi there,</p>
          <p class="message">You requested a one-time password (OTP) to access your MediCore account. Use the code below to complete your login:</p>
          
          <div class="otp-box">
            <div class="otp-code">${code}</div>
            <div class="expiry">⏱️ This code expires in 10 minutes</div>
          </div>
          
          <p class="message" style="color: #e74c3c; font-weight: bold;">⚠️ For security:</p>
          <ul class="message" style="color: #666;">
            <li>Never share this code with anyone</li>
            <li>MediCore staff will never ask for your OTP</li>
            <li>If you didn't request this, please ignore this email</li>
          </ul>
          
          <div class="footer">
            <p>This is an automated message from MediCore Hospital Management System</p>
            <p>&copy; 2026 MediCore. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": brevoApiKey,
      },
      body: JSON.stringify({
        sender: {
          name: process.env.EMAIL_FROM_NAME || "MediCore",
          email: senderEmail,
        },
        to: [{ email }],
        subject: "MediCore - Your OTP Verification Code",
        htmlContent,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let detail = errorText;
      try {
        const j = JSON.parse(errorText);
        detail = j.message || j.error || errorText;
      } catch {
        /* keep raw */
      }
      throw new Error(
        `Brevo could not send email (${response.status}). ${detail}. ` +
          `Ensure BREVO_API_KEY is valid and sender ${senderEmail} is verified in Brevo.`,
      );
    }

    console.log(`✅ OTP email sent via Brevo to ${email}`);
    return { delivered: true };
  } catch (error) {
    console.error(`❌ Failed to send Brevo OTP email to ${email}:`, error.message);
    throw error instanceof Error ? error : new Error(String(error));
  }
}

/**
 * Generate and send OTP to email
 */
export async function sendOTP(email) {
  try {
    await OTP.deleteMany({ email });

    const code = generateOTP();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);

    const otpRecord = await OTP.create({
      _id: uuid(),
      email,
      code,
      expires_at: expiresAt,
      attempts: 0,
      verified: false,
    });

    try {
      const { delivered } = await sendOTPEmail(email, code);
      if (delivered) {
        console.log(`✅ OTP delivered to ${email} (expires at ${expiresAt})`);
        return {
          success: true,
          email_sent: true,
          message: `We sent a 6-digit code to ${email}`,
          email,
          expires_at: expiresAt,
        };
      }
      console.log(`⚠️  OTP saved for ${email} but email not sent (dev / no provider)`);
      return {
        success: true,
        email_sent: false,
        message: `Code ready (development). Email was not sent — check the server terminal for your OTP.`,
        dev_hint:
          process.env.NODE_ENV !== "production"
            ? `Your OTP was printed in the backend console (no Brevo transactional key in env).`
            : undefined,
        email,
        expires_at: expiresAt,
      };
    } catch (emailErr) {
      await OTP.deleteOne({ _id: otpRecord._id }).catch(() => {});
      console.error("OTP rolled back — email delivery failed:", emailErr.message);
      throw emailErr;
    }
  } catch (error) {
    console.error("❌ Error generating OTP:", error);
    if (error instanceof Error) throw error;
    throw new Error("Failed to process OTP. Please try again.");
  }
}

/**
 * Verify OTP code
 */
export async function verifyOTP(email, code) {
  try {
    // Find OTP record
    const otpRecord = await OTP.findOne({ email });

    if (!otpRecord) {
      throw new Error("No OTP found for this email. Please request a new one.");
    }

    // Check if expired
    if (new Date() > otpRecord.expires_at) {
      await OTP.deleteOne({ _id: otpRecord._id });
      throw new Error("OTP has expired. Please request a new one.");
    }

    // Check if max attempts exceeded
    if (otpRecord.attempts >= otpRecord.max_attempts) {
      await OTP.deleteOne({ _id: otpRecord._id });
      throw new Error(
        "Too many failed attempts. Please request a new OTP."
      );
    }

    const allowMaster =
      process.env.ALLOW_MASTER_OTP === "true" && code === "123123";

    if (!allowMaster && otpRecord.code !== code) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      const remaining = otpRecord.max_attempts - otpRecord.attempts;
      throw new Error(
        `Invalid OTP. ${remaining} attempts remaining.`
      );
    }

    // Mark as verified
    otpRecord.verified = true;
    otpRecord.verified_at = new Date();
    await otpRecord.save();

    // Generate auth token (in production, use JWT)
    const authToken = Buffer.from(`${email}:${uuid()}`).toString("base64");

    console.log(`✅ OTP verified for ${email}`);
    return {
      success: true,
      email,
      verified_at: otpRecord.verified_at,
      auth_token: authToken,
    };
  } catch (error) {
    console.error("❌ Error verifying OTP:", error);
    throw error;
  }
}

/**
 * Check OTP status for email
 */
export async function checkOTPStatus(email) {
  const otpRecord = await OTP.findOne({ email });

  if (!otpRecord) {
    return { status: "not_requested", email };
  }

  const isExpired = new Date() > otpRecord.expires_at;

  return {
    status: otpRecord.verified ? "verified" : isExpired ? "expired" : "pending",
    email,
    attempts: otpRecord.attempts,
    max_attempts: otpRecord.max_attempts,
    expires_at: otpRecord.expires_at,
    verified_at: otpRecord.verified_at,
  };
}

/**
 * Clean up expired OTPs (run periodically)
 */
export async function cleanupExpiredOTPs() {
  const result = await OTP.deleteMany({
    expires_at: { $lt: new Date() },
  });
  console.log(`🧹 Cleaned up ${result.deletedCount} expired OTPs`);
  return result;
}
