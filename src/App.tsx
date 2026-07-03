import { useState, useEffect, useCallback, useRef } from "react";
import {
  type SensorData,
  type PredictionResult,
  FEATURES,
} from "./config";
import { loadModel, predict, isModelLoaded } from "./inference";
import { getRepairAdvice } from "./aiMechanic";
import { downloadPDFReport } from "./exportUtils";
import { predictRUL } from './rulInference';

const DEFAULT_NORMAL: SensorData = {
  engine_rpm: 1500,
  coolant_temp: 90,
  battery_voltage: 13.2,
  fuel_pressure: 55,
  intake_air_temp: 35,
  o2_sensor_voltage: 0.5,
  throttle_position: 25,
  speed: 60,
};

const ANOMALY_TEST: SensorData = {
  engine_rpm: 4500,
  coolant_temp: 120,
  battery_voltage: 10.8,
  fuel_pressure: 55,
  intake_air_temp: 35,
  o2_sensor_voltage: 0.5,
  throttle_position: 25,
  speed: 60,
};

const FEATURE_LABELS: Record<string, string> = {
  engine_rpm: "Engine RPM",
  coolant_temp: "Coolant Temp (°C)",
  battery_voltage: "Battery Voltage (V)",
  fuel_pressure: "Fuel Pressure (PSI)",
  intake_air_temp: "Intake Air Temp (°C)",
  o2_sensor_voltage: "O2 Sensor (V)",
  throttle_position: "Throttle Position (%)",
  speed: "Speed (km/h)",
};

const FEATURE_STEPS: Record<string, string> = {
  engine_rpm: "10",
  coolant_temp: "1",
  battery_voltage: "0.1",
  fuel_pressure: "1",
  intake_air_temp: "1",
  o2_sensor_voltage: "0.05",
  throttle_position: "1",
  speed: "5",
};

const formatSensorValue = (value: number): string => Number(value).toFixed(2);

export default function App() {
  const [sensorData, setSensorData] = useState<SensorData>({
    ...DEFAULT_NORMAL,
  });
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [rulValue, setRulValue] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [predicting, setPredicting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mechanicAdvice, setMechanicAdvice] = useState<string | null>(null);
  const [isAskingAI, setIsAskingAI] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const predictionInFlightRef = useRef(false);
  const lastSpokenAnomalyRef = useRef<string | null>(null);

  useEffect(() => {
    loadModel()
      .then(() => setLoading(false))
      .catch((err) => {
        setError(`Failed to load AI model: ${err.message}`);
        setLoading(false);
      });
  }, []);

  const handleInputChange = useCallback(
    (feature: keyof SensorData, value: string) => {
      const parsedValue = value === "" ? 0 : parseFloat(value) || 0;
      setSensorData((prev) => ({
        ...prev,
        [feature]: Number(parsedValue.toFixed(2)),
      }));
    },
    []
  );

  const fillNormal = useCallback(() => {
    setSensorData({ ...DEFAULT_NORMAL });
  }, []);

  const fillAnomaly = useCallback(() => {
    setSensorData({ ...ANOMALY_TEST });
  }, []);

  const generateSimulatedData = useCallback((baseData: SensorData): SensorData => {
    const nextData: SensorData = {
      engine_rpm: Number(Math.max(800, Math.min(5500, baseData.engine_rpm + (Math.random() - 0.5) * 250)).toFixed(2)),
      coolant_temp: Number(Math.max(70, Math.min(125, baseData.coolant_temp + (Math.random() - 0.5) * 6)).toFixed(2)),
      battery_voltage: Number(Math.max(9.5, Math.min(14.6, baseData.battery_voltage + (Math.random() - 0.5) * 0.25)).toFixed(2)),
      fuel_pressure: Number(Math.max(20, Math.min(80, baseData.fuel_pressure + (Math.random() - 0.5) * 6)).toFixed(2)),
      intake_air_temp: Number(Math.max(20, Math.min(120, baseData.intake_air_temp + (Math.random() - 0.5) * 5)).toFixed(2)),
      o2_sensor_voltage: Number(Math.max(0.1, Math.min(1.2, baseData.o2_sensor_voltage + (Math.random() - 0.5) * 0.08)).toFixed(2)),
      throttle_position: Number(Math.max(5, Math.min(100, baseData.throttle_position + (Math.random() - 0.5) * 4)).toFixed(2)),
      speed: Number(Math.max(0, Math.min(160, baseData.speed + (Math.random() - 0.5) * 8)).toFixed(2)),
    };

    if (Math.random() < 0.1) {
      const spikeType = Math.floor(Math.random() * 3);
      if (spikeType === 0) {
        nextData.engine_rpm = 4500;
      } else if (spikeType === 1) {
        nextData.coolant_temp = 118;
      } else {
        nextData.battery_voltage = 9.6;
      }
    }

    return nextData;
  }, []);

  const runPrediction = useCallback(async (overrideData: SensorData | null = null) => {
    const activeData = overrideData ?? sensorData;

    if (!isModelLoaded()) {
      setError("Model not loaded yet. Please wait.");
      return;
    }

    if (predictionInFlightRef.current) {
      return;
    }

    predictionInFlightRef.current = true;
    setPredicting(true);
    setError(null);

    try {
      const predictionResult = await predict(activeData);

      const isCatastrophic =
        activeData.engine_rpm > 5000 ||
        activeData.coolant_temp > 120 ||
        activeData.battery_voltage < 10 ||
        activeData.fuel_pressure < 20;

      if (isCatastrophic) {
        predictionResult.health_score = Math.min(predictionResult.health_score, 8);
        predictionResult.analysis.severity = "critical";
      }

      if (
        predictionResult.is_anomaly &&
        predictionResult.analysis.severity === "critical" &&
        !isMuted &&
        typeof window !== "undefined" &&
        typeof window.speechSynthesis !== "undefined"
      ) {
        const anomalyKey = `${predictionResult.analysis.component}:${predictionResult.label_name}`;
        if (lastSpokenAnomalyRef.current !== anomalyKey) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(
            `Critical Alert! ${predictionResult.analysis.component} failure detected.`
          );
          utterance.rate = 1.1;
          utterance.pitch = 1.05;
          window.speechSynthesis.speak(utterance);
          lastSpokenAnomalyRef.current = anomalyKey;
        }
      }

      setResult(predictionResult);

      let rulScore = await predictRUL(activeData);

      if (rulScore === 0 || rulScore < 5) {
        if (isCatastrophic || predictionResult.health_score < 30) {
          rulScore = 0;
        } else {
          rulScore = Math.round(predictionResult.health_score * 1.8);
        }
      }

      setRulValue(rulScore);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Prediction failed";

      if (message.toLowerCase().includes("session")) {
        console.warn("Skipping transient session warning during live simulation.");
      } else {
        setError(message);
      }
    } finally {
      predictionInFlightRef.current = false;
      setPredicting(false);
    }
  }, [sensorData]);

  const handleAskMechanic = useCallback(async () => {
    if (!result) return;
    setIsAskingAI(true);
    setMechanicAdvice(null);
    try {
      const advice = await getRepairAdvice(sensorData, result);
      setMechanicAdvice(advice);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setMechanicAdvice(`Failed to get advice: ${message}`);
    } finally {
      setIsAskingAI(false);
    }
  }, [sensorData, result]);

  const handleDownloadPDF = useCallback(() => {
    if (!result) return;
    // Pass rulValue to the PDF exporter
    downloadPDFReport(sensorData, result, mechanicAdvice ?? "", rulValue);
  }, [mechanicAdvice, result, sensorData, rulValue]);

  useEffect(() => {
    if (isModelLoaded() && !loading && !isSimulating) {
      const timer = setTimeout(() => runPrediction(), 300);
      return () => clearTimeout(timer);
    }
  }, [sensorData, loading, runPrediction, isSimulating]);

  useEffect(() => {
    if (!isSimulating || !isModelLoaded() || loading) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setSensorData((prev) => {
        const nextData = generateSimulatedData(prev);
        void runPrediction(nextData);
        return nextData;
      });
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [generateSimulatedData, isSimulating, loading, runPrediction]);

  const healthColor =
    result && result.health_score >= 80
      ? "#22c55e"
      : result && result.health_score >= 50
        ? "#eab308"
        : "#ef4444";

  const circum = 2 * Math.PI * 68;
  const offset = result
    ? circum - (result.health_score / 100) * circum
    : circum;

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <div className="logo">EP</div>
          <div>
            <h1 className="header-title">EdgePredict AI</h1>
            <p className="header-subtitle">
              Browser-Based Vehicle Health Predictor
            </p>
          </div>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className={`btn btn-sm simulation-toggle ${isSimulating ? "active" : ""}`}
            onClick={() => setIsSimulating((prev) => !prev)}
          >
            {isSimulating ? "⏱️ Live Simulation: ON" : "⏱️ Live Simulation: OFF"}
          </button>
          <button
            type="button"
            className={`btn btn-sm simulation-toggle ${isMuted ? "" : "active"}`}
            onClick={() => setIsMuted((prev) => !prev)}
            aria-label={isMuted ? "Enable voice alerts" : "Mute voice alerts"}
          >
            {isMuted ? "🔇" : "🔊"}
          </button>
          <div className={`status-badge ${loading ? "offline" : "online"}`}>
            <span className="dot" />
            <span>{loading ? "Loading Model..." : "AI Engine Ready"}</span>
          </div>
        </div>
      </header>

      <main className="main">
        <section className="panel inputs-panel">
          <div className="panel-header">
            <h2 className="panel-title">Sensor Inputs</h2>
            <div className="panel-actions">
              <button className="btn btn-sm btn-outline" onClick={fillNormal}>
                Normal
              </button>
              <button className="btn btn-sm btn-danger" onClick={fillAnomaly}>
                Anomaly Test
              </button>
            </div>
          </div>

          <div className="inputs-grid">
            {FEATURES.map((feat) => (
              <div className="input-group" key={feat}>
                <label htmlFor={feat}>{FEATURE_LABELS[feat]}</label>
                <input
                  id={feat}
                  type="number"
                  value={formatSensorValue(sensorData[feat])}
                  step={FEATURE_STEPS[feat]}
                  onChange={(e) => handleInputChange(feat, e.target.value)}
                />
              </div>
            ))}
          </div>

          <button
            className="btn btn-primary btn-full"
            onClick={() => void runPrediction()}
            disabled={loading || predicting}
          >
            {predicting
              ? "🔄 Running AI Inference..."
              : loading
                ? "⏳ Loading Model..."
                : "🚀 Run Prediction"}
          </button>
        </section>

        <section className="panel results-panel">
          <div className="panel-header">
            <h2 className="panel-title">AI Prediction Results</h2>
            {result && !result.is_anomaly && (
              <span className="badge badge-good">All Clear</span>
            )}
            {result && result.is_anomaly && (
              <span className="badge badge-bad">Anomaly Detected</span>
            )}
          </div>

          {error && <div className="error-banner">⚠️ {error}</div>}

          {!result && !error && (
            <div className="empty-state">
              <div className="empty-icon">🔬</div>
              <p>Enter sensor values and click Predict</p>
              <p className="empty-hint">
                The XGBoost ONNX model runs entirely in your browser
              </p>
            </div>
          )}

          {result && (
            <>
              <div className="results-grid">
                <div className="health-ring-section">
                  <div className="health-ring-container">
                    <svg viewBox="0 0 160 160" className="health-ring-svg">
                      <circle
                        className="bg-circle"
                        cx="80"
                        cy="80"
                        r="68"
                      />
                      <circle
                        className="progress-circle"
                        cx="80"
                        cy="80"
                        r="68"
                        stroke={healthColor}
                        strokeDasharray={circum}
                        strokeDashoffset={offset}
                      />
                    </svg>
                    <div className="health-ring-value">
                      <span className="health-number">
                        {result.health_score.toFixed(1)}
                      </span>
                      <span className="health-unit">%</span>
                      <span className="health-label">Health Score</span>
                    </div>
                  </div>

                  <div className={`status-text ${getStatusClass(result.health_score)}`}>
                    {result.health_score >= 80
                      ? "🟢 All Systems Normal"
                      : result.health_score >= 50
                        ? "🟡 Maintenance Recommended"
                        : "🔴 Immediate Attention Required"}
                  </div>
                </div>

                <div className="prediction-details">
                  <div className="detail-card">
                    <span className="detail-label">Predicted Status</span>
                    <span className="detail-value">{result.label_name}</span>
                  </div>
                  <div className="detail-card">
                    <span className="detail-label">Confidence</span>
                    <span className="detail-value">
                      {(result.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="detail-card">
                    <span className="detail-label">Anomaly Type</span>
                    <span className="detail-value">
                      {result.is_anomaly
                        ? result.analysis.component
                        : "None"}
                    </span>
                  </div>
                  <div className="detail-card">
                    <span className="detail-label">Severity</span>
                    <span
                      className={`detail-value ${result.analysis.severity !== "none" ? `severity-${result.analysis.severity}` : ""}`}
                    >
                      {result.analysis.severity.charAt(0).toUpperCase() +
                        result.analysis.severity.slice(1)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="visualizer-card">
                <div className="visualizer-header">
                  <h3>Car Component Visualizer</h3>
                  <span>{result.is_anomaly ? "Live fault highlight" : "No active fault"}</span>
                </div>
                <svg viewBox="0 0 320 180" className="car-visualizer" role="img" aria-label="Vehicle component visualizer">
                  <defs>
                    <linearGradient id="carBodyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#f8fafc" />
                      <stop offset="100%" stopColor="#cbd5e1" />
                    </linearGradient>
                    <linearGradient id="carRoofGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#e2e8f0" />
                      <stop offset="100%" stopColor="#94a3b8" />
                    </linearGradient>
                    <linearGradient id="carGlassGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#dbeafe" />
                      <stop offset="100%" stopColor="#93c5fd" />
                    </linearGradient>
                    <filter id="carShadow" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="#020617" floodOpacity="0.28" />
                    </filter>
                  </defs>

                  <ellipse cx="160" cy="150" rx="92" ry="16" fill="#020617" opacity="0.18" />
                  <path d="M70 110 L95 78 L127 66 L200 66 L240 78 L258 104 L270 108 L280 126 L250 126 L244 132 L80 132 L70 126 Z" className="car-body" style={{ fill: "url(#carBodyGradient)" }} filter="url(#carShadow)" />
                  <path d="M115 66 L150 42 L198 42 L220 66 Z" className="car-roof" style={{ fill: "url(#carRoofGradient)" }} />
                  <path d="M96 78 L110 78 L120 92 L96 92 Z" className="car-detail" />
                  <path d="M220 78 L240 78 L236 92 L214 92 Z" className="car-detail" />
                  <path d="M102 86 L132 86 L142 102 L104 102 Z" className={result.is_anomaly && result.analysis.component.toLowerCase().includes("engine") ? "component-highlight animate-pulse" : "component-neutral"} />
                  <path d="M180 86 L210 86 L214 102 L182 102 Z" className={result.is_anomaly && result.analysis.component.toLowerCase().includes("battery") ? "component-highlight animate-pulse" : "component-neutral"} />
                  <rect x="88" y="124" width="34" height="24" rx="10" className="wheel" />
                  <rect x="206" y="124" width="34" height="24" rx="10" className="wheel" />
                  <rect x="130" y="90" width="34" height="14" rx="3" className="car-glass" style={{ fill: "url(#carGlassGradient)" }} />
                  <rect x="164" y="90" width="34" height="14" rx="3" className="car-glass" style={{ fill: "url(#carGlassGradient)" }} />
                  <path d="M94 90 L116 80 L110 84 L92 95 Z" className="car-highlight" />
                  <path d="M214 90 L236 80 L230 84 L212 95 Z" className="car-highlight" />
                </svg>
                <p className="visualizer-caption">
                  {result.is_anomaly
                    ? `Highlighted area: ${result.analysis.component}`
                    : "The highlighted area will appear here when a fault is detected."}
                </p>
              </div>

              <div className="results-grid">
              </div>

              {/* ✨ FIXED RUL Card: Shows for both Normal and Anomaly ✨ */}
              {rulValue !== null && result && (
                <div className={`rul-card ${rulValue < 50 ? "critical" : rulValue < 120 ? "warning" : "healthy"}`}>
                  <div className="rul-header">
                    <div>
                      <h3 className="rul-title">⏳ Remaining Useful Life (RUL)</h3>
                      <p className="rul-subtitle">Estimated time before complete component failure</p>
                    </div>
                    <div className="rul-value-stack">
                      <span className="rul-value">{rulValue.toFixed(0)}</span>
                      <span className="rul-unit">Cycles</span>
                    </div>
                  </div>

                  <div className="rul-meter">
                    <div
                      className="rul-meter-fill"
                      style={{ width: `${Math.min(100, (rulValue / 200) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {result.is_anomaly && (
                <div className={`alert-box ${result.analysis.severity} mt-4`}>
                  <span className="alert-icon">
                    {result.analysis.severity === "critical" ? "🚨" : "⚠️"}
                  </span>
                  <div>
                    <strong>{result.analysis.component}</strong> —{" "}
                    {result.analysis.message}
                  </div>
                </div>
              )}

              {result.analysis.details.anomalous_sensors.length > 0 && (
                <div className="anomaly-list">
                  <h3>Anomalous Readings</h3>
                  <div className="anomaly-grid">
                    {result.analysis.details.anomalous_sensors.map((s) => (
                      <div className="anomaly-item" key={s.sensor}>
                        <span className="anomaly-sensor">{s.sensor}</span>
                        <span className="anomaly-value">{formatSensorValue(s.value)}</span>
                        <span className="anomaly-range">
                          Normal: {s.threshold}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="probabilities-section">
                <h3>Class Probabilities</h3>
                <div className="prob-bars">
                  {Object.entries(result.probabilities).map(([cls, prob]) => (
                    <div className="prob-bar-row" key={cls}>
                      <span className="prob-label">{cls}</span>
                      <div className="prob-bar-track">
                        <div
                          className="prob-bar-fill"
                          style={{
                            width: `${Math.max(prob * 100, 1)}%`,
                            backgroundColor:
                              cls === "Normal"
                                ? "#22c55e"
                                : cls === "Engine"
                                  ? "#ef4444"
                                  : cls === "Battery"
                                    ? "#a855f7"
                                    : cls === "Temperature"
                                      ? "#eab308"
                                      : "#3b82f6",
                          }}
                        />
                      </div>
                      <span className="prob-value">
                        {(prob * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="readings-section">
                <h3>Current Sensor Readings</h3>
                <div className="readings-grid">
                  {Object.entries(result.analysis.details.current_readings).map(
                    ([key, value]) => (
                      <div className="reading-item" key={key}>
                        <span className="reading-name">
                          {FEATURE_LABELS[key] ?? key}
                        </span>
                        <span className="reading-value">{formatSensorValue(value)}</span>
                      </div>
                    )
                  )}
                </div>
              </div>

              {result && result.predicted_label !== 0 && (
                <div className="assistant-card">
                  <div className="assistant-header">
                    <h3 className="assistant-title">🤖 GenAI Mechanic Assistant</h3>
                  </div>
                  <div className="assistant-actions">
                    <button
                      type="button"
                      className="btn btn-primary assistant-button"
                      onClick={handleAskMechanic}
                      disabled={isAskingAI}
                    >
                      {isAskingAI ? "⏳ Asking Gemini..." : "🛠️ Get Repair Plan"}
                    </button>

                    <div className="assistant-content">
                      {mechanicAdvice ? (
                        <div className="assistant-panel">
                          <div className="assistant-icon">✨</div>
                          <div className="assistant-copy-wrap">
                            <h4 className="assistant-subtitle">GenAI Action Plan</h4>
                            <div className="assistant-copy">
                              {mechanicAdvice}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="assistant-empty">
                          <p>
                            Click the button to get a 3-step actionable repair plan powered by Google Gemini AI.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="action-buttons">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleDownloadPDF}
                >
                  📄 Download Diagnostic Report
                </button>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void runPrediction()}
                  disabled={loading || predicting}
                >
                  Run Again
                </button>
              </div>
            </>
          )}
        </section>
      </main>

      <footer className="footer">
        <span>EdgePredict AI v1.0 — ONNX Runtime Web</span>
        <span>
          Model: XGBoost ·{" "}
          {loading ? "Loading..." : isModelLoaded() ? "Loaded" : "Not Loaded"}
        </span>
      </footer>
    </div>
  );
}

function getStatusClass(score: number): string {
  if (score >= 80) return "status-good";
  if (score >= 50) return "status-warning";
  return "status-critical";
}