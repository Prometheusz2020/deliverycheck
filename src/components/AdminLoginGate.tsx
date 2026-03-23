"use client";

import { useState } from "react";
import { loginAdmin } from "@/lib/auth-actions";
import { Lock, Loader2, ArrowRight, ShieldAlert } from "lucide-react";

export default function AdminLoginGate() {
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [useMasterKey, setUseMasterKey] = useState(false);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    try {
      const res = useMasterKey 
        ? await loginAdmin(adminPass)
        : await loginAdmin(adminEmail, adminPass);

      if (res.success) {
        window.location.reload(); 
      } else {
        alert(useMasterKey ? "Chave Mestra incorreta." : "Email ou Senha incorretos.");
      }
    } catch (err) {
      console.error("Login attempt failed:", err);
      alert("Erro na conexão segura.");
    }
    setIsLoggingIn(false);
  };

  return (
    <div className="animate-entrance" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '85vh', padding: '1rem' }}>
      <div className="card-premium" style={{ width: '100%', maxWidth: '400px', textAlign: 'center', padding: '3rem 2rem' }}>
        <div style={{ padding: '1.2rem', background: 'rgba(112, 0, 255, 0.1)', borderRadius: '24px', display: 'inline-flex', marginBottom: '1.5rem' }}>
          <Lock size={48} style={{ color: 'var(--secondary)' }} />
        </div>
        
        <h1 style={{ fontSize: '2.2rem', marginBottom: '0.2rem' }}>RESTRICTED AREA</h1>
        <p style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.3em', marginBottom: '2rem' }}>ZtiLabs Admin Console</p>
        
        <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', textAlign: 'left' }}>
          {!useMasterKey ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '9px', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>E-mail de Acesso</label>
                <input 
                  type="email" 
                  value={adminEmail} 
                  onChange={e => setAdminEmail(e.target.value)} 
                  className="input-premium" 
                  placeholder="admin@ztilabs.com.br" 
                  required
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '9px', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Senha Pessoal</label>
                <input 
                  type="password" 
                  value={adminPass} 
                  onChange={e => setAdminPass(e.target.value)} 
                  className="input-premium" 
                  placeholder="••••••••" 
                  required
                />
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
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
          )}

          <button type="submit" disabled={isLoggingIn} className="btn-main" style={{ marginTop: '0.5rem', background: 'linear-gradient(135deg, var(--secondary), #4b00ff)' }}>
            {isLoggingIn ? <Loader2 size={18} className="spin" /> : <span>Autenticar Terminal</span>}
            <ArrowRight size={18} />
          </button>

          <button 
            type="button" 
            onClick={() => setUseMasterKey(!useMasterKey)} 
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '9px', cursor: 'pointer', textAlign: 'center', marginTop: '0.5rem', textDecoration: 'underline' }}
          >
            {useMasterKey ? "Usar Login Pessoal" : "Usar Chave Mestra"}
          </button>
        </form>

        <div style={{ marginTop: '2.5rem', padding: '0.8rem', background: 'rgba(255, 45, 85, 0.05)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid rgba(255, 45, 85, 0.1)' }}>
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
