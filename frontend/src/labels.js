// Display names, units, form groups and demo presets (English only)

export const GROUPS = {
  Demographics: ["Age", "Sex", "BMI"],
  History: ["DM", "HTN", "DLP", "Current Smoker", "EX-Smoker", "FH", "CRF", "CVA",
            "Airway disease", "Thyroid Disease"],
  Symptoms: ["Typical Chest Pain", "Atypical", "Nonanginal", "Dyspnea", "Function Class",
             "BP", "PR", "Edema", "Weak Peripheral Pulse", "Lung rales",
             "Systolic Murmur", "Diastolic Murmur"],
  ECG: ["Q Wave", "St Elevation", "St Depression", "Tinversion", "LVH",
        "Poor R Progression", "BBB"],
  Labs: ["FBS", "CR", "TG", "LDL", "HDL", "BUN", "ESR", "HB", "K", "Na", "WBC",
         "Lymph", "PLT"],
  Echo: ["EF-TTE", "Region RWMA", "VHD"],
};

export const LABELS = {
  Age: "Age", Sex: "Sex", BMI: "Body mass index",
  DM: "Diabetes mellitus", HTN: "Hypertension", DLP: "Dyslipidemia",
  "Current Smoker": "Current smoker", "EX-Smoker": "Ex-smoker",
  FH: "Family history of CAD", CRF: "Chronic renal failure", CVA: "Stroke (CVA)",
  "Airway disease": "Airway disease", "Thyroid Disease": "Thyroid disease",
  "Typical Chest Pain": "Typical chest pain", Atypical: "Atypical chest pain",
  Nonanginal: "Non-anginal chest pain", Dyspnea: "Dyspnea",
  "Function Class": "Functional class (0-3)", BP: "Systolic blood pressure",
  PR: "Pulse rate", Edema: "Edema", "Weak Peripheral Pulse": "Weak peripheral pulse",
  "Lung rales": "Lung rales", "Systolic Murmur": "Systolic murmur",
  "Diastolic Murmur": "Diastolic murmur",
  "Q Wave": "Pathological Q wave", "St Elevation": "ST elevation",
  "St Depression": "ST depression", Tinversion: "T-wave inversion",
  LVH: "Left ventricular hypertrophy", "Poor R Progression": "Poor R-wave progression",
  BBB: "Bundle branch block",
  FBS: "Fasting blood sugar", CR: "Creatinine", TG: "Triglycerides",
  LDL: "LDL cholesterol", HDL: "HDL cholesterol", BUN: "Blood urea nitrogen",
  ESR: "ESR", HB: "Hemoglobin", K: "Potassium", Na: "Sodium", WBC: "White blood cells",
  Lymph: "Lymphocytes", Neut: "Neutrophils", PLT: "Platelets",
  "EF-TTE": "Ejection fraction (echo)", "Region RWMA": "RWMA region code",
  VHD: "Valvular heart disease",
};

// Standard clinical units (confirm against the dataset documentation)
export const UNITS = {
  Age: "years", BMI: "kg/m²", BP: "mmHg", PR: "bpm", FBS: "mg/dL", CR: "mg/dL",
  TG: "mg/dL", LDL: "mg/dL", HDL: "mg/dL", BUN: "mg/dL", ESR: "mm/h", HB: "g/dL",
  K: "mEq/L", Na: "mEq/L", Lymph: "%", "EF-TTE": "%",
};

export const PRESETS = {
  "Low-risk example": {
    Age: 38, "Typical Chest Pain": 0, HTN: 0, DM: 0, "Current Smoker": 0,
    "EF-TTE": 58, "Region RWMA": 0, Tinversion: 0, "St Depression": 0,
    BP: 115, FBS: 85, TG: 100,
  },
  "High-risk example": {
    Age: 68, "Typical Chest Pain": 1, HTN: 1, DM: 1, "EF-TTE": 35,
    "Region RWMA": 3, Tinversion: 1, "St Depression": 1, BP: 150, FBS: 160, TG: 220,
  },
};

export const label = (name) => LABELS[name] || name;

export const prettyFeature = (name) => {
  if (name.startsWith("Region RWMA_")) return `RWMA region ${name.split("_")[1]}`;
  if (name.startsWith("BBB_")) {
    const v = name.split("_")[1];
    return v === "N" ? "No bundle branch block" : `${v} bundle branch block`;
  }
  return label(name);
};

export const fmt = (v) => (Number.isInteger(v) ? String(v) : String(Number(v.toFixed(2))));

const SEVERITY = { N: 0, mild: 1, Moderate: 2, Severe: 3 };

export const orderValues = (name, values) => {
  if (name === "VHD") return [...values].sort((a, b) => SEVERITY[a] - SEVERITY[b]);
  if (name === "BBB") return ["N", "LBBB", "RBBB"].filter((v) => values.includes(v));
  if (values.includes("N") && values.includes("Y")) return ["N", "Y"];
  return values;
};

export const displayChoice = (name, v) => {
  if (v === "Y") return "Yes";
  if (v === "N") return name === "VHD" || name === "BBB" ? "None" : "No";
  if (typeof v === "string") return v.charAt(0).toUpperCase() + v.slice(1);
  return String(v);
};

export const isYesNo = (f) =>
  f.type === "binary" || (f.type === "choice" && f.values.length === 2 &&
    f.values.includes("N") && f.values.includes("Y"));