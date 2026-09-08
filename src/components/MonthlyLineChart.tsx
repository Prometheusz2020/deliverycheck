"use client";

import { useState, useMemo } from "react";
import { TrendingUp, Calendar, DollarSign, BarChart2, Layers, Award, ArrowUpRight, Filter } from "lucide-react";

export type ChartDataItem = {
  label: string; // Ex: "Jan", "Fev" ou "Jan/24"
  fullLabel?: string; // Ex: "Janeiro de 2026"
  val1: number; // Métrica primária (ex: Vendas Fiado ou Faturamento Entregas)
  val2?: number; // Métrica secundária (ex: Pagamentos Recebidos)
  val3?: number; // Métrica terciária (ex: Saldo Líquido)
  count1?: number; // Quantidade de registros
  count2?: number;
};

interface MonthlyLineChartProps {
  title: string;
  subtitle?: string;
  data: ChartDataItem[];
  historicalData?: ChartDataItem[];
  availableYears: number[];
  selectedYear: number;
  onYearChange: (year: number) => void;
  metric1Label?: string;
  metric2Label?: string;
  metric3Label?: string;
  isCurrency?: boolean;
  summaryCards?: {
    totalYear: number;
    avgMonthly: number;
    avgDaily?: number;
    avgDailyCount?: number;
    bestMonth: string;
    secondaryTotal?: number;
  };
}

export default function MonthlyLineChart({
  title,
  subtitle,
  data,
  historicalData = [],
  availableYears,
  selectedYear,
  onYearChange,
  metric1Label = "Vendas / Faturamento",
  metric2Label = "Pagamentos / Recebimentos",
  metric3Label = "Saldo Líquido",
  isCurrency = true,
  summaryCards
}: MonthlyLineChartProps) {
  const [viewMode, setViewMode] = useState<"year" | "history">("year");
  const [activeSeries, setActiveSeries] = useState<"all" | "metric1" | "metric2">("all");
  const [hoveredPoint, setHoveredPoint] = useState<{ idx: number; item: ChartDataItem; x: number; y: number } | null>(null);

  const activeData = viewMode === "year" ? data : historicalData;

  const formatValue = (val: number) => {
    if (isCurrency) {
      return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val || 0);
    }
    return new Intl.NumberFormat("pt-BR").format(val || 0);
  };

  // Calcular dimensões do SVG
  const width = 800;
  const height = 300;
  const padding = { top: 30, right: 30, bottom: 45, left: 55 };

  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;

  // Encontrar valor máximo para escala Y
  const maxVal = useMemo(() => {
    if (!activeData || activeData.length === 0) return 100;
    let max = 0;
    activeData.forEach(d => {
      if (activeSeries === "all" || activeSeries === "metric1") max = Math.max(max, d.val1 || 0);
      if ((activeSeries === "all" || activeSeries === "metric2") && d.val2 !== undefined) max = Math.max(max, d.val2 || 0);
    });
    return max === 0 ? 100 : max * 1.15; // 15% padding no topo
  }, [activeData, activeSeries]);

  // Pontos de coordenadas X, Y
  const points = useMemo(() => {
    if (!activeData || activeData.length === 0) return { p1: [], p2: [] };

    const stepX = activeData.length > 1 ? graphWidth / (activeData.length - 1) : graphWidth;

    const p1 = activeData.map((d, i) => {
      const x = padding.left + (activeData.length === 1 ? graphWidth / 2 : i * stepX);
      const y = padding.top + graphHeight - ((d.val1 || 0) / maxVal) * graphHeight;
      return { x, y, item: d, idx: i };
    });

    const p2 = activeData.map((d, i) => {
      const x = padding.left + (activeData.length === 1 ? graphWidth / 2 : i * stepX);
      const val = d.val2 || 0;
      const y = padding.top + graphHeight - (val / maxVal) * graphHeight;
      return { x, y, item: d, idx: i };
    });

    return { p1, p2 };
  }, [activeData, maxVal, graphWidth, graphHeight, padding]);

  // Gerar caminho SVG suave (smooth cubic bezier curve)
  const generateSVGPath = (pts: { x: number; y: number }[]) => {
    if (pts.length === 0) return "";
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;

    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const curr = pts[i];
      const next = pts[i + 1];
      const cp1x = curr.x + (next.x - curr.x) / 2;
      const cp1y = curr.y;
      const cp2x = curr.x + (next.x - curr.x) / 2;
      const cp2y = next.y;
      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`;
    }
    return path;
  };

  const path1 = generateSVGPath(points.p1);
  const path2 = generateSVGPath(points.p2);

  // Caminhos para área com gradiente abaixo da linha
  const area1 = points.p1.length > 0 
    ? `${path1} L ${points.p1[points.p1.length - 1].x} ${padding.top + graphHeight} L ${points.p1[0].x} ${padding.top + graphHeight} Z` 
    : "";

  const area2 = points.p2.length > 0 
    ? `${path2} L ${points.p2[points.p2.length - 1].x} ${padding.top + graphHeight} L ${points.p2[0].x} ${padding.top + graphHeight} Z` 
    : "";

  const hasMetric2 = activeData.some(d => d.val2 !== undefined && d.val2 > 0);

  // Cálculo da média de entregas/vendas por dia considerando o período selecionado
  const calculatedAvgDailyCount = useMemo(() => {
    if (!summaryCards) return 0;
    if (summaryCards.avgDailyCount !== undefined) return summaryCards.avgDailyCount;
    const currentYear = new Date().getFullYear();
    let days = 365;
    if (selectedYear === currentYear) {
      const startOfYear = new Date(currentYear, 0, 1);
      const now = new Date();
      days = Math.max(1, Math.floor((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    } else {
      const isLeap = (selectedYear % 4 === 0 && selectedYear % 100 !== 0) || (selectedYear % 400 === 0);
      days = isLeap ? 366 : 365;
    }
    const totalCount = data.reduce((sum, item) => sum + (item.count1 || 0), 0);
    return totalCount > 0 ? totalCount / days : 0;
  }, [summaryCards, selectedYear, data]);

  return (
    <div className="card-premium animate-entrance" style={{ padding: '1.8rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Cabeçalho do Gráfico */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '1.2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(0, 242, 255, 0.12)', border: '1px solid rgba(0, 242, 255, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
            <TrendingUp size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {title}
            </h3>
            {subtitle && (
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, marginTop: '2px' }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Controles de Filtros e Modo de Visualização */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          {/* Seletor de Modo: Ano Específico vs Evolução Histórica */}
          <div style={{ display: 'flex', background: 'var(--surface-high)', padding: '0.3rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <button
              onClick={() => setViewMode("year")}
              className={viewMode === "year" ? "btn-main" : "btn-outline"}
              style={{ padding: '0.5rem 1rem', fontSize: '11px', borderRadius: '8px', gap: '6px' }}
            >
              <Calendar size={14} /> Por Meses do Ano
            </button>
            <button
              onClick={() => setViewMode("history")}
              className={viewMode === "history" ? "btn-main" : "btn-outline"}
              style={{ padding: '0.5rem 1rem', fontSize: '11px', borderRadius: '8px', marginLeft: '0.3rem', gap: '6px' }}
            >
              <Layers size={14} /> Evolução Histórica
            </button>
          </div>

          {/* Seletor de Ano */}
          {viewMode === "year" && (
            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface-high)', padding: '0.3rem 0.8rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', gap: '8px' }}>
              <Filter size={14} style={{ color: 'var(--primary)' }} />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>Ano:</span>
              <select
                value={selectedYear}
                onChange={(e) => onYearChange(Number(e.target.value))}
                className="input-premium"
                style={{ padding: '0.2rem 0.6rem', fontSize: '12px', background: 'transparent', border: 'none', color: '#fff', fontWeight: 800, cursor: 'pointer' }}
              >
                {availableYears.map((yr) => (
                  <option key={yr} value={yr} style={{ background: '#111', color: '#fff' }}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Cards de Resumo KPIs com Card de Média de Entregas por Dia */}
      {summaryCards && viewMode === "year" && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem' }}>
          <div className="card-premium" style={{ padding: '1rem 1.2rem', borderTop: '3px solid var(--primary)', background: 'rgba(0, 242, 255, 0.03)' }}>
            <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 900, textTransform: 'uppercase', margin: 0 }}>Total Acumulado ({selectedYear})</p>
            <p style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--primary)', margin: '4px 0 0 0' }}>{formatValue(summaryCards.totalYear)}</p>
          </div>

          {/* Card Especial: Média de Entregas/Vendas por Dia */}
          <div className="card-premium" style={{ padding: '1rem 1.2rem', borderTop: '3px solid #a855f7', background: 'rgba(168, 85, 247, 0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
              <p style={{ fontSize: '10px', color: '#a855f7', fontWeight: 900, textTransform: 'uppercase', margin: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Calendar size={12} /> MÉDIA POR DIA
              </p>
              <span style={{ fontSize: '9px', fontWeight: 800, background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7', padding: '1px 6px', borderRadius: '4px' }}>
                ENTREGAS/DIA
              </span>
            </div>
            <p style={{ fontSize: '1.5rem', fontWeight: 900, color: '#a855f7', margin: '4px 0 0 0' }}>
              {calculatedAvgDailyCount.toFixed(1)} <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>/ dia</span>
            </p>
            <p style={{ fontSize: '9px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
              Média de comandas por dia em {selectedYear}
            </p>
          </div>

          <div className="card-premium" style={{ padding: '1rem 1.2rem', borderTop: '3px solid var(--accent)', background: 'rgba(57, 255, 20, 0.03)' }}>
            <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 900, textTransform: 'uppercase', margin: 0 }}>Média Mensal</p>
            <p style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--accent)', margin: '4px 0 0 0' }}>{formatValue(summaryCards.avgMonthly)}</p>
          </div>

          <div className="card-premium" style={{ padding: '1rem 1.2rem', borderTop: '3px solid var(--warning)', background: 'rgba(255, 149, 0, 0.03)' }}>
            <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 900, textTransform: 'uppercase', margin: 0 }}>Melhor Mês do Ano</p>
            <p style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--warning)', margin: '4px 0 0 0' }}>{summaryCards.bestMonth}</p>
          </div>

          {summaryCards.secondaryTotal !== undefined && (
            <div className="card-premium" style={{ padding: '1rem 1.2rem', borderTop: '3px solid var(--success)', background: 'rgba(52, 199, 89, 0.03)' }}>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 900, textTransform: 'uppercase', margin: 0 }}>Pagamentos Recebidos</p>
              <p style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--success)', margin: '4px 0 0 0' }}>{formatValue(summaryCards.secondaryTotal)}</p>
            </div>
          )}
        </div>
      )}


      {/* Legenda e Seleção de Séries de Linha */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem', fontSize: '12px', fontWeight: 700 }}>
          <button
            onClick={() => setActiveSeries(activeSeries === "metric1" ? "all" : "metric1")}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', cursor: 'pointer', color: activeSeries === "all" || activeSeries === "metric1" ? '#fff' : 'var(--text-muted)', opacity: activeSeries === "all" || activeSeries === "metric1" ? 1 : 0.4 }}
          >
            <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--primary)', boxShadow: '0 0 8px var(--primary)' }} />
            {metric1Label}
          </button>

          {hasMetric2 && (
            <button
              onClick={() => setActiveSeries(activeSeries === "metric2" ? "all" : "metric2")}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', cursor: 'pointer', color: activeSeries === "all" || activeSeries === "metric2" ? '#fff' : 'var(--text-muted)', opacity: activeSeries === "all" || activeSeries === "metric2" ? 1 : 0.4 }}
            >
              <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 8px var(--success)' }} />
              {metric2Label}
            </button>
          )}
        </div>

        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {viewMode === "year" ? `Exibindo os 12 meses de ${selectedYear}` : `Evolução Histórica (${activeData.length} períodos registrados)`}
        </span>
      </div>

      {/* Gráfico SVG de Linhas */}
      <div style={{ position: 'relative', width: '100%', overflowX: 'auto', background: 'rgba(0,0,0,0.2)', borderRadius: '16px', padding: '1rem 0', border: '1px solid rgba(255,255,255,0.04)' }}>
        {activeData.length === 0 ? (
          <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Nenhum dado registrado para o período selecionado.
          </div>
        ) : (
          <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
            <defs>
              {/* Gradiente Métria 1 */}
              <linearGradient id="gradMetric1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.35" />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0" />
              </linearGradient>

              {/* Gradiente Métrica 2 */}
              <linearGradient id="gradMetric2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--success)" stopOpacity="0.35" />
                <stop offset="100%" stopColor="var(--success)" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Linhas de Grade Horizontais (Y-Axis Grid) */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
              const y = padding.top + graphHeight * (1 - pct);
              const val = maxVal * pct;
              return (
                <g key={idx}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={width - padding.right}
                    y2={y}
                    stroke="rgba(255, 255, 255, 0.05)"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={padding.left - 10}
                    y={y + 4}
                    fill="rgba(255, 255, 255, 0.4)"
                    fontSize="10"
                    textAnchor="end"
                    fontWeight="600"
                  >
                    {isCurrency ? (val >= 1000 ? `${(val / 1000).toFixed(1)}k` : Math.round(val)) : Math.round(val)}
                  </text>
                </g>
              );
            })}

            {/* Rótulos do Eixo X (Meses/Períodos) */}
            {activeData.map((d, i) => {
              const stepX = activeData.length > 1 ? graphWidth / (activeData.length - 1) : graphWidth;
              const x = padding.left + (activeData.length === 1 ? graphWidth / 2 : i * stepX);
              return (
                <text
                  key={i}
                  x={x}
                  y={height - 12}
                  fill="rgba(255, 255, 255, 0.6)"
                  fontSize="11"
                  fontWeight="700"
                  textAnchor="middle"
                >
                  {d.label}
                </text>
              );
            })}

            {/* Preenchimento de Área Métrica 1 */}
            {(activeSeries === "all" || activeSeries === "metric1") && area1 && (
              <path d={area1} fill="url(#gradMetric1)" />
            )}

            {/* Preenchimento de Área Métrica 2 */}
            {(activeSeries === "all" || activeSeries === "metric2") && hasMetric2 && area2 && (
              <path d={area2} fill="url(#gradMetric2)" />
            )}

            {/* Linha da Métrica 2 (Pagamentos) */}
            {(activeSeries === "all" || activeSeries === "metric2") && hasMetric2 && path2 && (
              <path
                d={path2}
                fill="none"
                stroke="var(--success)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Linha da Métrica 1 (Vendas) */}
            {(activeSeries === "all" || activeSeries === "metric1") && path1 && (
              <path
                d={path1}
                fill="none"
                stroke="var(--primary)"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Pontos Interativos Métrica 2 */}
            {(activeSeries === "all" || activeSeries === "metric2") && hasMetric2 && points.p2.map((p, i) => (
              <g key={`p2-${i}`}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="5"
                  fill="#000"
                  stroke="var(--success)"
                  strokeWidth="2.5"
                  style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
                  onMouseEnter={() => setHoveredPoint({ idx: i, item: p.item, x: p.x, y: p.y })}
                  onMouseLeave={() => setHoveredPoint(null)}
                />
              </g>
            ))}

            {/* Pontos Interativos Métrica 1 */}
            {(activeSeries === "all" || activeSeries === "metric1") && points.p1.map((p, i) => (
              <g key={`p1-${i}`}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="6"
                  fill="var(--primary)"
                  stroke="#fff"
                  strokeWidth="2"
                  style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
                  onMouseEnter={() => setHoveredPoint({ idx: i, item: p.item, x: p.x, y: p.y })}
                  onMouseLeave={() => setHoveredPoint(null)}
                />
              </g>
            ))}

            {/* Linha vertical Guia ao passar o mouse */}
            {hoveredPoint && (
              <line
                x1={hoveredPoint.x}
                y1={padding.top}
                x2={hoveredPoint.x}
                y2={padding.top + graphHeight}
                stroke="rgba(255, 255, 255, 0.3)"
                strokeDasharray="3 3"
              />
            )}
          </svg>
        )}

        {/* Tooltip Hover Overlay */}
        {hoveredPoint && (
          <div
            style={{
              position: 'absolute',
              top: '15px',
              right: '20px',
              background: 'rgba(15, 15, 30, 0.95)',
              border: '1px solid var(--primary)',
              borderRadius: '12px',
              padding: '0.8rem 1.2rem',
              boxShadow: '0 8px 30px rgba(0, 242, 255, 0.25)',
              backdropFilter: 'blur(8px)',
              pointerEvents: 'none',
              zIndex: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}
          >
            <p style={{ fontSize: '12px', fontWeight: 900, color: '#fff', margin: 0, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px' }}>
              {hoveredPoint.item.fullLabel || hoveredPoint.item.label}
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '11px' }}>
              <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{metric1Label}:</span>
              <strong style={{ color: '#fff' }}>{formatValue(hoveredPoint.item.val1)}</strong>
            </div>
            {hoveredPoint.item.val2 !== undefined && (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '11px' }}>
                <span style={{ color: 'var(--success)', fontWeight: 700 }}>{metric2Label}:</span>
                <strong style={{ color: '#fff' }}>{formatValue(hoveredPoint.item.val2)}</strong>
              </div>
            )}
            {hoveredPoint.item.val3 !== undefined && (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '11px', borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '4px', marginTop: '2px' }}>
                <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{metric3Label}:</span>
                <strong style={{ color: hoveredPoint.item.val3 >= 0 ? 'var(--warning)' : 'var(--danger)' }}>
                  {formatValue(hoveredPoint.item.val3)}
                </strong>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
