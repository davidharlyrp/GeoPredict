/**
 * Parameter config types and loader.
 *
 * Reads parameters.json (single source of truth) and derives
 * typed helpers for auto-generating forms and result displays.
 *
 * To add a new parameter (e.g. elastic_modulus):
 *   1. Add entry to /parameters.json
 *   2. Copy updated file to frontend/public/parameters.json
 *   3. Add column to PocketBase collection
 *   That's it — UI + backend auto-adapt.
 */

export interface ParamConfig {
  key: string;
  label: string;
  unit: string;
  type: "number" | "select" | "text";
  step?: number;
  placeholder?: string;
  options?: string[];
  role: "feature" | "target";
  required?: boolean;
}

let _cache: ParamConfig[] | null = null;

export async function loadParamConfig(): Promise<ParamConfig[]> {
  if (_cache) return _cache;
  try {
    // Try fetching from the local public folder first as requested
    const res = await fetch(`/parameters.json?t=${Date.now()}`);
    if (!res.ok) throw new Error("Local config not found");
    _cache = await res.json();
  } catch (err) {
    console.warn("Falling back to backend API for config", err);
    // Fallback to backend API if local fetch fails
    const res = await fetch(`http://localhost:8000/api/config?t=${Date.now()}`);
    _cache = await res.json();
  }
  return _cache!;
}

// --- API Types ---

export interface SoilData {
  depth: number;
  [key: string]: number | string | null;
}

export interface PredictionInput {
  [key: string]: number | string | null;
}

export interface PredictionResult {
  value: number | null;
  confidence: number;
  restricted?: boolean;
}

export interface PredictionResponse {
  multi_output: Record<string, PredictionResult>;
  regressor_chain: Record<string, PredictionResult>;
}

export interface TrainResult {
  status: string;
  num_samples: number;
  features: string[];
  targets: string[];
  conf_multi: Record<string, number>;
  conf_chain: Record<string, number>;
}

export interface ModelStatus {
  model_exists: boolean;
}

export interface StatsResponse {
  total_records: number;
}

export interface HistogramBin {
  bin: string;
  count: number;
  range: [number, number];
}

export interface NumericDistribution {
  type: "numeric";
  mean: number;
  median: number;
  std: number;
  min: number;
  max: number;
  skew: number;
  bias: string;
  histogram: HistogramBin[];
  count: number;
}

export interface CategoricalBin {
  label: string;
  count: number;
}

export interface CategoricalDistribution {
  type: "categorical";
  distribution: CategoricalBin[];
  count: number;
}

export type DistributionData = Record<string, NumericDistribution | CategoricalDistribution>;

export interface RegressionResult {
  best_model?: string;
  equation: string;
  latex?: string;
  r2: number;
  trendline?: { x: number; y: number }[];
  scatter: { x: number; y: number }[];
  x_label: string;
  y_label: string;
  is_discovery?: boolean;
  error?: string;
}

// --- Sync helpers (use AFTER config is loaded) ---

export function getAllParams(config: ParamConfig[]): ParamConfig[] {
  return config;
}

export function getFeatureParams(config: ParamConfig[]): ParamConfig[] {
  return config.filter((p) => p.role === "feature");
}

export function getTargetParams(config: ParamConfig[]): ParamConfig[] {
  return config.filter((p) => p.role === "target");
}

export function buildInitialValues(params: ParamConfig[]): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const p of params) {
    if (p.type === "number") {
      values[p.key] = p.required ? 0 : null;
    } else {
      values[p.key] = null;
    }
  }
  return values;
}
