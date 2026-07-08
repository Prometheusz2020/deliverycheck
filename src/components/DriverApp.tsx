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

const hasValidAddress = (address?: string) => {
  if (!address) return false;
  const clean = address.trim().toLowerCase();
  if (clean === "não informado" || clean === "nao informado" || clean === "não informada") return false;
  if (clean === "s/e" || clean.startsWith("s/e,") || clean === "s/e, -") return false;
  if (clean.replace(/[^a-z0-9]/g, "") === "se") return false;
  if (clean.includes("entregar no estabelecimento")) return false;
  return true;
};

export default function DriverApp() {
  const [driver, setDriver] = useState<{ id: string; name: string } | null>(null);
  const [driversList, setDriversList] = useState<Driver[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  
  // PIN Login State
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [pinCode, setPinCode] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [markedDeliveryIds, setMarkedDeliveryIds] = useState<string[]>([]);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  const fetchData = async () => {
    try {
      const actions = await import("@/lib/actions");
      const today = new Date().toISOString().split('T')[0];
      const data = await actions.getDeliveries(today);
      const filtered = (data as Delivery[]).filter(d => hasValidAddress(d.address));
      setDeliveries(filtered);
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
      const filtered = (deliveriesData as Delivery[]).filter(d => hasValidAddress(d.address));
      setDeliveries(filtered);
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

  // Auto Logout on Inactivity
  useEffect(() => {
    if (!driver) return;

    let timeoutId: NodeJS.Timeout;

    const resetTimeout = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        handleLogout();
      }, 45000); // 45 seconds of inactivity
    };

    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart"];
    events.forEach(event => document.addEventListener(event, resetTimeout));

    resetTimeout();

    return () => {
      clearTimeout(timeoutId);
      events.forEach(event => document.removeEventListener(event, resetTimeout));
    };
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
        setIsLoginModalOpen(false);
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
    setIsLoginModalOpen(false);
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

  const handleBulkComplete = async () => {
    if (!driver || markedDeliveryIds.length === 0) return;
    setIsCompleting(true);
    try {
      const actions = await import("@/lib/actions");
      const res = await actions.bulkCompleteDeliveries(markedDeliveryIds, driver.id);
      if (res.success) {
        setMarkedDeliveryIds([]);
        fetchData();
      } else {
        alert("Erro ao confirmar entregas.");
      }
    } catch (err) {
      console.error(err);
      alert("Erro de conexão.");
    } finally {
      setIsCompleting(false);
    }
  };

  if (!driver) {
    return (
      <div className="animate-entrance" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '85vh', padding: '1.5rem', width: '100%', maxWidth: '800px', margin: '0 auto' }}>
        {/* Waiting Room Header */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem', marginTop: '1rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0.8rem', background: 'rgba(57, 255, 20, 0.1)', border: '1px solid rgba(57, 255, 20, 0.2)', borderRadius: '99px', margin: '0 auto 1rem auto' }}>
            <Zap size={14} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--accent)' }}>ZTILABS LOGISTICS</span>
          </div>
          <h1 style={{ fontSize: '3rem', fontWeight: 900, marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>PAINEL DE ESPERA</h1>
          <p style={{ fontSize: '16px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3em' }}>Sistema de Entregas</p>
        </div>

        {/* Info Card */}
        <div className="card-premium animate-entrance hover-card" style={{ width: '100%', maxWidth: '500px', padding: '2.5rem', textAlign: 'center', marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div style={{ background: 'rgba(255, 183, 0, 0.05)', border: '1px solid rgba(255, 183, 0, 0.1)', padding: '1.5rem', borderRadius: '16px' }}>
              <p style={{ fontSize: '3.5rem', fontWeight: 900, color: 'var(--warning)', lineHeight: '1' }}>
                {deliveries.filter(d => !d.driverId && d.status === 'PENDENTE').length}
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', marginTop: '0.5rem', letterSpacing: '0.1em' }}>Disponíveis</p>
            </div>
            <div style={{ background: 'rgba(57, 255, 20, 0.05)', border: '1px solid rgba(57, 255, 20, 0.1)', padding: '1.5rem', borderRadius: '16px' }}>
              <p style={{ fontSize: '3.5rem', fontWeight: 900, color: 'var(--accent)', lineHeight: '1' }}>
                {deliveries.filter(d => d.status === 'EM ROTA').length}
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', marginTop: '0.5rem', letterSpacing: '0.1em' }}>Em Rota</p>
            </div>
          </div>

          <button 
            onClick={() => setIsLoginModalOpen(true)}
            className="btn-main hover-card" 
            style={{ width: '100%', height: '65px', fontSize: '1.3rem', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
          >
            <User size={24} />
            <span>ACESSAR MEU PAINEL</span>
          </button>
        </div>

        {/* Login Modal Overlay */}
        {isLoginModalOpen && (
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
            {!selectedDriver ? (
              /* Driver Selection View */
              <div className="card-premium animate-entrance" style={{ 
                width: '100%', 
                maxWidth: '450px', 
                padding: '2.5rem 2rem', 
                background: 'rgba(10, 10, 26, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '24px',
                boxShadow: '0 24px 64px rgba(0,0,0,0.85)',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                  <h3 style={{ fontSize: '1.4rem', color: '#fff', fontWeight: 800 }}>SELECIONE SEU NOME</h3>
                  <button 
                    onClick={() => setIsLoginModalOpen(false)}
                    className="btn-outline" 
                    style={{ padding: '0.4rem 0.8rem', fontSize: '12px', borderColor: 'rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}
                  >
                    Fechar
                  </button>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', overflowY: 'auto', paddingRight: '4px' }}>
                  {driversList.filter(dr => dr.isActive !== false).length === 0 ? (
                    <p style={{ fontSize: '14px', color: 'var(--text-muted)', textAlign: 'center' }}>Nenhum motoboy ativo para hoje.</p>
                  ) : (
                    driversList.filter(dr => dr.isActive !== false).map(dr => (
                      <button
                        key={dr.id}
                        onClick={() => setSelectedDriver(dr)}
                        className="btn-outline hover-card"
                        style={{
                          width: '100%',
                          padding: '1.2rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-start',
                          fontSize: '1.2rem',
                          fontWeight: 800,
                          color: '#fff',
                          background: 'rgba(255,255,255,0.02)',
                          borderColor: 'rgba(255,255,255,0.05)',
                          textAlign: 'left'
                        }}
                      >
                        <User size={18} style={{ marginRight: '10px', color: 'var(--accent)' }} />
                        {dr.name.toUpperCase()}
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : (
              /* PIN Code View */
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
                  gap: '20px', 
                  marginBottom: '2rem',
                  maxWidth: '340px',
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
            )}
          </div>
        )}
      </div>
    );
  }

  const myDeliveries = deliveries.filter(d => d.driverId === driver.id && d.status !== 'ENTREGUE');
  const finishedDeliveries = deliveries.filter(d => d.driverId === driver.id && d.status === 'ENTREGUE');
  const availableDeliveries = deliveries.filter(d => !d.driverId && d.status === 'PENDENTE');

  return (
    <div className="page-container animate-entrance" style={{ maxWidth: '850px', marginTop: '1rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', padding: '1rem', background: 'var(--surface-high)', borderRadius: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '50px', height: '50px', background: 'var(--accent)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000' }}>
            <User size={24} />
          </div>
          <div>
            <p style={{ fontSize: '12px', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Agente</p>
            <p style={{ fontWeight: 800, fontSize: '1.5rem' }}>{driver.name}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="btn-outline" style={{ padding: '0.8rem', color: 'var(--danger)', borderColor: 'rgba(255,45,85,0.2)' }}>
          <LogOut size={22} />
        </button>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '3rem' }}>
        <div>
          <h3 style={{ fontSize: '1.2rem', color: 'var(--accent)', fontWeight: 900, textTransform: 'uppercase', marginBottom: '1.2rem', letterSpacing: '0.2em', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Zap size={20} /> Entregas Ativas
            <span style={{ 
              background: 'rgba(57, 255, 20, 0.1)', 
              color: 'var(--accent)', 
              padding: '0.2rem 0.6rem', 
              borderRadius: '6px', 
              fontSize: '0.9rem', 
              border: '1px solid rgba(57, 255, 20, 0.2)',
              marginLeft: '4px'
            }}>
              {myDeliveries.length}
            </span>
          </h3>
          <div className="active-deliveries-grid">
            {myDeliveries.length === 0 ? (
              <div className="card-premium" style={{ textAlign: 'center', padding: '2rem', opacity: 0.5, borderStyle: 'dashed', gridColumn: '1 / -1' }}>
                <Package size={20} style={{ marginBottom: '0.5rem', opacity: 0.3 }} />
                <p style={{ fontSize: '11px' }}>Nenhuma entrega em rota no momento.</p>
              </div>
            ) : (
              myDeliveries.map(delivery => {
                const isMarked = markedDeliveryIds.includes(delivery.id);
                const handleToggleMark = () => {
                  if (isMarked) {
                    setMarkedDeliveryIds(prev => prev.filter(id => id !== delivery.id));
                  } else {
                    setMarkedDeliveryIds(prev => [...prev, delivery.id]);
                  }
                };

                return (
                  <div 
                    key={delivery.id} 
                    onClick={handleToggleMark}
                    className="card-premium animate-entrance" 
                    style={{ 
                      padding: '1rem 1.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderLeft: isMarked ? '6px solid var(--success)' : '6px solid var(--accent)',
                      background: isMarked ? 'rgba(52, 199, 89, 0.08)' : 'rgba(255,255,255,0.02)',
                      borderColor: isMarked ? 'rgba(52, 199, 89, 0.4)' : undefined,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease-in-out',
                      boxShadow: isMarked ? '0 8px 30px rgba(52, 199, 89, 0.08)' : undefined
                    }}
                  >
                    <span style={{ 
                      fontSize: '1.4rem', 
                      fontWeight: 900, 
                      color: isMarked ? 'var(--success)' : 'var(--accent)'
                    }}>
                      Delivery {delivery.orderNumber}
                    </span>
                    <input 
                      type="checkbox"
                      checked={isMarked}
                      readOnly
                      style={{ width: '22px', height: '22px', cursor: 'pointer', accentColor: 'var(--success)' }}
                    />
                  </div>
                );
              })
            )}
          </div>
          
          {/* Confirmação em Lote */}
          {myDeliveries.length > 0 && markedDeliveryIds.length > 0 && (
            <div style={{
              position: 'sticky',
              bottom: '20px',
              zIndex: 99,
              background: 'rgba(10, 25, 15, 0.96)',
              border: '3px solid var(--success)',
              borderRadius: '20px',
              padding: '1.5rem',
              boxShadow: '0 12px 40px rgba(52, 199, 89, 0.4)',
              backdropFilter: 'blur(15px)',
              WebkitBackdropFilter: 'blur(15px)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              marginTop: '1.5rem',
              animation: 'slideUp 0.3s ease-out'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fff' }}>
                  {markedDeliveryIds.length} {markedDeliveryIds.length === 1 ? 'delivery marcado' : 'deliveries marcados'}
                </span>
                <button 
                  onClick={(e) => { e.stopPropagation(); setMarkedDeliveryIds([]); }}
                  className="btn-outline" 
                  style={{ padding: '0.5rem 1rem', fontSize: '13px', borderColor: 'rgba(255,255,255,0.2)', height: 'auto', color: 'var(--text-muted)', fontWeight: 800 }}
                >
                  Desmarcar Todas
                </button>
              </div>
              
              <button 
                onClick={handleBulkComplete}
                disabled={isCompleting}
                className="btn-main" 
                style={{ 
                  width: '100%', 
                  background: 'var(--success)', 
                  border: 'none', 
                  height: '65px', 
                  fontSize: '1.3rem',
                  fontWeight: 900,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px'
                }}
              >
                {isCompleting ? (
                  <>
                    <Loader2 size={26} className="spin" />
                    <span>Confirmando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle size={26} />
                    <span>Confirmar Entregas Selecionadas</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
        
        {finishedDeliveries.length > 0 && (
          <div>
            <h3 style={{ fontSize: '1.2rem', color: 'var(--text-muted)', fontWeight: 900, textTransform: 'uppercase', marginBottom: '1.2rem', letterSpacing: '0.2em', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CheckCircle size={20} /> Histórico de Hoje
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {finishedDeliveries.map(delivery => (
                <div key={delivery.id} className="card-premium" style={{ padding: '1.2rem 1.5rem', opacity: 0.7, background: 'rgba(57, 255, 20, 0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ fontWeight: 800, fontSize: '1.2rem' }}>{delivery.customerName}</p>
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Delivery {delivery.orderNumber} • Finalizado às {delivery.deliveredAt ? new Date(delivery.deliveredAt!).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}</p>
                    </div>
                    <p style={{ fontWeight: 800, color: 'var(--text-muted)', fontSize: '1.1rem' }}>Finalizado às {delivery.deliveredAt ? new Date(delivery.deliveredAt!).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {availableDeliveries.length > 0 && (
          <div>
            <h3 style={{ fontSize: '1.2rem', color: 'var(--primary)', fontWeight: 900, textTransform: 'uppercase', marginBottom: '1.2rem', letterSpacing: '0.2em', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Package size={20} /> Deliveries Disponíveis
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {availableDeliveries.map(delivery => (
                <div key={delivery.id} className="card-premium" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <div style={{ background: 'rgba(57, 255, 20, 0.1)', padding: '0.8rem 1.2rem', borderRadius: '10px', minWidth: '150px', textAlign: 'center' }}>
                      <span style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--accent)' }}>Delivery {delivery.orderNumber}</span>
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
                        <p style={{ fontWeight: 900, fontSize: '1.5rem', color: '#fff', margin: 0 }}>{delivery.customerName}</p>
                        {delivery.totalAmount !== undefined && delivery.totalAmount !== null && delivery.totalAmount > 0 && (
                          <span style={{ 
                            fontSize: '11px', 
                            background: 'rgba(0, 242, 255, 0.1)', 
                            color: 'var(--primary)', 
                            padding: '0.2rem 0.6rem', 
                            borderRadius: '6px', 
                            border: '1px solid rgba(0, 242, 255, 0.2)',
                            fontWeight: 800
                          }}>
                            R$ {delivery.totalAmount.toFixed(2)}
                          </span>
                        )}
                        {delivery.paymentMethod && (
                          <span style={{ 
                            fontSize: '11px', 
                            background: 'rgba(255, 255, 255, 0.05)', 
                            color: 'var(--text-secondary)', 
                            padding: '0.2rem 0.6rem', 
                            borderRadius: '6px', 
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            fontWeight: 800
                          }}>
                            {delivery.paymentMethod.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)', fontWeight: 600 }}>{delivery.address || "Não informado"}</p>
                    </div>
                  </div>
                  <button onClick={() => handleStatusUpdate(delivery.id, 'EM ROTA')} className="btn-outline" style={{ borderColor: 'var(--primary)', color: 'var(--primary)', padding: '0.8rem 1.5rem', fontSize: '14px', fontWeight: 800 }}>
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
        .drivers-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1.5rem;
          width: 100%;
        }
        @media (min-width: 600px) {
          .drivers-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        .active-deliveries-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0.8rem;
          width: 100%;
        }
        @media (min-width: 480px) {
          .active-deliveries-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (min-width: 768px) {
          .active-deliveries-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }
      `}</style>
    </div>
  );
}

