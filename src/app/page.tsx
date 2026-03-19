"use client";

import Link from "next/link";
import { Store, Truck, Zap, BarChart3, ShieldCheck } from "lucide-react";

export default function Home() {
  return (
    <div className="animate-entrance" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '85vh', gap: '4rem', padding: '2rem' }}>
      {/* Brand Section */}
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0.8rem', background: 'rgba(0, 242, 255, 0.1)', border: '1px solid rgba(0, 242, 255, 0.2)', borderRadius: '99px', margin: '0 auto' }}>
          <Zap size={14} style={{ color: 'var(--primary)', fill: 'var(--primary)' }} />
          <span style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--primary)' }}>ZTILABS CORE v2.6.4</span>
        </div>
        <h1 style={{ fontSize: '12vw', lineHeight: '0.8', margin: '0.5rem 0' }}>DELIVERY CHECK</h1>
        <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6em', opacity: 0.7 }}>Advanced Delivery Infrastructure</p>
      </div>

      {/* Main Options */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2rem', width: '100%', maxWidth: '900px' }}>
        {/* Restaurant Portal */}
        <a href="/restaurant" style={{ textDecoration: 'none' }}>
          <div className="card-premium" style={{ height: '100%', padding: '3rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '1.5rem', background: 'rgba(255,255,255,0.03)' }}>
            <div style={{ padding: '1.2rem', background: 'rgba(0, 242, 255, 0.05)', borderRadius: '16px', color: 'var(--primary)' }}>
              <Store size={48} />
            </div>
            
            <h2 style={{ fontSize: '1.8rem', color: 'white' }}>Administração</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '2rem' }}>Acesso restrito ao painel de controle, gestão de motoristas e inteligência ZtiLabs.</p>
            
            <div style={{ marginTop: '1.5rem', color: 'var(--primary)', fontWeight: 900, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Acessar Comando <Zap size={12} />
            </div>
          </div>
        </a>

        {/* Driver Portal */}
        <Link href="/driver" style={{ textDecoration: 'none' }}>
          <div className="card-premium" style={{ height: '100%', padding: '3rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '1.5rem', background: 'rgba(255,255,255,0.03)' }}>
            <div style={{ padding: '1.2rem', background: 'rgba(0, 255, 136, 0.05)', borderRadius: '16px', color: 'var(--accent)' }}>
              <Truck size={48} />
            </div>
            
            <h2 style={{ fontSize: '1.8rem', color: 'white' }}>Motoboy Hub</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '250px' }}>Scanner inteligente de rotas e acompanhamento de ganhos acumulados.</p>
            
            <div style={{ marginTop: '1.5rem', color: 'var(--accent)', fontWeight: 900, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Abrir Rota <Zap size={12} />
            </div>
          </div>
        </Link>
      </div>

      {/* Trust Badges */}
      <div style={{ display: 'flex', gap: '3rem', marginTop: '3rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--text-muted)' }}>
          <ShieldCheck size={16} /> Secure Ledger
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--text-muted)' }}>
          <BarChart3 size={16} /> Data Analytics
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--text-muted)' }}>
          <Zap size={16} /> Edge Processing
        </div>
      </div>
    </div>
  );
}
