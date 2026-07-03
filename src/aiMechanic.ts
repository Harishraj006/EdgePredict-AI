import { GoogleGenerativeAI } from "@google/generative-ai";
import { type SensorData, type PredictionResult } from "./config";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

function buildFallbackAdvice(result: PredictionResult, sensorData: SensorData): string {
  const component = result.analysis.component || "critical system";
  const severity = result.analysis.severity || "warning";
  const rpm = sensorData.engine_rpm;
  const temp = sensorData.coolant_temp;
  const voltage = sensorData.battery_voltage;

  if (severity === "critical") {
    return `1. Stop driving and inspect ${component} immediately. 2. Check high-risk readings such as RPM ${rpm}, coolant ${temp}°C, and battery ${voltage}V. 3. Arrange a professional diagnosis before operating the vehicle again.`;
  }

  return `1. Inspect ${component} and review the current sensor readings. 2. Verify the abnormal values around RPM ${rpm}, coolant ${temp}°C, and battery ${voltage}V. 3. Perform a routine maintenance check and retest the vehicle after repairs.`;
}

export async function getRepairAdvice(
  sensorData: SensorData,
  result: PredictionResult
): Promise<string> {
  // Normal condition na AI thevai illai
  if (result.predicted_label === 0) {
    return "Your vehicle is in perfect condition. Regular maintenance is sufficient!";
  }

  const prompt = `
    You are an expert automotive mechanic. 
    A predictive maintenance Edge AI system just detected a fault in a vehicle.
    
    Fault Type: ${result.label_name}
    Affected Component: ${result.analysis.component}
    Severity: ${result.analysis.severity}
    Current Sensor Readings: ${JSON.stringify(sensorData)}
    
    Provide a short, practical 3-step action plan to diagnose and fix this issue.
    At the very end of the response, add a new line exactly in this format:
    **Estimated Repair Cost:** ₹[Min] - ₹[Max]
    Use realistic Indian market rates (INR) for this specific fault.
    Keep it strictly under 4 sentences, do not use complex jargon, and do not add unnecessary details or hallucinated information.
  `;

  if (!genAI) {
    return buildFallbackAdvice(result, sensorData);
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const res = await model.generateContent(prompt);
    const responseText = res.response.text();
    return responseText || buildFallbackAdvice(result, sensorData);
  } catch (error) {
    console.error("Gemini API Error:", error);

    try {
      const fallbackModel = genAI.getGenerativeModel({ model: "gemini-pro" });
      const fallbackRes = await fallbackModel.generateContent(prompt);
      const fallbackText = fallbackRes.response.text();
      return fallbackText || buildFallbackAdvice(result, sensorData);
    } catch (fallbackError) {
      console.error("Fallback Model Error:", fallbackError);
      return buildFallbackAdvice(result, sensorData);
    }
  }
}

export default getRepairAdvice;