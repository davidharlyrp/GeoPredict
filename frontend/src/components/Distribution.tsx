import { useState, useEffect } from "react";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    Scatter, ZAxis, Line, ComposedChart
} from "recharts";
import {
    Info, AlertTriangle, Database, Activity,
    ArrowRightLeft, TrendingUp, LayoutGrid,
    Maximize2, Zap, Sliders
} from "lucide-react";
import { InlineMath } from "react-katex";
import "katex/dist/katex.min.css";
import type { ParamConfig, DistributionData, NumericDistribution, CategoricalDistribution, RegressionResult } from "../types";
import { loadParamConfig, getAllParams } from "../types";
import { getDistributionData, getRegressionData, discoverFormula } from "../services/api";

export default function Distribution() {
    const [params, setParams] = useState<ParamConfig[]>([]);
    const [stats, setStats] = useState<DistributionData | null>(null);
    const [selectedKey, setSelectedKey] = useState<string>("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const init = async () => {
            try {
                const [cfg, data] = await Promise.all([
                    loadParamConfig(),
                    getDistributionData()
                ]);
                const all = getAllParams(cfg);
                setParams(all);
                setStats(data);
                if (all.length > 0) setSelectedKey(all[0].key);
            } catch (err) {
                console.error("Failed to load distribution data", err);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);

    if (loading || !stats) {
        return (
            <div className="h-96 flex flex-col items-center justify-center space-y-4">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Analyzing Dataset...</p>
            </div>
        );
    }

    const currentParam = params.find((p: ParamConfig) => p.key === selectedKey);
    const currentStats = stats[selectedKey];

    const renderNumericAnalysis = (s: NumericDistribution, p: ParamConfig) => {
        const isHighlySkewed = Math.abs(s.skew) > 1;

        return (
            <div className="space-y-6 animate-fade-in">
                {/* Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: "Mean (Average)", value: s.mean.toFixed(2), icon: Activity },
                        { label: "Median", value: s.median.toFixed(2), icon: ArrowRightLeft },
                        { label: "Std Deviation", value: s.std.toFixed(2), icon: TrendingUp },
                        {
                            label: "Data Quality", value: s.bias, icon: Info,
                            color: s.bias === "Neutral" ? "text-emerald-500" : "text-amber-500"
                        }
                    ].map((item, i) => (
                        <div key={i} className="bg-card border border-border p-4 rounded-sm space-y-1">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{item.label}</span>
                                <item.icon className="w-3 h-3 text-muted-foreground/50" />
                            </div>
                            <p className={`text-xl font-bold tracking-tighter ${item.color || "text-foreground"}`}>
                                {item.value}
                            </p>
                        </div>
                    ))}
                </div>

                {/* Histogram & Analysis */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-card border border-border p-6 rounded-sm">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                                <Database className="w-4 h-4 text-primary" />
                                Distribution Frequency
                            </h3>
                            <div className="text-[10px] text-muted-foreground font-medium">
                                Sample Size: {s.count} Records
                            </div>
                        </div>

                        <div className="h-64 mt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={s.histogram} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(0 0% 15%)" />
                                    <XAxis
                                        dataKey="bin"
                                        fontSize={9}
                                        tick={{ fill: 'hsl(0 0% 40%)' }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        fontSize={9}
                                        tick={{ fill: 'hsl(0 0% 40%)' }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'hsl(0 0% 8%)', border: '1px solid hsl(0 0% 18%)', borderRadius: '4px' }}
                                        itemStyle={{ fontSize: '10px', color: '#fff', fontWeight: 'bold' }}
                                        labelStyle={{ fontSize: '10px', color: 'hsl(0 0% 60%)', marginBottom: '4px' }}
                                    />
                                    <Bar dataKey="count" fill="var(--color-primary)" radius={[2, 2, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="bg-card border border-border p-5 rounded-sm space-y-4">
                            <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-primary">
                                <Info className="w-4 h-4" />
                                Model Context
                            </h3>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                AI model predicts best at the peak of this chart. Data outside the dense area (outliers) might have lower reliability.
                            </p>
                            {isHighlySkewed && (
                                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-sm flex gap-3">
                                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold text-amber-500 uppercase">Detection: High Bias</p>
                                        <p className="text-[10px] text-amber-500/80 leading-tight">
                                            Data is heavily concentrated. Add more balanced variety for better AI results.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="bg-card border border-border p-5 rounded-sm space-y-3">
                            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Range Statistics</h3>
                            <div className="flex justify-between items-center py-2 border-b border-border/50">
                                <span className="text-[10px] font-bold text-muted-foreground">Minimum Range</span>
                                <span className="text-xs font-mono font-bold text-primary">{s.min} {p.unit}</span>
                            </div>
                            <div className="flex justify-between items-center py-2">
                                <span className="text-[10px] font-bold text-muted-foreground">Maximum Range</span>
                                <span className="text-xs font-mono font-bold text-primary">{s.max} {p.unit}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderCategoricalAnalysis = (s: CategoricalDistribution) => (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
            <div className="bg-card border border-border p-6 rounded-sm">
                <h3 className="text-xs font-black uppercase tracking-widest mb-6 flex items-center gap-2">
                    <LayoutGrid className="w-4 h-4 text-primary" />
                    Category Frequency
                </h3>
                <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={s.distribution} layout="vertical" margin={{ left: 20, right: 30 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(0 0% 15%)" />
                            <XAxis type="number" hide />
                            <YAxis
                                dataKey="label"
                                type="category"
                                fontSize={10}
                                tick={{ fill: 'hsl(0 0% 80%)' }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <Tooltip
                                cursor={{ fill: 'rgba(114, 123, 86, 0.1)' }}
                                contentStyle={{ backgroundColor: 'hsl(0 0% 8%)', border: '1px solid hsl(0 0% 18%)', borderRadius: '4px' }}
                                itemStyle={{ fontSize: '10px', color: '#fff', fontWeight: 'bold' }}
                            />
                            <Bar dataKey="count" fill="var(--color-primary)" radius={[0, 2, 2, 0]} barSize={20} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="bg-card border border-border p-6 rounded-sm space-y-6">
                <h3 className="text-xs font-black uppercase tracking-widest text-primary">Dataset Composition</h3>
                <div className="space-y-4">
                    {s.distribution.map((item, i) => (
                        <div key={i} className="space-y-2">
                            <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                                <span>{item.label}</span>
                                <span>{item.count} Records ({Math.round((item.count / s.count) * 100)}%)</span>
                            </div>
                            <div className="w-full bg-muted/30 h-1.5 rounded-full overflow-hidden">
                                <div
                                    className="bg-primary h-full transition-all duration-1000"
                                    style={{ width: `${(item.count / s.count) * 100}%` }}
                                ></div>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="pt-6 border-t border-border flex items-center justify-between text-muted-foreground">
                    <span className="text-[10px] font-bold uppercase tracking-widest">Total Categorical Data</span>
                    <span className="text-sm font-bold font-mono">{s.count} Samples</span>
                </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-12 py-4">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-l-4 border-primary pl-4 py-1">
                <div>
                    <h2 className="text-2xl font-black tracking-tight leading-none italic uppercase">Data Distribution</h2>
                    <p className="text-xs text-muted-foreground mt-2 font-medium">Analyze dataset coverage and identify bias for reliable AI results.</p>
                </div>

                <div className="flex items-center gap-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground text-primary">Single Parameter View:</label>
                    <select
                        className="bg-muted/40 border border-border rounded-sm py-1.5 px-3 text-xs font-bold focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                        value={selectedKey}
                        onChange={(e) => setSelectedKey(e.target.value)}
                    >
                        {params.map((p: ParamConfig) => (
                            <option key={p.key} value={p.key}>{p.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Analysis Content */}
            {currentStats && currentParam && (
                currentStats.type === "numeric" ?
                    renderNumericAnalysis(currentStats as NumericDistribution, currentParam) :
                    renderCategoricalAnalysis(currentStats as CategoricalDistribution)
            )}

            {/* Regression Analysis Section */}
            <div className="border-t border-border pt-12">
                <RegressionPlotter params={params.filter((p: ParamConfig) => p.type === "number")} />
            </div>
        </div>
    );
}

// --- Regression Plotter Sub-component ---
function RegressionPlotter({ params }: { params: ParamConfig[] }) {
    const [xKeys, setXKeys] = useState<string[]>([params[0]?.key || ""]);
    const [yKey, setYKey] = useState(params[1]?.key || params[0]?.key || "");
    const [modelType, setModelType] = useState("auto");
    const [forceOrigin, setForceOrigin] = useState(false);
    const [data, setData] = useState<RegressionResult | null>(null);
    const [loading, setLoading] = useState(false);

    const isDiscovery = modelType === "discovery";

    useEffect(() => {
        if (!xKeys.length || !xKeys[0] || !yKey) return;
        setLoading(true);

        if (isDiscovery) {
            discoverFormula(xKeys, yKey)
                .then(setData)
                .catch(err => console.error("Discovery failed", err))
                .finally(() => setLoading(false));
        } else {
            getRegressionData(xKeys[0], yKey, forceOrigin, modelType)
                .then(setData)
                .catch(err => console.error("Regression failed", err))
                .finally(() => setLoading(false));
        }
    }, [xKeys, yKey, forceOrigin, modelType, isDiscovery]);

    const yParam = params.find((p: ParamConfig) => p.key === yKey);

    const toggleXKey = (key: string) => {
        if (isDiscovery) {
            setXKeys(prev => prev.includes(key)
                ? (prev.length > 1 ? prev.filter(k => k !== key) : prev)
                : [...prev, key]
            );
        } else {
            setXKeys([key]);
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1">
                    <h3 className="text-lg font-black uppercase tracking-tight italic flex items-center gap-2">
                        <Zap className="w-5 h-5 text-primary" />
                        Correlation & Formula Discovery
                    </h3>
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Derive complex empirical relationships from soil data</p>
                </div>

                <div className="flex flex-wrap items-center gap-4 bg-muted/20 p-2 rounded-sm border border-border">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">Mode:</span>
                        <select
                            className="bg-background border border-border rounded-sm px-2 py-1 text-[10px] font-bold outline-none focus:border-primary text-primary"
                            value={modelType}
                            onChange={(e) => {
                                const newType = e.target.value;
                                if (newType !== "discovery" && xKeys.length > 1) {
                                    setXKeys([xKeys[0]]);
                                }
                                setModelType(newType);
                            }}
                        >
                            <option value="auto">Auto (Best Fit)</option>
                            <option value="discovery">Formula Discovery (Multi)</option>
                            <option value="Linear">Linear</option>
                            <option value="Polynomial">Polynomial</option>
                            <option value="Power">Power</option>
                            <option value="Exponential">Exponential</option>
                        </select>
                    </div>

                    {!isDiscovery && (
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">X-Axis:</span>
                            <select
                                className="bg-background border border-border rounded-sm px-2 py-1 text-[10px] font-bold outline-none focus:border-primary"
                                value={xKeys[0] || ""}
                                onChange={(e) => setXKeys([e.target.value])}
                            >
                                {params.map((p: ParamConfig) => <option key={p.key} value={p.key}>{p.label}</option>)}
                            </select>
                        </div>
                    )}

                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">Target (Y):</span>
                        <select
                            className="bg-background border border-border rounded-sm px-2 py-1 text-[10px] font-bold outline-none focus:border-primary"
                            value={yKey}
                            onChange={(e) => setYKey(e.target.value)}
                        >
                            {params.map((p: ParamConfig) => <option key={p.key} value={p.key}>{p.label}</option>)}
                        </select>
                    </div>

                    {!isDiscovery && (
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <input
                                type="checkbox"
                                className="w-3 h-3 accent-primary"
                                checked={forceOrigin}
                                onChange={(e) => setForceOrigin(e.target.checked)}
                            />
                            <span className="text-[10px] font-bold text-muted-foreground uppercase group-hover:text-primary transition-colors">Force (0,0)</span>
                        </label>
                    )}
                </div>
            </div>

            {isDiscovery && (
                <div className="bg-muted/10 border border-border/50 p-4 rounded-sm">
                    <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-3 px-1">Active Input Parameters (X)</h4>
                    <div className="flex flex-wrap gap-2">
                        {params.map((p) => (
                            <button
                                key={p.key}
                                onClick={() => toggleXKey(p.key)}
                                className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-all ${xKeys.includes(p.key)
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-background text-muted-foreground border-border hover:border-primary/50"
                                    }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                <div className="xl:col-span-3 bg-card border border-border p-6 rounded-sm relative overflow-hidden h-[450px]">
                    {loading && (
                        <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-10 flex items-center justify-center">
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                <span className="text-[9px] font-black uppercase tracking-[0.2em]">Computing Models...</span>
                            </div>
                        </div>
                    )}

                    {data?.error ? (
                        <div className="h-full flex flex-col items-center justify-center text-rose-500 space-y-3">
                            <AlertTriangle className="w-8 h-8" />
                            <p className="text-[10px] font-black uppercase tracking-widest">{data.error}</p>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 15%)" vertical={false} />
                                <XAxis
                                    dataKey="x"
                                    type="number"
                                    fontSize={9}
                                    tick={{ fill: 'hsl(0 0% 40%)' }}
                                    axisLine={false}
                                    tickLine={false}
                                    label={{
                                        value: isDiscovery ? `Actual Observed ${yParam?.label}` : data?.x_label,
                                        position: 'bottom',
                                        fontSize: 10,
                                        fill: 'hsl(0 0% 50%)',
                                        offset: 0
                                    }}
                                    domain={['auto', 'auto']}
                                />
                                <YAxis
                                    dataKey="y"
                                    type="number"
                                    fontSize={9}
                                    tick={{ fill: 'hsl(0 0% 40%)' }}
                                    axisLine={false}
                                    tickLine={false}
                                    label={{
                                        value: isDiscovery ? `Discovered Model Estimate` : data?.y_label,
                                        angle: -90,
                                        position: 'left',
                                        fontSize: 10,
                                        fill: 'hsl(0 0% 50%)'
                                    }}
                                    domain={['auto', 'auto']}
                                />
                                <ZAxis type="number" range={[50, 50]} />
                                <Tooltip
                                    cursor={{ strokeDasharray: '3 3' }}
                                    contentStyle={{ backgroundColor: 'hsl(0 0% 8%)', border: '1px solid hsl(0 0% 18%)', borderRadius: '4px' }}
                                    itemStyle={{ fontSize: '10px', color: '#fff', fontWeight: 'bold' }}
                                />

                                {/* Scatter Data */}
                                <Scatter
                                    name={isDiscovery ? "Discovery Fit" : "Historical Records"}
                                    data={data?.scatter || []}
                                    fill="var(--color-primary)"
                                    fillOpacity={0.3}
                                    stroke="var(--color-primary)"
                                    strokeWidth={1}
                                />

                                {/* Trendline (Reference line for Discovery) */}
                                {isDiscovery ? (
                                    <>
                                        {/* Ideal Line 1:1 */}
                                        <Line
                                            name="Ideal Correlation (1:1)"
                                            type="monotone"
                                            data={data?.scatter ? [
                                                { x: Math.min(...data.scatter.map((d: any) => d.x)), y: Math.min(...data.scatter.map((d: any) => d.x)) },
                                                { x: Math.max(...data.scatter.map((d: any) => d.x)), y: Math.max(...data.scatter.map((d: any) => d.x)) }
                                            ] : []}
                                            dataKey="y"
                                            stroke="hsl(var(--color-border))"
                                            strokeWidth={1}
                                            strokeDasharray="5 5"
                                            dot={false}
                                            activeDot={false}
                                        />
                                        {/* Actual Model Trend */}
                                        <Line
                                            name="Actual Model Fit"
                                            type="monotone"
                                            data={data?.trendline || []}
                                            dataKey="y"
                                            stroke="hsl(var(--color-primary))"
                                            strokeWidth={2}
                                            dot={false}
                                            activeDot={false}
                                            isAnimationActive={!loading}
                                        />
                                    </>
                                ) : (
                                    <Line
                                        name="Trendline"
                                        type="monotone"
                                        data={data?.trendline || []}
                                        dataKey="y"
                                        stroke="#fff"
                                        strokeWidth={2}
                                        dot={false}
                                        activeDot={false}
                                        isAnimationActive={!loading}
                                    />
                                )}
                            </ComposedChart>
                        </ResponsiveContainer>
                    )}
                </div>

                <div className="space-y-4">
                    <div className="bg-card border border-border p-5 rounded-sm space-y-4 shadow-xl shadow-primary/5">
                        <div className="flex items-center gap-2 text-primary">
                            <Sliders className="w-4 h-4" />
                            <h4 className="text-[11px] font-black uppercase tracking-widest">
                                {isDiscovery ? "Discovery Engine" : "Model Statistics"}
                            </h4>
                        </div>

                        <div className="space-y-4">
                            {!isDiscovery && (
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-50">Best Fit Model</p>
                                    <p className="text-sm font-black italic text-foreground">{data?.best_model || "--"}</p>
                                </div>
                            )}

                            <div className="space-y-1">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-50">
                                    {isDiscovery ? "Derived Empirical Formula" : "Regression Equation"}
                                </p>
                                <div className="p-3 bg-muted/30 border border-border rounded-sm font-mono text-xs font-bold text-primary flex items-center justify-center min-h-[60px]">
                                    {data?.latex ? (
                                        <div className="overflow-x-auto overflow-y-hidden py-2 scale-110">
                                            <InlineMath math={data.latex} />
                                        </div>
                                    ) : (
                                        <span className="opacity-30">--</span>
                                    )}
                                </div>
                                <p className="text-[8px] opacity-40 break-all font-mono mt-1 uppercase text-center">Plain: {data?.equation}</p>
                            </div>

                            <div className="space-y-1 pt-2 border-t border-border/50">
                                <div className="flex justify-between items-end">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-50">Model Quality (R²)</p>
                                    <p className="text-xl font-black text-primary">{(data?.r2 || 0).toFixed(4)}</p>
                                </div>
                                <div className="w-full bg-muted/20 h-1 rounded-full overflow-hidden mt-2">
                                    <div
                                        className="h-full bg-primary transition-all duration-1000"
                                        style={{ width: `${Math.max(0, (data?.r2 || 0)) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-primary/5 border border-primary/20 p-5 rounded-sm space-y-3">
                        <div className="flex items-center gap-2 text-primary">
                            <Maximize2 className="w-4 h-4" />
                            <h4 className="text-[11px] font-black uppercase tracking-widest">Engineering Insight</h4>
                        </div>
                        <p className="text-xs text-muted-foreground/80 leading-relaxed italic">
                            {isDiscovery
                                ? "Discovery mode searches millions of mathematical combinations to find the exact hidden relationships between multiple soil parameters simultaneously."
                                : `Correlation between historical data helps identify intrinsic soil properties and outlier data points that might skew AI predictions.`
                            }
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
