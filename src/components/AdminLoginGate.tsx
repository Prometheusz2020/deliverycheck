"use client";

import { useState } from "react";
import { loginAdmin } from "@/lib/auth-actions";
import { Lock, Loader2, ArrowRight, ShieldAlert } from "lucide-react";

export default function AdminLoginGate() {
  const [adminPass, setAdminPass] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    try {
      const res = await loginAdmin(adminPass);
      if (res.success) {
        window.location.reload(); // Recarrega para recatar o estado via Server Component
      } else {
        alert("Chave Mestra incorreta.");
      }
    } catch (err) {
      alert("Erro na conexão segura.");
    }
    setIsLoggingIn(false);
  };

  return (
    <div className="animate-entrance" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '85vh', padding: '1rem' }}>
      <div className="card-premium" style={{ width: '100%', maxWidth: '400px', textAlign: 'center', padding: '4rem 2rem' }}>
        <div style={{ padding: '1.2rem', background: 'rgba(112, 0, 255, 0.1)', borderRadius: '24px', display: 'inline-flex', marginBottom: '2rem' }}>
          <Lock size={48} style={{ color: 'var(--secondary)' }} />
        </div>
        
        <h1 style={{ fontSize: '2.2rem', marginBottom: '0.5rem' }}>RESTRICTED AREA</h1>
        <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.4em', marginBottom: '3rem' }}>ZtiLabs Admin Console</p>
        
        <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <label style={{ fontSize: '9px', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Chave Mestra de Acesso</label>
            <input 
              type="password" 
              value={adminPass} 
              onChange={e => setAdminPass(e.target.value)} 
              className="input-premium" 
              placeholder="••••••••" 
              required
              autoFocus
              autoComplete="current-password"
            />
          </div>
          <button type="submit" disabled={isLoggingIn} className="btn-main" style={{ marginTop: '1rem', background: 'linear-gradient(135deg, var(--secondary), #4b00ff)' }}>
            {isLoggingIn ? <Loader2 size={18} className="spin" /> : <span>Autenticar Terminal</span>}
            <ArrowRight size={18} />
          </button>
        </form>

        <div style={{ marginTop: '3rem', padding: '1rem', background: 'rgba(255, 45, 85, 0.05)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid rgba(255, 45, 85, 0.1)' }}>
           <ShieldAlert size={16} style={{ color: 'var(--danger)' }} />
           <p style={{ fontSize: '10px', color: 'var(--danger)', fontWeight: 700, textAlign: 'left', lineHeight: 1.4 }}>Tentativas não autorizadas são registradas pelo núcleo.</p>
        </div>
      </div>
      <style jsx>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
