// ─────────────────────────────────────────────────────────────
//  routes/auth.js  —  OTP Authentication endpoints
// ─────────────────────────────────────────────────────────────

import { Router } from "express";
import {
  sendOTP,
  verifyOTP,
  checkOTPStatus,
  hasBrevoCredentials,
  brevoEnvKeyPresence,
} from "../services/auth.js";

const router = Router();

// ── Send OTP to Email ───────────────────────────────────────

router.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Valid email is required" });
    }

    const result = await sendOTP(email.trim().toLowerCase());
    res.status(200).json({
      success: true,
      email_sent: result.email_sent !== false,
      message: result.message || `OTP sent to ${email}`,
      expires_in_minutes: 10,
      ...(result.dev_hint && { dev_hint: result.dev_hint }),
    });
  } catch (e) {
    res.status(500).json({ error: e.message || "Failed to send OTP" });
  }
});

// ── Verify OTP ──────────────────────────────────────────────

router.post("/verify-otp", async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: "Email and code are required" });
    }

    const result = await verifyOTP(email.trim().toLowerCase(), code);
    res.status(200).json({
      success: true,
      message: "OTP verified successfully",
      user_email: email,
      auth_token: result.auth_token,
    });
  } catch (e) {
    res.status(400).json({ error: e.message || "OTP verification failed" });
  }
});

// ── Check OTP Status ────────────────────────────────────────

router.get("/otp-status/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const result = await checkOTPStatus(email.trim().toLowerCase());
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Check API Keys ────────────────────────────────────────

router.get("/diagnostic", (req, res) => {
  const nodeEnv =
    typeof process.env.NODE_ENV === "string" && process.env.NODE_ENV.trim()
      ? process.env.NODE_ENV.trim()
      : "(unset)";
  res.json({
    status: "ok",
    environment: nodeEnv,
    hasBrevoKey: hasBrevoCredentials(),
    brevo_key_env_presence: brevoEnvKeyPresence(),
    senderEmailConfigured: !!(
      process.env.BREVO_SENDER_EMAIL?.trim() || process.env.EMAIL_USER?.trim()
    ),
  });
});

export default router;
