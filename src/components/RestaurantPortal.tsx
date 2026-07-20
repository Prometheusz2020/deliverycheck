"use client";

import { useEffect, useState, useCallback } from "react";
import { logoutAdmin } from "@/lib/auth-actions";
import { Delivery, DeliverySummary, Driver } from "@/lib/types";
import { 
  Clock, UserPlus, MessageSquare, DollarSign, Loader2, 
  BarChart2, Users, ClipboardList, TrendingUp, MapPin, 
  Briefcase, LogOut, Package, User
} from "lucide-react";
import CreditSalesDashboard from "./CreditSalesDashboard";

export default function RestaurantPortal() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [summary, setSummary] = useState<DeliverySummary>({ 
    pending: 0, onRoute: 0, delivered: 0, totalValue: 0, totalFees: 0 
  });
  const [activeTab, setActiveTab] = useState<'deliveries' | 'drivers' | 'creditsales'>('deliveries');
  
  const [newDriverName, setNewDriverName] = useState("");
  const [newDriverPass, setNewDriverPass] = useState("");
  const [isAddingDriver, setIsAddingDriver] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString('sv-SE'));

  // Estados para Filtro e Seleção
  const [onlyWithAddress, setOnlyWithAddress] = useState(true);
  const [selectedDeliveryIds, setSelectedDeliveryIds] = useState<string[]>([]);
  const [targetDriverId, setTargetDriverId] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [finishedLimit, setFinishedLimit] = useState(10);

  const hasValidAddress = (address?: string) => {
    if (!address) return false;
    const clean = address.trim().toLowerCase();
    if (clean === "não informado" || clean === "nao informado" || clean === "não informada") return false;
    if (clean === "s/e" || clean.startsWith("s/e,") || clean === "s/e, -") return false;
    if (clean.replace(/[^a-z0-9]/g, "") === "se") return false;
    if (clean.includes("entregar no estabelecimento")) return false;
    return true;
  };

  const formatScannedTime = (scannedAt: Date | string) => {
    const date = new Date(scannedAt);
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const diffMs = new Date().getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return `${timeStr} (agora)`;
    if (diffMins < 60) return `${timeStr} (há ${diffMins} min)`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${timeStr} (há ${diffHours}h)`;
    return timeStr;
  };

  const getDeliveryDuration = (scannedAt: Date | string, deliveredAt?: Date | string) => {
    if (!deliveredAt) return "";
    const start = new Date(scannedAt);
    const end = new Date(deliveredAt);
    const diffMins = Math.round((end.getTime() - start.getTime()) / 60000);
    if (diffMins <= 0) return "1 min";
    if (diffMins < 60) return `${diffMins} min`;
    return `${Math.floor(diffMins / 60)}h ${diffMins % 60}m`;
  };

  const handleBulkAssign = async () => {
    if (selectedDeliveryIds.length === 0 || !targetDriverId) return;
    setIsAssigning(true);
    try {
      const actions = await import("@/lib/actions");
      const res = await actions.bulkAssignDeliveries(selectedDeliveryIds, targetDriverId);
      if (res.success) {
        setSelectedDeliveryIds([]);
        setTargetDriverId("");
        fetchData();
      } else {
        alert(res.error || "Erro ao atribuir entregas.");
      }
    } catch (err) {
      console.error(err);
      alert("Erro ao conectar com o servidor.");
    } finally {
      setIsAssigning(false);
    }
  };

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
            <button onClick={() => setActiveTab('creditsales')} className={activeTab === 'creditsales' ? 'btn-main' : 'btn-outline'} style={{ padding: '0.6rem 1.5rem', fontSize: '12px', borderRadius: '8px', marginLeft: '0.4rem' }}>
              <DollarSign size={16} /> Fiado / Prazo
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

      {activeTab !== 'creditsales' && (
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
      )}

      {activeTab === 'deliveries' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Painel de Filtros e Resumo */}
          {(() => {
            const filteredDeliveries = deliveries.filter(d => {
              const matchesAddress = onlyWithAddress ? hasValidAddress(d.address) : true;
              const matchesSearch = searchTerm 
                ? (d.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                   d.address?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                   d.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase()))
                : true;
              return matchesAddress && matchesSearch;
            });
            const totalCount = deliveries.length;
            const hiddenCount = totalCount - deliveries.filter(d => hasValidAddress(d.address)).length;
            
            const unassigned = filteredDeliveries.filter(d => !d.driverId);
            const allUnassignedSelected = unassigned.length > 0 && unassigned.every(d => selectedDeliveryIds.includes(d.id));
            
            const handleToggleSelectAllUnassigned = () => {
              const unassignedIds = unassigned.map(d => d.id);
              if (allUnassignedSelected) {
                setSelectedDeliveryIds(prev => prev.filter(id => !unassignedIds.includes(id)));
              } else {
                setSelectedDeliveryIds(prev => Array.from(new Set([...prev, ...unassignedIds])));
              }
            };

            return (
              <>
                <div className="card-premium" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Mostrando <strong style={{ color: 'var(--primary)' }}>{filteredDeliveries.length}</strong> de <strong>{totalCount}</strong> comandas
                      {hiddenCount > 0 && (
                        <span style={{ color: 'var(--warning)', marginLeft: '8px', fontSize: '11px', fontWeight: 500 }}>
                          ({hiddenCount} ocultadas por não terem endereço / balcão)
                        </span>
                      )}
                    </span>
                    <input 
                      type="text"
                      placeholder="Buscar por cliente, endereço ou delivery..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="input-premium"
                      style={{ maxWidth: '320px', fontSize: '12px', padding: '0.4rem 0.8rem', border: '1px solid rgba(255,255,255,0.08)' }}
                    />
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none', fontSize: '13px', fontWeight: 600 }}>
                      <input 
                        type="checkbox"
                        checked={onlyWithAddress}
                        onChange={(e) => setOnlyWithAddress(e.target.checked)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                      />
                      Ocultar Balcão (Apenas Entregas com Endereço)
                    </label>
                  </div>
                </div>

                {/* Unassigned Deliveries First */}
                {unassigned.length > 0 && (
                  <div className="card-premium" style={{ borderTop: '4px solid var(--warning)' }}>
                    <h3 style={{ marginBottom: '1rem', color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Clock size={16} /> AGUARDANDO ATRIBUIÇÃO
                    </h3>
                    <div className="table-wrapper">
                      <table className="table-premium">
                        <thead>
                          <tr>
                            <th style={{ width: '45px', textAlign: 'center' }}>
                              <input 
                                type="checkbox" 
                                checked={allUnassignedSelected}
                                onChange={handleToggleSelectAllUnassigned}
                                style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                              />
                            </th>
                            <th>Comanda</th>
                            <th>Cliente</th>
                            <th>Recebido Há</th>
                            <th style={{ width: '180px' }}>Atribuir Motoboy</th>
                            <th>Ação</th>
                          </tr>
                        </thead>
                        <tbody>
                          {unassigned.map(delivery => (
                            <tr key={delivery.id}>
                              <td style={{ textAlign: 'center' }}>
                                <input 
                                  type="checkbox" 
                                  checked={selectedDeliveryIds.includes(delivery.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedDeliveryIds(prev => [...prev, delivery.id]);
                                    } else {
                                      setSelectedDeliveryIds(prev => prev.filter(id => id !== delivery.id));
                                    }
                                  }}
                                  style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                                />
                              </td>
                              <td style={{ color: 'var(--primary)', fontWeight: 800 }}>{delivery.orderNumber}</td>
                              <td>
                                <p>{delivery.customerName}</p>
                                <p style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{delivery.address}</p>
                              </td>
                              <td>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                  {formatScannedTime(delivery.scannedAt)}
                                </span>
                              </td>
                              <td>
                                <select 
                                  className="input-premium" 
                                  style={{ padding: '0.3rem 0.6rem', fontSize: '11px', width: '160px', border: '1px solid rgba(255, 255, 255, 0.1)', cursor: 'pointer' }}
                                  onChange={(e) => handleTransfer(delivery.id, e.target.value)}
                                  value=""
                                >
                                  <option value="">Enviar para...</option>
                                  {drivers.filter(dr => dr.isActive).map(dr => (
                                    <option key={dr.id} value={dr.id}>{dr.name}</option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <button 
                                  onClick={async () => {
                                    if(confirm("Excluir pedido?")) {
                                      const actions = await import("@/lib/actions");
                                      await actions.deleteDelivery(delivery.id);
                                      fetchData();
                                    }
                                  }}
                                  style={{ padding: '0.4rem', background: 'rgba(255,45,85,0.1)', border: 'none', borderRadius: '4px', color: 'var(--danger)', cursor: 'pointer' }}
                                >
                                  <LogOut size={14} style={{ transform: 'rotate(180deg)' }} />
                                </button>
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
                  const driverDeliveries = filteredDeliveries.filter(d => d.driverId === driver.id && d.status !== 'ENTREGUE');
                  if (driverDeliveries.length === 0) return null;
                  
                  const allDriverSelected = driverDeliveries.length > 0 && driverDeliveries.every(d => selectedDeliveryIds.includes(d.id));
                  const handleToggleSelectAllDriver = () => {
                    const driverIds = driverDeliveries.map(d => d.id);
                    if (allDriverSelected) {
                      setSelectedDeliveryIds(prev => prev.filter(id => !driverIds.includes(id)));
                    } else {
                      setSelectedDeliveryIds(prev => Array.from(new Set([...prev, ...driverIds])));
                    }
                  };

                  return (
                    <div key={driver.id} className="card-premium" style={{ borderTop: '4px solid var(--primary)' }}>
                      <h3 style={{ marginBottom: '1rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <MapPin size={16} /> {driver.name.toUpperCase()}
                      </h3>
                      <div className="table-wrapper">
                        <table className="table-premium">
                          <thead>
                            <tr>
                              <th style={{ width: '45px', textAlign: 'center' }}>
                                <input 
                                  type="checkbox" 
                                  checked={allDriverSelected}
                                  onChange={handleToggleSelectAllDriver}
                                  style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                                />
                              </th>
                              <th>Comanda</th>
                              <th>Cliente</th>
                              <th>Status</th>
                              <th style={{ width: '180px' }}>Reatribuir Motoboy</th>
                              <th>Obs / Notas</th>
                              <th>Ações</th>
                            </tr>
                          </thead>
                          <tbody>
                            {driverDeliveries.map(delivery => (
                              <tr key={delivery.id}>
                                <td style={{ textAlign: 'center' }}>
                                  <input 
                                    type="checkbox" 
                                    checked={selectedDeliveryIds.includes(delivery.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedDeliveryIds(prev => [...prev, delivery.id]);
                                      } else {
                                        setSelectedDeliveryIds(prev => prev.filter(id => id !== delivery.id));
                                      }
                                    }}
                                    style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                                  />
                                </td>
                                <td style={{ fontWeight: 800 }}>{delivery.orderNumber}</td>
                                <td>
                                  <p style={{ fontWeight: 800 }}>{delivery.customerName}</p>
                                  <p style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{delivery.address}</p>
                                </td>
                                <td>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <span style={{ 
                                      fontSize: '9px', 
                                      fontWeight: 900, 
                                      padding: '0.2rem 0.6rem', 
                                      borderRadius: '4px',
                                      background: delivery.status === 'EM ROTA' ? 'rgba(0, 122, 255, 0.1)' : 'rgba(255, 149, 0, 0.1)',
                                      color: delivery.status === 'EM ROTA' ? 'var(--primary)' : 'var(--warning)',
                                      width: 'fit-content'
                                    }}>
                                      {delivery.status}
                                    </span>
                                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                      {formatScannedTime(delivery.scannedAt)}
                                    </span>
                                  </div>
                                </td>
                                <td>
                                  <select 
                                    className="input-premium" 
                                    style={{ padding: '0.3rem 0.6rem', fontSize: '11px', width: '160px', border: '1px solid rgba(255, 255, 255, 0.1)', cursor: 'pointer' }}
                                    onChange={(e) => handleTransfer(delivery.id, e.target.value)}
                                    value={driver.id || ""}
                                  >
                                    {drivers.filter(dr => dr.isActive || dr.id === driver.id).map(dr => (
                                      <option key={dr.id} value={dr.id}>{dr.name} {!dr.isActive ? '(Inativo)' : ''}</option>
                                    ))}
                                    <option value="unassigned">Retirar Motoboy (Pendente)</option>
                                  </select>
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
                                  <button 
                                    onClick={async () => {
                                      if(confirm("Excluir pedido?")) {
                                        const actions = await import("@/lib/actions");
                                        await actions.deleteDelivery(delivery.id);
                                        fetchData();
                                      }
                                    }}
                                    style={{ padding: '0.4rem', background: 'rgba(255,45,85,0.1)', border: 'none', borderRadius: '4px', color: 'var(--danger)', cursor: 'pointer' }}
                                  >
                                    <LogOut size={14} style={{ transform: 'rotate(180deg)' }} />
                                  </button>
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
                 {(() => {
                   const finishedDeliveries = filteredDeliveries.filter(d => d.status === 'ENTREGUE');
                   return (
                     <div className="card-premium" style={{ opacity: 0.8 }}>
                       <h3 style={{ marginBottom: '1rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                         <Package size={16} /> FINALIZADAS ({finishedDeliveries.length})
                       </h3>
                       <div className="table-wrapper">
                           <table className="table-premium">
                             <thead>
                               <tr>
                                 <th>Comanda</th>
                                 <th>Cliente</th>
                                 <th>Motoboy</th>
                                 <th>Tempo de Entrega</th>
                                 <th>Status</th>
                               </tr>
                             </thead>
                             <tbody>
                               {finishedDeliveries.slice(0, finishedLimit).map(delivery => (
                                 <tr key={delivery.id}>
                                   <td style={{ fontWeight: 800, color: 'var(--text-muted)' }}>Comanda {delivery.orderNumber}</td>
                                   <td>{delivery.customerName}</td>
                                   <td style={{ color: 'var(--text-muted)', fontSize: '11px' }}>por {delivery.deliveryPerson}</td>
                                   <td style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                     {delivery.deliveredAt ? getDeliveryDuration(delivery.scannedAt, delivery.deliveredAt) : '--'}
                                   </td>
                                   <td style={{ color: 'var(--success)', fontWeight: 800 }}>ENTREGUE</td>
                                 </tr>
                               ))}
                             </tbody>
                           </table>
                       </div>
                       {finishedDeliveries.length > finishedLimit && (
                         <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
                           <button 
                             onClick={() => setFinishedLimit(prev => prev + 20)} 
                             className="btn-outline" 
                             style={{ padding: '0.6rem 2rem', fontSize: '12px' }}
                           >
                             Carregar Mais Entregas
                           </button>
                         </div>
                       )}
                     </div>
                   );
                 })()}

                {/* Sticky Bottom Bar for Bulk Action */}
                {selectedDeliveryIds.length > 0 && (
                  <div style={{
                    position: 'fixed',
                    bottom: '24px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '90%',
                    maxWidth: '650px',
                    zIndex: 9999,
                    background: 'rgba(20, 20, 40, 0.95)',
                    border: '2px solid var(--primary)',
                    borderRadius: '16px',
                    padding: '1rem 1.5rem',
                    boxShadow: '0 12px 40px rgba(0, 122, 255, 0.4)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    animation: 'slideUp 0.3s ease-out'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 800, color: '#fff' }}>
                        {selectedDeliveryIds.length} {selectedDeliveryIds.length === 1 ? 'comanda selecionada' : 'comandas selecionadas'}
                      </span>
                      <button 
                        onClick={() => setSelectedDeliveryIds([])}
                        className="btn-outline" 
                        style={{ padding: '0.4rem 0.8rem', fontSize: '11px', borderColor: 'rgba(255,255,255,0.2)', height: 'auto' }}
                      >
                        Limpar
                      </button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Enviar para:</span>
                      <select 
                        className="input-premium" 
                        style={{ padding: '0.4rem 0.8rem', fontSize: '12px', width: '160px' }}
                        onChange={(e) => setTargetDriverId(e.target.value)}
                        value={targetDriverId}
                      >
                        <option value="">Escolha o motoboy...</option>
                        {drivers.filter(dr => dr.isActive).map(dr => (
                          <option key={dr.id} value={dr.id}>{dr.name}</option>
                        ))}
                      </select>
                      <button
                        onClick={handleBulkAssign}
                        disabled={!targetDriverId || isAssigning}
                        className="btn-main"
                        style={{ padding: '0.5rem 1.2rem', fontSize: '12px', height: '36px', minHeight: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        {isAssigning ? "Enviando..." : "Confirmar Envio"}
                      </button>
                    </div>
                  </div>
                )}

                <style jsx>{`
                  @keyframes slideUp {
                    from { transform: translate(-50%, 100px); opacity: 0; }
                    to { transform: translate(-50%, 0); opacity: 1; }
                  }
                `}</style>
              </>
            );
          })()}
        </div>
      ) : activeTab === 'drivers' ? (
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

                return (
                  <div key={dr.id} className="card-premium" style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '45px', height: '45px', background: dr.isActive ? 'var(--accent)' : 'var(--surface-high)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: dr.isActive ? '#000' : 'var(--text-muted)' }}>
                          <User size={24} />
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <p style={{ fontWeight: 800, fontSize: '1.2rem', color: dr.isActive ? '#fff' : 'var(--text-muted)' }}>{dr.name.toUpperCase()}</p>
                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '10px', fontWeight: 800 }}>
                              <input 
                                type="checkbox"
                                checked={!!dr.isActive}
                                onChange={async (e) => {
                                  const checked = e.target.checked;
                                  // Update state optimistically
                                  setDrivers(prev => prev.map(d => d.id === dr.id ? { ...d, isActive: checked } : d));
                                  try {
                                    const actions = await import("@/lib/actions");
                                    await actions.toggleDriverActive(dr.id, checked);
                                    fetchData();
                                  } catch (err) {
                                    console.error(err);
                                    // Revert if error
                                    setDrivers(prev => prev.map(d => d.id === dr.id ? { ...d, isActive: !checked } : d));
                                    alert("Erro ao alterar o status do motorista.");
                                  }
                                }}
                                style={{ width: '14px', height: '14px', cursor: 'pointer', accentColor: 'var(--accent)' }}
                              />
                              <span style={{ color: dr.isActive ? 'var(--accent)' : 'var(--text-muted)' }}>
                                {dr.isActive ? 'ATIVO HOJE' : 'INATIVO'}
                              </span>
                            </label>
                          </div>
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
                               <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                      {/* Entregas Ativas / Em Rota */}
                      <div>
                        <p style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: 900, textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="pulse-dot" style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)', display: 'inline-block' }}></span>
                          Em Rota ({onRoute.length})
                        </p>
                        {onRoute.length === 0 ? (
                          <p style={{ fontSize: '11px', color: 'var(--text-muted)', opacity: 0.5, paddingLeft: '8px' }}>Nenhuma entrega em rota.</p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {onRoute.map(delivery => (
                              <div key={delivery.id} style={{ display: 'flex', flexDirection: 'column', background: 'rgba(0, 122, 255, 0.05)', border: '1px solid rgba(0, 122, 255, 0.15)', padding: '0.8rem 1rem', borderRadius: '10px', gap: '4px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--primary)' }}>{delivery.orderNumber}</span>
                                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--success)' }}>R$ {delivery.totalAmount?.toFixed(2)}</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <p style={{ fontSize: '12px', fontWeight: 600, color: '#fff' }}>{delivery.customerName}</p>
                                  <p style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                    <MapPin size={10} style={{ flexShrink: 0 }} /> {delivery.address}
                                  </p>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '4px' }}>
                                  <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Saída: {new Date(delivery.scannedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                  {delivery.observations && (
                                    <span style={{ fontSize: '9px', color: 'var(--warning)', background: 'rgba(255,149,0,0.1)', padding: '1px 6px', borderRadius: '4px' }}>Obs: {delivery.observations}</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Histórico Recente (Entregues) */}
                      <div style={{ marginTop: '0.4rem' }}>
                        <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 900, textTransform: 'uppercase', marginBottom: '6px' }}>Histórico Recente (Entregues)</p>
                        {delivered.length === 0 ? (
                          <p style={{ fontSize: '11px', color: 'var(--text-muted)', opacity: 0.5, paddingLeft: '8px' }}>Nenhum histórico recente hoje.</p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            {[...delivered].sort((a, b) => new Date(b.deliveredAt || b.scannedAt).getTime() - new Date(a.deliveredAt || a.scannedAt).getTime()).slice(0, 3).map(delivery => (
                              <div key={delivery.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '0.6rem 1rem', borderRadius: '10px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--success)' }}>{delivery.orderNumber}</span>
                                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>{delivery.customerName}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                   <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                     {delivery.deliveredAt 
                                       ? new Date(delivery.deliveredAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
                                       : '--:--'}
                                   </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>              </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <CreditSalesDashboard />
      )}
    </div>
  );
}
