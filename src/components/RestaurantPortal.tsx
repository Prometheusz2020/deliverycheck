"use client";

import { useEffect, useState, useCallback } from "react";
import { logoutAdmin } from "@/lib/auth-actions";
import { Delivery, DeliverySummary, Driver } from "@/lib/types";
import { 
  Clock, UserPlus, MessageSquare, DollarSign, Loader2, 
  BarChart2, Users, ClipboardList, TrendingUp, MapPin, 
  Briefcase, LogOut, Package, User
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
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchData = useCallback(async () => {
    try {
      const actions = await import("@/lib/actions");
      const [d, dr, s] = await Promise.all([
        actions.getDeliveries(selectedDate), 
        actions.getDrivers(), 
        actions.getSummary(selectedDate)
      ]);
      setDeliveries(d as any);
      setDrivers(dr);
      setSummary(s);
    } catch (err) {
      console.error("Portal Fetch Error:", err);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData, selectedDate]);

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
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface-high)', padding: '0.4rem 0.8rem', borderRadius: '12px', gap: '8px' }}>
            <Clock size={16} style={{ color: 'var(--accent)' }} />
            <input 
              type="date" 
              value={selectedDate} 
              onChange={e => setSelectedDate(e.target.value)}
              className="input-premium"
              style={{ padding: '0.2rem', background: 'transparent', border: 'none', color: 'var(--text)', fontSize: '12px', cursor: 'pointer' }}
            />
          </div>
          <button onClick={handleAdminLogout} style={{ padding: '0.8rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)', borderRadius: '12px', cursor: 'pointer' }}>
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <div className="grid-quarters" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        {[
          { label: 'Pendentes', val: summary.pending, icon: Clock, color: 'var(--warning)' },
          { label: 'Em Rota', val: summary.onRoute, icon: TrendingUp, color: 'var(--primary)' }
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Unassigned Deliveries First */}
          {deliveries.filter(d => !d.driverId).length > 0 && (
            <div className="card-premium" style={{ borderTop: '4px solid var(--warning)' }}>
              <h3 style={{ marginBottom: '1rem', color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={16} /> AGUARDANDO ATRIBUIÇÃO
              </h3>
              <div className="table-wrapper">
                <table className="table-premium">
                  <thead>
                    <tr>
                      <th>Cód</th>
                      <th>Cliente</th>
                      <th>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveries.filter(d => !d.driverId).map(delivery => (
                      <tr key={delivery.id}>
                        <td style={{ color: 'var(--primary)', fontWeight: 800 }}>{delivery.orderNumber}</td>
                        <td>
                          <p>{delivery.customerName}</p>
                          <p style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{delivery.address}</p>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <select 
                              onChange={(e) => handleTransfer(delivery.id, e.target.value)}
                              className="input-premium"
                              style={{ padding: '0.2rem', fontSize: '10px', flex: 1 }}
                              value={delivery.driverId || ""}
                            >
                              <option value="">Enviar para...</option>
                              {drivers.map(dr => (
                                <option key={dr.id} value={dr.id}>{dr.name}</option>
                              ))}
                            </select>
                            <button 
                              onClick={async () => {
                                if(confirm("Excluir pedido?")) {
                                  const actions = await import("@/lib/actions");
                                  await actions.deleteDelivery(delivery.id);
                                  fetchData();
                                }
                              }}
                              style={{ padding: '0.4rem', background: 'rgba(255,45,85,0.1)', border: 'none', borderRadius: '4px', color: 'var(--danger)' }}
                            >
                              <LogOut size={14} style={{ transform: 'rotate(180deg)' }} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Grouped by Active Driver */}
          {drivers.map(driver => {
            const driverDeliveries = deliveries.filter(d => d.driverId === driver.id && d.status !== 'ENTREGUE');
            if (driverDeliveries.length === 0) return null;
            
            return (
              <div key={driver.id} className="card-premium" style={{ borderTop: '4px solid var(--primary)' }}>
                <h3 style={{ marginBottom: '1rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MapPin size={16} /> {driver.name.toUpperCase()}
                </h3>
                <div className="table-wrapper">
                  <table className="table-premium">
                    <thead>
                      <tr>
                        <th>Cód</th>
                        <th>Cliente</th>
                        <th>Obs / Notas</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {driverDeliveries.map(delivery => (
                        <tr key={delivery.id}>
                          <td style={{ fontWeight: 800 }}>{delivery.orderNumber}</td>
                          <td>
                            <p>{delivery.customerName}</p>
                          </td>
                          <td>
                            <input 
                              type="text" 
                              placeholder="Add nota..." 
                              defaultValue={delivery.observations || ""}
                              onBlur={(e) => handleObs(delivery.id, e.target.value)}
                              className="input-premium"
                              style={{ fontSize: '10px', padding: '0.3rem' }}
                            />
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <select 
                                onChange={(e) => handleTransfer(delivery.id, e.target.value)}
                                className="input-premium"
                                style={{ padding: '0.2rem', fontSize: '10px' }}
                                value={delivery.driverId || ""}
                              >
                                {drivers.map(dr => (
                                  <option key={dr.id} value={dr.id}>{dr.name}</option>
                                ))}
                              </select>
                              <button 
                                onClick={async () => {
                                  if(confirm("Excluir pedido?")) {
                                    const actions = await import("@/lib/actions");
                                    await actions.deleteDelivery(delivery.id);
                                    fetchData();
                                  }
                                }}
                                style={{ padding: '0.4rem', background: 'rgba(255,45,85,0.1)', border: 'none', borderRadius: '4px', color: 'var(--danger)' }}
                              >
                                <LogOut size={14} style={{ transform: 'rotate(180deg)' }} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          {/* Show Recent Finished */}
          <div className="card-premium" style={{ opacity: 0.8 }}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Package size={16} /> FINALIZADAS RECENTEMENTE
            </h3>
            <div className="table-wrapper">
                <table className="table-premium">
                  <tbody>
                    {deliveries.filter(d => d.status === 'ENTREGUE').slice(0, 10).map(delivery => (
                      <tr key={delivery.id}>
                        <td>{delivery.orderNumber}</td>
                        <td>{delivery.customerName}</td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '11px' }}>por {delivery.deliveryPerson}</td>
                        <td style={{ color: 'var(--success)', fontWeight: 800 }}>ENTREGUE</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            </div>
          </div>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: '1.5rem' }}>
              {drivers.map(dr => {
                const onRoute = deliveries.filter(d => d.driverId === dr.id && d.status === 'EM ROTA');
                const delivered = deliveries.filter(d => d.driverId === dr.id && d.status === 'ENTREGUE');
                const allDeliveries = deliveries.filter(d => d.driverId === dr.id);

                return (
                  <div key={dr.id} className="card-premium" style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '45px', height: '45px', background: 'var(--accent)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000' }}>
                          <User size={24} />
                        </div>
                        <div>
                          <p style={{ fontWeight: 800, fontSize: '1.2rem' }}>{dr.name.toUpperCase()}</p>
                          <p style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 900, textTransform: 'uppercase' }}>Taxas: R$ {dr.totalFeesEarned.toFixed(2)}</p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <div style={{ textAlign: 'center' }}>
                          <p style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 800 }}>{onRoute.length}</p>
                          <p style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Em Rota</p>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <p style={{ fontSize: '11px', color: 'var(--success)', fontWeight: 800 }}>{delivered.length}</p>
                          <p style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Entregues</p>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 900, textTransform: 'uppercase', marginBottom: '4px' }}>Histórico Recente</p>
                      {allDeliveries.length === 0 ? (
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', opacity: 0.5 }}>Nenhum registro encontrado.</p>
                      ) : (
                        allDeliveries.slice(0, 5).map(delivery => (
                          <div key={delivery.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '0.6rem 1rem', borderRadius: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ fontSize: '11px', fontWeight: 800, color: delivery.status === 'ENTREGUE' ? 'var(--success)' : 'var(--primary)' }}>{delivery.orderNumber}</span>
                              <span style={{ fontSize: '12px', fontWeight: 600 }}>{delivery.customerName}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                               <span style={{ 
                                 fontSize: '9px', 
                                 fontWeight: 900, 
                                 padding: '0.2rem 0.6rem', 
                                 borderRadius: '4px',
                                 background: delivery.status === 'ENTREGUE' ? 'rgba(52, 199, 89, 0.1)' : 'rgba(0, 122, 255, 0.1)',
                                 color: delivery.status === 'ENTREGUE' ? 'var(--success)' : 'var(--primary)'
                               }}>{delivery.status}</span>
                               <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                 {delivery.status === 'ENTREGUE' 
                                   ? new Date(delivery.deliveredAt!).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
                                   : new Date(delivery.scannedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                               </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
