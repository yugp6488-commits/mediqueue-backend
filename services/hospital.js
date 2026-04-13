// ─────────────────────────────────────────────────────────────
//  services/hospital.js  —  Hospital business-logic layer
//  Direct port of lib/server/hospital/repository.ts
// ─────────────────────────────────────────────────────────────

import crypto from "crypto";
import Department from "../models/Department.js";
import Doctor from "../models/Doctor.js";
import Patient from "../models/Patient.js";
import VisitHistory from "../models/VisitHistory.js";
import DbLog from "../models/DbLog.js";

// ── Helpers ─────────────────────────────────────────────────

function uuid() {
  return crypto.randomUUID();
}

function utcDayBounds() {
  const dayStr = new Date().toISOString().split("T")[0];
  const [y, m, d] = dayStr.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0, 0));
  return { start, end, dayStr };
}

function severityRank(s) {
  if (s === "High") return 3;
  if (s === "Moderate") return 2;
  return 1;
}

/** Convert Mongoose doc → plain object with `id` instead of `_id` */
function toApi(doc) {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  obj.id = String(obj._id);
  delete obj._id;
  delete obj.__v;
  return JSON.parse(JSON.stringify(obj));
}

async function appendLog(operation, table_name, record_id, details) {
  await DbLog.create({
    _id: uuid(),
    operation,
    table_name,
    record_id,
    details,
  });
}

// ── Seed ────────────────────────────────────────────────────

let _seeded = false;

export async function seedIfEmpty() {
  if (_seeded) return;
  const count = await Department.estimatedDocumentCount();
  if (count > 0) {
    _seeded = true;
    return;
  }

  const deptNames = [
    "General Medicine",
    "Emergency",
    "Pediatrics",
    "Cardiology",
    "Orthopedics",
    "Neurology",
    "Dermatology",
  ];

  const deptIds = {};
  for (const name of deptNames) {
    const id = uuid();
    deptIds[name] = id;
    await Department.create({ _id: id, name, description: null });
  }

  const doctors = [
    { name: "Sarah Chen", specialty: "General Practitioner", dept: "General Medicine", color: "emerald", available: true },
    { name: "James Wilson", specialty: "Emergency Medicine", dept: "Emergency", color: "rose", available: true },
    { name: "Emily Rodriguez", specialty: "Pediatrician", dept: "Pediatrics", color: "amber", available: true },
    { name: "Michael Park", specialty: "Cardiologist", dept: "Cardiology", color: "sky", available: true },
    { name: "Lisa Thompson", specialty: "Orthopedic Surgeon", dept: "Orthopedics", color: "violet", available: false },
  ];

  for (const dr of doctors) {
    await Doctor.create({
      _id: uuid(),
      name: dr.name,
      specialty: dr.specialty,
      department_id: deptIds[dr.dept],
      avatar_color: dr.color,
      is_available: dr.available,
    });
  }

  await appendLog("INSERT", "departments", null, "Seeded default departments");
  await appendLog("INSERT", "doctors", null, "Seeded default doctors");
  _seeded = true;
}

// ── Departments ─────────────────────────────────────────────

export async function listDepartments() {
  await seedIfEmpty();
  const rows = await Department.find().sort({ name: 1 }).lean();
  return rows.map((r) => ({ id: String(r._id), name: r.name, description: r.description }));
}

// ── Doctors ─────────────────────────────────────────────────

export async function listDoctorsWithDepartments() {
  await seedIfEmpty();
  const [depts, docs] = await Promise.all([
    Department.find().lean(),
    Doctor.find().sort({ name: 1 }).lean(),
  ]);

  const deptMap = new Map(depts.map((d) => [String(d._id), { id: String(d._id), name: d.name, description: d.description }]));

  return docs.map((raw) => ({
    id: String(raw._id),
    name: raw.name,
    specialty: raw.specialty,
    department_id: raw.department_id,
    is_available: raw.is_available,
    avatar_color: raw.avatar_color,
    department: deptMap.get(raw.department_id) || undefined,
  }));
}

export async function updateDoctorAvailability(id, is_available) {
  const res = await Doctor.updateOne({ _id: id }, { $set: { is_available } });
  if (res.matchedCount) {
    await appendLog("UPDATE", "doctors", id, `is_available=${is_available}`);
  }
  return res.matchedCount > 0;
}

// ── Patients ────────────────────────────────────────────────

async function nextQueueNumber() {
  const { start, end } = utcDayBounds();
  const count = await Patient.countDocuments({
    check_in_time: { $gte: start, $lt: end },
  });
  return count + 1;
}

async function getDepartmentById(id) {
  const raw = await Department.findById(id).lean();
  if (!raw) return null;
  return { id: String(raw._id), name: raw.name, description: raw.description };
}

async function getDoctorById(id) {
  const raw = await Doctor.findById(id).lean();
  if (!raw) return null;
  const department = await getDepartmentById(raw.department_id);
  return {
    id: String(raw._id),
    name: raw.name,
    specialty: raw.specialty,
    department_id: raw.department_id,
    avatar_color: raw.avatar_color,
    is_available: raw.is_available,
    department: department || undefined,
  };
}

export async function getPatientById(id) {
  const raw = await Patient.findById(id).lean();
  if (!raw) return null;
  const [department, doctor] = await Promise.all([
    getDepartmentById(raw.department_id),
    raw.doctor_id ? getDoctorById(raw.doctor_id) : Promise.resolve(null),
  ]);
  return {
    id: String(raw._id),
    full_name: raw.full_name,
    email: raw.email,
    phone: raw.phone,
    date_of_birth: raw.date_of_birth,
    department_id: raw.department_id,
    doctor_id: raw.doctor_id || null,
    symptoms: raw.symptoms,
    severity: raw.severity,
    status: raw.status,
    queue_number: raw.queue_number,
    check_in_time: raw.check_in_time,
    created_at: raw.created_at,
    travel_distance_km: raw.travel_distance_km || 0,
    department: department || undefined,
    doctor: doctor || undefined,
  };
}

export async function createPatient(input) {
  await seedIfEmpty();
  const id = uuid();
  const now = new Date();
  const queue_number = await nextQueueNumber();

  await Patient.create({
    _id: id,
    full_name: input.full_name,
    email: input.email.trim().toLowerCase(),
    phone: input.phone,
    date_of_birth: input.date_of_birth,
    department_id: input.department_id,
    doctor_id: null,
    symptoms: input.symptoms,
    severity: input.severity,
    status: input.status || "waiting",
    queue_number,
    check_in_time: now,
    travel_distance_km: input.travel_distance_km || 0,
  });

  await appendLog("INSERT", "patients", id, "Patient check-in");
  return getPatientById(id);
}

export async function updatePatient(id, patch) {
  const $set = {};
  if (patch.severity !== undefined) $set.severity = patch.severity;
  if (patch.status !== undefined) $set.status = patch.status;
  if (patch.doctor_id !== undefined) $set.doctor_id = patch.doctor_id;
  if (Object.keys($set).length === 0) return getPatientById(id);

  const res = await Patient.updateOne({ _id: id }, { $set });
  if (!res.matchedCount) return null;
  await appendLog("UPDATE", "patients", id, JSON.stringify(Object.keys($set)));
  return getPatientById(id);
}

// ── Queue ───────────────────────────────────────────────────

/**
 * Calculate queue position factoring in:
 * 1. Severity level (High > Moderate > Low)
 * 2. Travel distance (rural patients >30km with High urgency get priority)
 * 3. Check-in time (earlier = higher priority within same severity)
 */
function calculateQueuePriority(patient) {
  const severityScore = severityRank(patient.severity);
  const isRural = (patient.travel_distance_km || 0) > 30;
  
  // For High urgency rural patients, add 0.5 to severity score
  // This keeps them below pure High urgency but above Moderate
  let adjustedScore = severityScore;
  if (patient.severity === "High" && isRural) {
    adjustedScore = 3.5; // Between High (3) and Moderate (2) but closer to High
  }
  
  return {
    severityScore: adjustedScore,
    checkInTime: new Date(patient.check_in_time).getTime(),
    isRural,
  };
}

export async function listQueueSlice(departmentId) {
  const rows = await Patient.find({
    department_id: departmentId,
    status: { $in: ["waiting", "in_progress"] },
  }).lean();

  // Calculate priority for each patient and sort
  const withPriority = rows.map((patient) => ({
    ...patient,
    priority: calculateQueuePriority(patient),
  }));

  const sorted = [...withPriority].sort((a, b) => {
    // Primary sort: severity score (higher first)
    if (b.priority.severityScore !== a.priority.severityScore) {
      return b.priority.severityScore - a.priority.severityScore;
    }
    
    // Secondary sort: check-in time (earlier first)
    return a.priority.checkInTime - b.priority.checkInTime;
  });

  // Return queue with calculated position index
  return sorted.map((raw, position) => ({
    id: String(raw._id),
    full_name: raw.full_name,
    queue_number: raw.queue_number,
    status: raw.status,
    severity: raw.severity,
    check_in_time: raw.check_in_time,
    travel_distance_km: raw.travel_distance_km || 0,
    queue_position: position + 1,
  }));
}

// ── Doctor Dashboard ────────────────────────────────────────

export async function listDoctorDashboard() {
  await seedIfEmpty();
  const { start, end } = utcDayBounds();

  const [queuePatients, totalToday, completedToday, waitingNow, inProgress, availableDoctors] =
    await Promise.all([
      Patient.find({ status: { $in: ["waiting", "in_progress"] } }).lean(),
      Patient.countDocuments({ check_in_time: { $gte: start, $lt: end } }),
      Patient.countDocuments({ check_in_time: { $gte: start, $lt: end }, status: "completed" }),
      Patient.countDocuments({ status: "waiting" }),
      Patient.countDocuments({ status: "in_progress" }),
      Doctor.find({ is_available: true }).lean(),
    ]);

  const depts = await Department.find().lean();
  const deptMap = new Map(depts.map((d) => [String(d._id), { id: String(d._id), name: d.name, description: d.description }]));

  const allDocs = await Doctor.find().lean();
  const docMap = new Map(
    allDocs.map((d) => [
      String(d._id),
      {
        id: String(d._id),
        name: d.name,
        specialty: d.specialty,
        department_id: d.department_id,
        is_available: d.is_available,
        avatar_color: d.avatar_color,
      },
    ])
  );

  const sorted = [...queuePatients].map((patient) => ({
    ...patient,
    priority: calculateQueuePriority(patient),
  })).sort((a, b) => {
    // Primary sort: severity score (higher first)
    if (b.priority.severityScore !== a.priority.severityScore) {
      return b.priority.severityScore - a.priority.severityScore;
    }
    
    // Secondary sort: check-in time (earlier first)
    return a.priority.checkInTime - b.priority.checkInTime;
  });

  const patients = sorted.map((raw) => {
    const dept = deptMap.get(raw.department_id);
    const drDoc = raw.doctor_id ? docMap.get(raw.doctor_id) : undefined;
    return {
      id: String(raw._id),
      full_name: raw.full_name,
      email: raw.email,
      phone: raw.phone,
      date_of_birth: raw.date_of_birth,
      department_id: raw.department_id,
      doctor_id: raw.doctor_id || null,
      symptoms: raw.symptoms,
      severity: raw.severity,
      status: raw.status,
      queue_number: raw.queue_number,
      check_in_time: raw.check_in_time,
      created_at: raw.created_at,
      travel_distance_km: raw.travel_distance_km || 0,
      department: dept || undefined,
      doctor: drDoc || undefined,
    };
  });

  const doctorList = availableDoctors.map((raw) => {
    const dept = deptMap.get(raw.department_id);
    return {
      id: String(raw._id),
      name: raw.name,
      specialty: raw.specialty,
      department_id: raw.department_id,
      is_available: raw.is_available,
      avatar_color: raw.avatar_color,
      department: dept || undefined,
    };
  });

  return {
    patients,
    doctors: doctorList,
    metrics: { totalToday, completedToday, waitingNow, inProgress },
  };
}

// ── Visit History ───────────────────────────────────────────

export async function createVisitHistory(input) {
  const id = uuid();
  await VisitHistory.create({
    _id: id,
    patient_id: input.patient_id,
    doctor_id: input.doctor_id,
    department_id: input.department_id,
    visit_date: new Date(input.visit_date),
    diagnosis: input.diagnosis,
    prescriptions: input.prescriptions || null,
    notes: input.notes,
  });
  await appendLog("INSERT", "visit_history", id, "Visit completed");
  const visits = await getVisitsForPatient(input.patient_id);
  const created = visits.find((v) => v.id === id);
  if (!created) throw new Error("Visit record could not be reloaded");
  return created;
}

export async function getVisitsForPatient(patientId) {
  const rows = await VisitHistory.find({ patient_id: patientId })
    .sort({ visit_date: -1 })
    .lean();

  const [doctors, depts] = await Promise.all([listDoctorsWithDepartments(), listDepartments()]);
  const docMap = new Map(doctors.map((d) => [d.id, d]));
  const deptMap = new Map(depts.map((d) => [d.id, d]));

  return rows.map((raw) => ({
    id: String(raw._id),
    patient_id: raw.patient_id,
    doctor_id: raw.doctor_id,
    department_id: raw.department_id,
    visit_date: raw.visit_date,
    diagnosis: raw.diagnosis,
    prescriptions: raw.prescriptions,
    notes: raw.notes,
    doctor: docMap.get(raw.doctor_id) || undefined,
    department: deptMap.get(raw.department_id) || undefined,
  }));
}

// ── Patient History ─────────────────────────────────────────

export async function findLatestPatientByEmail(email) {
  const rows = await Patient.find({ email: email.trim().toLowerCase() })
    .sort({ created_at: -1 })
    .limit(1)
    .lean();
  if (!rows.length) return null;
  return getPatientById(String(rows[0]._id));
}

// ── Admin ───────────────────────────────────────────────────

export async function adminDailyRecords() {
  await seedIfEmpty();
  const { start, end } = utcDayBounds();
  const [departments, patientRows] = await Promise.all([
    listDepartments(),
    Patient.find({ check_in_time: { $gte: start, $lt: end } })
      .sort({ check_in_time: -1 })
      .lean(),
  ]);

  const deptMap = new Map(departments.map((d) => [d.id, d]));

  const patients = patientRows.map((raw) => {
    const dept = deptMap.get(raw.department_id);
    return {
      id: String(raw._id),
      full_name: raw.full_name,
      email: raw.email,
      phone: raw.phone,
      date_of_birth: raw.date_of_birth,
      department_id: raw.department_id,
      doctor_id: raw.doctor_id || null,
      symptoms: raw.symptoms,
      severity: raw.severity,
      status: raw.status,
      queue_number: raw.queue_number,
      check_in_time: raw.check_in_time,
      created_at: raw.created_at,
      department: dept || undefined,
    };
  });

  const departmentStats = departments.map((dept) => {
    const deptPatients = patients.filter((p) => p.department_id === dept.id);
    return {
      department_id: dept.id,
      department_name: dept.name,
      total_patients: deptPatients.length,
      waiting: deptPatients.filter((p) => p.status === "waiting").length,
      in_progress: deptPatients.filter((p) => p.status === "in_progress").length,
      completed: deptPatients.filter((p) => p.status === "completed").length,
    };
  });

  const metrics = {
    totalPatients: patients.length,
    waiting: patients.filter((p) => p.status === "waiting").length,
    inProgress: patients.filter((p) => p.status === "in_progress").length,
    completed: patients.filter((p) => p.status === "completed").length,
  };

  return { departmentStats, patients, metrics };
}

export async function adminDoctorAvailability() {
  await seedIfEmpty();
  const doctors = await listDoctorsWithDepartments();
  const { start, end } = utcDayBounds();

  const patientRows = await Patient.find({ check_in_time: { $gte: start, $lt: end } })
    .select("doctor_id status")
    .lean();

  const doctorStats = doctors.map((doc) => {
    const docPatients = patientRows.filter((p) => p.doctor_id === doc.id);
    return {
      doctor_id: doc.id,
      doctor_name: doc.name,
      specialty: doc.specialty,
      is_available: doc.is_available,
      seen_today: docPatients.filter((p) => p.status === "completed").length,
      in_queue: docPatients.filter((p) => p.status === "waiting" || p.status === "in_progress").length,
    };
  });

  const metrics = {
    availableCount: doctors.filter((d) => d.is_available).length,
    unavailableCount: doctors.filter((d) => !d.is_available).length,
    totalSeen: doctorStats.reduce((s, d) => s + d.seen_today, 0),
    totalQueue: doctorStats.reduce((s, d) => s + d.in_queue, 0),
  };

  return { doctors, doctorStats, metrics };
}

export async function adminDbLogs(filter) {
  const q = filter === "all" ? {} : { operation: filter };

  const [logs, insert, update, select, alert] = await Promise.all([
    DbLog.find(q).sort({ created_at: -1 }).limit(100).lean(),
    DbLog.countDocuments({ operation: "INSERT" }),
    DbLog.countDocuments({ operation: "UPDATE" }),
    DbLog.countDocuments({ operation: "SELECT" }),
    DbLog.countDocuments({ operation: "ALERT" }),
  ]);

  const mapped = logs.map((raw) => ({
    id: String(raw._id),
    operation: raw.operation,
    table_name: raw.table_name,
    record_id: raw.record_id || null,
    details: raw.details || null,
    created_at: raw.created_at,
  }));

  return {
    logs: mapped,
    counts: { insert, update, select, alert },
    stats: {
      storageUsed: "MongoDB Atlas",
      storageFree: "—",
      activeSessions: 0,
      queryCount: insert + update + select,
    },
  };
}
