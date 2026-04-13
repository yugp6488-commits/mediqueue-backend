import mongoose from "mongoose";

const patientSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    full_name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    date_of_birth: { type: String, required: true },
    department_id: { type: String, required: true },
    doctor_id: { type: String, default: null },
    symptoms: { type: String, required: true },
    severity: {
      type: String,
      enum: ["Low", "Moderate", "High"],
      required: true,
    },
    status: {
      type: String,
      enum: ["waiting", "in_progress", "completed"],
      default: "waiting",
    },
    queue_number: { type: Number, required: true },
    check_in_time: { type: Date, default: Date.now },
    travel_distance_km: { type: Number, default: 0, min: 0, max: 200 },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

export default mongoose.model("Patient", patientSchema);
