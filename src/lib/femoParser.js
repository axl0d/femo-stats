import * as XLSX from "xlsx";

// Fixed cell coordinate parser for Ecuador's official FEMO form (AM 00025-2025).
// Coordinates are stable across all instances of the form.

function serialToISO(serial, year, month, day) {
  if (year && month && day) {
    const y = Math.round(year), m = Math.round(month), d = Math.round(day);
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  if (typeof serial === "number" && serial > 0) {
    const date = XLSX.SSF.parse_date_code(serial);
    if (date) return `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
  }
  return null;
}

function cell(sheet, row, col) {
  const c = sheet[XLSX.utils.encode_cell({ r: row, c: col })];
  return c && c.v != null ? c.v : "";
}

export function classifyBMI(bmi) {
  if (bmi == null || isNaN(bmi)) return "No data";
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Normal";
  if (bmi < 30) return "Overweight";
  if (bmi < 35) return "Obesity I";
  if (bmi < 40) return "Obesity II";
  return "Obesity III";
}

export function parseBloodPressure(bp) {
  if (!bp || typeof bp !== "string" || !bp.includes("/")) return null;
  const [sys, dia] = bp.split("/").map((v) => parseInt(v.trim(), 10));
  if (isNaN(sys) || isNaN(dia)) return null;
  return { systolic: sys, diastolic: dia };
}

export function classifyBP(bp) {
  const parsed = parseBloodPressure(bp);
  if (!parsed) return "No data";
  if (parsed.systolic >= 140 || parsed.diastolic >= 90) return "High";
  if (parsed.systolic >= 120 || parsed.diastolic >= 80) return "Borderline";
  return "Normal";
}

export function parseFEMO(workbook, fileName) {
  if (workbook.SheetNames.length < 3) {
    throw new Error("Invalid file: expected at least 3 sheets.");
  }

  const s1 = workbook.Sheets[workbook.SheetNames[0]];
  const s2 = workbook.Sheets[workbook.SheetNames[1]];
  const s3 = workbook.Sheets[workbook.SheetNames[2]];

  // Sheet 1 — worker identity
  const fullName = [
    String(cell(s1, 7, 1)).trim(),
    String(cell(s1, 7, 18)).trim(),
    String(cell(s1, 7, 33)).trim(),
    String(cell(s1, 7, 43)).trim(),
  ].filter(Boolean).join(" ");

  const sex = cell(s1, 12, 20) === "X" ? "M" : cell(s1, 12, 23) === "X" ? "F" : null;
  const birthDate = serialToISO(null, cell(s1, 12, 25), cell(s1, 12, 28), cell(s1, 12, 30));
  const age = cell(s1, 12, 31) || null;
  const bloodType = String(cell(s1, 12, 33)).trim() || null;
  const position = String(cell(s1, 15, 9)).trim() || "Unspecified";

  // Sheet 1 — exam metadata
  const date = serialToISO(cell(s1, 15, 33));

  const examTypeMarks = [
    { col: 25, label: "PERIODICO" },
    { col: 1,  label: "INGRESO" },
    { col: 29, label: "REINTEGRO" },
    { col: 38, label: "RETIRO" },
  ];
  let examType = "UNSPECIFIED";
  for (let r = 17; r <= 19; r++) {
    for (let c = 0; c <= 60; c++) {
      if (String(cell(s1, r, c)).trim() === "X") {
        examType = examTypeMarks.reduce((a, b) =>
          Math.abs(b.col - c) < Math.abs(a.col - c) ? b : a
        ).label;
      }
    }
  }

  // Sheet 1 — vitals (row 54)
  let bmi = parseFloat(cell(s1, 54, 38)) || null;
  const weight = parseFloat(cell(s1, 54, 32)) || null;
  const height = parseFloat(cell(s1, 54, 34)) || null;
  if (!bmi && weight && height) bmi = Math.round((weight / (height * height)) * 10) / 10;

  const smokerNo = cell(s1, 43, 27) === "X";
  const smokerYes = cell(s1, 43, 13) || cell(s1, 43, 6);
  const smoker = smokerNo ? "No" : smokerYes ? "Yes" : "No data";

  // Sheet 2 — occupational risk matrix
  const risks = [];
  let currentCategory = null;
  const activityCols = [6, 8, 10];
  const range = XLSX.utils.decode_range(s2["!ref"] || "A1:A1");

  for (let r = 5; r <= range.e.r; r++) {
    const cat = String(cell(s2, r, 0)).trim();
    if (cat) currentCategory = cat;
    const factor = String(cell(s2, r, 3)).trim();
    if (!factor) continue;
    if (activityCols.some((c) => String(cell(s2, r, c)).trim() === "X")) {
      risks.push({ category: currentCategory || "Uncategorized", factor });
    }
  }

  // Sheet 3 — fitness assessment (row 52)
  let fitness = "No data";
  if (String(cell(s3, 52, 15)).trim() === "X") fitness = "Fit";
  else if (String(cell(s3, 52, 32)).trim() === "X") fitness = "Fit with restrictions";
  else if (String(cell(s3, 52, 46)).trim() === "X") fitness = "Unfit";

  if (!fullName) {
    throw new Error("Could not extract worker name. Verify the file matches the official FEMO format.");
  }

  return {
    sourceFile: fileName,
    worker: { fullName, sex, birthDate, age, bloodType, position },
    exam: {
      date,
      type: examType,
      vitals: {
        temp: parseFloat(cell(s1, 54, 1)) || null,
        bloodPressure: String(cell(s1, 54, 8)).trim() || null,
        heartRate: parseFloat(cell(s1, 54, 15)) || null,
        respiratoryRate: parseFloat(cell(s1, 54, 22)) || null,
        o2Sat: parseFloat(cell(s1, 54, 28)) || null,
        weight,
        height,
        bmi,
        waist: parseFloat(cell(s1, 54, 44)) || null,
      },
      smoker,
    },
    risks,
    fitness,
  };
}

export async function parseFEMOFile(file) {
  const buf = await file.arrayBuffer();
  const workbook = XLSX.read(buf, { type: "array" });
  return parseFEMO(workbook, file.name);
}
