"use client";

import { useEffect, useState } from "react";
import { processReceipt } from "@/lib/ocr";
import { 
  getSessionDriver, logoutAdmin 
} from "@/lib/auth-actions";
import { 
  Camera, CheckCircle, Clock, MapPin, User, LogOut, 
  Package, Zap, Loader2, ArrowRight, ShieldCheck, QrCode 
} from "lucide-react";

export default function DriverApp() {
  const [driver, setDriver] = useState<{ id: string; name: string } | null>(null);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  
  // Login State
  const [loginName, setLoginName] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const fetchData = async () => {
    try {
      const actions = await import("@/lib/actions");
      const data = await actions.getDeliveries();
      setDeliveries(data as any);
    } catch (err) {
      console.error("Driver Fetch Error:", err);
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
        }
      } catch (err) {
        setDriver(null);
      }
    };
    checkSession();
  }, []);

  useEffect(() => {
    if (!driver) return;
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [driver]);

  const handleDriverLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    try {
      const actions = await import("@/lib/actions");
      const res = await actions.loginDriver(loginName, loginPass);
      if (res.success) {
        const session = await getSessionDriver();
        setDriver(session);
        fetchData();
      } else {
        alert("Credenciais de motorista inválidas.");
      }
    } catch (err) {
      alert("Erro ao conectar com a central.");
    }
    setIsLoggingIn(false);
  };

  const handleLogout = async () => {
    await logoutAdmin(); // Reuso da lógica de limpar cookies
    setDriver(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !driver) return;
    setIsScanning(true);
    try {
      const data = await processReceipt(e.target.files[0]);
      if (data) {
        const actions = await import("@/lib/actions");
        await actions.addDelivery({
          ...data,
          driverId: driver.id,
          deliveryPerson: driver.name,
          status: 'EM ROTA'
        });
        fetchData();
      } else {
        alert("Não foi possível processar a imagem. Tente novamente.");
      }
    } catch (err) {
      alert("Erro no processamento da imagem.");
    }
    setIsScanning(true);
  };

  const handleStatusUpdate = async (id: string, status: any) => {
    const actions = await import("@/lib/actions");
    await actions.updateDeliveryStatus(id, status);
    fetchData();
  };

  if (!driver) {
    return (
      <div className="animate-entrance" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '85vh', padding: '1.5rem' }}>
        <div className="card-premium" style={{ width: '100%', maxWidth: '400px', textAlign: 'center', padding: '3rem 2rem' }}>
          <div style={{ padding: '1rem', background: 'rgba(57, 255, 20, 0.05)', borderRadius: '20px', display: 'inline-flex', marginBottom: '2rem' }}>
            <Zap size={40} style={{ color: 'var(--accent)' }} />
          </div>
          
          <h1 style={{ fontSize: '2.2rem', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>DRIVER HUB</h1>
          <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.4em', marginBottom: '3rem' }}>ZtiLabs Driver Logistics</p>
          
          <form onSubmit={handleDriverLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', textAlign: 'left' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <label style={{ fontSize: '9px', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Nome do Agente</label>
              <input 
                type="text" 
                value={loginName} 
                onChange={e => setLoginName(e.target.value)} 
                className="input-premium" 
                placeholder="Ex: Maverick X" 
                required
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <label style={{ fontSize: '9px', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase' }}>PIN de Segurança</label>
              <input 
                type="password" 
                value={loginPass} 
                onChange={e => setLoginPass(e.target.value)} 
                className="input-premium" 
                placeholder="Introduza seu código" 
                required
                autoComplete="current-password"
              />
            </div>
            <button type="submit" disabled={isLoggingIn} className="btn-main" style={{ marginTop: '1.5rem', background: 'linear-gradient(135deg, var(--accent), #00cc66)', color: '#000' }}>
              {isLoggingIn ? <Loader2 size={18} className="spin" /> : <span>Iniciar Jornada</span>}
              <ArrowRight size={18} />
            </button>
          </form>

          <div style={{ marginTop: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: 0.5 }}>
             <ShieldCheck size={14} />
             <p style={{ fontSize: '10px', fontWeight: 700 }}>Conexão Direta e Segura</p>
          </div>
        </div>
      </div>
    );
  }

  const myDeliveries = deliveries.filter(d => d.driverId === driver.id && d.status !== 'ENTREGUE');
  const availableDeliveries = deliveries.filter(d => !d.driverId && d.status === 'PENDENTE');

  return (
    <div className="page-container animate-entrance" style={{ maxWidth: '600px', marginTop: '1rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', padding: '1rem', background: 'var(--surface-high)', borderRadius: '20px' }}>
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

      <div style={{ marginBottom: '2rem' }}>
        <label className="btn-main" style={{ cursor: 'pointer', height: '140px', flexDirection: 'column', gap: '1rem', fontSize: '1.2rem', background: 'linear-gradient(135deg, var(--primary), #0076fe)', color: '#fff', border: 'none' }}>
          {isScanning ? <Loader2 size={40} className="spin" /> : <Camera size={40} />}
          <span>Escanear Novo Pedido</span>
          <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFileUpload} />
        </label>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div>
          <h3 style={{ fontSize: '0.9rem', color: 'var(--accent)', fontWeight: 900, textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '0.2em' }}>Minhas Entregas</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {myDeliveries.length === 0 ? (
              <div className="card-premium" style={{ textAlign: 'center', padding: '3rem', opacity: 0.5, borderStyle: 'dashed' }}>
                <Package size={24} style={{ marginBottom: '1rem', opacity: 0.3 }} />
                <p style={{ fontSize: '12px' }}>Nenhum pedido em rota ativa.</p>
              </div>
            ) : (
              myDeliveries.map(delivery => (
                <div key={delivery.id} className="card-premium animate-entrance" style={{ borderLeft: '4px solid var(--accent)' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                     <span style={{ fontSize: '10px', background: 'rgba(57, 255, 20, 0.1)', color: 'var(--accent)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 900 }}>#{delivery.orderNumber}</span>
                     <p style={{ fontWeight: 800, color: 'var(--success)' }}>R$ {delivery.totalAmount.toFixed(2)}</p>
                   </div>
                   <p style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.5rem' }}>{delivery.customerName}</p>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                      <MapPin size={14} /> {delivery.address}
                   </div>
                   {delivery.observations && (
                      <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.8rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        <strong>Nota:</strong> {delivery.observations}
                      </div>
                   )}
                   <button onClick={() => handleStatusUpdate(delivery.id, 'ENTREGUE')} className="btn-main" style={{ width: '100%', background: 'var(--success)', border: 'none', height: '60px' }}>
                     <CheckCircle size={24} /> Confirmar Entrega
                   </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <h3 style={{ fontSize: '0.9rem', color: 'var(--primary)', fontWeight: 900, textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '0.2em' }}>Pendentes no Comando</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {availableDeliveries.map(delivery => (
              <div key={delivery.id} className="card-premium" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontWeight: 800 }}>{delivery.customerName}</p>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{delivery.address.slice(0, 30)}...</p>
                </div>
                <button onClick={() => handleStatusUpdate(delivery.id, 'EM ROTA')} className="btn-outline" style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}>
                  Assumir
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
