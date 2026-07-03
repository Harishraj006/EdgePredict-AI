/**
 * Browser-based ONNX inference engine.
 * Loads the XGBoost ONNX model and runs predictions entirely client-side.
 */

import * as ort from "onnxruntime-web";
import { standardScale } from "./scaler";
import {
  type SensorData,
  type PredictionResult,
  FEATURES,
  LABEL_NAMES,
  ANOMALY_COMPONENTS,
  ANOMALY_MESSAGES,
  SEVERITY_MAP,
  SEVERITY_WEIGHTS,
  SENSOR_THRESHOLDS,
} from "./config";

// Point to CDN for WASM files (avoid Vite serving issues with .mjs imports)
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/';

let session: ort.InferenceSession | null = null;
let isLoading = false;
let loadPromise: Promise<void> | null = null;

/**
 * Load the ONNX model.
 */
export async function loadModel(): Promise<void> {
  if (session) return;
  if (loadPromise) return loadPromise;

  isLoading = true;
  loadPromise = (async () => {
    try {
      const modelPath = new URL("/xgboost.onnx", window.location.origin).href;

      // Use WASM backend for broad browser compatibility
      session = await ort.InferenceSession.create(modelPath, {
        executionProviders: ["wasm"],
      });

      console.log("[OK] ONNX model loaded successfully");
      // FIXED: Use inputNames and outputNames (it's already an array of strings)
      console.log("  Inputs:", session.inputNames);
      console.log("  Outputs:", session.outputNames);
    } catch (err) {
      console.error("[FAIL] Failed to load ONNX model:", err);
      loadPromise = null;
      throw err;
    } finally {
      isLoading = false;
    }
  })();

  return loadPromise;
}

export function isModelLoaded(): boolean {
  return session !== null;
}

export function isLoadingModel(): boolean {
  return isLoading;
}

/**
 * Run prediction on sensor data entirely in the browser.
 */
export async function predict(data: SensorData): Promise<PredictionResult> {
  if (!session) {
    throw new Error("Model not loaded. Call loadModel() first.");
  }

  // 1. Extract features in correct order
  const features = FEATURES.map((f) => data[f] ?? 0);

  // 2. Scale features (StandardScaler)
  const scaledFeatures = standardScale(features);

  // 3. Create input tensor (batch size 1, 8 features)
  const inputTensor = new ort.Tensor(
    "float32",
    scaledFeatures,
    [1, FEATURES.length]
  );

  // 4. Run inference
  const feeds: Record<string, ort.Tensor> = {};
  // FIXED: Use inputNames[0] directly
  feeds[session.inputNames[0]] = inputTensor;
  const results = await session.run(feeds);

  // 5. Parse outputs safely 
  // FIXED: Use outputNames directly
  const labelOutput = results[session.outputNames[0]];
  const probOutput = results[session.outputNames[1] || "probabilities"];
  
  console.log("Raw ONNX Results:", results);

  // Safely extract predicted label
  let predictedLabel = 0;
  if (labelOutput && labelOutput.data && labelOutput.data.length > 0) {
    predictedLabel = Number(labelOutput.data[0]);
  }

  // Safely extract probabilities
  let probabilitiesArr: number[] = [];
  
  if (probOutput && probOutput.data) {
    probabilitiesArr = Array.from(probOutput.data as Float32Array | Float64Array);
  } else if (Array.isArray(probOutput) && probOutput.length > 0) {
    const probMap = probOutput[0]; 
    const numClasses = Object.keys(LABEL_NAMES).length;
    
    if (probMap instanceof Map) {
      for (let i = 0; i < numClasses; i++) {
        const val = probMap.get(BigInt(i)) ?? probMap.get(i) ?? 0;
        probabilitiesArr.push(Number(val));
      }
    } else if (probMap && typeof probMap === 'object') {
      for (let i = 0; i < numClasses; i++) {
        probabilitiesArr.push(Number((probMap as any)[i] ?? 0));
      }
    }
  }

  if (probabilitiesArr.length === 0) {
    console.warn("Using default probability fallback.");
    probabilitiesArr = [1, 0, 0, 0, 0]; 
  }

  const confidence = Math.max(...probabilitiesArr);
  const labelName = LABEL_NAMES[predictedLabel] ?? "Unknown";

  // 6. Compute health score
  const healthScore = computeHealthScore(predictedLabel, confidence);

  // 7. Analyze anomaly
  const analysis = analyzeAnomaly(predictedLabel, features);

  // 8. Build probabilities map
  const probabilities: Record<string, number> = {};
  probabilitiesArr.forEach((p, i) => {
    probabilities[LABEL_NAMES[i] ?? String(i)] = Number(p.toFixed(4));
  });

  return {
    predicted_label: predictedLabel,
    label_name: labelName,
    health_score: healthScore,
    confidence: Number(confidence.toFixed(4)),
    is_anomaly: predictedLabel !== 0,
    probabilities,
    analysis,
  };
}

/**
 * Compute a health score (0-100) based on prediction.
 */
function computeHealthScore(label: number, confidence: number): number {
  let baseScore: number;

  if (label === 0) {
    // Normal: 90% to 100% based on confidence
    baseScore = 90.0 + confidence * 10.0;
  } else {
    // Anomaly: Force health score severely down (Below 50%)
    // The higher the confidence of a fault, the lower the health score
    const penaltyWeight = SEVERITY_WEIGHTS[label] ?? 0.6;
    baseScore = 45.0 - confidence * 35.0 * penaltyWeight;

    // Safety check: Never drop below 2% unless it's a complete crash
    if (baseScore < 2) baseScore = 2;
  }

  return Number(Math.max(0, Math.min(100, baseScore)).toFixed(2));
}

/**
 * Provide detailed analysis of an anomaly.
 */
function analyzeAnomaly(
  label: number,
  features: number[]
): PredictionResult["analysis"] {
  if (label === 0) {
    return {
      component: "All Systems",
      status: "Healthy",
      severity: "none",
      message: "All vehicle systems operating normally.",
      details: { current_readings: getReadings(features), anomalous_sensors: [] },
    };
  }

  const component = ANOMALY_COMPONENTS[label] ?? "Unknown";
  const message = ANOMALY_MESSAGES[label] ?? "Unknown anomaly detected";
  const severity = SEVERITY_MAP[label] ?? "warning";

  const readings = getReadings(features);
  const anomalousSensors: Array<{
    sensor: string;
    value: number;
    threshold: string;
    status: string;
  }> = [];

  for (const [name, value] of Object.entries(readings)) {
    const thresh = SENSOR_THRESHOLDS[name];
    if (thresh) {
      const [low, high] = thresh.normal;
      if (value < low || value > high) {
        anomalousSensors.push({
          sensor: name,
          value,
          threshold: `${low}-${high} ${thresh.unit}`,
          status: "ABNORMAL",
        });
      }
    }
  }

  return {
    component,
    status: "Fault Detected",
    severity,
    message,
    details: {
      current_readings: readings,
      anomalous_sensors: anomalousSensors,
    },
  };
}

function getReadings(features: number[]): Record<string, number> {
  const readings: Record<string, number> = {};
  FEATURES.forEach((f, i) => {
    if (i < features.length) {
      readings[f] = Number(features[i].toFixed(2));
    }
  });
  return readings;
}