import { useState, useEffect } from "react";
import type { ParamConfig } from "../types";
import { loadParamConfig, getAllParams, buildInitialValues } from "../types";
import { submitSoilData } from "../services/api";
import rulesConfig from "../geotech_rules.json";

export default function DataEntry() {
    const [params, setParams] = useState<ParamConfig[]>([]);
    const [form, setForm] = useState<Record<string, unknown>>({});
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    useEffect(() => {
        loadParamConfig().then((cfg) => {
            const all = getAllParams(cfg);
            setParams(all);
            setForm(buildInitialValues(all));
        });
    }, []);

    const handleChange = (param: ParamConfig, value: string) => {
        let newForm = { ...form };

        if (param.type === "number") {
            newForm[param.key] = value === "" ? null : parseFloat(value);
        } else {
            newForm[param.key] = value || null;
        }

        // Special handling for geotechnical constraints
        if (param.key === "soil_type") {
            const soilType = value;
            const relevantRule = rulesConfig.rules.find(r => r.condition.soil_type.includes(soilType));

            if (relevantRule) {
                relevantRule.restricted_targets.forEach(targetKey => {
                    newForm[targetKey] = 0; // Automatically set to 0 as requested
                });
            }
        }

        setForm(newForm);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            await submitSoilData(form);
            setMessage({ type: "success", text: "Data successfully saved to database." });
            setForm(buildInitialValues(params));
            window.dispatchEvent(new CustomEvent("refreshStats"));
        } catch (err) {
            setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to save data." });
        } finally {
            setLoading(false);
        }
    };

    const renderField = (p: ParamConfig) => {
        const id = `entry-${p.key}`;
        const label = p.unit ? `${p.label} (${p.unit})` : p.label;

        // Check if field should be disabled based on rules
        const soilType = form["soil_type"] as string;
        const isRestricted = rulesConfig.rules.some(r =>
            r.condition.soil_type.includes(soilType) &&
            r.restricted_targets.includes(p.key)
        );

        const baseInputClasses = `w-full bg-input border border-border rounded-sm py-2 px-3 text-sm transition-all focus:ring-1 focus:ring-primary focus:border-primary outline-none placeholder:text-muted-foreground/30 font-medium ${isRestricted ? "opacity-50 cursor-not-allowed bg-muted" : ""}`;

        return (
            <div key={p.key} className={`space-y-1.5 animate-scale-in ${isRestricted ? "pointer-events-none" : ""}`}>
                <label className="text-[11px] font-bold tracking-wider text-muted-foreground flex items-center gap-1" htmlFor={id}>
                    {label}
                    {p.required && <span className="text-primary">*</span>}
                    {isRestricted && (
                        <span className="text-[9px] font-black uppercase tracking-tighter text-amber-500 bg-amber-500/10 px-1 rounded-sm border border-amber-500/20 ml-1">
                            Restricted
                        </span>
                    )}
                </label>

                {p.type === "select" && p.options ? (
                    <select
                        id={id}
                        className={baseInputClasses}
                        value={(form[p.key] as string) ?? ""}
                        onChange={(e) => handleChange(p, e.target.value)}
                    >
                        <option value="">Select soil type...</option>
                        {p.options.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                        ))}
                    </select>
                ) : (
                    <input
                        id={id}
                        type={p.type === "number" ? "number" : "text"}
                        step={p.step ?? "any"}
                        className={baseInputClasses}
                        value={(form[p.key] as number | string) ?? ""}
                        onChange={(e) => handleChange(p, e.target.value)}
                        placeholder={isRestricted ? "N/A (Coarse-grained soil)" : p.placeholder}
                        required={p.required}
                        disabled={isRestricted}
                    />
                )}
            </div>
        );
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 py-4">
            <div className="border-l-4 border-primary pl-4 py-1">
                <h2 className="text-2xl font-black tracking-tight leading-none italic uppercase">Field Entry</h2>
                <p className="text-xs text-muted-foreground mt-2 font-medium">Input raw geotechnical data for analysis and model training.</p>
            </div>

            {message && (
                <div className={`p-3 rounded-sm border flex items-center gap-3 text-xs font-bold uppercase tracking-wide animate-slide-down ${message.type === "success"
                    ? "bg-primary/10 border-primary/20 text-primary"
                    : "bg-destructive/10 border-destructive/20 text-destructive"
                    }`}>
                    <span>{message.type === "success" ? "✓" : "×"}</span>
                    {message.text}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-10">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
                    {params.map(renderField)}
                </div>

                <div className="flex justify-end border-t border-border pt-8 mt-10">
                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold uppercase tracking-tighter text-sm py-3 px-10 rounded-sm shadow-lg shadow-primary/20 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                    >
                        {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>}
                        {loading ? "Processing..." : "Save Record"}
                    </button>
                </div>
            </form>
        </div>
    );
}
