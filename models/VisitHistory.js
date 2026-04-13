import mongoose from "mongoose";

const visitHistorySchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    patient_id: { type: String, required: true },
    doctor_id: { type: String, required: true },
    department_id: { type: String, required: true },
    visit_date: { type: Date, required: true },
    diagnosis: { type: String, default: null },
    prescriptions: { type: [String], default: null },
    notes: { type: String, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

export default mongoose.model("VisitHistory", visitHistorySchema);
