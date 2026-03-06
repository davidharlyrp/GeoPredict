import { useState } from "react";
import { pb } from "../services/pocketbase";
import { ShieldCheck, Mail, Lock, AlertTriangle, Loader2 } from "lucide-react";

interface LoginProps {
    onLogin: () => void;
}

export default function Login({ onLogin }: LoginProps) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            await pb.collection('users').authWithPassword(email, password);
            if (pb.authStore.isValid) {
                onLogin();
            } else {
                setError("Login failed. Please check your credentials.");
            }
        } catch (err: any) {
            setError(err.message || "Authentication failed. Make sure the user exists in PocketBase.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

            <div className="max-w-md w-full relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/20 via-primary/50 to-primary/20 rounded-lg blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>

                <div className="relative bg-card border border-border/50 rounded-lg p-8 shadow-2xl backdrop-blur-sm">
                    <div className="flex flex-col items-center mb-8">
                        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 border border-primary/20 shadow-inner">
                            <ShieldCheck className="w-8 h-8 text-primary animate-pulse" />
                        </div>
                        <h1 className="text-3xl font-black italic tracking-tighter uppercase text-foreground text-center">GeoPredict</h1>
                        <div className="h-0.5 w-12 bg-primary mt-1 rounded-full" />
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black mt-3 flex items-center gap-2">
                            <span className="w-1 h-1 bg-primary rounded-full"></span>
                            PocketBase Auth Protocol
                            <span className="w-1 h-1 bg-primary rounded-full"></span>
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <label htmlFor="email" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                <Mail className="w-3 h-3 text-primary" />
                                Email Address
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-input/50 border border-border rounded-md py-3 px-4 text-sm font-normal focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-muted-foreground/20"
                                placeholder="name@dahar.com"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="password" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                <Lock className="w-3 h-3 text-primary" />
                                Password
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-input/50 border border-border rounded-md py-3 px-4 text-sm font-normal focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-muted-foreground/20"
                                placeholder="••••••••"
                                required
                            />
                        </div>

                        {error && (
                            <div className="bg-destructive/10 border border-destructive/20 p-3 rounded-md flex items-start gap-3">
                                <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                                <p className="text-[11px] font-bold text-destructive leading-tight uppercase tracking-tight">
                                    {error}
                                </p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest text-xs py-4 rounded-md shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 group/btn overflow-hidden relative"
                        >
                            {loading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                "Initiate Clearance"
                            )}
                        </button>
                    </form>

                    <div className="mt-10 pt-6 border-t border-border/50 text-center">
                        <p className="text-[9px] text-muted-foreground font-black uppercase tracking-[0.2em] opacity-40">
                            Dahar Engineer • Secure Protocol v6.1
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
