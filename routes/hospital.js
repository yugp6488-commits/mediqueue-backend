// ─────────────────────────────────────────────────────────────
//  routes/hospital.js  —  All /api/hospital/* endpoints
// ─────────────────────────────────────────────────────────────

import { Router } from "express";
import {
  listDepartments,
  createPatient,
  getPatientById,
  updatePatient,
  listQueueSlice,
  listDoctorDashboard,
  updateDoctorAvailability,
  getVisitsForPatient,
  createVisitHistory,
  findLatestPatientByEmail,
  adminDailyRecords,
  adminDoctorAvailability,
  adminDbLogs,
} from "../services/hospital.js";

const router = Router();

// ── Departments ─────────────────────────────────────────────

router.get("/departments", async (_req, res) => {
  try {
    const departments = await listDepartments();
    res.json(departments);
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

// ── Patients ────────────────────────────────────────────────

router.post("/patients", async (req, res) => {
  try {
    const { full_name, email, phone, date_of_birth, department_id, symptoms, severity, status, travel_distance_km } =
      req.body;

    // Basic validation
    if (!full_name || !email || !phone || !date_of_birth || !department_id || !symptoms || !severity) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    if (!["Low", "Moderate", "High"].includes(severity)) {
      return res.status(400).json({ error: "Invalid severity" });
    }

    const patient = await createPatient({
      full_name,
      email,
      phone,
      date_of_birth,
      department_id,
      symptoms,
      severity,
      status,
      travel_distance_km,
    });
    res.status(201).json(patient);
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

router.get("/patients/:id", async (req, res) => {
  try {
    const patient = await getPatientById(req.params.id);
    if (!patient) return res.status(404).json({ error: "Not found" });
    res.json(patient);
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

router.patch("/patients/:id", async (req, res) => {
  try {
    const { severity, status, doctor_id } = req.body;
    const patch = {};
    if (severity !== undefined) patch.severity = severity;
    if (status !== undefined) patch.status = status;
    if (doctor_id !== undefined) patch.doctor_id = doctor_id;

    const patient = await updatePatient(req.params.id, patch);
    if (!patient) return res.status(404).json({ error: "Not found" });
    res.json(patient);
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

// ── Patient Queue ───────────────────────────────────────────

router.get("/patients/:id/queue", async (req, res) => {
  try {
    const patient = await getPatientById(req.params.id);
    if (!patient) return res.status(404).json({ error: "Not found" });
    const queue = await listQueueSlice(patient.department_id);
    res.json({ patient, queue });
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

// ── Doctor Dashboard ────────────────────────────────────────

router.get("/doctor-dashboard", async (_req, res) => {
  try {
    const data = await listDoctorDashboard();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

// ── Doctors ─────────────────────────────────────────────────

router.patch("/doctors/:id", async (req, res) => {
  try {
    const { is_available } = req.body;
    if (typeof is_available !== "boolean") {
      return res.status(400).json({ error: "is_available must be a boolean" });
    }
    const ok = await updateDoctorAvailability(req.params.id, is_available);
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

// ── Visit History ───────────────────────────────────────────

router.get("/visit-history", async (req, res) => {
  try {
    const { patientId } = req.query;
    if (!patientId) return res.status(400).json({ error: "patientId required" });
    const visits = await getVisitsForPatient(patientId);
    res.json(visits);
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

router.post("/visit-history", async (req, res) => {
  try {
    const { patient_id, doctor_id, department_id, visit_date, diagnosis, notes, prescriptions } =
      req.body;
    if (!patient_id || !doctor_id || !department_id) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const visit = await createVisitHistory({
      patient_id,
      doctor_id,
      department_id,
      visit_date: visit_date || new Date().toISOString(),
      diagnosis: diagnosis ?? null,
      notes: notes ?? null,
      prescriptions,
    });
    res.status(201).json(visit);
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

// ── Patient History ─────────────────────────────────────────

router.get("/patient-history", async (req, res) => {
  try {
    const email = req.query.email?.trim().toLowerCase();
    if (!email) return res.status(400).json({ error: "email required" });
    const patient = await findLatestPatientByEmail(email);
    if (!patient) return res.json(null);
    const visits = await getVisitsForPatient(patient.id);
    res.json({ patient, visits });
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

// ── Admin ───────────────────────────────────────────────────

router.get("/admin/daily-records", async (_req, res) => {
  try {
    const data = await adminDailyRecords();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

router.get("/admin/doctor-availability", async (_req, res) => {
  try {
    const data = await adminDoctorAvailability();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

router.get("/admin/db-logs", async (req, res) => {
  try {
    const filter = req.query.filter || "all";
    const data = await adminDbLogs(filter);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message || "Server error" });
  }
});

// ── Authentication (OTP) ────────────────────────────────────

router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, error: "Missing email or OTP" });
    }

    // For the prototype, we are accepting any 6-digit code to let you in
    // In production, you would check this against your database
    if (otp.length === 6) {
      return res.status(200).json({
        success: true,
        message: "OTP Verified successfully!",
        redirectUrl: "/patient"
      });
    } else {
      return res.status(400).json({ success: false, error: "Invalid OTP format" });
    }

  } catch (e) {
    res.status(500).json({ success: false, error: e.message || "Server error" });
  }
});

export default router;
