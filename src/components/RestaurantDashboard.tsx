"use client";

import { useEffect, useState, useCallback } from "react";
// Importações seguras que NÃO usam Prisma
import { 
  loginAdmin, getSessionAdmin, logoutAdmin 
} from "@/lib/auth-actions";
import { Delivery, DeliverySummary, Driver } from "@/lib/types";
import { 
  Clock, UserPlus, MessageSquare, DollarSign, Loader2, 
  BarChart2, Users, ClipboardList, TrendingUp, MapPin, 
  Briefcase, Lock, ShieldAlert, LogOut, ArrowRight 
} from "lucide-react";

export default function RestaurantDashboard() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [adminPass, setAdminPass] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [summary, setSummary] = useState<DeliverySummary>({ 
    pending: 0, onRoute: 0, delivered: 0, totalValue: 0, totalFees: 0 
  });
  const [activeTab, setActiveTab] = useState<'deliveries' | 'drivers'>('deliveries');
  
  const [newDriverName, setNewDriverName] = useState("");
  const [newDriverPass, setNewDriverPass] = useState("");
  const [isAddingDriver, setIsAddingDriver] = useState(false);

  // Carregamento Preguiçoso das ações de Banco de Dados
  // Isto evita que o Prisma quebre a renderização inicial do Login
  const fetchData = useCallback(async () => {
    try {
      const actions = await import("@/lib/actions");
      const [d, dr, s] = await Promise.all([
        actions.getDeliveries(), 
        actions.getDrivers(), 
        actions.getSummary()
      ]);
      setDeliveries(d as any);
      setDrivers(dr);
      setSummary(s);
    } catch (err) {
      console.error("Dashboard Fetch Error:", err);
    }
  }, []);

  // Monitor de Segurança
  useEffect(() => {
    const checkSession = async () => {
      try {
        const session = await getSessionAdmin();
        setIsAdmin(session);
        if (session) fetchData();
      } catch (err) {
        setIsAdmin(false);
      }
    };
    checkSession();
  }, [fetchData]);

  // Pooling se logado
  useEffect(() => {
    if (!isAdmin) return;
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData, isAdmin]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    try {
      const res = await loginAdmin(adminPass);
      if (res.success) {
        setIsAdmin(true);
        fetchData();
      } else {
        alert("Senha incorreta.");
      }
    } catch (err) {
      alert("Erro de autenticação.");
    }
    setIsLoggingIn(false);
  };

  const handleAdminLogout = async () => {
    await logoutAdmin();
    setIsAdmin(false);
  };

  const handleAddDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDriverName) return;
    setIsAddingDriver(true);
    const actions = await import("@/lib/actions");
    await actions.addDriver(newDriverName, newDriverPass);
    setNewDriverName("");
    setNewDriverPass("");
    setIsAddingDriver(false);
    fetchData();
  };

  const handleTransfer = async (delId: string, drId: string) => {
    const actions = await import("@/lib/actions");
    await actions.reassignDelivery(delId, drId);
    fetchData();
  };

  const handleObs = async (id: string, text: string) => {
    const actions = await import("@/lib/actions");
    await actions.updateObservations(id, text);
    setDeliveries(prev => prev.map(d => d.id === id ? { ...d, observations: text } : d));
  };

  if (isAdmin === null) return (
    <div className="flex-center" style={{ height: '80vh' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
        <Loader2 className="spin text-primary" size={48} />
        <p style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.2em' }}>ENCRYPTING COMMAND CHANNEL...</p>
      </div>
    </div>
  );

  if (!isAdmin) {
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
                placeholder="Identificação Administrativa" 
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
             <p style={{ fontSize: '10px', color: 'var(--danger)', fontWeight: 700, textAlign: 'left', lineHeight: 1.4 }}>Acesso monitorado v.2.4.6</p>
          </div>
        </div>

        <style jsx>{`
          .spin { animation: spin 1s linear infinite; }
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  return (
    <div className="page-container animate-entrance" style={{ marginTop: '2rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', marginBottom: '0.2rem' }}>COMMAND CENTER</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5em' }}>ZtiLabs Intelligence Dashboard</p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', background: 'var(--surface-high)', padding: '0.4rem', borderRadius: '12px' }}>
            <button 
              onClick={() => setActiveTab('deliveries')}
              className={activeTab === 'deliveries' ? 'btn-main' : 'btn-outline'}
              style={{ padding: '0.6rem 1.5rem', fontSize: '12px', borderRadius: '8px' }}
            >
              <ClipboardList size={16} /> Entregas
            </button>
            <button 
              onClick={() => setActiveTab('drivers')}
              className={activeTab === 'drivers' ? 'btn-main' : 'btn-outline'}
              style={{ padding: '0.6rem 1.5rem', fontSize: '12px', borderRadius: '8px', marginLeft: '0.4rem' }}
            >
              <Users size={16} /> Equipe
            </button>
          </div>
          
          <button 
            onClick={handleAdminLogout}
            style={{ padding: '0.8rem', background: 'rgba(255,45,85,0.05)', border: '1px solid rgba(255,45,85,0.1)', color: 'var(--danger)', borderRadius: '12px', cursor: 'pointer' }}
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <div className="grid-quarters">
        {[
          { label: 'Pendente', val: summary.pending, icon: Clock, color: 'var(--warning)' },
          { label: 'Em Rota', val: summary.onRoute, icon: TrendingUp, color: 'var(--primary)' },
          { label: 'Receita', val: `R$ ${summary.totalValue.toFixed(2)}`, icon: BarChart2, color: 'var(--success)' },
          { label: 'Taxas', val: `R$ ${summary.totalFees.toFixed(2)}`, icon: DollarSign, color: 'var(--secondary)' }
        ].map((c, i) => (
          <div key={i} className="card-premium" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: c.color, marginBottom: '1.5rem' }}>
              <c.icon size={24} />
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }}>{c.label}</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff' }}>{c.val}</p>
          </div>
        ))}
      </div>

      {activeTab === 'deliveries' ? (
        <div className="table-wrapper">
          <table className="table-premium">
            <thead>
              <tr>
                <th>Referência</th>
                <th>Cliente</th>
                <th>Montante</th>
                <th>Responsável</th>
                <th>Notas</th>
                <th style={{ textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-muted)' }}>Módulo de dados aguardando atividade...</td></tr>
              ) : (
                deliveries.map(delivery => (
                  <tr key={delivery.id}>
                    <td>
                      <span style={{ fontFamily: 'JetBrains Mono', fontSize: '11px', color: 'var(--primary)', fontWeight: 700 }}>#{delivery.orderNumber}</span>
                    </td>
                    <td>
                      <p style={{ fontWeight: 800 }}>{delivery.customerName}</p>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{delivery.address}</p>
                    </td>
                    <td>
                      <p style={{ fontWeight: 800, color: 'var(--success)' }}>R$ {delivery.totalAmount?.toFixed(2)}</p>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <p style={{ fontSize: '11px' }}>{delivery.deliveryPerson || "Livre"}</p>
                        {delivery.status !== 'ENTREGUE' && (
                          <select 
                            onChange={(e) => handleTransfer(delivery.id, e.target.value)}
                            className="input-premium"
                            style={{ padding: '0.2rem', fontSize: '10px' }}
                            value={delivery.driverId || ""}
                          >
                            <option value="">Delegar...</option>
                            {drivers.map(dr => (
                              <option key={dr.id} value={dr.id}>{dr.name}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    </td>
                    <td>
                       <input 
                          type="text" 
                          defaultValue={delivery.observations || ""}
                          onBlur={(e) => handleObs(delivery.id, e.target.value)}
                          className="input-premium"
                          style={{ fontSize: '10px', border: 'none', background: 'rgba(255,255,255,0.03)' }}
                          placeholder="..."
                       />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                       <span className={`status ${delivery.status === 'PENDENTE' ? 'status-pending' : delivery.status === 'EM ROTA' ? 'status-route' : 'status-delivered'}`}>
                         {delivery.status}
                       </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '2rem' }}>
          <div style={{ gridColumn: 'span 4' }}>
            <div className="card-premium">
              <h3 style={{ marginBottom: '1.5rem' }}>Recrutamento</h3>
              <form onSubmit={handleAddDriver} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                 <input type="text" value={newDriverName} onChange={e => setNewDriverName(e.target.value)} className="input-premium" placeholder="Nome do Agente" />
                 <input type="text" value={newDriverPass} onChange={e => setNewDriverPass(e.target.value)} className="input-premium" placeholder="PIN de Acesso" />
                 <button type="submit" disabled={isAddingDriver} className="btn-main">Cadastrar Agente</button>
              </form>
            </div>
          </div>
          <div style={{ gridColumn: 'span 8' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
              {drivers.map(dr => (
                <div key={dr.id} className="card-premium">
                   <p style={{ fontSize: '1.2rem', fontWeight: 800 }}>{dr.name}</p>
                   <p style={{ fontSize: '10px', color: 'var(--text-muted)' }}>PIN: {dr.password}</p>
                   <p style={{ marginTop: '1rem', color: 'var(--accent)', fontWeight: 800 }}>R$ {dr.totalFeesEarned.toFixed(2)} acumulados</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .flex-center { display: flex; align-items: center; justify-content: center; }
      `}</style>
    </div>
  );
}
