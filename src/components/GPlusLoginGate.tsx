"use client";

import React, { useState } from "react";
import { Lock, Loader2, ArrowRight, UserPlus, LogIn, AlertCircle } from "lucide-react";
import { loginGPlusUser, createGPlusTenantAccount } from "@/lib/gplus-actions";
import ThemeToggle from "./ThemeToggle";

export default function GPlusLoginGate() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!usuario.trim() || !senha.trim()) {
      setErrorMsg("Por favor, preencha o usuário e a senha.");
      return;
    }

    setLoading(true);
    try {
      let res;
      if (isRegistering) {
        res = await createGPlusTenantAccount(usuario, senha, nomeEmpresa);
      } else {
        res = await loginGPlusUser(usuario, senha);
      }

      if (res.success) {
        window.location.reload();
      } else {
        setErrorMsg(res.error || "Erro ao realizar autenticação.");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Erro de conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-entrance" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '85vh', padding: '1rem' }}>
      <div className="card-premium" style={{ width: '100%', maxWidth: '420px', textAlign: 'center', padding: '2.5rem 2rem', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '1rem', right: '1rem' }}>
          <ThemeToggle />
        </div>
        <div style={{ padding: '1.2rem', background: 'rgba(0, 242, 255, 0.1)', borderRadius: '24px', display: 'inline-flex', marginBottom: '1.5rem', border: '1px solid rgba(0, 242, 255, 0.2)' }}>
          <Lock size={42} style={{ color: 'var(--primary)' }} />
        </div>
        
        <h1 style={{ fontSize: '2rem', marginBottom: '0.2rem' }}>PAINEL GPLUS</h1>
        <p style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.3em', marginBottom: '2rem' }}>
          {isRegistering ? "Novo Cadastro de Empresa" : "Autenticação do Sistema"}
        </p>

        {errorMsg && (
          <div style={{ padding: '0.8rem 1rem', background: 'rgba(255, 45, 85, 0.1)', border: '1px solid var(--danger)', borderRadius: '8px', color: '#ff4d6d', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.2rem', textAlign: 'left' }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', textAlign: 'left' }}>
          {isRegistering && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Nome da Empresa / Estabelecimento
              </label>
              <input 
                type="text" 
                value={nomeEmpresa} 
                onChange={e => setNomeEmpresa(e.target.value)} 
                className="input-premium" 
                placeholder="Ex: Restaurante Central" 
              />
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Usuário GPlus <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input 
              type="text" 
              value={usuario} 
              onChange={e => setUsuario(e.target.value)} 
              className="input-premium" 
              placeholder="Digite seu usuário" 
              required
              autoFocus
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Senha <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input 
              type="password" 
              value={senha} 
              onChange={e => setSenha(e.target.value)} 
              className="input-premium" 
              placeholder="••••••••" 
              required
            />
          </div>

          <button type="submit" disabled={loading} className="btn-main" style={{ marginTop: '0.5rem', width: '100%' }}>
            {loading ? <Loader2 size={18} className="spin" /> : (
              <>
                {isRegistering ? <UserPlus size={18} /> : <LogIn size={18} />}
                <span>{isRegistering ? "Cadastrar Empresa" : "Entrar no Painel"}</span>
              </>
            )}
            <ArrowRight size={18} />
          </button>

          <button 
            type="button" 
            onClick={() => {
              setIsRegistering(!isRegistering);
              setErrorMsg(null);
            }} 
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer', textAlign: 'center', marginTop: '0.5rem', textDecoration: 'underline' }}
          >
            {isRegistering ? "Já possui conta? Clique para entrar" : "Primeiro acesso? Cadastrar nova empresa"}
          </button>
        </form>
      </div>
    </div>
  );
}
