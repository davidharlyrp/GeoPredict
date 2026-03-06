import { useState, useEffect } from "react";
import type { ParamConfig, PredictionResponse, PredictionResult } from "../types";
import { loadParamConfig, getFeatureParams, getTargetParams, buildInitialValues } from "../types";
import { predictParameters, trainModel, getModelStatus } from "../services/api";
import { BarChart3, HelpCircle, AlertCircle } from "lucide-react";
import rulesConfig from "../geotech_rules.json";

export default function Predictor() {
    const [featureParams, setFeatureParams] = useState<ParamConfig[]>([]);
    const [targetParams, setTargetParams] = useState<ParamConfig[]>([]);
    const [input, setInput] = useState<Record<string, unknown>>({});
    const [result, setResult] = useState<PredictionResponse | null>(null);
    const [predicting, setPredicting] = useState(false);
    const [training, setTraining] = useState(false);
    const [modelReady, setModelReady] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    useEffect(() => {
        loadParamConfig().then((cfg) => {
            const features = getFeatureParams(cfg);
            const targets = getTargetParams(cfg);
            setFeatureParams(features);
            setTargetParams(targets);
            setInput(buildInitialValues(features));
        });
        getModelStatus()
            .then((s) => setModelReady(s.model_exists))
            .catch(() => setModelReady(false));
    }, []);

    const handleChange = (param: ParamConfig, value: string) => {
        if (param.type === "number") {
            setInput((prev) => ({ ...prev, [param.key]: value === "" ? null : parseFloat(value) }));
        } else {
            setInput((prev) => ({ ...prev, [param.key]: value || null }));
        }
    };

    const handlePredict = async (e: React.FormEvent) => {
        e.preventDefault();
        setPredicting(true);
        setMessage(null);
        setResult(null);

        try {
            const res = await predictParameters(input);
            setResult(res);
        } catch (err) {
            setMessage({ type: "error", text: err instanceof Error ? err.message : "Prediction failed." });
        } finally {
            setPredicting(false);
        }
    };

    const handleTrain = async () => {
        setTraining(true);
        setMessage(null);

        try {
            const res = await trainModel();
            setMessage({ type: "success", text: `AI Model successfully trained on ${res.num_samples} records.` });
            setModelReady(true);
        } catch (err) {
            setMessage({ type: "error", text: err instanceof Error ? err.message : "Training failed." });
        } finally {
            setTraining(false);
        }
    };

    const formatValue = (val: number | null) => {
        if (val === null) return "—";
        if (val === 0) return "0";
        if (Math.abs(val) < 0.001) return val.toExponential(2);
        return val.toFixed(2);
    };

    const getConfClass = (score: number) => {
        if (score >= 0.7) return "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
        if (score >= 0.4) return "text-amber-500 bg-amber-500/10 border-amber-500/20";
        return "text-rose-500 bg-rose-500/10 border-rose-500/20";
    };

    const renderResultList = (title: string, data: Record<string, PredictionResult>) => (
        <div className="flex-1 bg-card/20 border border-border rounded-sm overflow-hidden flex flex-col">
            <div className="bg-muted/40 px-4 py-2 border-b border-border">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{title}</h3>
            </div>
            <div className="p-3 space-y-2">
                {targetParams.map((p) => {
                    const item = data[p.key];
                    const isRestricted = item?.restricted;

                    // Find explanation for restricted parameters
                    const soilType = input["soil_type"] as string;
                    const rule = rulesConfig.rules.find(r =>
                        r.condition.soil_type.includes(soilType) &&
                        r.restricted_targets.includes(p.key)
                    );

                    return (
                        <div key={p.key} className={`bg-card border border-border p-3 rounded-sm space-y-1 transition-all group ${isRestricted ? "opacity-60 grayscale-[0.5]" : "hover:border-primary/40"}`}>
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-bold tracking-wider text-muted-foreground group-hover:text-primary transition-colors">{p.label}</span>
                                    {isRestricted && (
                                        <div className="group/hint relative">
                                            <HelpCircle className="w-3 h-3 text-amber-500 cursor-help" />
                                            <div className="absolute left-0 bottom-full mb-2 w-48 p-2 bg-popover text-[9px] text-popover-foreground rounded-sm shadow-xl border border-border invisible group-hover/hint:visible z-50 font-medium leading-relaxed">
                                                <div className="flex items-center gap-1 mb-1 text-amber-500 font-black uppercase tracking-tighter">
                                                    <AlertCircle className="w-2.5 h-2.5" />
                                                    Geotech Constraint
                                                </div>
                                                {rule?.reason || "Parameter not applicable for this soil type."}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {item && !isRestricted && (
                                    <span className={`text-[8px] px-1.5 py-0.5 rounded-full border font-bold ${getConfClass(item.confidence)}`}>
                                        {Math.round(item.confidence * 100)}% RELIABILITY
                                    </span>
                                )}
                            </div>
                            <div className="flex items-baseline gap-3">
                                <span className={`text-lg font-bold tracking-tighter ${isRestricted ? "text-muted-foreground/50 italic" : ""}`}>
                                    {isRestricted ? "N/A" : formatValue(item?.value ?? null)}
                                </span>
                                {!isRestricted && item && p.unit && <span className="text-[10px] text-muted-foreground font-medium">{p.unit}</span>}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );

    return (
        <div className="space-y-8 py-4">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-l-4 border-primary pl-4 py-1">
                <div>
                    <h2 className="text-2xl font-black tracking-tight leading-none italic uppercase">Parameter Predictor</h2>
                    <p className="text-xs text-muted-foreground mt-2 font-medium">Predict missing soil parameters using dual ML architectures.</p>
                </div>

                <button
                    onClick={handleTrain}
                    disabled={training}
                    className="text-[9px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary active:scale-95 transition-all flex items-center gap-1.5 bg-muted/30 px-3 py-1.5 rounded-sm border border-border border-dashed hover:border-primary/30"
                >
                    <span className={`w-2 h-2 rounded-full ${modelReady ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`}></span>
                    {training ? "Training Pipeline..." : "⟳ Retrain System"}
                </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                {/* Inputs */}
                <div className="xl:col-span-3 space-y-4">
                    <form onSubmit={handlePredict} className="space-y-4">
                        <div className="bg-card/30 border border-border p-4 rounded-sm space-y-4">
                            {featureParams.map((p) => {
                                const id = `pred-${p.key}`;
                                return (
                                    <div key={p.key} className="space-y-1">
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground" htmlFor={id}>
                                            {p.label} {p.unit && <span className="opacity-50 font-normal italic">({p.unit})</span>}
                                        </label>
                                        {p.type === "select" ? (
                                            <select
                                                id={id}
                                                className="w-full bg-input border border-border rounded-sm py-1.5 px-3 text-xs font-semibold focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                                                value={(input[p.key] as string) ?? ""}
                                                onChange={(e) => handleChange(p, e.target.value)}
                                            >
                                                <option value="">Select...</option>
                                                {p.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                            </select>
                                        ) : (
                                            <input
                                                id={id}
                                                type="number"
                                                step={p.step ?? "any"}
                                                className="w-full bg-input border border-border rounded-sm py-1.5 px-3 text-xs font-semibold focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                                                value={(input[p.key] as number | string) ?? ""}
                                                onChange={(e) => handleChange(p, e.target.value)}
                                                placeholder={p.placeholder}
                                                required={p.required}
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <button
                            type="submit"
                            disabled={predicting || !modelReady}
                            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold uppercase tracking-tight text-xs py-3 rounded-sm shadow-md transition-all active:scale-95 disabled:opacity-30 flex justify-center items-center gap-2"
                        >
                            {predicting ? "Analyzing Data..." : "Generate Predictions"}
                        </button>
                    </form>

                    {message && (
                        <div className={`p-3 rounded-sm border text-[10px] font-bold uppercase tracking-wide animate-slide-up ${message.type === "success"
                            ? "bg-primary/10 border-primary/20 text-primary"
                            : "bg-destructive/10 border-destructive/20 text-destructive"
                            }`}>
                            {message.text}
                        </div>
                    )}
                </div>

                {/* Results */}
                <div className="xl:col-span-9">
                    {result ? (
                        <div className="flex flex-col lg:flex-row gap-4 animate-fade-in">
                            {renderResultList("Independent Analysis (Multi-Output)", result.multi_output)}
                            {renderResultList("Sequence Analysis (Chain)", result.regressor_chain)}
                        </div>
                    ) : (
                        <div className="h-full min-h-[400px] border-2 border-dashed border-border rounded-sm flex flex-col items-center justify-center text-muted-foreground bg-muted/5">
                            <BarChart3 className="w-12 h-12 mb-4 opacity-20" />
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Awaiting Input Data</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
