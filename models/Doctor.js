import mongoose from "mongoose";

const doctorSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true },
    specialty: { type: String, required: true },
    department_id: { type: String, required: true },
    is_available: { type: Boolean, default: true },
    avatar_color: { type: String, default: "emerald" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

export default mongoose.model("Doctor", doctorSchema);
