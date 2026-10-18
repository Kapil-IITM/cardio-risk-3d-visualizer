import json, sys
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
import shap
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ---------- Paths ----------
ROOT = Path(__file__).resolve().parent.parent
ML_DIR = ROOT / "ml_pipeline"
MODELS = ML_DIR / "models"
sys.path.insert(0, str(ML_DIR))
import pipeline                                   

TARGETS = ["Cath", "LAD", "LCX", "RCA"]


FEATURE_COLUMNS = joblib.load(MODELS / "feature_columns.pkl")
SCHEMA = json.loads((MODELS / "form_schema.json").read_text())
FIELDS = {f["name"]: f for f in SCHEMA}
MODEL = {t: joblib.load(MODELS / f"model_{t}.pkl") for t in TARGETS}
EXPLAINER = {t: shap.TreeExplainer(joblib.load(MODELS / f"explain_rf_{t}.pkl")) for t in TARGETS}
CV = pd.read_csv(MODELS / "cv_metrics.csv", index_col=0)

NAMES = {"Cath": "Overall CAD", "LAD": "Left Anterior Descending (LAD)",
         "LCX": "Left Circumflex (LCX)", "RCA": "Right Coronary Artery (RCA)"}

def confidence_label(auc):
    
    return "high" if auc >= 0.90 else "moderate" if auc >= 0.80 else "low"

DISCLAIMER = ("Decision support / educational use only. Not a substitute for formal "
              "diagnostic imaging or clinical judgement.")
NOTE = ("Vessel values are model-estimated probability of >=50% stenosis, "
        "not the severity of narrowing.")

# ---------- App ----------
app = FastAPI(title="Cardio Risk API")
app.add_middleware(CORSMiddleware,
                   allow_origins=["http://localhost:5173","http://localhost:5174", "http://localhost:3000"],
                   allow_methods=["*"], allow_headers=["*"])

class PredictRequest(BaseModel):
    patient: dict[str, Any]

def shap_pos(t, X):
    sv = np.array(EXPLAINER[t].shap_values(X))
    if sv.ndim == 3:                               # shap version ke hisaab se shape alag
        sv = sv[..., 1] if sv.shape[-1] == 2 else sv[1]
    return sv

def build_row(patient):
    """Validate + type-cast. Missing fields default se bharte hain."""
    row, defaulted, outside, errors = {}, [], [], []
    for name, f in FIELDS.items():
        if name not in patient or patient[name] in (None, ""):
            row[name] = f["default"]; defaulted.append(name); continue
        v = patient[name]
        if f["type"] in ("choice", "binary"):
            match = [x for x in f["values"] if str(x).lower() == str(v).lower()]
            if not match:
                errors.append(f"{name}: {v!r} allowed nahi. Allowed: {f['values']}"); continue
            row[name] = match[0]                   
        else:
            try:
                v = float(v)
            except (TypeError, ValueError):
                errors.append(f"{name}: number chahiye"); continue
            if not (f["min"] <= v <= f["max"]):
                outside.append(name)               
            row[name] = v
    if errors:
        raise HTTPException(status_code=422, detail=errors)
    return row, defaulted, outside

@app.get("/health")
def health():
    return {"status": "ok", "n_features": len(FEATURE_COLUMNS)}

@app.get("/features")
def features():
    return {"fields": SCHEMA}

@app.post("/predict")
def predict(req: PredictRequest):
    row, defaulted, outside = build_row(req.patient)
    X = pipeline.prepare(pd.DataFrame([row]), FEATURE_COLUMNS)

    out, probs = {}, {}
    for t in TARGETS:
        p = float(MODEL[t].predict_proba(X)[0, 1])
        probs[t] = p
        sv = pd.Series(shap_pos(t, X)[0], index=FEATURE_COLUMNS)
        top = sv.reindex(sv.abs().sort_values(ascending=False).index).head(8)
        auc = float(CV.loc[t, "roc_auc"])
        out[t] = {
            "name": NAMES[t],
            "probability": round(p, 4),
            "cv_auc": round(auc, 3),
            "confidence": confidence_label(auc),
            "top_factors": [
                {"feature": f, "value": float(X.iloc[0][f]), "shap": round(float(v), 4),
                 "direction": "increases risk" if v > 0 else "decreases risk"}
                for f, v in top.items()
            ],
        }

    warnings = []
    if defaulted:
        warnings.append(f"{len(defaulted)} field(s) default value se bhare gaye.")
    if outside:
        warnings.append(f"Training range ke bahar: {outside}. Prediction kam reliable.")
    if max(probs[t] for t in ["LAD", "LCX", "RCA"]) > probs["Cath"] + 0.10:
        warnings.append("Koi vessel probability overall CAD se zyada hai (models alag hain).")

    return {"predictions": out, "defaulted_fields": defaulted, "warnings": warnings,
            "note": NOTE, "disclaimer": DISCLAIMER,
            "shap_note": "SHAP uncalibrated RF par hai, probability calibrated model se. "
                         "Ranking aur direction wahi rehti hai, numbers ka jod probability ke barabar nahi."}