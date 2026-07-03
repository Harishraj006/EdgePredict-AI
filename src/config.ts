export const FEATURES = [
  "engine_rpm",
  "coolant_temp",
  "battery_voltage",
  "fuel_pressure",
  "intake_air_temp",
  "o2_sensor_voltage",
  "throttle_position",
  "speed",
] as const;

export type SensorData = Record<(typeof FEATURES)[number], number>;

export const LABEL_NAMES: Record<number, string> = {
  0: "Normal",
  1: "Engine",
  2: "Battery",
  3: "Temperature",
  4: "Sensor",
};

export const ANOMALY_COMPONENTS: Record<number, string> = {
  1: "Engine",
  2: "Battery",
  3: "Cooling System",
  4: "Sensor System",
};

export const ANOMALY_MESSAGES: Record<number, string> = {
  1: "Engine anomaly detected - possible misfire or overheating",
  2: "Battery system failure - low voltage detected",
  3: "Cooling system problem - abnormal temperature readings",
  4: "Sensor malfunction - erratic sensor readings detected",
};

export const SEVERITY_MAP: Record<number, string> = {
  1: "critical",
  2: "critical",
  3: "warning",
  4: "warning",
};

export const SEVERITY_WEIGHTS: Record<number, number> = {
  1: 0.35, // Engine: severe
  2: 0.25, // Battery: critical
  3: 0.30, // Temperature: severe
  4: 0.45, // Sensor: moderate
};

export const SENSOR_THRESHOLDS: Record<
  string,
  { normal: [number, number]; unit: string }
> = {
  engine_rpm: { normal: [600, 3500], unit: "RPM" },
  coolant_temp: { normal: [75, 105], unit: "°C" },
  battery_voltage: { normal: [12.0, 14.8], unit: "V" },
  fuel_pressure: { normal: [25, 85], unit: "PSI" },
  intake_air_temp: { normal: [15, 55], unit: "°C" },
  o2_sensor_voltage: { normal: [0.05, 0.95], unit: "V" },
  throttle_position: { normal: [0, 100], unit: "%" },
  speed: { normal: [0, 130], unit: "km/h" },
};

export interface PredictionResult {
  predicted_label: number;
  label_name: string;
  health_score: number;
  confidence: number;
  is_anomaly: boolean;
  probabilities: Record<string, number>;
  analysis: {
    component: string;
    status: string;
    severity: string;
    message: string;
    details: {
      current_readings: Record<string, number>;
      anomalous_sensors: Array<{
        sensor: string;
        value: number;
        threshold: string;
        status: string;
      }>;
    };
  };
}
