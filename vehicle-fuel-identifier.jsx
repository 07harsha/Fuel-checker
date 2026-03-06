import { useState, useRef, useCallback } from "react";

const FUEL_COLORS = {
  "Petrol": { bg: "#FF6B35", light: "#FFE0D0", icon: "⛽" },
  "Diesel": { bg: "#2C4A6E", light: "#D0DCF0", icon: "🛢️" },
  "Electric": { bg: "#00C896", light: "#C0F5E8", icon: "⚡" },
  "Hybrid": { bg: "#8B5CF6", light: "#E8D8FF", icon: "🔋" },
  "CNG": { bg: "#F59E0B", light: "#FEF3C7", icon: "💨" },
  "LPG": { bg: "#EF4444", light: "#FEE2E2", icon: "🔥" },
  "Hydrogen": { bg: "#06B6D4", light: "#CFFAFE", icon: "💧" },
  "Unknown": { bg: "#6B7280", light: "#F3F4F6", icon: "❓" },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default function App() {
  const [vehicles, setVehicles] = useState([]);
  const [inputText, setInputText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processingVehicle, setProcessingVehicle] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [activeFilter, setActiveFilter] = useState("All");
  const [viewMode, setViewMode] = useState("grid");
  const fileRef = useRef();

  const parseVehicleNumbers = (text) => {
    const lines = text.split(/[\n,;]+/).map((l) => l.trim()).filter(Boolean);
    return [...new Set(lines)];
  };

  const callAI = async (numbers) => {
    const prompt = `You are a vehicle database expert. For each vehicle registration number below, identify the likely fuel type it uses based on the registration pattern, country format, and year indicators.

Vehicle numbers:
${numbers.join("\n")}

Respond ONLY with a JSON array. Each item must have:
- "number": the exact vehicle number
- "fuel": one of: Petrol, Diesel, Electric, CNG, LPG, Hybrid, Hydrogen, Unknown
- "confidence": "High", "Medium", or "Low"
- "reason": short one-line reason (max 12 words)
- "country": likely country/region (e.g. India, UK, US, Germany, Unknown)
- "year": estimated registration year or range or "Unknown"

Return ONLY valid JSON array, no other text.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();
    const text = data.content.map((c) => c.text || "").join("");
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  };

  const processBatch = async (numbers) => {
    setIsProcessing(true);
    setVehicles([]);
    setProgress(0);

    const BATCH_SIZE = 20;
    const batches = [];
    for (let i = 0; i < numbers.length; i += BATCH_SIZE) {
      batches.push(numbers.slice(i, i + BATCH_SIZE));
    }

    let allResults = [];

    for (let b = 0; b < batches.length; b++) {
      const batch = batches[b];
      setProcessingVehicle(`Batch ${b + 1} of ${batches.length} (${batch.length} vehicles)`);

      try {
        const results = await callAI(batch);
        allResults = [...allResults, ...results];
        setVehicles([...allResults]);
      } catch (e) {
        // Fallback if batch fails
        const fallback = batch.map((n) => ({
          number: n,
          fuel: "Unknown",
          confidence: "Low",
          reason: "Could not determine fuel type",
          country: "Unknown",
          year: "Unknown",
        }));
        allResults = [...allResults, ...fallback];
        setVehicles([...allResults]);
      }

      setProgress(Math.round(((b + 1) / batches.length) * 100));
      if (b < batches.length - 1) await sleep(500);
    }

    setIsProcessing(false);
    setProcessingVehicle("");
  };

  const handleProcess = () => {
    const numbers = parseVehicleNumbers(inputText);
    if (numbers.length === 0) return;
    processBatch(numbers);
  };

  const handleFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setInputText(e.target.result);
    };
    reader.readAsText(file);
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  const fuelSummary = vehicles.reduce((acc, v) => {
    acc[v.fuel] = (acc[v.fuel] || 0) + 1;
    return acc;
  }, {});

  const fuelTypes = ["All", ...Object.keys(fuelSummary)];
  const filtered = activeFilter === "All" ? vehicles : vehicles.filter((v) => v.fuel === activeFilter);

  const exportCSV = () => {
    const rows = [["Vehicle Number", "Fuel Type", "Confidence", "Country", "Year", "Reason"]];
    vehicles.forEach((v) => rows.push([v.number, v.fuel, v.confidence, v.country, v.year, v.reason]));
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vehicle_fuel_report.csv";
    a.click();
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0A0E1A",
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      color: "#E8EAF0",
    }}>
      {/* Ambient background */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 80% 50% at 20% 0%, rgba(0,200,150,0.08) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 80% 100%, rgba(99,102,241,0.08) 0%, transparent 60%)",
      }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1200, margin: "0 auto", padding: "32px 20px" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            background: "rgba(0,200,150,0.1)", border: "1px solid rgba(0,200,150,0.3)",
            borderRadius: 100, padding: "6px 18px", marginBottom: 20, fontSize: 13,
            color: "#00C896", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00C896", display: "inline-block", animation: "pulse 2s infinite" }} />
            AI-Powered Vehicle Analysis
          </div>
          <h1 style={{
            fontSize: "clamp(2rem, 5vw, 3.5rem)", fontWeight: 800, margin: 0, lineHeight: 1.1,
            background: "linear-gradient(135deg, #fff 30%, #00C896 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            letterSpacing: "-0.02em",
          }}>
            VehicleFuel<span style={{ color: "#00C896", WebkitTextFillColor: "#00C896" }}>AI</span>
          </h1>
          <p style={{ color: "#8892A4", marginTop: 12, fontSize: 16, maxWidth: 500, margin: "12px auto 0" }}>
            Upload thousands of vehicle numbers — AI identifies their fuel type instantly
          </p>
        </div>

        {/* Input Section */}
        <div style={{
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 20, padding: 28, marginBottom: 24, backdropFilter: "blur(10px)",
        }}>
          <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current.click()}
              style={{
                flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", gap: 8, padding: "20px 28px",
                border: `2px dashed ${dragOver ? "#00C896" : "rgba(255,255,255,0.15)"}`,
                borderRadius: 14, cursor: "pointer", transition: "all 0.2s",
                background: dragOver ? "rgba(0,200,150,0.05)" : "transparent",
                minWidth: 160,
              }}
            >
              <span style={{ fontSize: 32 }}>📂</span>
              <span style={{ fontSize: 13, color: "#8892A4", textAlign: "center" }}>
                Drop file or click<br /><span style={{ color: "#00C896" }}>.txt / .csv</span>
              </span>
              <input ref={fileRef} type="file" accept=".txt,.csv" style={{ display: "none" }} onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])} />
            </div>

            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={"Paste vehicle numbers here...\n\nMH12AB1234\nKA05MN4567\nDL3CAF0001\nTN09BZ9999\n...(any format, one per line or comma-separated)"}
              style={{
                flex: 1, minHeight: 160, background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12,
                padding: "14px 16px", color: "#E8EAF0", fontSize: 14, resize: "vertical",
                outline: "none", fontFamily: "'DM Mono', monospace", lineHeight: 1.7,
              }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <span style={{ fontSize: 13, color: "#8892A4" }}>
              {parseVehicleNumbers(inputText).length > 0
                ? `✓ ${parseVehicleNumbers(inputText).length} vehicle numbers detected`
                : "Enter vehicle numbers to begin"}
            </span>
            <button
              onClick={handleProcess}
              disabled={isProcessing || parseVehicleNumbers(inputText).length === 0}
              style={{
                background: isProcessing ? "rgba(0,200,150,0.2)" : "linear-gradient(135deg, #00C896, #00A878)",
                color: isProcessing ? "#00C896" : "#0A0E1A",
                border: "none", borderRadius: 12, padding: "12px 32px",
                fontSize: 15, fontWeight: 700, cursor: isProcessing ? "not-allowed" : "pointer",
                transition: "all 0.2s", letterSpacing: "0.01em",
                boxShadow: isProcessing ? "none" : "0 4px 20px rgba(0,200,150,0.3)",
              }}
            >
              {isProcessing ? "🔄 Analyzing..." : "🚗 Identify Fuel Types"}
            </button>
          </div>

          {/* Progress */}
          {isProcessing && (
            <div style={{ marginTop: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
                <span style={{ color: "#8892A4" }}>{processingVehicle}</span>
                <span style={{ color: "#00C896", fontWeight: 700 }}>{progress}%</span>
              </div>
              <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 10, overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${progress}%`, borderRadius: 10,
                  background: "linear-gradient(90deg, #00C896, #00E5B0)",
                  transition: "width 0.4s ease", boxShadow: "0 0 12px rgba(0,200,150,0.5)",
                }} />
              </div>
            </div>
          )}
        </div>

        {/* Summary Cards */}
        {Object.keys(fuelSummary).length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
              {Object.entries(fuelSummary).sort((a, b) => b[1] - a[1]).map(([fuel, count]) => {
                const meta = FUEL_COLORS[fuel] || FUEL_COLORS["Unknown"];
                return (
                  <div key={fuel} style={{
                    background: `rgba(${hexToRgb(meta.bg)}, 0.12)`,
                    border: `1px solid rgba(${hexToRgb(meta.bg)}, 0.3)`,
                    borderRadius: 14, padding: "12px 20px", display: "flex", alignItems: "center", gap: 10,
                    cursor: "pointer", transition: "all 0.2s",
                    boxShadow: activeFilter === fuel ? `0 0 0 2px ${meta.bg}` : "none",
                  }} onClick={() => setActiveFilter(activeFilter === fuel ? "All" : fuel)}>
                    <span style={{ fontSize: 22 }}>{meta.icon}</span>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: meta.bg }}>{count}</div>
                      <div style={{ fontSize: 12, color: "#8892A4", fontWeight: 600 }}>{fuel}</div>
                    </div>
                  </div>
                );
              })}
              <div style={{
                marginLeft: "auto", display: "flex", gap: 8, alignItems: "center",
              }}>
                {vehicles.length > 0 && (
                  <button onClick={exportCSV} style={{
                    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                    color: "#E8EAF0", borderRadius: 10, padding: "8px 16px", cursor: "pointer",
                    fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6,
                  }}>
                    ⬇ Export CSV
                  </button>
                )}
                <button onClick={() => setViewMode("grid")} style={{
                  background: viewMode === "grid" ? "rgba(0,200,150,0.15)" : "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.1)", color: "#E8EAF0",
                  borderRadius: 10, padding: "8px 12px", cursor: "pointer", fontSize: 16,
                }}>⊞</button>
                <button onClick={() => setViewMode("table")} style={{
                  background: viewMode === "table" ? "rgba(0,200,150,0.15)" : "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.1)", color: "#E8EAF0",
                  borderRadius: 10, padding: "8px 12px", cursor: "pointer", fontSize: 16,
                }}>☰</button>
              </div>
            </div>

            {/* Filter bar */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {fuelTypes.map((f) => (
                <button key={f} onClick={() => setActiveFilter(f)} style={{
                  background: activeFilter === f ? "#00C896" : "rgba(255,255,255,0.05)",
                  color: activeFilter === f ? "#0A0E1A" : "#8892A4",
                  border: "1px solid rgba(255,255,255,0.08)", borderRadius: 100,
                  padding: "5px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                  transition: "all 0.15s",
                }}>
                  {f} {f !== "All" && `(${fuelSummary[f] || 0})`}
                  {f === "All" && `(${vehicles.length})`}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {viewMode === "grid" && filtered.length > 0 && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 14,
          }}>
            {filtered.map((v, i) => {
              const meta = FUEL_COLORS[v.fuel] || FUEL_COLORS["Unknown"];
              const confColor = v.confidence === "High" ? "#00C896" : v.confidence === "Medium" ? "#F59E0B" : "#EF4444";
              return (
                <div key={i} style={{
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid rgba(${hexToRgb(meta.bg)}, 0.2)`,
                  borderRadius: 16, padding: 18, transition: "transform 0.2s, box-shadow 0.2s",
                  cursor: "default",
                  animation: `fadeSlideIn 0.3s ease both`,
                  animationDelay: `${Math.min(i * 0.02, 0.5)}s`,
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = `0 8px 24px rgba(${hexToRgb(meta.bg)},0.15)`; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                    <span style={{
                      fontFamily: "'DM Mono', monospace", fontSize: 15, fontWeight: 700,
                      color: "#fff", letterSpacing: "0.04em",
                    }}>
                      {v.number}
                    </span>
                    <span style={{ fontSize: 24 }}>{meta.icon}</span>
                  </div>
                  <div style={{
                    display: "inline-block", background: `rgba(${hexToRgb(meta.bg)},0.15)`,
                    color: meta.bg, borderRadius: 8, padding: "4px 10px",
                    fontSize: 13, fontWeight: 700, marginBottom: 10,
                  }}>
                    {v.fuel}
                  </div>
                  <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.5, marginBottom: 10 }}>
                    {v.reason}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                    <span style={{ color: "#4B5563" }}>{v.country} · {v.year}</span>
                    <span style={{ color: confColor, fontWeight: 700 }}>{v.confidence}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {viewMode === "table" && filtered.length > 0 && (
          <div style={{
            background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 16, overflow: "hidden",
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                  {["#", "Vehicle Number", "Fuel Type", "Country", "Year", "Confidence", "Reason"].map((h) => (
                    <th key={h} style={{ padding: "14px 16px", textAlign: "left", color: "#8892A4", fontWeight: 600, fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((v, i) => {
                  const meta = FUEL_COLORS[v.fuel] || FUEL_COLORS["Unknown"];
                  const confColor = v.confidence === "High" ? "#00C896" : v.confidence === "Medium" ? "#F59E0B" : "#EF4444";
                  return (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", transition: "background 0.15s" }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      <td style={{ padding: "12px 16px", color: "#4B5563" }}>{i + 1}</td>
                      <td style={{ padding: "12px 16px", fontFamily: "'DM Mono', monospace", fontWeight: 700, color: "#fff" }}>{v.number}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{
                          background: `rgba(${hexToRgb(meta.bg)},0.15)`, color: meta.bg,
                          borderRadius: 6, padding: "3px 10px", fontWeight: 700, fontSize: 13,
                          display: "inline-flex", alignItems: "center", gap: 5,
                        }}>
                          {meta.icon} {v.fuel}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", color: "#8892A4" }}>{v.country}</td>
                      <td style={{ padding: "12px 16px", color: "#8892A4" }}>{v.year}</td>
                      <td style={{ padding: "12px 16px", color: confColor, fontWeight: 700 }}>{v.confidence}</td>
                      <td style={{ padding: "12px 16px", color: "#6B7280", maxWidth: 220 }}>{v.reason}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Empty state */}
        {!isProcessing && vehicles.length === 0 && (
          <div style={{
            textAlign: "center", padding: "80px 20px",
            border: "1px dashed rgba(255,255,255,0.07)", borderRadius: 20,
          }}>
            <div style={{ fontSize: 64, marginBottom: 20 }}>🚗</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Ready to Analyze</div>
            <div style={{ color: "#8892A4", fontSize: 15 }}>
              Paste vehicle registration numbers above and click Identify Fuel Types
            </div>
            <div style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              {["MH12AB1234 → Petrol", "DL8CAF0001 → CNG", "KA01AB1234 → Diesel", "TN05EV001 → Electric"].map((ex) => (
                <span key={ex} style={{
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8, padding: "6px 14px", fontSize: 13, color: "#8892A4",
                  fontFamily: "'DM Mono', monospace",
                }}>
                  {ex}
                </span>
              ))}
            </div>
          </div>
        )}

        <p style={{ textAlign: "center", marginTop: 40, fontSize: 12, color: "#374151" }}>
          Powered by Claude AI · Results are AI-estimated and may vary · Always verify with official databases
        </p>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&family=DM+Mono:wght@400;500;700&display=swap');
        * { box-sizing: border-box; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes fadeSlideIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        ::-webkit-scrollbar { width: 6px; } 
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        textarea:focus { border-color: rgba(0,200,150,0.4) !important; box-shadow: 0 0 0 3px rgba(0,200,150,0.1); }
      `}</style>
    </div>
  );
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}
