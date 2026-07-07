"use client";

import { useEffect, useState } from "react";
import { 
  getSessionDriver 
} from "@/lib/auth-actions";
import { Delivery, DeliveryStatus, Driver } from "@/lib/types";
import { 
  CheckCircle, MapPin, User, LogOut, 
  Package, Zap, Loader2, ArrowRight, ShieldCheck, MessageSquare, ArrowLeft, Delete
} from "lucide-react";

export default function DriverApp() {
  const [driver, setDriver] = useState<{ id: string; name: string } | null>(null);
  const [driversList, setDriversList] = useState<Driver[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  
  // PIN Login State
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [pinCode, setPinCode] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const fetchData = async () => {
    try {
      const actions = await import("@/lib/actions");
      const today = new Date().toISOString().split('T')[0];
      const data = await actions.getDeliveries(today);
      setDeliveries(data as Delivery[]);
    } catch (err) {
      console.error("Driver Fetch Error:", err);
    }
  };

  const fetchDriversAndDeliveries = async () => {
    try {
      const actions = await import("@/lib/actions");
      const today = new Date().toISOString().split('T')[0];
      const [driversData, deliveriesData] = await Promise.all([
        actions.getDrivers(),
        actions.getDeliveries(today)
      ]);
      setDriversList(driversData);
      setDeliveries(deliveriesData as Delivery[]);
    } catch (err) {
      console.error("Waiting Room Fetch Error:", err);
    }
  };

  useEffect(() => {
    const checkSession = async () => {
      try {
        const session = await getSessionDriver();
        if (session) {
          setDriver(session);
          fetchData();
        } else {
          setDriver(null);
          fetchDriversAndDeliveries();
        }
      } catch {
        setDriver(null);
        fetchDriversAndDeliveries();
      }
    };
    checkSession();
  }, []);

  useEffect(() => {
    if (!driver) return;
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [driver]);

  useEffect(() => {
    if (driver) return;
    const interval = setInterval(fetchDriversAndDeliveries, 15000);
    return () => clearInterval(interval);
  }, [driver]);

  const handlePinSubmit = async (pin: string) => {
    if (!selectedDriver) return;
    setIsLoggingIn(true);
    try {
      const actions = await import("@/lib/actions");
      const res = await actions.loginDriver(selectedDriver.name, pin);
      if (res.success) {
        const session = await getSessionDriver();
        setDriver(session);
        setSelectedDriver(null);
        setPinCode("");
        fetchData();
      } else {
        alert("PIN incorreto!");
        setPinCode("");
      }
    } catch {
      alert("Erro ao conectar com o servidor.");
    }
    setIsLoggingIn(false);
  };

  const handleKeypadPress = (val: string) => {
    if (isLoggingIn || pinCode.length >= 4) return;
    const newPin = pinCode + val;
    setPinCode(newPin);
    if (newPin.length === 4) {
      handlePinSubmit(newPin);
    }
  };

  const handleKeypadClear = () => {
    if (isLoggingIn) return;
    setPinCode("");
  };

  const handleLogout = async () => {
    try {
      const actions = await import("@/lib/actions");
      await actions.logoutDriver();
    } catch (err) {
      console.error("Logout error:", err);
    }
    setDriver(null);
    setSelectedDriver(null);
    setPinCode("");
    fetchDriversAndDeliveries();
  };

  const [manualOrderNumber, setManualOrderNumber] = useState("");

  const handleRegisterDelivery = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!driver || !manualOrderNumber) return;
    setIsLoggingIn(true); 
    try {
      const actions = await import("@/lib/actions");
      const res = await actions.processDriverOrderInput(
        `#${manualOrderNumber}`,
        driver.id,
        driver.name
      );
      
      if (!res.success) {
        alert(res.error || "Pedido não encontrado.");
      } else {
        setManualOrderNumber("");
        fetchData();
      }
    } catch {
      alert("Erro ao conectar com o servidor.");
    }
    setIsLoggingIn(false);
  };

  const handleStatusUpdate = async (id: string, status: DeliveryStatus) => {
    const actions = await import("@/lib/actions");
    await actions.updateDeliveryStatus(id, status);
    fetchData();
  };

  if (!driver) {
    return (
      <div className="animate-entrance" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '85vh', padding: '1.5rem', width: '100%', maxWidth: '500px', margin: '0 auto' }}>
        {/* Waiting Room Header */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem', marginTop: '1rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0.8rem', background: 'rgba(57, 255, 20, 0.1)', border: '1px solid rgba(57, 255, 20, 0.2)', borderRadius: '99px', margin: '0 auto 1rem auto' }}>
            <Zap size={14} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--accent)' }}>ZTILABS LOGISTICS</span>
          </div>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>TELA DE ESPERA</h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3em' }}>Selecione seu card para operar</p>
        </div>

        {/* Drivers Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', width: '100%' }}>
          {driversList.length === 0 ? (
            <div className="card-premium" style={{ textAlign: 'center', padding: '3rem', opacity: 0.5 }}>
              <Package size={30} style={{ marginBottom: '1rem', opacity: 0.3 }} />
              <p style={{ fontSize: '12px' }}>Nenhum motoboy cadastrado no sistema.</p>
            </div>
          ) : (
            driversList.map(dr => {
              const driverDeliveries = deliveries.filter(d => d.driverId === dr.id);
              const onRouteCount = driverDeliveries.filter(d => d.status === 'EM ROTA').length;
              const deliveredCount = driverDeliveries.filter(d => d.status === 'ENTREGUE').length;
              const todayFees = driverDeliveries
                .filter(d => d.status === 'ENTREGUE')
                .reduce((sum, d) => sum + (d.deliveryFee || 0), 0);

              return (
                <div 
                  key={dr.id} 
                  onClick={() => setSelectedDriver(dr)}
                  className="card-premium animate-entrance hover-card" 
                  style={{ 
                    padding: '1.5rem', 
                    cursor: 'pointer', 
                    borderLeft: onRouteCount > 0 ? '4px solid var(--accent)' : '4px solid rgba(255,255,255,0.1)',
                    transition: 'all 0.2s ease-in-out'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ 
                        width: '45px', 
                        height: '45px', 
                        background: onRouteCount > 0 ? 'var(--accent)' : 'var(--surface-high)', 
                        borderRadius: '12px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        color: onRouteCount > 0 ? '#000' : 'var(--text-muted)' 
                      }}>
                        <User size={22} />
                      </div>
                      <div>
                        <p style={{ fontWeight: 800, fontSize: '1.3rem', color: '#fff' }}>{dr.name.toUpperCase()}</p>
                        <span style={{ 
                          fontSize: '9px', 
                          fontWeight: 900, 
                          padding: '0.15rem 0.5rem', 
                          borderRadius: '4px',
                          background: onRouteCount > 0 ? 'rgba(57, 255, 20, 0.1)' : 'rgba(255,255,255,0.05)',
                          color: onRouteCount > 0 ? 'var(--accent)' : 'var(--text-muted)'
                        }}>
                          {onRouteCount > 0 ? 'EM ROTA' : 'AGUARDANDO'}
                        </span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '14px', color: 'var(--accent)', fontWeight: 800 }}>R$ {todayFees.toFixed(2)}</p>
                      <p style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Taxas de Hoje</p>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
                    <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.01)', padding: '0.5rem', borderRadius: '10px' }}>
                      <p style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--primary)' }}>{onRouteCount}</p>
                      <p style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Em Rota</p>
                    </div>
                    <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.01)', padding: '0.5rem', borderRadius: '10px' }}>
                      <p style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--success)' }}>{deliveredCount}</p>
                      <p style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Entregues</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* PIN Keyboard Modal Overlay */}
        {selectedDriver && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(2, 2, 8, 0.85)',
            backdropFilter: 'blur(25px)',
            WebkitBackdropFilter: 'blur(25px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
            padding: '1rem'
          }}>
            <div className="card-premium animate-entrance" style={{ 
              width: '100%', 
              maxWidth: '380px', 
              padding: '2.5rem 2rem', 
              textAlign: 'center', 
              background: 'rgba(10, 10, 26, 0.95)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '24px',
              boxShadow: '0 24px 64px rgba(0,0,0,0.85)'
            }}>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.3em', marginBottom: '0.5rem' }}>AUTENTICAÇÃO MOTOBOY</p>
              <h3 style={{ fontSize: '1.6rem', color: '#fff', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '0.3rem' }}>{selectedDriver.name.toUpperCase()}</h3>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '2rem' }}>Digite seu PIN de segurança para continuar</p>
              
              {/* PIN Dots display container */}
              <div style={{ 
                background: 'rgba(0, 0, 0, 0.35)', 
                border: '1px solid rgba(255, 255, 255, 0.04)', 
                borderRadius: '99px', 
                padding: '0.8rem 2.2rem', 
                display: 'inline-flex', 
                gap: '16px', 
                marginBottom: '2.5rem' 
              }}>
                {[0, 1, 2, 3].map((idx) => (
                  <div 
                    key={idx} 
                    style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      border: '2px solid rgba(255, 255, 255, 0.2)',
                      borderColor: pinCode.length > idx ? 'var(--accent)' : 'rgba(255,255,255,0.2)',
                      background: pinCode.length > idx ? 'var(--accent)' : 'transparent',
                      boxShadow: pinCode.length > idx ? '0 0 10px var(--accent)' : 'none',
                      transition: 'all 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                    }}
                  />
                ))}
              </div>

              {/* Keypad Grid */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(3, 1fr)', 
                gap: '16px', 
                marginBottom: '2rem',
                maxWidth: '280px',
                margin: '0 auto 2rem auto',
                justifyItems: 'center'
              }}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                  <button 
                    key={num} 
                    onClick={() => handleKeypadPress(String(num))}
                    className="pin-btn"
                    type="button"
                  >
                    {num}
                  </button>
                ))}
                
                {/* Back / Voltar Button */}
                <button 
                  onClick={() => { setSelectedDriver(null); setPinCode(""); }}
                  className="pin-btn pin-btn-special"
                  type="button"
                  title="Voltar"
                >
                  <ArrowLeft size={22} />
                </button>
                
                {/* Zero Button */}
                <button 
                  onClick={() => handleKeypadPress('0')}
                  className="pin-btn"
                  type="button"
                >
                  0
                </button>
                
                {/* Clear / Delete Button */}
                <button 
                  onClick={handleKeypadClear}
                  className="pin-btn pin-btn-special pin-btn-danger"
                  type="button"
                  title="Limpar"
                >
                  <Delete size={22} />
                </button>
              </div>
              
              {isLoggingIn && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', minHeight: '20px' }}>
                  <Loader2 size={16} className="spin" style={{ color: 'var(--accent)' }} />
                  <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 600 }}>Verificando PIN...</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  const myDeliveries = deliveries.filter(d => d.driverId === driver.id && d.status !== 'ENTREGUE');
  const finishedDeliveries = deliveries.filter(d => d.driverId === driver.id && d.status === 'ENTREGUE');
  const availableDeliveries = deliveries.filter(d => !d.driverId && d.status === 'PENDENTE');

  return (
    <div className="page-container animate-entrance" style={{ maxWidth: '600px', marginTop: '1rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', padding: '1rem', background: 'var(--surface-high)', borderRadius: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', background: 'var(--accent)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000' }}>
            <User size={20} />
          </div>
          <div>
            <p style={{ fontSize: '10px', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Agente</p>
            <p style={{ fontWeight: 800, fontSize: '1.1rem' }}>{driver.name}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="btn-outline" style={{ padding: '0.6rem', color: 'var(--danger)', borderColor: 'rgba(255,45,85,0.2)' }}>
          <LogOut size={18} />
        </button>
      </header>

      <div className="card-premium animate-entrance" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
        <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--accent)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>REGISTRAR COMANDA</h3>
        <form onSubmit={handleRegisterDelivery} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'var(--surface-low)', padding: '0.5rem 1rem', borderRadius: '15px' }}>
            <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent)' }}>Comanda #</span>
            <input 
              type="number" 
              value={manualOrderNumber} 
              onChange={e => setManualOrderNumber(e.target.value)}
              className="input-premium"
              style={{ fontSize: '1.8rem', fontWeight: 800, textAlign: 'left', border: 'none', background: 'transparent', padding: '0.5rem' }}
              placeholder="000"
              required
            />
          </div>
          <button type="submit" className="btn-main" style={{ width: '100%', background: 'linear-gradient(135deg, var(--primary), #0066ff)', color: '#fff', border: 'none', height: '55px', fontSize: '1.1rem' }}>
            {isLoggingIn ? <Loader2 size={24} className="spin" /> : <><Package size={22} /> <span>Vincular Comanda</span></>}
          </button>
        </form>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '3rem' }}>
        <div>
          <h3 style={{ fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 900, textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '0.2em', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={14} /> Entregas Ativas
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {myDeliveries.length === 0 ? (
              <div className="card-premium" style={{ textAlign: 'center', padding: '2rem', opacity: 0.5, borderStyle: 'dashed' }}>
                <Package size={20} style={{ marginBottom: '0.5rem', opacity: 0.3 }} />
                <p style={{ fontSize: '11px' }}>Nenhuma entrega em rota no momento.</p>
              </div>
            ) : (
              myDeliveries.map(delivery => (
                <div key={delivery.id} className="card-premium animate-entrance" style={{ borderLeft: '4px solid var(--accent)' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                     <span style={{ fontSize: '1.2rem', background: 'rgba(57, 255, 20, 0.1)', color: 'var(--accent)', padding: '0.4rem 0.8rem', borderRadius: '8px', fontWeight: 900, border: '1px solid rgba(57, 255, 20, 0.2)' }}>
                       Comanda {delivery.orderNumber}
                     </span>
                     <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Em Rota</span>
                   </div>
                   <p style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>{delivery.customerName}</p>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.8rem' }}>
                      <MapPin size={14} /> {delivery.address}
                   </div>
                    {delivery.observations && (
                      <div style={{ background: 'rgba(57, 255, 20, 0.05)', padding: '0.8rem', borderRadius: '12px', border: '1px solid rgba(57, 255, 20, 0.1)', marginBottom: '1.2rem', fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 600 }}>
                        <MessageSquare size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                        {delivery.observations}
                      </div>
                    )}
                   <button onClick={() => handleStatusUpdate(delivery.id, 'ENTREGUE')} className="btn-main" style={{ width: '100%', background: 'var(--success)', border: 'none', height: '50px', fontSize: '0.9rem' }}>
                     <CheckCircle size={20} /> Confirmar Entrega
                   </button>
                </div>
              ))
            )}
          </div>
        </div>

        {finishedDeliveries.length > 0 && (
          <div>
            <h3 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 900, textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '0.2em', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle size={14} /> Histórico de Hoje
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {finishedDeliveries.map(delivery => (
                <div key={delivery.id} className="card-premium" style={{ padding: '0.8rem 1.2rem', opacity: 0.7, background: 'rgba(57, 255, 20, 0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>{delivery.customerName}</p>
                      <p style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{delivery.orderNumber} • Finalizado às {delivery.deliveredAt ? new Date(delivery.deliveredAt!).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}</p>
                    </div>
                    <p style={{ fontWeight: 800, color: 'var(--text-muted)', fontSize: '0.9rem' }}>Finalizado às {delivery.deliveredAt ? new Date(delivery.deliveredAt!).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {availableDeliveries.length > 0 && (
          <div>
            <h3 style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 900, textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '0.2em', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Package size={14} /> Comandas Disponíveis
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {availableDeliveries.map(delivery => (
                <div key={delivery.id} className="card-premium" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ background: 'rgba(57, 255, 20, 0.1)', padding: '0.5rem', borderRadius: '8px', minWidth: '110px', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 900, color: 'var(--accent)' }}>Comanda {delivery.orderNumber}</span>
                    </div>
                    <div>
                      <p style={{ fontWeight: 800, fontSize: '0.9rem' }}>{delivery.customerName}</p>
                      <p style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{(delivery.address || "").slice(0, 35)}...</p>
                    </div>
                  </div>
                  <button onClick={() => handleStatusUpdate(delivery.id, 'EM ROTA')} className="btn-outline" style={{ borderColor: 'var(--primary)', color: 'var(--primary)', padding: '0.4rem 0.8rem', fontSize: '11px' }}>
                    Assumir
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .hover-card:hover {
          transform: translateY(-2px);
          border-color: var(--accent) !important;
          box-shadow: 0 8px 30px rgba(57, 255, 20, 0.05);
        }
      `}</style>
    </div>
  );
}
