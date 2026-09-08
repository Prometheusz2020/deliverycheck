"use client";

import { useEffect, useState, useCallback } from "react";
import { DeliveryStatsReport } from "@/lib/types";
import { 
  BarChart3, Calendar, Clock, DollarSign, Package, 
  TrendingUp, Users, RefreshCw, CheckCircle2, AlertTriangle, 
  XCircle, Truck, Layers, Loader2
} from "lucide-react";
import MonthlyLineChart from "./MonthlyLineChart";

export default function DeliveryStatsDashboard() {
  const [period, setPeriod] = useState<"day" | "month" | "year">("day");
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7)
  );
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [report, setReport] = useState<DeliveryStatsReport | null>(null);
  const [historicalData, setHistoricalData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const actions = await import("@/lib/actions");
      if (period === "year") {
        const resHist = await actions.getHistoricalDeliveryStats(selectedYear);
        setHistoricalData(resHist);
      } else {
        const dateStr = period === "day" ? selectedDate : selectedMonth;
        const res = await actions.getDeliveryStatsReport({ period, dateStr });
        setReport(res);
      }
    } catch (err) {
      console.error("Erro ao carregar estatísticas:", err);
    } finally {
      setLoading(false);
    }
  }, [period, selectedDate, selectedMonth, selectedYear]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val || 0);
  };

  const maxTimelineCount = report?.timeline 
    ? Math.max(...report.timeline.map(t => t.count), 1)
    : 1;

  return (
    <div className="animate-entrance" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Controles Superiores: Filtros de Período e Data */}
      <div className="card-premium" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', padding: '1.2rem 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(0, 122, 255, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
            <BarChart3 size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 900, margin: 0, color: '#fff', letterSpacing: '0.02em' }}>
              VOLUME & ESTATÍSTICAS DE ENTREGA
            </h2>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
              Análise completa de entregas, faturamento, taxas, motoboys e gráfico de evolução
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          {/* Seletor de Tipo (Dia vs Mês vs Ano/Histórico) */}
          <div style={{ display: 'flex', background: 'var(--surface-high)', padding: '0.3rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <button
              onClick={() => setPeriod("day")}
              className={period === "day" ? "btn-main" : "btn-outline"}
              style={{ padding: '0.5rem 1.2rem', fontSize: '12px', borderRadius: '8px' }}
            >
              <Clock size={15} /> Por Dia
            </button>
            <button
              onClick={() => setPeriod("month")}
              className={period === "month" ? "btn-main" : "btn-outline"}
              style={{ padding: '0.5rem 1.2rem', fontSize: '12px', borderRadius: '8px', marginLeft: '0.3rem' }}
            >
              <Calendar size={15} /> Por Mês
            </button>
            <button
              onClick={() => setPeriod("year")}
              className={period === "year" ? "btn-main" : "btn-outline"}
              style={{ padding: '0.5rem 1.2rem', fontSize: '12px', borderRadius: '8px', marginLeft: '0.3rem' }}
            >
              <TrendingUp size={15} /> Por Ano / Histórico
            </button>
          </div>

          {/* Campo de Data ou Mês se não for ano */}
          {period !== "year" && (
            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface-high)', padding: '0.4rem 0.8rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', gap: '8px' }}>
              <Calendar size={16} style={{ color: 'var(--primary)' }} />
              {period === "day" ? (
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="input-premium"
                  style={{ padding: '0.2rem', background: 'transparent', border: 'none', color: 'var(--text)', fontSize: '13px', cursor: 'pointer' }}
                />
              ) : (
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="input-premium"
                  style={{ padding: '0.2rem', background: 'transparent', border: 'none', color: 'var(--text)', fontSize: '13px', cursor: 'pointer' }}
                />
              )}
            </div>
          )}

          <button
            onClick={fetchStats}
            className="btn-outline"
            style={{ padding: '0.6rem', borderRadius: '10px', height: '40px', width: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Atualizar Estatísticas"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {period === "year" && (
        <>
          {loading && !historicalData ? (
            <div className="card-premium" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Loader2 size={36} className="animate-spin" style={{ margin: '0 auto 1rem auto', color: 'var(--primary)' }} />
              <p style={{ fontSize: '14px', fontWeight: 600 }}>Carregando estatísticas históricas de entregas...</p>
            </div>
          ) : (
            <MonthlyLineChart
              title="EVOLUÇÃO ANUAL DE ENTREGAS E FATURAMENTO"
              subtitle="Gráfico de linhas com todos os 12 meses do ano e linha do tempo histórica"
              data={(historicalData?.months || []).map((m: any) => ({
                label: m.shortName,
                fullLabel: `${m.fullName} de ${m.year}`,
                val1: m.salesTotal,
                val2: m.deliveredCount,
                val3: m.totalFees,
                count1: m.deliveredCount
              }))}
              historicalData={(historicalData?.historicalTimeline || []).map((h: any) => ({
                label: h.label,
                fullLabel: `${h.label} (${h.deliveredCount} entregues, ${formatCurrency(h.salesTotal)})`,
                val1: h.salesTotal,
                val2: h.deliveredCount,
                val3: h.totalFees,
                count1: h.deliveredCount
              }))}
              availableYears={historicalData?.availableYears || [new Date().getFullYear()]}
              selectedYear={historicalData?.targetYear || selectedYear}
              onYearChange={(yr) => {
                setSelectedYear(yr);
              }}
              metric1Label="Faturamento Entregas (R$)"
              metric2Label="Quantidade Entregues"
              metric3Label="Total Taxas Motoboys"
              isCurrency={true}
              summaryCards={{
                totalYear: historicalData?.summary?.yearSalesTotal || 0,
                avgMonthly: historicalData?.summary?.avgMonthlySales || 0,
                bestMonth: historicalData?.summary?.bestMonth || "-",
                secondaryTotal: historicalData?.summary?.yearTotalFees || 0
              }}
            />
          )}
        </>
      )}

      {period !== "year" && report && (

        <>
          {/* Título do Relatório Selecionado */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {report.title}
            </h3>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Taxa de Sucesso: <strong style={{ color: 'var(--success)' }}>{report.completionRate.toFixed(1)}% concluídas</strong>
            </span>
          </div>

          {/* Cards de Métricas Principais (KPIs) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.2rem' }}>
            {/* KPI 1: Volume Total */}
            <div className="card-premium" style={{ borderTop: '4px solid var(--primary)', padding: '1.4rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--primary)', marginBottom: '1rem' }}>
                <Truck size={24} />
                <span style={{ fontSize: '10px', fontWeight: 900, background: 'rgba(0,122,255,0.12)', padding: '2px 8px', borderRadius: '6px' }}>
                  {report.deliveredOrders} ENTREGUES
                </span>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', margin: 0 }}>
                VOLUME TOTAL ENTREGAS
              </p>
              <p style={{ fontSize: '2rem', fontWeight: 900, margin: '4px 0 0 0', lineHeight: 1 }}>
                {report.totalOrders} <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>comandas</span>
              </p>
              <div style={{ display: 'flex', gap: '8px', marginTop: '1rem', paddingTop: '0.8rem', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '11px' }}>
                <span style={{ color: 'var(--success)' }}>✓ {report.deliveredOrders} OK</span>
                <span style={{ color: 'var(--primary)' }}>✈ {report.onRouteOrders} Rota</span>
                {report.canceledOrders > 0 && <span style={{ color: 'var(--danger)' }}>✕ {report.canceledOrders} Canc</span>}
              </div>
            </div>

            {/* KPI 2: Faturamento Total */}
            <div className="card-premium" style={{ borderTop: '4px solid var(--success)', padding: '1.4rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success)', marginBottom: '1rem' }}>
                <DollarSign size={24} />
                <span style={{ fontSize: '10px', fontWeight: 900, background: 'rgba(52,199,89,0.12)', padding: '2px 8px', borderRadius: '6px' }}>
                  TICKET MÉDIO: {formatCurrency(report.avgTicket)}
                </span>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', margin: 0 }}>
                FATURAMENTO DE ENTREGAS
              </p>
              <p style={{ fontSize: '1.8rem', fontWeight: 900, margin: '4px 0 0 0', lineHeight: 1, color: 'var(--success)' }}>
                {formatCurrency(report.totalAmount)}
              </p>
              <div style={{ marginTop: '1rem', paddingTop: '0.8rem', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '11px', color: 'var(--text-muted)' }}>
                Baseado em comandas finalizadas
              </div>
            </div>

            {/* KPI Específico: Média por Dia */}
            <div className="card-premium" style={{ borderTop: '4px solid #a855f7', padding: '1.4rem', background: 'rgba(168, 85, 247, 0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a855f7', marginBottom: '1rem' }}>
                <Calendar size={24} />
                <span style={{ fontSize: '10px', fontWeight: 900, background: 'rgba(168, 85, 247, 0.15)', padding: '2px 8px', borderRadius: '6px' }}>
                  {period === "day" ? "HOJE" : "DIÁRIO"}
                </span>
              </div>
              <p style={{ color: '#a855f7', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', margin: 0 }}>
                MÉDIA POR DIA NO PERÍODO
              </p>
              <p style={{ fontSize: '1.8rem', fontWeight: 900, margin: '4px 0 0 0', lineHeight: 1, color: '#a855f7' }}>
                {formatCurrency(
                  period === "day" 
                    ? report.totalAmount 
                    : (report.totalAmount / (period === "month" ? (new Date(parseInt(selectedMonth.split("-")[0]), parseInt(selectedMonth.split("-")[1]), 0).getDate()) : 30))
                )}
              </p>
              <div style={{ marginTop: '1rem', paddingTop: '0.8rem', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '11px', color: 'var(--text-muted)' }}>
                Média de {
                  (report.deliveredOrders / (period === "day" ? 1 : (period === "month" ? (new Date(parseInt(selectedMonth.split("-")[0]), parseInt(selectedMonth.split("-")[1]), 0).getDate()) : 30))).toFixed(1)
                } entregas/dia
              </div>
            </div>

            {/* KPI 3: Taxas de Motoboys */}
            <div className="card-premium" style={{ borderTop: '4px solid var(--accent)', padding: '1.4rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--accent)', marginBottom: '1rem' }}>
                <TrendingUp size={24} />
                <span style={{ fontSize: '10px', fontWeight: 900, background: 'rgba(57,255,20,0.12)', padding: '2px 8px', borderRadius: '6px' }}>
                  A REPASSAR
                </span>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', margin: 0 }}>
                TAXAS DOS MOTOBOYS
              </p>
              <p style={{ fontSize: '1.8rem', fontWeight: 900, margin: '4px 0 0 0', lineHeight: 1, color: 'var(--accent)' }}>
                {formatCurrency(report.totalFees)}
              </p>
              <div style={{ marginTop: '1rem', paddingTop: '0.8rem', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '11px', color: 'var(--text-muted)' }}>
                Total acumulado das entregas
              </div>
            </div>

            {/* KPI 4: Total de Marmitex / Itens */}
            <div className="card-premium" style={{ borderTop: '4px solid var(--warning)', padding: '1.4rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--warning)', marginBottom: '1rem' }}>
                <Package size={24} />
                <span style={{ fontSize: '10px', fontWeight: 900, background: 'rgba(255,149,0,0.12)', padding: '2px 8px', borderRadius: '6px' }}>
                  PRODUTOS
                </span>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', margin: 0 }}>
                TOTAL DE MARMITEX / ITENS
              </p>
              <p style={{ fontSize: '2rem', fontWeight: 900, margin: '4px 0 0 0', lineHeight: 1, color: 'var(--warning)' }}>
                {report.totalItems} <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>unidades</span>
              </p>
              <div style={{ marginTop: '1rem', paddingTop: '0.8rem', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '11px', color: 'var(--text-muted)' }}>
                Média de {report.deliveredOrders > 0 ? (report.totalItems / report.deliveredOrders).toFixed(1) : 0} por comanda
              </div>
            </div>
          </div>

          {/* Gráfico Visual de Distribuição no Tempo (Horários / Dias) */}
          {report.timeline.length > 0 && (
            <div className="card-premium" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 900, margin: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers size={18} style={{ color: 'var(--primary)' }} />
                  DISTRIBUIÇÃO DE VOLUME NO TEMPO ({period === "day" ? "POR HORA" : "POR DIA DO MÊS"})
                </h3>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '180px', paddingTop: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', overflowX: 'auto' }}>
                {report.timeline.map((item, idx) => {
                  const pct = Math.round((item.count / maxTimelineCount) * 100);
                  return (
                    <div key={idx} style={{ flex: 1, minWidth: period === "day" ? '36px' : '28px', display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                      <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--primary)', marginBottom: '4px' }}>
                        {item.count}
                      </span>
                      <div 
                        style={{ 
                          width: '100%', 
                          maxHeight: '130px', 
                          height: `${Math.max(pct, 6)}%`, 
                          background: 'linear-gradient(180deg, var(--primary) 0%, rgba(0, 122, 255, 0.3) 100%)', 
                          borderRadius: '6px 6px 0 0',
                          transition: 'height 0.4s ease'
                        }}
                        title={`${item.label}: ${item.count} comandas (${item.deliveredCount} entregues - ${formatCurrency(item.totalAmount)})`}
                      />
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px', whiteSpace: 'nowrap' }}>
                        {item.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tabela de Desempenho e Volume por Motoboy */}
          <div className="card-premium" style={{ borderTop: '4px solid var(--accent)', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Users size={20} style={{ color: 'var(--accent)' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 900, margin: 0, color: '#fff', letterSpacing: '0.05em' }}>
                  DESEMPENHO E VOLUME POR MOTOBOY
                </h3>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Total de Motoboys com Entregas: <strong>{report.drivers.filter(d => d.totalDeliveries > 0).length}</strong>
              </span>
            </div>

            <div className="table-wrapper">
              <table className="table-premium">
                <thead>
                  <tr>
                    <th>Entregador</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                    <th style={{ textAlign: 'center' }}>Entregas Concluídas</th>
                    <th style={{ textAlign: 'center' }}>Participação (%)</th>
                    <th style={{ textAlign: 'center' }}>Itens (Marmitex)</th>
                    <th style={{ textAlign: 'right' }}>Total Transportado</th>
                    <th style={{ textAlign: 'right' }}>Taxas Acumuladas</th>
                  </tr>
                </thead>
                <tbody>
                  {report.drivers.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                        Nenhum motorista registrado no período.
                      </td>
                    </tr>
                  ) : (
                    report.drivers.map((dr) => (
                      <tr key={dr.driverId}>
                        <td style={{ fontWeight: 800, color: '#fff' }}>
                          {dr.driverName.toUpperCase()}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{
                            fontSize: '9px',
                            fontWeight: 900,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: dr.isActive ? 'rgba(57, 255, 20, 0.12)' : 'rgba(255,255,255,0.05)',
                            color: dr.isActive ? 'var(--accent)' : 'var(--text-muted)'
                          }}>
                            {dr.isActive ? 'ATIVO' : 'INATIVO'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 800, color: 'var(--success)' }}>
                          {dr.deliveredCount}
                        </td>
                        <td style={{ textAlign: 'center', width: '180px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ flex: 1, height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${dr.sharePercentage}%`, background: 'var(--accent)', borderRadius: '4px' }} />
                            </div>
                            <span style={{ fontSize: '11px', fontWeight: 700, minWidth: '40px', textAlign: 'right' }}>
                              {dr.sharePercentage}%
                            </span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>
                          {dr.itemsCount} un
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--success)' }}>
                          {formatCurrency(dr.totalAmount)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--accent)' }}>
                          {formatCurrency(dr.totalFees)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Formas de Pagamento Utilizadas */}
          <div className="card-premium" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 900, marginBottom: '1.2rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <DollarSign size={18} style={{ color: 'var(--success)' }} />
              DISTRIBUIÇÃO POR FORMA DE PAGAMENTO
            </h3>

            <div className="table-wrapper">
              <table className="table-premium">
                <thead>
                  <tr>
                    <th>Forma de Pagamento</th>
                    <th style={{ textAlign: 'center' }}>Qtd Entregas</th>
                    <th style={{ textAlign: 'right' }}>Valor Total</th>
                  </tr>
                </thead>
                <tbody>
                  {report.paymentMethods.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem' }}>
                        Nenhuma forma de pagamento registrada.
                      </td>
                    </tr>
                  ) : (
                    report.paymentMethods.map((p, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 800, color: '#fff' }}>
                          {p.method}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 800 }}>
                          {p.count}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--success)' }}>
                          {formatCurrency(p.totalAmount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
