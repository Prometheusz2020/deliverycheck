"use client";

import { useEffect, useState, useCallback } from "react";
import { logoutAdmin } from "@/lib/auth-actions";
import { Delivery, DeliverySummary, Driver } from "@/lib/types";
import { 
  Clock, UserPlus, MessageSquare, DollarSign, Loader2, 
  BarChart2, Users, ClipboardList, TrendingUp, MapPin, 
  Briefcase, LogOut 
} from "lucide-react";

export default function RestaurantPortal() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [summary, setSummary] = useState<DeliverySummary>({ 
    pending: 0, onRoute: 0, delivered: 0, totalValue: 0, totalFees: 0 
  });
  const [activeTab, setActiveTab] = useState<'deliveries' | 'drivers'>('deliveries');
  
  const [newDriverName, setNewDriverName] = useState("");
  const [newDriverPass, setNewDriverPass] = useState("");
  const [isAddingDriver, setIsAddingDriver] = useState(false);

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
      console.error("Portal Fetch Error:", err);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleAdminLogout = async () => {
    await logoutAdmin();
    window.location.reload(); 
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

  return (
    <div className="page-container animate-entrance" style={{ marginTop: '2rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', marginBottom: '0.2rem' }}>COMMAND CENTER</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5em' }}>ZtiLabs Driver Administration</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', background: 'var(--surface-high)', padding: '0.4rem', borderRadius: '12px' }}>
            <button onClick={() => setActiveTab('deliveries')} className={activeTab === 'deliveries' ? 'btn-main' : 'btn-outline'} style={{ padding: '0.6rem 1.5rem', fontSize: '12px', borderRadius: '8px' }}>
              <ClipboardList size={16} /> Entregas
            </button>
            <button onClick={() => setActiveTab('drivers')} className={activeTab === 'drivers' ? 'btn-main' : 'btn-outline'} style={{ padding: '0.6rem 1.5rem', fontSize: '12px', borderRadius: '8px', marginLeft: '0.4rem' }}>
              <Users size={16} /> Motoristas
            </button>
          </div>
          <button onClick={handleAdminLogout} style={{ padding: '0.8rem', background: 'rgba(255,45,85,0.05)', border: '1px solid rgba(255,45,85,0.1)', color: 'var(--danger)', borderRadius: '12px', cursor: 'pointer' }}>
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <div className="grid-quarters">
        {[
          { label: 'Pendentes', val: summary.pending, icon: Clock, color: 'var(--warning)' },
          { label: 'Em Rota', val: summary.onRoute, icon: TrendingUp, color: 'var(--primary)' },
          { label: 'Total Pedidos', val: `R$ ${summary.totalValue.toFixed(2)}`, icon: BarChart2, color: 'var(--success)' },
          { label: 'Total Taxas', val: `R$ ${summary.totalFees.toFixed(2)}`, icon: DollarSign, color: 'var(--secondary)' }
        ].map((c, i) => (
          <div key={i} className="card-premium" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: c.color, marginBottom: '1.5rem' }}>
              <c.icon size={24} />
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }}>{c.label}</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 800 }}>{c.val}</p>
          </div>
        ))}
      </div>

      {activeTab === 'deliveries' ? (
        <div className="table-wrapper">
          <table className="table-premium">
            <thead>
              <tr>
                <th>Cód</th>
                <th>Cliente</th>
                <th>Valor</th>
                <th>Entregador</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map(delivery => (
                <tr key={delivery.id}>
                  <td style={{ color: 'var(--primary)', fontWeight: 800 }}>#{delivery.orderNumber}</td>
                  <td>
                    <p>{delivery.customerName}</p>
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{delivery.address}</p>
                  </td>
                  <td style={{ fontWeight: 800 }}>R$ {delivery.totalAmount?.toFixed(2)}</td>
                  <td>
                    <select 
                      onChange={(e) => handleTransfer(delivery.id, e.target.value)}
                      className="input-premium"
                      style={{ padding: '0.2rem', fontSize: '10px' }}
                      value={delivery.driverId || ""}
                    >
                      <option value="">{delivery.deliveryPerson || "Selecionar..."}</option>
                      {drivers.map(dr => (
                        <option key={dr.id} value={dr.id}>{dr.name}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`status ${delivery.status === 'PENDENTE' ? 'status-pending' : delivery.status === 'EM ROTA' ? 'status-route' : 'status-delivered'}`}>
                      {delivery.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '2rem' }}>
          <div style={{ gridColumn: 'span 4' }}>
            <div className="card-premium">
              <h3 style={{ marginBottom: '1.5rem' }}>Add Motorista</h3>
              <form onSubmit={handleAddDriver} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <input type="text" value={newDriverName} onChange={e => setNewDriverName(e.target.value)} className="input-premium" placeholder="Nome" />
                <input type="text" value={newDriverPass} onChange={e => setNewDriverPass(e.target.value)} className="input-premium" placeholder="Senha" />
                <button type="submit" disabled={isAddingDriver} className="btn-main">Cadastrar</button>
              </form>
            </div>
          </div>
          <div style={{ gridColumn: 'span 8' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
              {drivers.map(dr => (
                <div key={dr.id} className="card-premium">
                  <p style={{ fontWeight: 800 }}>{dr.name}</p>
                  <p style={{ color: 'var(--accent)', fontWeight: 800 }}>Ganhos: R$ {dr.totalFeesEarned.toFixed(2)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
