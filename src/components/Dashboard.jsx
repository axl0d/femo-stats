import { useState, useEffect, useMemo } from "react";
import { signOut } from "../lib/auth";
import { listCompanies, createCompany, saveFEMORecord, getDashboardData } from "../lib/femoData";
import { parseFEMOFile, classifyBMI, classifyBP } from "../lib/femoParser";

export default function Dashboard({ session }) {
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [workers, setWorkers] = useState([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState(null);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [showCompanyForm, setShowCompanyForm] = useState(false);

  useEffect(() => { fetchCompanies(); }, []);

  useEffect(() => {
    if (selectedCompany) fetchDashboard(selectedCompany.id);
  }, [selectedCompany]);

  async function fetchCompanies() {
    setLoadingCompanies(true);
    try {
      const data = await listCompanies();
      setCompanies(data);
      if (data.length > 0) setSelectedCompany(data[0]);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingCompanies(false);
    }
  }

  async function fetchDashboard(companyId) {
    setLoadingDashboard(true);
    try {
      setWorkers(await getDashboardData(companyId));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingDashboard(false);
    }
  }

  async function handleCreateCompany(e) {
    e.preventDefault();
    if (!newCompanyName.trim()) return;
    try {
      const created = await createCompany({ name: newCompanyName.trim() });
      setCompanies((prev) => [...prev, created]);
      setSelectedCompany(created);
      setNewCompanyName("");
      setShowCompanyForm(false);
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleFile(file) {
    if (!selectedCompany) { setError("Select or create a company first."); return; }
    setParsing(true);
    setError(null);
    try {
      const parsed = await parseFEMOFile(file);
      await saveFEMORecord(selectedCompany.id, parsed);
      await fetchDashboard(selectedCompany.id);
    } catch (e) {
      setError(e.message || "Failed to process file.");
    } finally {
      setParsing(false);
    }
  }

  const stats = useMemo(() => {
    const n = workers.length;
    if (n === 0) return null;

    const withExam = workers.filter((w) => w.latestExam);
    const fit = withExam.filter((w) => w.latestExam.aptitud === "Fit").length;

    const bmiCounts = {};
    let overweightOrObese = 0;
    withExam.forEach((w) => {
      const cat = classifyBMI(w.latestExam.imc);
      bmiCounts[cat] = (bmiCounts[cat] || 0) + 1;
      if (cat === "Overweight" || cat.startsWith("Obesity")) overweightOrObese++;
    });

    const bpCounts = {};
    withExam.forEach((w) => {
      const cat = classifyBP(w.latestExam.presion_arterial);
      bpCounts[cat] = (bpCounts[cat] || 0) + 1;
    });

    const smokerCounts = {};
    withExam.forEach((w) => {
      smokerCounts[w.latestExam.fumador] = (smokerCounts[w.latestExam.fumador] || 0) + 1;
    });

    const riskFreq = {};
    withExam.forEach((w) => {
      new Set((w.latestExam.risk_factors || []).map((r) => r.factor)).forEach((f) => {
        riskFreq[f] = (riskFreq[f] || 0) + 1;
      });
    });
    const topRisks = Object.entries(riskFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([factor, count]) => ({ factor, count, pct: Math.round((count / n) * 100) }));

    const byPosition = {};
    workers.forEach((w) => {
      const p = w.position || "Unspecified";
      if (!byPosition[p]) byPosition[p] = { total: 0, fit: 0, restricted: 0, unfit: 0 };
      byPosition[p].total++;
      const f = w.latestExam?.aptitud;
      if (f === "Fit") byPosition[p].fit++;
      else if (f === "Fit with restrictions") byPosition[p].restricted++;
      else if (f === "Unfit") byPosition[p].unfit++;
    });

    return {
      n,
      pctFit: withExam.length ? Math.round((fit / withExam.length) * 100) : 0,
      pctOverweight: withExam.length ? Math.round((overweightOrObese / withExam.length) * 100) : 0,
      pctHighBP: withExam.length ? Math.round(((bpCounts["High"] || 0) / withExam.length) * 100) : 0,
      pctSmoker: withExam.length ? Math.round(((smokerCounts["Yes"] || 0) / withExam.length) * 100) : 0,
      bmiCounts,
      topRisks,
      byPosition,
    };
  }, [workers]);

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "1.5rem 1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0 }}>FEMO Stats</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: "#666" }}>{session.user.email}</span>
          <button onClick={signOut} style={{ fontSize: 13, background: "none", border: "1px solid #ccc", borderRadius: 6, padding: "5px 10px", cursor: "pointer" }}>
            Sign out
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        {loadingCompanies ? (
          <span style={{ fontSize: 13, color: "#666" }}>Loading companies…</span>
        ) : (
          <select
            value={selectedCompany?.id || ""}
            onChange={(e) => setSelectedCompany(companies.find((c) => c.id === e.target.value))}
            style={{ padding: "8px 10px", fontSize: 14, borderRadius: 8, border: "1px solid #ccc" }}
          >
            {companies.length === 0 && <option value="">No companies yet</option>}
            {companies.map((c) => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
          </select>
        )}
        <button onClick={() => setShowCompanyForm((v) => !v)} style={{ fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "1px solid #ccc", background: "#fff", cursor: "pointer" }}>
          + New company
        </button>
      </div>

      {showCompanyForm && (
        <form onSubmit={handleCreateCompany} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input
            value={newCompanyName}
            onChange={(e) => setNewCompanyName(e.target.value)}
            placeholder="Company name"
            style={{ flex: 1, padding: "8px 10px", fontSize: 14, borderRadius: 8, border: "1px solid #ccc" }}
          />
          <button type="submit" style={{ fontSize: 13, padding: "8px 14px", borderRadius: 8, border: "none", background: "#1a1a1a", color: "#fff", cursor: "pointer" }}>
            Create
          </button>
        </form>
      )}

      {selectedCompany && (
        <div style={{ border: "1.5px dashed #ccc", borderRadius: 12, padding: "1.25rem", textAlign: "center", marginBottom: 24 }}>
          <input type="file" id="femo-upload" accept=".xls,.xlsx" style={{ display: "none" }}
            onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])} />
          <label htmlFor="femo-upload" style={{ cursor: "pointer", fontSize: 14, fontWeight: 500 }}>
            {parsing ? "Processing file…" : `Upload FEMO (.xls) — ${selectedCompany.razon_social}`}
          </label>
        </div>
      )}

      {error && <p style={{ color: "#c0392b", fontSize: 13, marginBottom: 16 }}>{error}</p>}
      {loadingDashboard && <p style={{ fontSize: 13, color: "#666" }}>Loading stats…</p>}
      {!loadingDashboard && !stats && selectedCompany && (
        <p style={{ fontSize: 14, color: "#666", textAlign: "center", padding: "2rem 0" }}>
          No workers uploaded yet for this company.
        </p>
      )}

      {stats && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 24 }}>
            <Metric label="Fit for work" value={`${stats.pctFit}%`} />
            <Metric label="Overweight / obese" value={`${stats.pctOverweight}%`} />
            <Metric label="High blood pressure" value={`${stats.pctHighBP}%`} />
            <Metric label="Smokers" value={`${stats.pctSmoker}%`} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 16, marginBottom: 24 }}>
            <Card title="Fitness by position">
              {Object.entries(stats.byPosition).map(([pos, d]) => (
                <div key={pos} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#666", marginBottom: 4 }}>
                    <span>{pos}</span><span>{d.total}</span>
                  </div>
                  <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", background: "#eee" }}>
                    <div style={{ background: "#5DCAA5", width: `${(d.fit / d.total) * 100}%` }} />
                    <div style={{ background: "#FAC775", width: `${(d.restricted / d.total) * 100}%` }} />
                    <div style={{ background: "#F09595", width: `${(d.unfit / d.total) * 100}%` }} />
                  </div>
                </div>
              ))}
              <div style={{ display: "flex", gap: 14, marginTop: 12, fontSize: 11, color: "#666" }}>
                <Dot color="#5DCAA5" label="fit" />
                <Dot color="#FAC775" label="restricted" />
                <Dot color="#F09595" label="unfit" />
              </div>
            </Card>

            <Card title="Top occupational risks">
              {stats.topRisks.length === 0 && <p style={{ fontSize: 13, color: "#666" }}>No risk data yet.</p>}
              {stats.topRisks.map((r) => (
                <div key={r.factor} style={{ marginBottom: 9 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                    <span>{r.factor}</span><span style={{ color: "#666" }}>{r.pct}%</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: "#eee" }}>
                    <div style={{ height: 6, borderRadius: 3, width: `${r.pct}%`, background: "#7F77DD" }} />
                  </div>
                </div>
              ))}
            </Card>
          </div>

          <Card title={`Workers (${stats.n})`}>
            {workers.map((w) => (
              <div key={w.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderBottom: "1px solid #eee" }}>
                <span>{w.full_name}</span>
                <span style={{ color: "#666" }}>{w.position} · {w.totalExams} exam(s)</span>
              </div>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div style={{ background: "#f6f6f4", borderRadius: 10, padding: "1rem" }}>
      <p style={{ fontSize: 13, color: "#666", margin: "0 0 4px" }}>{label}</p>
      <p style={{ fontSize: 24, fontWeight: 500, margin: 0 }}>{value}</p>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: 12, padding: "1rem 1.25rem" }}>
      <p style={{ fontSize: 14, fontWeight: 500, margin: "0 0 12px" }}>{title}</p>
      {children}
    </div>
  );
}

function Dot({ color, label }) {
  return (
    <span>
      <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: color, marginRight: 4 }} />
      {label}
    </span>
  );
}
