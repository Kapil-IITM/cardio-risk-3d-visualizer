const API = "http://127.0.0.1:8001";

export const getFeatures = () =>
  fetch(`${API}/features`).then((r) => r.json());

export const predict = async (patient) => {
  const r = await fetch(`${API}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ patient }),
  });
  if (!r.ok) throw await r.json();
  return r.json();
};