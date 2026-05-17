import { useState, useEffect, useMemo } from "react";
import { 
  Activity, 
  Globe, 
  Calendar, 
  BarChart3, 
  Terminal, 
  Play, 
  Clock, 
  MapPin, 
  Cpu, 
  Leaf,
  Info,
  Server,
  Zap,
  ArrowRight
} from "lucide-react";
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface LogEntry {
  ts: string;
  t: "ok" | "warn" | "err" | "info" | "dim";
  m: string;
}

interface Metrics {
  co2_total: number;
  data_mb: number;
  tokens: number;
  co2_saved: number;
  co2_history: number[];
  fmt_data: { json: number; avro: number; proto: number };
  scheduler: boolean;
  logs: LogEntry[];
}

interface GeoData {
  hostname: string;
  country: string;
  city: string;
  region: string;
  lat: number;
  lon: number;
  ip: string;
  ci: number;
  org: string;
  error?: boolean;
}

interface HistoricalData {
  period_start: string;
  period_end: string;
  total_calls: number;
  total_co2_g: number;
  total_co2_saved_g: number;
  total_wh: number;
  by_day: Record<string, number>;
  by_hour: number[];
  by_model: Record<string, { calls: number; co2_g: number }>;
  by_country: Record<string, { calls: number; co2_g: number }>;
}

// --- Constants ---
const FLAG_MAP: Record<string, string> = {
  "United States": "🇺🇸",
  "Ireland": "🇮🇪",
  "Belgium": "🇧🇪",
  "Netherlands": "🇳🇱",
  "Finland": "🇫🇮",
  "Germany": "🇩🇪",
  "Colombia": "🇨🇴",
  "Brazil": "🇧🇷"
};

const SCHED_MATRIX = [
  [0, 82, "VERDE", "EJECUTAR", "todas"],
  [1, 75, "VERDE", "EJECUTAR", "todas"],
  [2, 68, "VERDE", "EJECUTAR", "todas"],
  [3, 60, "VERDE", "EJECUTAR", "todas"],
  [4, 55, "OPTIMO", "EJECUTAR", "todas + batch"],
  [5, 58, "VERDE", "EJECUTAR", "todas + batch"],
  [6, 70, "VERDE", "EJECUTAR", "todas"],
  [7, 95, "VERDE", "EJECUTAR", "todas"],
  [8, 130, "MIXTO", "EJECUTAR", "criticas"],
  [9, 165, "MIXTO", "PRECAUCIÓN", "criticas"],
  [10, 190, "MIXTO", "PRECAUCIÓN", "criticas"],
  [11, 215, "FÓSIL", "DIFERIR", "ninguna"],
  [12, 228, "FÓSIL", "DIFERIR", "ninguna"],
  [13, 232, "PICO", "DIFERIR", "ninguna"],
  [14, 220, "FÓSIL", "DIFERIR", "ninguna"],
  [15, 205, "FÓSIL", "DIFERIR", "ninguna"],
  [16, 195, "MIXTO", "PRECAUCIÓN", "criticas"],
  [17, 178, "MIXTO", "PRECAUCIÓN", "criticas"],
  [18, 160, "MIXTO", "EJECUTAR", "criticas"],
  [19, 140, "MIXTO", "EJECUTAR", "criticas"],
  [20, 118, "MIXTO", "EJECUTAR", "todas"],
  [21, 102, "MIXTO", "EJECUTAR", "todas"],
  [22, 90, "VERDE", "EJECUTAR", "todas"],
  [23, 84, "VERDE", "EJECUTAR", "todas"],
];

const ZONE_COLORS: Record<string, string> = {
  "OPTIMO": "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  "VERDE": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  "MIXTO": "bg-amber-500/10 text-amber-400 border-amber-500/20",
  "FÓSIL": "bg-rose-500/10 text-rose-400 border-rose-500/20",
  "PICO": "bg-red-900/20 text-red-500 border-red-500/40",
};

const ACTION_COLORS: Record<string, string> = {
  "EJECUTAR": "bg-indigo-500/10 text-indigo-400",
  "PRECAUCIÓN": "bg-amber-500/10 text-amber-400",
  "DIFERIR": "bg-rose-500/10 text-rose-400",
};

// --- Components ---

const MetricCard = ({ label, value, sub, colorClass, highlight }: any) => (
  <div className="card-elegant p-5 relative overflow-hidden group">
    <div className="text-[10px] text-ink-secondary uppercase font-bold tracking-[0.15em] mb-3">{label}</div>
    <div className={cn("text-3xl font-bold tracking-tight mb-1", colorClass)}>
      {value}
    </div>
    <div className="text-[11px] text-ink-secondary/70 font-medium">{sub}</div>
    {highlight && (
      <div className="absolute top-5 right-5 w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.6)] pulse-indigo" />
    )}
    <div className="absolute bottom-0 left-0 h-0.5 w-0 bg-accent transition-all duration-300 group-hover:w-full opacity-50" />
  </div>
);

export default function App() {
  const [tab, setTab] = useState<"live" | "geo" | "matrix" | "history">("live");
  const [model, setModel] = useState<"gemini" | "openai" | "both">("gemini");
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [geo, setGeo] = useState<Record<string, GeoData> | null>(null);
  const [history, setHistory] = useState<HistoricalData | null>(null);
  const [loading, setLoading] = useState(false);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchMetrics = async () => {
    try {
      const r = await fetch("/api/metrics");
      const d = await r.json();
      setMetrics(d);
    } catch (e) {}
  };

  const fetchGeo = async () => {
    try {
      const r = await fetch("/api/geo");
      const d = await r.json();
      setGeo(d);
    } catch (e) {}
  };

  const fetchHistory = async () => {
    try {
      const r = await fetch("/api/monthly");
      const d = await r.json();
      setHistory(d);
    } catch (e) {}
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (tab === "geo") fetchGeo();
    if (tab === "history") fetchHistory();
  }, [tab]);

  const runPipeline = async () => {
    setLoading(true);
    try {
      await fetch(`/api/run/${model}`);
      setTimeout(fetchMetrics, 1000);
    } catch (e) {
      console.error(e);
    } finally {
        setTimeout(() => setLoading(false), 2000);
    }
  };

  const co2Data = useMemo(() => {
    if (!metrics) return [];
    return metrics.co2_history.map((val, i) => ({ name: i, value: val }));
  }, [metrics]);

  const payloadData = useMemo(() => {
    if (!metrics) return [];
    return [
      { name: "JSON/XML", value: metrics.fmt_data.json, color: "#f85149" },
      { name: "Avro", value: metrics.fmt_data.avro, color: "#3fb950" },
      { name: "Protobuf", value: metrics.fmt_data.proto, color: "#58a6ff" },
    ];
  }, [metrics]);

  const historyDayData = useMemo(() => {
    if (!history) return [];
    return Object.entries(history.by_day).map(([date, co2]: [string, number]) => ({ 
      date: date.slice(5), 
      co2: Number(co2.toFixed(2)) 
    }));
  }, [history]);

  const historyHourData = useMemo(() => {
    if (!history) return [];
    return history.by_hour.map((val: number, h: number) => ({ hour: `${h}h`, co2: Number(val.toFixed(2)) }));
  }, [history]);

  return (
    <div className="min-h-screen bg-bg-primary font-sans flex flex-col">
      {/* Top Header Navigation */}
      <header className="h-14 bg-bg-secondary border-b border-border-subtle flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="w-3.5 h-3.5 rounded-full bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.6)]"></div>
            <span className="font-bold text-ink-primary tracking-tight text-sm">GREEN DATA PIPELINES <span className="text-gray-500 text-[10px] ml-1 font-mono tracking-widest opacity-50">V5.0</span></span>
          </div>
          <nav className="hidden md:flex gap-6 mt-1">
            {["live", "history", "geo", "matrix"].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t as any)}
                className={cn(
                  "text-[11px] font-bold tracking-widest uppercase pb-4 transition-all relative border-b-2",
                  tab === t 
                    ? "text-indigo-400 border-indigo-400" 
                    : "text-gray-500 border-transparent hover:text-gray-300"
                )}
              >
                {t}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-lg bg-bg-primary border border-border-subtle">
            <div className="w-4 h-4 rounded-full border-2 border-green-500 border-t-transparent animate-spin"></div>
            <span className="text-[10px] text-ink-secondary font-mono uppercase tracking-[0.15em]">SYNCED</span>
          </div>
          
          <div className="flex items-center gap-3">
             <div className="flex flex-col items-end hidden xs:block">
               <span className="text-[11px] font-bold text-ink-primary">{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
               <span className="text-[9px] text-ink-secondary uppercase tracking-widest">BOGOTÁ, CO</span>
             </div>
             <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-[11px] font-bold text-white shadow-lg shadow-indigo-900/20">
               GD
             </div>
          </div>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            {tab === "live" && (
              <div className="space-y-6">
                {/* Transparency Banner Card */}
                <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-5 flex flex-col md:flex-row items-center gap-5 transition-all hover:bg-indigo-500/[0.08]">
                  <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center shrink-0 border border-indigo-500/30">
                    <Info className="w-6 h-6 text-indigo-400" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-indigo-100 uppercase tracking-widest flex items-center gap-2">
                       Auditoría de Inferencia en Tiempo Real
                    </div>
                    <p className="text-[13px] text-indigo-200/70 leading-relaxed max-w-4xl">
                      Este dashboard monitorea flujos de datos reales integrados con Gemini API y OpenAI. El análisis de impacto se calcula dinámicamente según la ubicación del data center y la intensidad de carbono actual (gCO₂/kWh).
                    </p>
                  </div>
                </div>

                {/* Controls & Metrics Grid */}
                <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                  {/* Model Selection sidebar style */}
                  <div className="xl:col-span-1 flex flex-col gap-3">
                    <span className="text-[10px] font-bold text-ink-secondary uppercase tracking-[0.2em] px-1">Source Model</span>
                    <div className="flex flex-col gap-2">
                      {(["gemini", "openai", "both"] as const).map((m) => (
                        <button
                          key={m}
                          onClick={() => setModel(m)}
                          className={cn(
                            "group flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-xs font-bold",
                            model === m 
                              ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/40" 
                              : "bg-bg-secondary border-border-subtle text-ink-secondary hover:border-indigo-400/50"
                          )}
                        >
                          <span className="flex items-center gap-3">
                            <Cpu className={cn("w-4 h-4", model === m ? "text-white" : "text-gray-500 group-hover:text-indigo-400")} />
                            {m === "both" ? "Dual Pipeline" : `${m.toUpperCase()} API`}
                          </span>
                          {model === m && <ArrowRight className="w-3.5 h-3.5" />}
                        </button>
                      ))}
                    </div>
                    
                    <button
                      onClick={runPipeline}
                      disabled={loading}
                      className={cn(
                        "mt-4 w-full py-4 rounded-xl font-black text-xs tracking-[0.2em] transition-all flex items-center justify-center gap-3",
                        loading 
                          ? "bg-bg-tertiary border border-border-subtle text-secondary cursor-not-allowed" 
                          : "bg-indigo-600 text-white shadow-[0_4px_20px_rgba(79,70,229,0.3)] hover:bg-indigo-500 hover:-translate-y-0.5 active:translate-y-0"
                      )}
                    >
                      {loading ? (
                        <>
                          <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                          PROCESANDO...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 fill-current" />
                          RUN PIPELINE
                        </>
                      )}
                    </button>
                  </div>

                  {/* Metrics Row */}
                  <div className="xl:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <MetricCard 
                      label="CO₂ eq Total" 
                      value={`${metrics?.co2_total?.toFixed(2) || "0.00"} g`} 
                      sub={`Auditando carga de sesión`}
                      colorClass="text-rose-400"
                      highlight
                    />
                    <MetricCard 
                      label="Eficiencia Datos" 
                      value={`${metrics?.data_mb?.toFixed(2) || "0.00"} MB`} 
                      sub={metrics?.scheduler ? "AVRO Optimized" : "Standard JSON"}
                      colorClass="text-indigo-400"
                    />
                    <MetricCard 
                      label="Tokens Session" 
                      value={metrics?.tokens?.toLocaleString() || "0"} 
                      sub="Volumen de inferencia"
                      colorClass="text-ink-primary"
                    />
                  </div>
                </div>

                {/* Main Visual Content Grid */}
                <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
                  {/* Left Chart */}
                  <div className="xl:col-span-3 card-elegant p-6 bg-gradient-to-b from-bg-secondary to-bg-primary">
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-rose-500/10 rounded-lg">
                          <Activity className="w-4 h-4 text-rose-400" />
                        </div>
                        <span className="text-[11px] font-bold uppercase tracking-widest text-ink-primary">Trazabilidad Carbono Temporal</span>
                      </div>
                      <span className="text-[10px] font-mono text-ink-secondary text-right">METRIC: gCO2e / REQUEST</span>
                    </div>
                    <div className="h-[240px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={co2Data}>
                          <defs>
                            <linearGradient id="roseGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#21262d" vertical={false} opacity={0.5} />
                          <XAxis hide />
                          <YAxis hide domain={[0, 'dataMax + 5']} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: "#161b22", border: "1px solid #30363d", borderRadius: "12px", color: "#f0f6fc", fontSize: "12px" }}
                            cursor={{ stroke: '#30363d', strokeWidth: 2 }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="value" 
                            stroke="#f43f5e" 
                            strokeWidth={3} 
                            dot={{ r: 4, fill: "#f43f5e", strokeWidth: 2, stroke: "#0d1117" }} 
                            activeDot={{ r: 6, fill: "#f43f5e", strokeWidth: 2, stroke: "#f0f6fc" }} 
                            animationDuration={1500}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Right Chart */}
                  <div className="xl:col-span-2 card-elegant p-6 bg-gradient-to-b from-bg-secondary to-bg-primary">
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/10 rounded-lg">
                          <Zap className="w-4 h-4 text-indigo-400" />
                        </div>
                        <span className="text-[11px] font-bold uppercase tracking-widest text-ink-primary">Impacto por Serialización</span>
                      </div>
                    </div>
                    <div className="h-[240px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={payloadData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#21262d" vertical={false} opacity={0.5} />
                          <XAxis dataKey="name" stroke="#8b949e" fontSize={10} axisLine={false} tickLine={false} dy={10} />
                          <YAxis stroke="#8b949e" fontSize={10} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}MB`} />
                          <Tooltip 
                            cursor={{ fill: "rgba(99, 102, 241, 0.05)" }}
                            contentStyle={{ backgroundColor: "#161b22", border: "1px solid #30363d", borderRadius: "12px", color: "#f0f6fc" }} 
                          />
                          <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                            {payloadData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color === "#3fb950" ? "#10b981" : entry.color === "#f85149" ? "#f43f5e" : "#6366f1"} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Terminal / Log */}
                <div className="card-elegant">
                  <div className="px-6 py-4 border-b border-border-subtle bg-bg-tertiary/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-rose-500/60" />
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
                      <div className="w-2.5 h-2.5 rounded-full bg-indigo-500/60" />
                      <span className="text-[10px] text-ink-secondary font-bold uppercase tracking-[0.2em] ml-3 flex items-center gap-2">
                         Audit Flow Terminal
                      </span>
                    </div>
                    <span className="text-[9px] font-mono text-ink-secondary opacity-50 uppercase tracking-widest px-3 py-1 rounded-full border border-border-subtle">Process Monitoring</span>
                  </div>
                  <div className="terminal-elegant scrollbar-hide">
                    {metrics?.logs.map((log, i) => (
                      <div key={i} className={cn("py-1 border-l-2 border-transparent pl-3 hover:border-border-active transition-all", `tl-${log.t}`)}>
                        <span className="opacity-40 font-mono text-[11px] mr-3 font-medium select-none">[{log.ts}]</span> 
                        <span className="font-mono">{log.m}</span>
                      </div>
                    ))}
                    {(!metrics || metrics.logs.length === 0) && <div className="tl-dim italic py-4 text-center opacity-30 tracking-widest text-[11px]">INITIALIZING SYSTEMS...</div>}
                  </div>
                </div>
              </div>
            )}

          {tab === "geo" && (
            <div className="space-y-6">
              <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-5 flex items-center gap-4">
                <div className="p-2 bg-indigo-500/20 rounded-lg">
                  <Globe className="w-5 h-5 text-indigo-400" />
                </div>
                <div className="text-[13px] text-indigo-200/80">
                  <b className="text-ink-primary uppercase italic mr-2 tracking-tight">Geo Auditoría Global:</b> Trazabilidad IP de las peticiones a centros de datos. La intensidad de carbono (gCO₂/kWh) se actualiza dinámicamente según informes regionales.
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-4">
                  <div className="text-[10px] text-ink-secondary font-bold uppercase tracking-[0.2em] px-1">Servidores de Inferencia Activos</div>
                  {geo ? Object.entries(geo).map(([key, data]: [string, GeoData]) => (
                    <div key={key} className="card-elegant p-4 flex items-start gap-5 hover:bg-bg-tertiary/40 group">
                      <div className="text-4xl transition-transform group-hover:scale-110 duration-300">{FLAG_MAP[data.country] || "🌐"}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[13px] font-black text-ink-primary tracking-tight">{key.toUpperCase()} API</span>
                          <span className={cn(
                            "text-[9px] font-bold px-2.5 py-1 rounded-md border",
                            data.ci < 200 ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : "text-amber-400 bg-amber-500/10 border-amber-500/20"
                          )}>
                            {data.ci} gCO₂e
                          </span>
                        </div>
                        <div className="text-[11px] text-ink-secondary font-medium">{data.city}, {data.region}, {data.country}</div>
                        <div className="text-[10px] text-indigo-400/60 mt-2 font-mono truncate">{data.ip} · {data.hostname}</div>
                      </div>
                    </div>
                  )) : (
                    <div className="card-elegant p-12 text-center flex flex-col items-center gap-4">
                       <div className="w-8 h-8 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
                       <span className="text-[10px] font-bold text-ink-secondary uppercase tracking-[0.2em]">Resolving Nodes...</span>
                    </div>
                  )}
                </div>
                
                <div className="lg:col-span-2">
                  <div className="card-elegant p-1 bg-bg-secondary relative aspect-video shadow-2xl shadow-black/40">
                    <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#6366f1_1.5px,transparent_1.5px)] [background-size:24px_24px]" />
                    <svg viewBox="0 0 360 180" className="w-full h-full opacity-30 select-none">
                      <path d="M40 50 L100 45 L130 55 L120 80 L80 90 L50 75 Z" fill="#6366f1" />
                      <path d="M155 50 L210 45 L240 60 L235 90 L185 95 L160 80 Z" fill="#6366f1" />
                      <path d="M250 55 L320 60 L335 100 L290 120 L260 100 Z" fill="#6366f1" />
                      <path d="M70 100 L110 110 L120 140 L90 155 L65 130 Z" fill="#6366f1" />
                      <path d="M170 100 L220 110 L215 140 L185 145 L165 125 Z" fill="#6366f1" />
                    </svg>
                    {geo && Object.values(geo).map((g: GeoData, i: number) => {
                      const x = ((g.lon + 180) / 360) * 100;
                      const y = ((90 - g.lat) / 180) * 100;
                      return (
                        <div 
                          key={i} 
                          className="absolute w-3 h-3 rounded-full border-2 border-white/40 -translate-x-1/2 -translate-y-1/2 z-10"
                          style={{ 
                            left: `${x}%`, 
                            top: `${y}%`, 
                            backgroundColor: g.ci < 300 ? "#10b981" : "#f43f5e",
                            boxShadow: `0 0 20px ${g.ci < 300 ? "rgba(16,185,129,0.6)" : "rgba(244,63,94,0.6)"}`
                          }}
                        >
                          <div className="absolute top-5 left-1/2 -translate-x-1/2 whitespace-nowrap bg-indigo-600 px-3 py-1.5 rounded-lg text-[9px] font-black text-white border border-indigo-400/40 shadow-xl shadow-black/60 scale-75 md:scale-100">
                            {g.hostname.split('-')[0].toUpperCase()}
                          </div>
                        </div>
                      );
                    })}
                    {/* Local Marker */}
                    <div 
                      className="absolute w-4 h-4 rounded-full bg-indigo-500 border-2 border-white -translate-x-1/2 -translate-y-1/2 pulse-indigo z-20"
                      style={{ left: `${(( -74 + 180) / 360) * 100}%`, top: `${((90 - 4.7) / 180) * 100}%` }}
                    >
                      <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white text-bg-primary px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-2xl whitespace-nowrap">
                         Local Node (BOG)
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === "matrix" && (
            <div className="space-y-6">
              <div className="card-elegant shadow-2xl shadow-black/20">
                <div className="px-6 py-5 border-b border-border-subtle bg-bg-tertiary/30 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-indigo-400" />
                    <span className="text-[11px] text-ink-primary font-bold uppercase tracking-[0.2em]">Scheduler Programming Matrix</span>
                  </div>
                  <div className="text-[10px] font-black tracking-[0.2em] px-4 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                     LIVE SYSTEM: OPERATIONAL
                  </div>
                </div>
                <div className="overflow-x-auto scrollbar-hide">
                  <table className="w-full text-left text-[12px] border-collapse min-w-[700px]">
                    <thead>
                      <tr className="bg-bg-tertiary/20 text-ink-secondary border-b border-border-subtle">
                        <th className="px-6 py-4 font-bold tracking-widest uppercase">Time Frame</th>
                        <th className="px-6 py-4 font-bold tracking-widest uppercase text-center">Intensity</th>
                        <th className="px-6 py-4 font-bold tracking-widest uppercase">Grid Zone</th>
                        <th className="px-6 py-4 font-bold tracking-widest uppercase">Auto Action</th>
                        <th className="px-6 py-4 font-bold tracking-widest uppercase">Restrictions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {SCHED_MATRIX.map(([h, ci, zone, act, allow]) => {
                        const isCurrent = h === time.getHours();
                        return (
                          <tr key={h} className={cn("transition-colors", isCurrent ? "bg-indigo-600/10" : "hover:bg-bg-tertiary/20")}>
                            <td className="px-6 py-4 font-mono font-medium">
                                {String(h).padStart(2, '0')}:00 {isCurrent && <span className="ml-3 text-indigo-400 text-[10px] font-bold animate-pulse">● ACTIVE</span>}
                            </td>
                            <td className="px-6 py-4 text-center font-mono font-bold">
                                <span className={cn(
                                    "px-3 py-1 rounded-lg",
                                    Number(ci) < 100 ? "text-emerald-400" : Number(ci) > 200 ? "text-rose-400" : "text-amber-400"
                                )}>
                                    {ci} <span className="text-[9px] font-normal opacity-50 uppercase ml-0.5">gCO2e</span>
                                </span>
                            </td>
                            <td className="px-6 py-4">
                                <span className={cn("px-2.5 py-1 rounded-md border text-[10px] font-black uppercase tracking-tight", ZONE_COLORS[zone as string])}>
                                    {zone}
                                </span>
                            </td>
                            <td className="px-6 py-4 font-bold">
                                <span className={cn("px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest", ACTION_COLORS[act as string])}>
                                    {act}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-ink-secondary font-medium italic text-[11px] opacity-60 tracking-tight">{allow}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {tab === "history" && (
            <div className="space-y-8">
              <div className="bg-amber-500/5 border border-amber-500/20 border-l-4 border-l-amber-500 rounded-xl p-5 flex items-center gap-5 transition-all hover:bg-amber-500/[0.08]">
                <div className="p-2.5 bg-amber-500/20 rounded-xl border border-amber-500/30">
                  <BarChart3 className="w-6 h-6 text-amber-500" />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-amber-100 uppercase tracking-[0.2em] block">Monthly Audit Historical Analysis</span>
                  <p className="text-[13px] text-amber-200/80 leading-relaxed">
                    Consolidado de métricas operativas de los últimos 30 días naturales. Este análisis estadístico permite identificar derivas en la huella de carbono y optimizar el entrenamiento de modelos de programación predictiva.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                <MetricCard label="Llamadas Consolidadas (30d)" value={history?.total_calls?.toLocaleString() || "0"} sub="Total auditado" colorClass="text-indigo-400" />
                <MetricCard label="Carga de Carbono (G)" value={`${history?.total_co2_g?.toFixed(2) || "0.00"} g`} sub={`Audit trial 30-day index`} colorClass="text-rose-400" />
                <MetricCard label="Impacto de Ahorro" value={`${history?.total_co2_saved_g?.toFixed(2) || "0.00"} g`} sub={`${((history?.total_co2_saved_g || 0) / (history?.total_co2_g || 0.01) * 100).toFixed(1)}% mitigado`} colorClass="text-emerald-400" />
                <MetricCard label="Consumo Energético" value={`${history?.total_wh?.toFixed(2) || "0.00"} Wh`} sub="Grid Load Average" colorClass="text-amber-400" />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="card-elegant p-6 bg-gradient-to-b from-bg-secondary to-bg-primary">
                  <div className="text-[11px] font-black text-ink-primary uppercase tracking-[0.2em] mb-8 flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-indigo-500 rounded-full" /> Auditoría Diaria de Huella (30d)
                  </div>
                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={historyDayData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#21262d" vertical={false} opacity={0.3} />
                        <XAxis dataKey="date" stroke="#8b949e" fontSize={9} interval={2} axisLine={false} tickLine={false} />
                        <YAxis hide />
                        <Tooltip 
                          contentStyle={{ backgroundColor: "#161b22", border: "1px solid #30363d", borderRadius: "12px" }}
                          itemStyle={{ color: "#10b981" }}
                          cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }}
                        />
                        <Bar dataKey="co2" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={24} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                
                <div className="card-elegant p-6 bg-gradient-to-b from-bg-secondary to-bg-primary">
                  <div className="text-[11px] font-black text-ink-primary uppercase tracking-[0.2em] mb-8 flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-amber-500 rounded-full" /> Perfil de Carga Agregado por Hora
                  </div>
                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={historyHourData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#21262d" vertical={false} opacity={0.3} />
                        <XAxis dataKey="hour" stroke="#8b949e" fontSize={9} interval={2} axisLine={false} tickLine={false} />
                        <YAxis hide />
                        <Tooltip 
                           contentStyle={{ backgroundColor: "#161b22", border: "1px solid #30363d", borderRadius: "12px" }} 
                           itemStyle={{ color: "#6366f1" }}
                        />
                        <Line type="stepAfter" dataKey="co2" stroke="#6366f1" strokeWidth={3} dot={false} strokeDasharray="None" animationDuration={2000} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row justify-center items-center gap-8 py-8 border-2 border-border-subtle border-dashed rounded-2xl bg-bg-secondary/30">
                <div className="flex items-center gap-4 text-ink-secondary/60 text-[11px] font-mono font-bold tracking-[0.2em] px-6 py-2 rounded-xl bg-bg-primary/50">
                  <Server className="w-4 h-4 text-indigo-400" /> MASTER TRAIL: AUDIT_LOG.INDEX
                </div>
                <div className="flex items-center gap-4 text-ink-secondary/60 text-[11px] font-mono font-bold tracking-[0.2em] px-6 py-2 rounded-xl bg-bg-primary/50">
                  <Play className="w-4 h-4 text-emerald-400 rotate-90" /> REPLICATION: SYNCED
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
      </main>

      <footer className="h-7 bg-indigo-600 flex items-center px-4 justify-between text-[10px] font-medium text-white shrink-0">
        <div className="flex gap-4">
          <div className="flex items-center gap-1.5"><span className="opacity-70">Region:</span> {geo?.[Object.keys(geo)[0]]?.region || "Unknown"}</div>
          <div className="flex items-center gap-1.5"><span className="opacity-70">Audit:</span> Active</div>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-1.5">Intensity: {geo?.[Object.keys(geo)[0]]?.ci || 0} gCO2e</div>
          <div className="flex items-center gap-1.5">Optimization: 1 pending</div>
        </div>
      </footer>
    </div>
  );
}
