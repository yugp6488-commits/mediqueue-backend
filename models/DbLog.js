import mongoose from "mongoose";

const dbLogSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    operation: {
      type: String,
      enum: ["INSERT", "UPDATE", "SELECT", "DELETE", "ALERT"],
      required: true,
    },
    table_name: { type: String, required: true },
    record_id: { type: String, default: null },
    details: { type: String, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

export default mongoose.model("DbLog", dbLogSchema);
