import type { PredictionResponse, TrainResult, ModelStatus, StatsResponse, DistributionData, RegressionResult } from "../types";
import { pb } from "./pocketbase";

const API_BASE = "http://localhost:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    // Add PocketBase auth token if available
    if (pb.authStore.token) {
        headers["Authorization"] = `Bearer ${pb.authStore.token}`;
    }

    const res = await fetch(`${API_BASE}${path}`, {
        headers,
        ...options,
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(error.detail || "Request failed");
    }

    return res.json();
}

export async function submitSoilData(data: Record<string, unknown>): Promise<{ status: string; record: Record<string, unknown> }> {
    return request("/api/data", {
        method: "POST",
        body: JSON.stringify(data),
    });
}

export async function predictParameters(input: Record<string, unknown>): Promise<PredictionResponse> {
    return request("/api/predict", {
        method: "POST",
        body: JSON.stringify(input),
    });
}

export async function trainModel(): Promise<TrainResult> {
    return request("/api/train", {
        method: "POST",
    });
}

export async function getModelStatus(): Promise<ModelStatus> {
    return request("/api/model-status");
}

export async function getStats(): Promise<StatsResponse> {
    return request("/api/stats");
}

export async function getDistributionData(): Promise<DistributionData> {
    return request("/api/distribution");
}

export async function getRegressionData(x: string, y: string, forceOrigin: boolean, modelType: string = "auto"): Promise<RegressionResult> {
    return request(`/api/regression?x=${x}&y=${y}&force_origin=${forceOrigin}&model_type=${modelType}`);
}

export async function discoverFormula(xs: string[], y: string): Promise<RegressionResult> {
    const xsParam = xs.join(",");
    return request(`/api/formula-discovery?xs=${xsParam}&y=${y}`);
}
