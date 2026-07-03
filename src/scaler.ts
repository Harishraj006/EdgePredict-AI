/**
 * StandardScaler implementation matching the Python sklearn StandardScaler.
 * Parameters extracted from the trained scaler.pkl file.
 */

// Extracted from models/scaler.pkl
const SCALER_MEAN = [
  1654.3023100699147,
  92.99515322562186,
  13.064021772338497,
  55.057397173681565,
  36.80319355360923,
  0.49499233900419165,
  25.828929430521242,
  59.7904455827857,
];

const SCALER_SCALE = [
  809.7059610394565,
  10.815107844568809,
  0.8708877468148611,
  10.111950275820679,
  10.809484384969176,
  0.21454655692320335,
  16.45570611121351,
  28.997883729419645,
];

/**
 * Apply StandardScaler transformation: (x - mean) / scale
 */
export function standardScale(features: number[]): Float32Array {
  if (features.length !== SCALER_MEAN.length) {
    throw new Error(
      `Expected ${SCALER_MEAN.length} features, got ${features.length}`
    );
  }

  const scaled = new Float32Array(features.length);
  for (let i = 0; i < features.length; i++) {
    scaled[i] = (features[i] - SCALER_MEAN[i]) / SCALER_SCALE[i];
  }
  return scaled;
}
