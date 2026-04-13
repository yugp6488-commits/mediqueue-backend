// ─────────────────────────────────────────────────────────────
//  routes/auth.js  —  OTP Authentication endpoints
// ─────────────────────────────────────────────────────────────

import { Router } from "express";
import { sendOTP, verifyOTP } from "../services/auth.js";

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
      message: `OTP sent to ${email}`,
      expires_in_minutes: 10,
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

export default router;
