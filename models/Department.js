import mongoose from "mongoose";

const departmentSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

export default mongoose.model("Department", departmentSchema);
