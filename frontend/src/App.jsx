import { useEffect, useRef, useState } from "react";
import { getFeatures, predict } from "./api";
import Heart3D, { probColor } from "./Heart3D";
import { GROUPS, UNITS, PRESETS, label, prettyFeature, fmt,
         orderValues, displayChoice, isYesNo } from "./labels";

const VESSELS = ["LAD", "LCX", "RCA"];
const SHORT = { LAD: "Left Anterior Descending", LCX: "Left Circumflex", RCA: "Right Coronary Artery" };

const riskLevel = (p) => (p < 0.3 ? "Low" : p < 0.6 ? "Moderate" : "High");

/* ---------- form fields ---------- */
function Field({ f, value, onChange }) {
  const unit = UNITS[f.name];

  if (isYesNo(f)) {
    const yes = f.type === "binary" ? 1 : "Y";
    const no = f.type === "binary" ? 0 : "N";
    return (
      <div className="seg">
        <button type="button" className={value === no ? "on" : ""} onClick={() => onChange(no)}>No</button>
        <button type="button" className={value === yes ? "on yes" : ""} onClick={() => onChange(yes)}>Yes</button>
      </div>
    );
  }

  if (f.type === "number") {
    return (
      <div>
        <div className="num">
          <input type="number" step="any" value={value ?? ""}
                 onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} />
          {unit && <span className="unit">{unit}</span>}
        </div>
        <div className="range">range {Number(f.min.toFixed(1))} to {Number(f.max.toFixed(1))}</div>
      </div>
    );
  }

  return (
    <select value={value ?? ""}
            onChange={(e) => onChange(typeof f.values[0] === "number" ? Number(e.target.value) : e.target.value)}>
      {orderValues(f.name, f.values).map((v) => (
        <option key={v} value={v}>
          {f.name === "Region RWMA" ? `Region ${v}` : displayChoice(f.name, v)}
        </option>
      ))}
    </select>
  );
}

function PatientForm({ fields, patient, setPatient, defaults }) {
  const byName = Object.fromEntries(fields.map((f) => [f.name, f]));
  const listed = Object.values(GROUPS).flat();
  const tabs = { ...GROUPS };
  const other = fields.map((f) => f.name).filter((n) => !listed.includes(n));
  if (other.length) tabs.Other = other;

  const [tab, setTab] = useState("Demographics");
  const names = (tabs[tab] || []).filter((n) => byName[n]);

  return (
    <section className="card form-card">
      <div className="card-title">Patient data</div>

      <div className="presets">
        <span className="muted small">Demo presets (synthetic, not real patients)</span>
        <div className="preset-row">
          {Object.entries(PRESETS).map(([name, vals]) => (
            <button key={name} type="button" className="chip"
                    onClick={() => setPatient({ ...defaults, ...vals })}>{name}</button>
          ))}
          <button type="button" className="chip ghost" onClick={() => setPatient({ ...defaults })}>Reset</button>
        </div>
      </div>

      <div className="tabs">
        {Object.keys(tabs).map((t) => (
          <button key={t} type="button" className={`tab ${t === tab ? "active" : ""}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      <div className="fields">
        {names.map((n) => (
          <label key={n} className="field">
            <span className="field-label">{label(n)}</span>
            <Field f={byName[n]} value={patient[n]}
                   onChange={(v) => setPatient((p) => ({ ...p, [n]: v }))} />
          </label>
        ))}
      </div>
    </section>
  );
}

/* ---------- results ---------- */
function ConfidencePill({ r }) {
  return <span className={`pill conf-${r.confidence}`}>{r.confidence} confidence · AUC {r.cv_auc}</span>;
}

function OverallCard({ r }) {
  const p = r.probability;
  const likely = p >= 0.5;
  const C = 2 * Math.PI * 52;
  return (
    <section className="card overall">
      <div className="card-title">Overall CAD</div>
      <div className="overall-body">
        <svg width="130" height="130" viewBox="0 0 130 130">
          <circle cx="65" cy="65" r="52" fill="none" stroke="rgba(148,163,184,.18)" strokeWidth="12" />
          <circle cx="65" cy="65" r="52" fill="none" stroke={probColor(p)} strokeWidth="12"
                  strokeLinecap="round" strokeDasharray={`${p * C} ${C}`} transform="rotate(-90 65 65)" />
          <text x="65" y="72" textAnchor="middle" className="gauge-text">{(p * 100).toFixed(0)}%</text>
        </svg>
        <div>
          <div className="status" style={{ color: probColor(p) }}>
            {likely ? "CAD likely" : "CAD unlikely"}
          </div>
          <div className="muted small">Model probability {likely ? "≥" : "<"} 50%</div>
          <div className="pill-row">
            <span className="pill" style={{ borderColor: probColor(p), color: probColor(p) }}>
              {riskLevel(p)} risk band
            </span>
            <ConfidencePill r={r} />
          </div>
        </div>
      </div>
    </section>
  );
}

function VesselCard({ id, r, selected, onClick }) {
  const p = r.probability;
  return (
    <button type="button" className={`card vessel ${selected ? "selected" : ""}`} onClick={onClick}
            style={{ "--c": probColor(p) }}>
      <div className="vessel-head">
        <div>
          <b>{id}</b> <span className="muted small">{SHORT[id]}</span>
        </div>
        <div className="vessel-pct" style={{ color: probColor(p) }}>{(p * 100).toFixed(0)}%</div>
      </div>
      <div className="bar"><div style={{ width: `${p * 100}%`, background: probColor(p) }} /></div>
      <ConfidencePill r={r} />
    </button>
  );
}

function Contributions({ id, r }) {
  const max = Math.max(...r.top_factors.map((t) => Math.abs(t.shap)));
  return (
    <section className="card">
      <div className="card-title">
        Why {(r.probability * 100).toFixed(0)}% for {id}?
        <span className="muted small"> top contributing factors (SHAP)</span>
      </div>
      <div className="axis-labels"><span>◀ lowers risk</span><span>raises risk ▶</span></div>
      {r.top_factors.map((t) => {
        const w = (Math.abs(t.shap) / max) * 50;
        const up = t.shap > 0;
        return (
          <div key={t.feature} className="contrib">
            <div className="contrib-name">
              {prettyFeature(t.feature)} <span className="muted">= {fmt(t.value)}</span>
            </div>
            <div className="track">
              <div className="mid" />
              <div className={`fill ${up ? "up" : "down"}`}
                   style={up ? { left: "50%", width: `${w}%` } : { left: `${50 - w}%`, width: `${w}%` }} />
            </div>
            <div className="contrib-val">{up ? "+" : ""}{t.shap.toFixed(3)}</div>
          </div>
        );
      })}
      <p className="muted small note">
        SHAP is computed on an uncalibrated random forest, so values show direction and ranking,
        not exact percentage points.
      </p>
    </section>
  );
}

/* ---------- app ---------- */
export default function App() {
  const [fields, setFields] = useState([]);
  const [defaults, setDefaults] = useState({});
  const [patient, setPatient] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState("LAD");
  const reqId = useRef(0);

    useEffect(() => {
    let cancelled = false;
    const load = (attempt = 1) => {
      getFeatures()
        .then((d) => {
          if (cancelled) return;
          const def = Object.fromEntries(d.fields.map((f) => [
            f.name, f.type === "number" ? Number(Number(f.default).toFixed(2)) : f.default,
          ]));
          setFields(d.fields); setDefaults(def); setPatient(def); setError(null);
        })
        .catch(() => {
          if (cancelled) return;
          if (attempt < 12) {
            setError("Waking up the server. The first load can take about a minute...");
            setTimeout(() => load(attempt + 1), 5000);
          } else {
            setError("Cannot reach the server. Please try again later.");
          }
        });
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // Re-predict 400 ms after the last change
  useEffect(() => {
    if (!fields.length) return;
    const my = ++reqId.current;
    const t = setTimeout(() => {
      setBusy(true);
      predict(patient)
        .then((r) => { if (my === reqId.current) { setResult(r); setError(null); } })
        .catch((e) => { if (my === reqId.current) setError(JSON.stringify(e.detail ?? e)); })
        .finally(() => { if (my === reqId.current) setBusy(false); });
    }, 800);
    return () => clearTimeout(t);
  }, [patient, fields]);

  const P = result?.predictions;

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <div className="logo">♥</div>
          <div>
            <h1>CardioRisk 3D</h1>
            <div className="muted small">Coronary artery disease risk and vessel-level stenosis prediction</div>
          </div>
        </div>
        <div className={`status-dot ${busy ? "busy" : "ok"}`}>{busy ? "Updating..." : "Live"}</div>
      </header>

      <div className="disclaimer" role="alert">
        <b>⚠ Clinical safety notice:</b>{" "}
        {result?.disclaimer ?? "Decision support / educational use only. Not a substitute for formal diagnostic imaging or clinical judgement."}
      </div>

      {error && <div className="error">{error}</div>}

      <main className="layout">
        <div className="col-form">
          {fields.length > 0 && (
            <PatientForm fields={fields} patient={patient} setPatient={setPatient} defaults={defaults} />
          )}
        </div>

        <div className="col-center">
          <section className="card heart-card">
            <div className="card-title">Interactive coronary map</div>
            {P ? (
              <Heart3D
                probs={{ LAD: P.LAD.probability, LCX: P.LCX.probability, RCA: P.RCA.probability }}
                selected={sel}
                onSelect={setSel}
              />
            ) : (
              <div className="heart-wrap center muted">Waiting for first prediction...</div>
            )}
          </section>
          {P && sel && <Contributions id={sel} r={P[sel]} />}
          {P && !sel && (
            <section className="card muted">Select a vessel on the heart or in the list to see why the model gave that risk.</section>
          )}
        </div>

        <aside className="col-summary">
          {P && (
            <>
              <OverallCard r={P.Cath} />
              <div className="card-title plain">Vessel-level stenosis probability</div>
              {VESSELS.map((id) => (
                <VesselCard key={id} id={id} r={P[id]} selected={sel === id} onClick={() => setSel(id)} />
              ))}
              {result.warnings.map((w) => <div key={w} className="warn">⚠ {w}</div>)}
              <p className="muted small note">{result.note}</p>
            </>
          )}
        </aside>
      </main>

      <footer className="foot muted small">
        Trained on the Z-Alizadeh Sani CAD dataset (303 patients). Vessel colours show predicted probability,
        not lesion location or severity. Anatomy: BodyParts3D, © DBCLS, CC BY-SA 2.1 Japan.
      </footer>
    </div>
  );
}