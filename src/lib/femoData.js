import { supabase } from "./supabaseClient";

export async function listCompanies() {
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function createCompany({ name, taxId, industryCode }) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;

  const { data, error } = await supabase
    .from("companies")
    .insert({ doctor_id: userData.user.id, name, tax_id: taxId || null, industry_code: industryCode || null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Persists a parsed FEMO record: upserts the worker, then inserts the exam and its risk factors.
export async function saveFEMORecord(companyId, parsed) {
  const { worker, exam, risks } = parsed;

  // Match by full name — replace with national ID once that field is confirmed in the form.
  const { data: existing, error: findError } = await supabase
    .from("workers")
    .select("id")
    .eq("company_id", companyId)
    .eq("full_name", worker.fullName)
    .limit(1);
  if (findError) throw findError;

  let workerId;
  if (existing && existing.length > 0) {
    workerId = existing[0].id;
    const { error } = await supabase
      .from("workers")
      .update({
        sex: worker.sex,
        birth_date: worker.birthDate,
        age: worker.age,
        blood_type: worker.bloodType,
        position: worker.position,
      })
      .eq("id", workerId);
    if (error) throw error;
  } else {
    const { data: newWorker, error } = await supabase
      .from("workers")
      .insert({
        company_id: companyId,
        full_name: worker.fullName,
        sex: worker.sex,
        birth_date: worker.birthDate,
        age: worker.age,
        blood_type: worker.bloodType,
        position: worker.position,
      })
      .select()
      .single();
    if (error) throw error;
    workerId = newWorker.id;
  }

  const { data: newExam, error: examError } = await supabase
    .from("exams")
    .insert({
      worker_id: workerId,
      exam_date: exam.date,
      exam_type: exam.type,
      source_file: parsed.sourceFile,
      temperature: exam.vitals.temp,
      blood_pressure: exam.vitals.bloodPressure,
      heart_rate: exam.vitals.heartRate,
      respiratory_rate: exam.vitals.respiratoryRate,
      o2_saturation: exam.vitals.o2Sat,
      weight_kg: exam.vitals.weight,
      height_m: exam.vitals.height,
      bmi: exam.vitals.bmi,
      waist_cm: exam.vitals.waist,
      smoker: exam.smoker,
      fitness: parsed.fitness,
    })
    .select()
    .single();
  if (examError) throw examError;

  if (risks && risks.length > 0) {
    const rows = risks.map((r) => ({ exam_id: newExam.id, category: r.category, factor: r.factor }));
    const { error } = await supabase.from("risk_factors").insert(rows);
    if (error) throw error;
  }

  return { workerId, examId: newExam.id };
}

export async function getDashboardData(companyId) {
  const { data: workers, error } = await supabase
    .from("workers")
    .select(`
      id, full_name, sex, birth_date, age, blood_type, position,
      exams (
        id, exam_date, exam_type, bmi, blood_pressure, smoker, fitness,
        risk_factors ( category, factor )
      )
    `)
    .eq("company_id", companyId);
  if (error) throw error;

  return workers.map((w) => {
    const sorted = (w.exams || []).sort(
      (a, b) => new Date(b.exam_date || 0) - new Date(a.exam_date || 0)
    );
    return { ...w, latestExam: sorted[0] || null, totalExams: sorted.length };
  });
}
