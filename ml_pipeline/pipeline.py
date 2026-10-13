import numpy as np
import pandas as pd

YN_COLS = ["Obesity","CRF","CVA","Airway disease","Thyroid Disease","CHF","DLP",
           "Weak Peripheral Pulse","Lung rales","Systolic Murmur","Diastolic Murmur",
           "Dyspnea","Atypical","Nonanginal","LowTH Ang","LVH","Poor R Progression"]
TARGETS = ["Cath", "LAD", "LCX", "RCA"]
DROP_COLS = TARGETS + ["Exertional CP", "Weight", "Length"]
EXTRA_DROPS = ["Obesity", "Neut", "CHF", "LowTH Ang"]

def preprocess(data):
    X = data.drop(columns=[c for c in DROP_COLS if c in data.columns]).copy()
    X["Sex"] = X["Sex"].map({"Male": 1, "Female": 0})
    for c in YN_COLS:
        X[c] = X[c].map({"Y": 1, "N": 0})
    X["VHD"] = X["VHD"].str.lower().map({"n": 0, "mild": 1, "moderate": 2, "severe": 3})
    X["BBB"] = pd.Categorical(X["BBB"], categories=["N", "LBBB", "RBBB"])
    X["Region RWMA"] = pd.Categorical(X["Region RWMA"], categories=[0, 1, 2, 3, 4])
    X = pd.get_dummies(X, columns=["BBB", "Region RWMA"], dtype=int)
    assert X.isnull().sum().sum() == 0, "Mapping mein spelling mismatch"
    return X

def prepare(data, feature_columns):
    data = data.copy()
    for c in ["Obesity", "CHF", "LowTH Ang"]:     # model mein nahi hain, form mein bhi nahi
        if c not in data.columns:
            data[c] = "N"
    X = preprocess(data)
    X = X.drop(columns=[c for c in EXTRA_DROPS if c in X.columns])
    return X.reindex(columns=feature_columns, fill_value=0)