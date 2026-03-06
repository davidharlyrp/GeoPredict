import { useState, useEffect } from "react";
import DataEntry from "./components/DataEntry";
import Distribution from "./components/Distribution";
import Predictor from "./components/Predictor";
import Login from "./components/Login";
import { getStats } from "./services/api";
import { pb } from "./services/pocketbase";
import { LogOut, User, ShieldCheck } from "lucide-react";

type Tab = "entry" | "distribution" | "predictor";

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("entry");
  const [totalRecords, setTotalRecords] = useState<number | null>(null);
  const [authState, setAuthState] = useState(pb.authStore.isValid);

  const fetchStats = async () => {
    try {
      const stats = await getStats();
      setTotalRecords(stats.total_records);
    } catch (err) {
      console.error("Failed to fetch stats", err);
    }
  };

  useEffect(() => {
    if (authState) {
      fetchStats();
      window.addEventListener("refreshStats", fetchStats);
    }
    return () => window.removeEventListener("refreshStats", fetchStats);
  }, [authState]);

  const handleLogin = () => {
    setAuthState(pb.authStore.isValid);
  };

  const handleLogout = () => {
    pb.authStore.clear();
    setAuthState(false);
  };

  if (!authState) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/40 leading-relaxed tracking-tight">
      <header className="border-b border-border bg-card/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center border border-primary/20">
              <ShieldCheck className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-black leading-none tracking-tighter italic uppercase">GeoPredict</h1>
              <p className="text-[9px] text-muted-foreground uppercase tracking-[0.2em] font-black opacity-60">Daharin • v6.0</p>
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-1 bg-muted/30 p-1 rounded-lg border border-border/50">
            <button
              className={`px-6 py-2 text-[11px] font-black uppercase tracking-widest rounded-md transition-all ${activeTab === "entry"
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              onClick={() => setActiveTab("entry")}
            >
              Data Entry
            </button>
            <button
              className={`px-6 py-2 text-[11px] font-black uppercase tracking-widest rounded-md transition-all ${activeTab === "distribution"
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              onClick={() => setActiveTab("distribution")}
            >
              Distribution
            </button>
            <button
              className={`px-6 py-2 text-[11px] font-black uppercase tracking-widest rounded-md transition-all ${activeTab === "predictor"
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              onClick={() => setActiveTab("predictor")}
            >
              Predictor
            </button>
          </nav>

          <div className="flex items-center gap-6">
            <div className="hidden md:flex flex-col items-end pr-6 border-r border-border/50">
              <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-black opacity-40">System Records</span>
              <span className="text-sm font-mono font-black text-primary tracking-tighter">
                {totalRecords !== null ? totalRecords.toLocaleString() : "--"}
              </span>
            </div>

            <button
              onClick={handleLogout}
              className="group flex items-center gap-3 pl-2"
            >
              <div className="w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center group-hover:border-primary/50 transition-colors">
                <User className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-[10px] font-black uppercase tracking-tight text-foreground group-hover:text-primary transition-colors">Authorized</div>
                <div className="text-[9px] font-bold text-muted-foreground flex items-center gap-1 group-hover:text-destructive transition-colors">
                  <LogOut className="w-2.5 h-2.5" />
                  Logout
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="lg:hidden border-t border-border/50 bg-muted/20 flex p-1">
          <button
            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded transition-all ${activeTab === "entry" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            onClick={() => setActiveTab("entry")}
          >
            Entry
          </button>
          <button
            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded transition-all ${activeTab === "distribution" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            onClick={() => setActiveTab("distribution")}
          >
            Stats
          </button>
          <button
            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded transition-all ${activeTab === "predictor" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            onClick={() => setActiveTab("predictor")}
          >
            AI Engine
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 lg:p-10 opacity-0 animate-fade-in [animation-fill-mode:forwards]">
        <div className="bg-card/30 backdrop-blur-sm border border-border/50 p-6 lg:p-10 rounded-xl shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-primary/10 transition-colors duration-1000" />
          <div className="relative">
            {activeTab === "entry" && <DataEntry />}
            {activeTab === "distribution" && <Distribution />}
            {activeTab === "predictor" && <Predictor />}
          </div>
        </div>
      </main>

      <footer className="border-t border-border py-6 bg-card/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black opacity-50">
            &copy; {new Date().getFullYear()} Daharin • Geotechnical Machine Learning
          </p>
          <div className="flex gap-4">
            <div className="h-1 w-1 bg-primary/20 rounded-full" />
            <div className="h-1 w-1 bg-primary/40 rounded-full" />
            <div className="h-1 w-1 bg-primary/20 rounded-full" />
          </div>
        </div>
      </footer>
    </div>
  );
}
