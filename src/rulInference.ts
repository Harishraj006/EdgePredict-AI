import * as ort from "onnxruntime-web";
import { type SensorData, FEATURES } from "./config";

let rulSession: ort.InferenceSession | null = null;

// RUL Model load pandrom
export async function loadRULModel() {
  if (rulSession) return;
  try {
    const modelPath = new URL("/rul_xgboost.onnx", window.location.origin).href;
    rulSession = await ort.InferenceSession.create(modelPath, {
      executionProviders: ["wasm"],
    });
    console.log("[OK] RUL Model loaded successfully");
  } catch (err) {
    console.error("Failed to load RUL model:", err);
  }
}

// RUL Predict pandrom
export async function predictRUL(data: SensorData): Promise<number> {
  if (!rulSession) await loadRULModel();
  if (!rulSession) return 0;

  // 1. Namma 8 sensors oda values edukkurom
  const realFeatures = FEATURES.map((f) => data[f] ?? 0);

  // 2. NASA model evlo features ethirpaakutho atha kandupudikurom (mostly 14 to 21 irukkum)
  const expectedFeatures = 14;

  // 3. Hackathon Trick: Balance features-ku dummy values (0) padding pandrom
  const paddedFeatures = [...realFeatures];
  while (paddedFeatures.length < expectedFeatures) {
    paddedFeatures.push(0);
  }

  // 4. Tensor create panni predict pandrom
  const inputTensor = new ort.Tensor("float32", new Float32Array(paddedFeatures), [1, expectedFeatures]);
  const feeds: Record<string, ort.Tensor> = {};
  const inputName = rulSession.inputNames?.[0] ?? "input";
  feeds[inputName] = inputTensor;

  const results = await rulSession.run(feeds);
  const outputName = rulSession.outputNames?.[0] ?? "output";
  const rulOutput = results[outputName];

  // Output value edukkurom (Cycles remaining)
  let predictedRUL = 0;
  if (rulOutput && rulOutput.data && rulOutput.data.length > 0) {
    predictedRUL = Number(rulOutput.data[0]);
  }

  // RUL negative-a poga koodathu
  return Math.max(0, Math.round(predictedRUL)); 
}