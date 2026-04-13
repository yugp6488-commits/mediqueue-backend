import mongoose from "mongoose";

const otpSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, index: true },
    code: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    max_attempts: { type: Number, default: 5 },
    expires_at: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
    verified: { type: Boolean, default: false },
    verified_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

export default mongoose.model("OTP", otpSchema);
