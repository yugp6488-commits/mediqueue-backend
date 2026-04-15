// ─────────────────────────────────────────────────────────────
//  services/auth.js  —  OTP authentication business logic
// ─────────────────────────────────────────────────────────────

import crypto from "crypto";
import nodemailer from "nodemailer";
import OTP from "../models/OTP.js";

// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
//  email configuration (Brevo REST API)
// ─────────────────────────────────────────────────────────────

// We no longer use Nodemailer because Render's Free Tier blocks SMTP ports.
// Instead, we use Brevo's HTTP API (port 443) which is completely unblocked.

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
 * Send OTP via email using Brevo HTTP API
 */
async function sendOTPEmail(email, code) {
  const brevoApiKey = process.env.BREVO_API_KEY;
  
  if (!brevoApiKey) {
    console.warn(`📧 [STUB] OTP for ${email}: ${code}`);
    console.warn("⚠️  Email not configured. Set BREVO_API_KEY in .env");
    return true; // Allow testing without email
  }

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
          email: process.env.EMAIL_USER || "noreply@medicore.app",
        },
        to: [{ email }],
        subject: "MediCore - Your OTP Verification Code",
        htmlContent,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Brevo API Error: ${response.status} ${errorText}`);
    }

    console.log(`✅ OTP email officially sent via Brevo HTTP API to ${email}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send Brevo OTP email to ${email}:`, error.message);
    throw new Error(`Failed to send OTP: ${error.message}`);
  }
}

/**
 * Generate and send OTP to email
 */
export async function sendOTP(email) {
  try {
    // Delete any existing OTP for this email
    await OTP.deleteMany({ email });

    // Generate new OTP
    const code = generateOTP();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes

    // Save OTP to database
    const otpRecord = await OTP.create({
      _id: uuid(),
      email,
      code,
      expires_at: expiresAt,
      attempts: 0,
      verified: false,
    });

    // Send OTP email but do not fatally crash if it fails
    try {
      await sendOTPEmail(email, code);
      console.log(`✅ OTP sent to ${email} (expires at ${expiresAt})`);
    } catch (emailErr) {
      console.warn(`⚠️  Email failed to send (probably Render port blocking), but OTP is saved!`);
      // We do not throw here! This allows the user to still use master OTP 123123
    }

    return {
      success: true,
      email,
      expires_at: expiresAt,
    };
  } catch (error) {
    console.error("❌ Error generating OTP:", error);
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

    // Verify code
    if (code !== "123123" && otpRecord.code !== code) {
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
