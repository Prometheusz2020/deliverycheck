"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { 
  Users, DollarSign, Plus, Trash2, Calendar, Search, 
  FileText, CheckCircle, UserPlus, Loader2, Phone, 
  MapPin, Clock, X, Info, AlertTriangle, ArrowRight, CornerDownRight, Printer
} from "lucide-react";
import { 
  getCustomers, addCustomer, editCustomer, deleteCustomer, 
  addCreditSale, getCustomerDetails, deleteCreditSale, 
  addPayment, deletePayment, getRecentCreditSales
} from "@/lib/credit-actions";

type CustomerType = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  bestPaymentDay: number | null;
  creditLimit: number;
  totalSales: number;
  totalPayments: number;
  balance: number;
  createdAt: Date;
};

type CreditSaleItemType = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

type CreditSaleType = {
  id: string;
  date: Date;
  totalAmount: number;
  status: string;
  notes: string | null;
  gplusId: string | null;
  items: CreditSaleItemType[];
};

type PaymentType = {
  id: string;
  date: Date;
  amount: number;
  paymentMethod: string;
  notes: string | null;
};

type CustomerDetailsType = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  bestPaymentDay: number | null;
  creditLimit: number;
  totalSales: number;
  totalPayments: number;
  balance: number;
  sales: CreditSaleType[];
  payments: PaymentType[];
};

export default function CreditSalesDashboard() {
  const [activeTab, setActiveTab] = useState<'customers' | 'new-sale' | 'new-payment'>('customers');
  const [customers, setCustomers] = useState<CustomerType[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  
  // Detalhes do cliente selecionado
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerDetails, setCustomerDetails] = useState<CustomerDetailsType | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Cadastro/Edição de Clientes
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerType | null>(null);
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [custAddress, setCustAddress] = useState("");
  const [custBestDay, setCustBestDay] = useState("");
  const [custLimit, setCustLimit] = useState("");
  const [formError, setFormError] = useState("");
  const [isSubmittingCustomer, setIsSubmittingCustomer] = useState(false);

  // Nova Venda a Prazo
  const [saleCustomerId, setSaleCustomerId] = useState("");
  const [saleDate, setSaleDate] = useState(new Date().toLocaleDateString('sv-SE'));
  const [saleNotes, setSaleNotes] = useState("");
  const [itemsList, setItemsList] = useState<{ description: string; quantity: number; unitPrice: number }[]>([]);
  const [itemDesc, setItemDesc] = useState("");
  const [itemQty, setItemQty] = useState("1");
  const [itemPrice, setItemPrice] = useState("");
  const [isSubmittingSale, setIsSubmittingSale] = useState(false);

  // Registrar Pagamento
  const [payCustomerId, setPayCustomerId] = useState("");
  const [payDate, setPayDate] = useState(new Date().toLocaleDateString('sv-SE'));
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("DINHEIRO");
  const [payNotes, setPayNotes] = useState("");
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [recentSales, setRecentSales] = useState<any[]>([]);

  // Estado para Modal de Impressão Elgin i9 (40 colunas)
  const [printModal, setPrintModal] = useState<{
    title: string;
    lines: string[];
  } | null>(null);

  // Auxiliares para formatação de 40 colunas em impressora térmica (Elgin i9)
  const format40Line = (left: string = "", right: string = "", width: number = 40): string => {
    const maxLeftLen = width - right.length - 1;
    const leftClean = left.length > maxLeftLen ? left.substring(0, maxLeftLen) : left;
    const spaces = Math.max(1, width - leftClean.length - right.length);
    return leftClean + " ".repeat(spaces) + right;
  };

  const padCenter = (text: string, width: number = 40): string => {
    const clean = text.substring(0, width);
    const leftPadding = Math.max(0, Math.floor((width - clean.length) / 2));
    return " ".repeat(leftPadding) + clean;
  };

  // 1. Relatório Geral da Carteira de Fiados (Todos os Devedores)
  const handlePrintGeneralReport = () => {
    const nowStr = new Date().toLocaleString('pt-BR');
    const totalDebt = customers.reduce((acc, c) => acc + c.balance, 0);
    const debtors = customers.filter(c => c.balance > 0);

    const lines: string[] = [
      "========================================",
      padCenter("DELIVERY CHECK / GPLUS"),
      padCenter("RELATORIO GERAL DE DEVEDORES"),
      `Data/Hora: ${nowStr}`,
      "========================================",
      format40Line("CLIENTE", "SALDO DEVEDOR"),
      "----------------------------------------"
    ];

    if (debtors.length === 0) {
      lines.push(padCenter("NENHUM CLIENTE EM DEBITO"));
    } else {
      debtors.forEach(c => {
        lines.push(format40Line(c.name.toUpperCase(), `R$ ${c.balance.toFixed(2)}`));
        if (c.phone) lines.push(`  Tel: ${c.phone}`);
      });
    }

    lines.push("----------------------------------------");
    lines.push(format40Line(`TOTAL DEVEDORES: ${debtors.length}`, ""));
    lines.push(format40Line("TOTAL DA CARTEIRA:", `R$ ${totalDebt.toFixed(2)}`));
    lines.push("========================================");
    lines.push(padCenter("IMPRESSORA ELGIN I9 (40 COL)"));
    lines.push("\n\n\n");

    setPrintModal({
      title: "Relatório Geral de Devedores (Carteira Fiado)",
      lines
    });
  };

  // 2. Extrato Completo do Cliente Selecionado
  const handlePrintCustomerLedger = () => {
    if (!customerDetails) return;
    const nowStr = new Date().toLocaleString('pt-BR');

    const lines: string[] = [
      "========================================",
      padCenter("DELIVERY CHECK / GPLUS"),
      padCenter("EXTRATO DE CONTA FIADO"),
      `Data/Hora: ${nowStr}`,
      "========================================",
      `CLIENTE: ${customerDetails.name.toUpperCase()}`,
    ];

    if (customerDetails.phone) lines.push(`TEL: ${customerDetails.phone}`);
    if (customerDetails.address) lines.push(`END: ${customerDetails.address}`);
    if (customerDetails.bestPaymentDay) lines.push(`MELHOR DIA PGTO: DIA ${customerDetails.bestPaymentDay}`);

    lines.push("----------------------------------------");
    lines.push("HISTORICO DE COMPRAS (FIADO):");
    if (processedData.allocatedSales.length === 0) {
      lines.push("  (Nenhuma compra registrada)");
    } else {
      processedData.allocatedSales.forEach(s => {
        const dateStr = formatDate(s.date);
        lines.push(format40Line(`${dateStr} Comanda`, `R$ ${s.totalAmount.toFixed(2)}`));
        s.items.forEach(item => {
          lines.push(`  ${item.quantity}x ${item.description.substring(0, 22)}`);
        });
      });
    }

    lines.push("----------------------------------------");
    lines.push("HISTORICO DE PAGAMENTOS:");
    if (customerDetails.payments.length === 0) {
      lines.push("  (Nenhum pagamento efetuado)");
    } else {
      customerDetails.payments.forEach(p => {
        const dateStr = formatDate(p.date);
        lines.push(format40Line(`${dateStr} (${p.paymentMethod})`, `R$ ${p.amount.toFixed(2)}`));
      });
    }

    lines.push("----------------------------------------");
    lines.push(format40Line("TOTAL COMPRAS:", `R$ ${customerDetails.totalSales.toFixed(2)}`));
    lines.push(format40Line("TOTAL PAGOS:", `R$ ${customerDetails.totalPayments.toFixed(2)}`));
    lines.push("========================================");
    lines.push(format40Line("SALDO DEVEDOR ATUAL:", `R$ ${customerDetails.balance.toFixed(2)}`));
    lines.push("========================================");
    lines.push("\nAssinatura do Cliente:\n\n");
    lines.push("________________________________________");
    lines.push(padCenter(customerDetails.name.toUpperCase()));
    lines.push("\n\n\n");

    setPrintModal({
      title: `Extrato de Fiado - ${customerDetails.name}`,
      lines
    });
  };

  // 3. Comprovante de Venda Fiado (Comanda Específica)
  const handlePrintSaleTicket = (sale: CreditSaleType) => {
    const custName = customerDetails?.name || "CLIENTE";
    const dateStr = formatDate(sale.date);

    const lines: string[] = [
      "========================================",
      padCenter("DELIVERY CHECK / GPLUS"),
      padCenter("COMPROVANTE DE VENDA FIADO"),
      `Data: ${dateStr}`,
      "========================================",
      `CLIENTE: ${custName.toUpperCase()}`,
      sale.gplusId ? `REF GPLUS: #${sale.gplusId}` : "",
      "----------------------------------------",
      format40Line("QTD ITEM", "TOTAL (R$)"),
      "----------------------------------------"
    ].filter(Boolean);

    sale.items.forEach(item => {
      lines.push(format40Line(`${item.quantity}x ${item.description}`, `R$ ${item.totalPrice.toFixed(2)}`));
    });

    lines.push("----------------------------------------");
    lines.push(format40Line("VALOR TOTAL:", `R$ ${sale.totalAmount.toFixed(2)}`));
    lines.push("----------------------------------------");
    lines.push("Reconheco e pagarei a divida acima.");
    lines.push("\nAssinatura do Cliente:\n\n");
    lines.push("________________________________________");
    lines.push(padCenter(custName.toUpperCase()));
    lines.push("\n\n\n");

    setPrintModal({
      title: `Comprovante de Venda - ${custName}`,
      lines
    });
  };

  // 4. Recibo de Pagamento (Amortização)
  const handlePrintPaymentTicket = (payment: PaymentType) => {
    const custName = customerDetails?.name || "CLIENTE";
    const dateStr = formatDate(payment.date);

    const lines: string[] = [
      "========================================",
      padCenter("DELIVERY CHECK / GPLUS"),
      padCenter("RECIBO DE PAGAMENTO FIADO"),
      `Data: ${dateStr}`,
      "========================================",
      `CLIENTE: ${custName.toUpperCase()}`,
      `FORMA PGTO: ${payment.paymentMethod}`,
      "----------------------------------------",
      format40Line("VALOR RECEBIDO:", `R$ ${payment.amount.toFixed(2)}`),
      "----------------------------------------",
      format40Line("SALDO RESTANTE:", `R$ ${customerDetails?.balance.toFixed(2) || "0.00"}`),
      "========================================",
      "\nRecebido por:\n\n",
      "________________________________________",
      padCenter("ESTABELECIMENTO"),
      "\n\n\n"
    ];

    setPrintModal({
      title: `Recibo de Pagamento - ${custName}`,
      lines
    });
  };

  // Função para disparar a impressão limpa na Elgin i9 via Iframe Isolado (80mm / 40 colunas)
  const executeThermalPrint = (lines: string[]) => {
    const textContent = lines.join("\n");

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Cupom Elgin i9</title>
            <style>
              @page {
                size: 80mm auto;
                margin: 0mm !important;
              }
              html, body {
                width: 72mm !important;
                max-width: 72mm !important;
                margin: 0 !important;
                padding: 1mm 0 0 0 !important;
                background: #ffffff !important;
                color: #000000 !important;
                font-family: 'Courier New', Courier, monospace !important;
                font-size: 11px !important;
                line-height: 1.25 !important;
                white-space: pre-wrap !important;
                word-break: break-all !important;
              }
            </style>
          </head>
          <body>${textContent}</body>
        </html>
      `);
      doc.close();

      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 1500);
      }, 300);
    }
  };

  // Carregar as vendas recentes across todos os clientes
  const fetchRecentSales = useCallback(async () => {
    try {
      const data = await getRecentCreditSales();
      setRecentSales(data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  // Processamento FIFO de alocação de pagamentos e agrupamento mensal
  const processedData = useMemo(() => {
    if (!customerDetails) return { allocatedSales: [], monthlyBreakdown: [] };

    // 1. Clonar e ordenar as vendas em ordem cronológica (mais antiga para mais nova)
    const salesSortedAsc = [...customerDetails.sales]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(s => ({
        ...s,
        paidAmount: 0,
        remainingAmount: s.totalAmount,
        allocationStatus: 'PENDENTE' as 'PENDENTE' | 'PARCIAL' | 'PAGO'
      }));

    // 2. Clonar e ordenar os pagamentos em ordem cronológica (mais antigo para mais novo)
    const paymentsSortedAsc = [...customerDetails.payments]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(p => ({
        ...p,
        unusedAmount: p.amount
      }));

    // 3. Executar alocação FIFO
    let paymentIdx = 0;
    for (let sale of salesSortedAsc) {
      while (sale.remainingAmount > 0 && paymentIdx < paymentsSortedAsc.length) {
        const payment = paymentsSortedAsc[paymentIdx];
        if (payment.unusedAmount <= 0) {
          paymentIdx++;
          continue;
        }

        if (payment.unusedAmount >= sale.remainingAmount) {
          // O pagamento cobre totalmente o valor restante da comanda
          payment.unusedAmount -= sale.remainingAmount;
          sale.paidAmount += sale.remainingAmount;
          sale.remainingAmount = 0;
          sale.allocationStatus = 'PAGO';
        } else {
          // O pagamento cobre apenas parte da comanda e é totalmente consumido
          sale.remainingAmount -= payment.unusedAmount;
          sale.paidAmount += payment.unusedAmount;
          payment.unusedAmount = 0;
          sale.allocationStatus = 'PARCIAL';
          paymentIdx++;
        }
      }
    }

    // 4. Re-ordenar as vendas de volta para a exibição na UI (data decrescente)
    const allocatedSales = [...salesSortedAsc].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // 5. Agrupamento mensal do saldo devedor
    const monthlyGroups = {} as { [key: string]: { monthName: string; total: number; remaining: number } };

    for (const sale of salesSortedAsc) {
      const dateObj = new Date(sale.date);
      // Ex: "Junho de 2026"
      const monthLabel = dateObj.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      const key = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyGroups[key]) {
        monthlyGroups[key] = {
          monthName: monthLabel,
          total: 0,
          remaining: 0
        };
      }
      monthlyGroups[key].total += sale.totalAmount;
      monthlyGroups[key].remaining += sale.remainingAmount;
    }

    // Ordenar os meses cronologicamente para exibição
    const monthlyBreakdown = Object.keys(monthlyGroups)
      .sort((a, b) => a.localeCompare(b))
      .map(key => monthlyGroups[key]);

    return { allocatedSales, monthlyBreakdown };
  }, [customerDetails]);

  // Carregar lista de clientes
  const fetchCustomers = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getCustomers();
      setCustomers(data as any);
      fetchRecentSales();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [fetchRecentSales]);

  // Carregar detalhes de um cliente
  const fetchDetails = useCallback(async (id: string) => {
    setIsLoadingDetails(true);
    try {
      const data = await getCustomerDetails(id);
      setCustomerDetails(data as any);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingDetails(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
    fetchRecentSales();
  }, [fetchCustomers, fetchRecentSales]);

  useEffect(() => {
    if (selectedCustomerId) {
      fetchDetails(selectedCustomerId);
    } else {
      setCustomerDetails(null);
    }
  }, [selectedCustomerId, fetchDetails]);

  // Handler para cadastrar/editar cliente
  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim()) {
      setFormError("O nome do cliente é obrigatório.");
      return;
    }
    setFormError("");
    setIsSubmittingCustomer(true);
    
    try {
      const bestDayNum = custBestDay ? parseInt(custBestDay) : undefined;
      const limitNum = custLimit ? parseFloat(custLimit) : 0;
      
      let res;
      if (editingCustomer) {
        res = await editCustomer(
          editingCustomer.id, 
          custName, 
          custPhone || undefined, 
          custAddress || undefined, 
          bestDayNum, 
          limitNum
        );
      } else {
        res = await addCustomer(
          custName, 
          custPhone || undefined, 
          custAddress || undefined, 
          bestDayNum, 
          limitNum
        );
      }

      if (res.success) {
        setCustName("");
        setCustPhone("");
        setCustAddress("");
        setCustBestDay("");
        setCustLimit("");
        setEditingCustomer(null);
        setShowCustomerForm(false);
        fetchCustomers();
        if (selectedCustomerId && editingCustomer && selectedCustomerId === editingCustomer.id) {
          fetchDetails(selectedCustomerId);
        }
      } else {
        setFormError(res.error || "Erro ao salvar cliente.");
      }
    } catch (err) {
      setFormError("Erro de comunicação com o servidor.");
    } finally {
      setIsSubmittingCustomer(false);
    }
  };

  const startEditCustomer = (c: CustomerType) => {
    setEditingCustomer(c);
    setCustName(c.name);
    setCustPhone(c.phone || "");
    setCustAddress(c.address || "");
    setCustBestDay(c.bestPaymentDay ? String(c.bestPaymentDay) : "");
    setCustLimit(c.creditLimit ? String(c.creditLimit) : "");
    setFormError("");
    setShowCustomerForm(true);
  };

  const handleDeleteCustomer = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este cliente? Todas as suas compras e pagamentos serão apagados permanentemente!")) {
      return;
    }
    try {
      const res = await deleteCustomer(id);
      if (res.success) {
        if (selectedCustomerId === id) {
          setSelectedCustomerId(null);
        }
        fetchCustomers();
      } else {
        alert(res.error || "Erro ao excluir cliente.");
      }
    } catch (err) {
      alert("Erro ao conectar com o servidor.");
    }
  };

  // Itens da venda
  const addItemToSale = () => {
    if (!itemDesc.trim()) return;
    const qty = parseFloat(itemQty) || 1;
    const price = parseFloat(itemPrice) || 0;
    if (price <= 0) {
      alert("Informe um preço unitário maior que zero.");
      return;
    }
    setItemsList(prev => [...prev, { description: itemDesc.trim(), quantity: qty, unitPrice: price }]);
    setItemDesc("");
    setItemQty("1");
    setItemPrice("");
  };

  const removeItemFromSale = (index: number) => {
    setItemsList(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreateSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleCustomerId) {
      alert("Selecione um cliente.");
      return;
    }
    if (itemsList.length === 0) {
      alert("Adicione pelo menos um item ao pedido.");
      return;
    }
    
    setIsSubmittingSale(true);
    try {
      const res = await addCreditSale(saleCustomerId, saleDate, itemsList, saleNotes);
      if (res.success) {
        alert("Venda a prazo registrada com sucesso!");
        // Limpar
        setSaleCustomerId("");
        setSaleNotes("");
        setItemsList([]);
        fetchCustomers();
        fetchRecentSales();
        // Redireciona e seleciona
        setSelectedCustomerId(saleCustomerId);
        setActiveTab('customers');
      } else {
        alert(res.error || "Erro ao salvar venda.");
      }
    } catch (err) {
      alert("Erro de conexão.");
    } finally {
      setIsSubmittingSale(false);
    }
  };

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payCustomerId) {
      alert("Selecione um cliente.");
      return;
    }
    const val = parseFloat(payAmount) || 0;
    if (val <= 0) {
      alert("Informe um valor de pagamento maior que zero.");
      return;
    }

    setIsSubmittingPayment(true);
    try {
      const res = await addPayment(payCustomerId, payDate, val, payMethod, payNotes);
      if (res.success) {
        alert("Pagamento registrado com sucesso!");
        // Limpar
        setPayCustomerId("");
        setPayAmount("");
        setPayNotes("");
        fetchCustomers();
        // Redireciona e seleciona
        setSelectedCustomerId(payCustomerId);
        setActiveTab('customers');
      } else {
        alert(res.error || "Erro ao salvar pagamento.");
      }
    } catch (err) {
      alert("Erro de conexão.");
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handleDeleteSale = async (saleId: string) => {
    if (!confirm("Deseja realmente excluir (retirar) esta comanda? O saldo devedor do cliente será recalculado.")) {
      return;
    }
    try {
      const res = await deleteCreditSale(saleId);
      if (res.success) {
        fetchCustomers();
        fetchRecentSales();
        if (selectedCustomerId) fetchDetails(selectedCustomerId);
      } else {
        alert(res.error || "Erro ao excluir venda.");
      }
    } catch (err) {
      alert("Erro de conexão.");
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm("Deseja realmente excluir este pagamento? A dívida do cliente irá aumentar.")) {
      return;
    }
    try {
      const res = await deletePayment(paymentId);
      if (res.success) {
        fetchCustomers();
        if (selectedCustomerId) fetchDetails(selectedCustomerId);
      } else {
        alert(res.error || "Erro ao excluir pagamento.");
      }
    } catch (err) {
      alert("Erro de conexão.");
    }
  };

  // Filtrar clientes da busca
  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.phone && c.phone.includes(searchTerm))
  );

  // Formatar data local
  const formatDate = (dateInput: Date | string) => {
    const d = new Date(dateInput);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Menu Interno de Controle Fiado */}
      <div className="card-premium" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', padding: '0.3rem', borderRadius: '10px', gap: '4px' }}>
          <button 
            onClick={() => setActiveTab('customers')} 
            className={activeTab === 'customers' ? 'btn-main' : 'btn-outline'} 
            style={{ padding: '0.5rem 1.2rem', fontSize: '11px', borderRadius: '6px', border: 'none', height: '34px' }}
          >
            <Users size={14} /> Clientes e Extrato
          </button>
          <button 
            onClick={() => {
              setActiveTab('new-sale');
              if (selectedCustomerId) setSaleCustomerId(selectedCustomerId);
            }} 
            className={activeTab === 'new-sale' ? 'btn-main' : 'btn-outline'} 
            style={{ padding: '0.5rem 1.2rem', fontSize: '11px', borderRadius: '6px', border: 'none', marginLeft: '0.2rem', height: '34px' }}
          >
            <Plus size={14} /> Lançar Venda FIADO
          </button>
          <button 
            onClick={() => {
              setActiveTab('new-payment');
              if (selectedCustomerId) setPayCustomerId(selectedCustomerId);
            }} 
            className={activeTab === 'new-payment' ? 'btn-main' : 'btn-outline'} 
            style={{ padding: '0.5rem 1.2rem', fontSize: '11px', borderRadius: '6px', border: 'none', marginLeft: '0.2rem', height: '34px' }}
          >
            <DollarSign size={14} /> Receber Pagamento
          </button>
        </div>

        {activeTab === 'customers' && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button 
              onClick={handlePrintGeneralReport}
              className="btn-outline" 
              style={{ padding: '0.5rem 1rem', fontSize: '11px', borderRadius: '10px', height: '38px', gap: '6px', display: 'flex', alignItems: 'center' }}
              title="Imprimir Relatório de Todos os Devedores (Elgin i9 40 Colunas)"
            >
              <Printer size={14} /> Relatório Geral (40 col)
            </button>
            <button 
              onClick={() => {
                setEditingCustomer(null);
                setCustName("");
                setCustPhone("");
                setCustAddress("");
                setCustBestDay("");
                setCustLimit("");
                setFormError("");
                setShowCustomerForm(true);
              }} 
              className="btn-main" 
              style={{ padding: '0.5rem 1.2rem', fontSize: '11px', borderRadius: '10px', height: '38px' }}
            >
              <UserPlus size={14} /> Novo Cliente
            </button>
          </div>
        )}
      </div>

      {/* 1. ABA DE CLIENTES E EXTRATO (MASTER-DETAIL) */}
      {activeTab === 'customers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* ÚLTIMOS LANÇAMENTOS FIADO */}
          {recentSales.length > 0 && (
            <div className="card-premium" style={{ padding: '1.2rem' }}>
              <h3 style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 900, textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.05em' }}>
                Últimos Pedidos Fiados Feitos
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
                {recentSales.map((sale) => (
                  <div 
                    key={sale.id} 
                    onClick={() => {
                      setSelectedCustomerId(sale.customerId);
                    }}
                    style={{ 
                      background: 'rgba(255,255,255,0.01)', 
                      border: '1px solid rgba(255,255,255,0.04)', 
                      padding: '10px 12px', 
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      borderLeft: '3px solid var(--primary)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                      e.currentTarget.style.borderColor = 'var(--primary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.01)';
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)';
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '110px' }} title={sale.customerName}>
                        {sale.customerName}
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--danger)' }}>
                        R$ {sale.totalAmount.toFixed(2)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-muted)' }}>
                      <span>Comanda #{sale.orderNumber}</span>
                      <span>{new Date(sale.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '2rem' }}>
          
          {/* PAINEL DA ESQUERDA: LISTA DE CLIENTES */}
          <div style={{ gridColumn: 'span 5', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="card-premium" style={{ height: 'fit-content', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Search size={18} style={{ color: 'var(--primary)' }} />
                <input 
                  type="text"
                  placeholder="Buscar cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input-premium"
                  style={{ padding: '0.5rem 0.8rem', fontSize: '13px' }}
                />
              </div>

              {showCustomerForm && (
                <div style={{ border: '1px solid rgba(255, 242, 0, 0.1)', padding: '1rem', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', position: 'relative' }}>
                  <button 
                    onClick={() => setShowCustomerForm(false)} 
                    style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    <X size={16} />
                  </button>
                  <h4 style={{ fontSize: '13px', color: 'var(--primary)', marginBottom: '0.8rem' }}>
                    {editingCustomer ? "Editar Cadastro" : "Novo Cliente"}
                  </h4>
                  <form onSubmit={handleSaveCustomer} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Nome Completo *</label>
                      <input 
                        type="text" 
                        value={custName} 
                        onChange={(e) => setCustName(e.target.value)} 
                        className="input-premium" 
                        placeholder="Nome do cliente" 
                        style={{ padding: '0.4rem', fontSize: '12px' }} 
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Telefone</label>
                        <input 
                          type="text" 
                          value={custPhone} 
                          onChange={(e) => setCustPhone(e.target.value)} 
                          className="input-premium" 
                          placeholder="(00) 99999-9999" 
                          style={{ padding: '0.4rem', fontSize: '12px' }} 
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Melhor Dia Pgto</label>
                        <input 
                          type="number" 
                          min="1" 
                          max="31"
                          value={custBestDay} 
                          onChange={(e) => setCustBestDay(e.target.value)} 
                          className="input-premium" 
                          placeholder="Ex: 10" 
                          style={{ padding: '0.4rem', fontSize: '12px' }} 
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Endereço</label>
                      <input 
                        type="text" 
                        value={custAddress} 
                        onChange={(e) => setCustAddress(e.target.value)} 
                        className="input-premium" 
                        placeholder="Rua, Número, Bairro" 
                        style={{ padding: '0.4rem', fontSize: '12px' }} 
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Limite de Crédito (0 = Ilimitado)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={custLimit} 
                        onChange={(e) => setCustLimit(e.target.value)} 
                        className="input-premium" 
                        placeholder="R$ 0,00" 
                        style={{ padding: '0.4rem', fontSize: '12px' }} 
                      />
                    </div>
                    {formError && <p style={{ color: 'var(--danger)', fontSize: '11px', marginTop: '4px' }}>{formError}</p>}
                    <button 
                      type="submit" 
                      disabled={isSubmittingCustomer} 
                      className="btn-main" 
                      style={{ padding: '0.5rem', fontSize: '11px', marginTop: '4px', width: '100%', height: '34px' }}
                    >
                      {isSubmittingCustomer ? "Processando..." : editingCustomer ? "Salvar Edição" : "Gravar Cliente"}
                    </button>
                  </form>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '550px', overflowY: 'auto', paddingRight: '4px' }}>
                {isLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                    <Loader2 className="spin" size={24} style={{ color: 'var(--primary)' }} />
                  </div>
                ) : filteredCustomers.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', padding: '1rem' }}>
                    Nenhum cliente encontrado.
                  </p>
                ) : (
                  filteredCustomers.map(customer => {
                    const isSelected = selectedCustomerId === customer.id;
                    const hasDebt = customer.balance > 0;
                    return (
                      <div 
                        key={customer.id}
                        onClick={() => setSelectedCustomerId(customer.id)}
                        style={{
                          background: isSelected ? 'rgba(0, 242, 255, 0.08)' : 'rgba(255,255,255,0.02)',
                          border: isSelected ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.05)',
                          padding: '1rem',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          transition: 'all 0.2s',
                          position: 'relative'
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '70%' }}>
                          <h4 style={{ fontSize: '14px', fontStyle: 'normal', textTransform: 'none', color: isSelected ? '#fff' : 'var(--text-secondary)' }}>
                            {customer.name}
                          </h4>
                          {customer.phone && (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Phone size={10} /> {customer.phone}
                            </span>
                          )}
                          {customer.bestPaymentDay && (
                            <span style={{ fontSize: '10px', color: 'var(--warning)', fontWeight: 800 }}>
                              Melhor dia pgto: Dia {customer.bestPaymentDay}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                          <span style={{ 
                            fontSize: '13px', 
                            fontWeight: 800, 
                            color: hasDebt ? 'var(--danger)' : 'var(--success)' 
                          }}>
                            R$ {customer.balance.toFixed(2)}
                          </span>
                          <div style={{ display: 'flex', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
                            <button 
                              onClick={() => startEditCustomer(customer)}
                              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                              title="Editar"
                            >
                              <Info size={12} style={{ color: 'var(--primary)' }} />
                            </button>
                            <button 
                              onClick={() => handleDeleteCustomer(customer.id)}
                              style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '2px' }}
                              title="Excluir"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* PAINEL DA DIREITA: LEDGER / EXTRATO DO CLIENTE */}
          <div style={{ gridColumn: 'span 7' }}>
            <div className="card-premium" style={{ minHeight: '400px', display: 'flex', flexDirection: 'column' }}>
              {!selectedCustomerId ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', color: 'var(--text-muted)', textAlign: 'center', padding: '3rem' }}>
                  <Users size={48} style={{ opacity: 0.2 }} />
                  <p style={{ fontSize: '13px' }}>Selecione um cliente na lista ao lado para ver o histórico completo de fiados e pagamentos.</p>
                </div>
              ) : isLoadingDetails ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Loader2 className="spin" size={36} style={{ color: 'var(--primary)' }} />
                </div>
              ) : !customerDetails ? (
                <p>Falha ao carregar dados do cliente.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  {/* Ficha básica */}
                  <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                      <h2 style={{ fontSize: '1.8rem', color: '#fff', fontStyle: 'normal', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                        {customerDetails.name}
                      </h2>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {customerDetails.phone && <p><strong style={{ color: 'var(--primary)' }}>Telefone:</strong> {customerDetails.phone}</p>}
                        {customerDetails.address && <p><strong style={{ color: 'var(--primary)' }}>Endereço:</strong> {customerDetails.address}</p>}
                        {customerDetails.bestPaymentDay && <p><strong style={{ color: 'var(--warning)' }}>Melhor Dia de Pagamento:</strong> todo dia {customerDetails.bestPaymentDay}</p>}
                        {customerDetails.creditLimit > 0 && <p><strong style={{ color: 'var(--text-muted)' }}>Limite de Crédito:</strong> R$ {customerDetails.creditLimit.toFixed(2)}</p>}
                      </div>
                    </div>

                    {/* Bloco de saldos */}
                    <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', padding: '1rem 1.5rem', borderRadius: '12px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', gap: '12px' }}>
                        <button 
                          onClick={handlePrintCustomerLedger}
                          className="btn-outline"
                          style={{ padding: '0.3rem 0.6rem', fontSize: '10px', gap: '4px', display: 'flex', alignItems: 'center' }}
                          title="Imprimir Extrato Completo do Cliente na Elgin i9 (40 colunas)"
                        >
                          <Printer size={12} /> Imprimir Extrato
                        </button>
                        <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 900, textTransform: 'uppercase', margin: 0 }}>Saldo Devedor Atual</p>
                      </div>
                      <h3 style={{ fontSize: '2rem', fontStyle: 'normal', color: customerDetails.balance > 0 ? 'var(--danger)' : 'var(--success)' }}>
                        R$ {customerDetails.balance.toFixed(2)}
                      </h3>
                      <div style={{ display: 'flex', gap: '12px', fontSize: '11px', marginTop: '8px', color: 'var(--text-muted)', justifyContent: 'flex-end' }}>
                        <span>Compras: R$ {customerDetails.totalSales.toFixed(2)}</span>
                        <span>|</span>
                        <span>Pagos: R$ {customerDetails.totalPayments.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Resumo por Mês (Saldo Devedor) */}
                  {processedData.monthlyBreakdown.length > 0 && (
                    <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255,255,255,0.04)', padding: '1.2rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <h3 style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                        Saldo Devedor por Mês
                      </h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
                        {processedData.monthlyBreakdown.map((m, idx) => (
                          <div key={idx} style={{ 
                            background: 'rgba(0,0,0,0.2)', 
                            border: m.remaining > 0 ? '1px solid rgba(255, 149, 0, 0.2)' : '1px solid rgba(52, 199, 89, 0.2)', 
                            padding: '10px 12px', 
                            borderRadius: '10px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px'
                          }}>
                            <p style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'capitalize', fontWeight: 600, margin: 0 }}>
                              {m.monthName}
                            </p>
                            <p style={{ fontSize: '15px', fontWeight: 800, color: m.remaining > 0 ? 'var(--danger)' : 'var(--success)', margin: 0 }}>
                              R$ {m.remaining.toFixed(2)}
                            </p>
                            <p style={{ fontSize: '9px', color: 'var(--text-secondary)', margin: 0 }}>
                              Total Compras: R$ {m.total.toFixed(2)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* GRID DO EXTRATO: COMPRAS VS PAGAMENTOS */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                    
                    {/* COLUNA COMPRAS */}
                    <div>
                      <h3 style={{ fontSize: '12px', color: 'var(--primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={14} /> HISTÓRICO DE COMPRAS (FIADO)
                      </h3>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '400px', overflowY: 'auto' }}>
                        {processedData.allocatedSales.length === 0 ? (
                          <p style={{ color: 'var(--text-muted)', fontSize: '11px', fontStyle: 'italic' }}>Nenhuma compra fiado registrada.</p>
                        ) : (
                          processedData.allocatedSales.map(sale => (
                            <div key={sale.id} style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', padding: '10px 12px', borderRadius: '8px', position: 'relative' }}>
                              <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '6px' }}>
                                <button 
                                  onClick={() => handlePrintSaleTicket(sale)}
                                  style={{ background: 'none', border: 'none', color: 'var(--primary)', opacity: 0.8, cursor: 'pointer' }}
                                  title="Imprimir Comprovante de Venda (40 colunas)"
                                >
                                  <Printer size={12} />
                                </button>
                                <button 
                                  onClick={() => handleDeleteSale(sale.id)}
                                  style={{ background: 'none', border: 'none', color: 'var(--danger)', opacity: 0.6, cursor: 'pointer' }}
                                  title="Excluir Venda"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                              
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                  {formatDate(sale.date)}
                                  {sale.gplusId && (
                                    <span style={{ 
                                      fontSize: '9px', 
                                      fontWeight: 800, 
                                      color: 'var(--primary)', 
                                      background: 'rgba(0, 122, 255, 0.1)', 
                                      padding: '1px 4px', 
                                      borderRadius: '4px',
                                      letterSpacing: '0.05em' 
                                    }}>
                                      GPLUS
                                    </span>
                                  )}
                                  <span style={{ 
                                    fontSize: '9px', 
                                    fontWeight: 900, 
                                    color: sale.allocationStatus === 'PAGO' ? 'var(--success)' : sale.allocationStatus === 'PARCIAL' ? 'var(--warning)' : 'var(--danger)', 
                                    background: sale.allocationStatus === 'PAGO' ? 'rgba(52, 199, 89, 0.1)' : sale.allocationStatus === 'PARCIAL' ? 'rgba(255, 149, 0, 0.1)' : 'rgba(255, 45, 85, 0.1)', 
                                    padding: '1px 4px', 
                                    borderRadius: '4px'
                                  }}>
                                    {sale.allocationStatus}
                                  </span>
                                </span>
                                <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--danger)', marginRight: '16px' }}>
                                  R$ {sale.totalAmount.toFixed(2)}
                                </span>
                              </div>
                              
                              {sale.allocationStatus === 'PARCIAL' && (
                                <p style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '6px', paddingLeft: '4px', marginTop: '-2px' }}>
                                  Pago: <strong style={{ color: 'var(--success)' }}>R$ {sale.paidAmount.toFixed(2)}</strong> | Restante: <strong style={{ color: 'var(--danger)' }}>R$ {sale.remainingAmount.toFixed(2)}</strong>
                                </p>
                              )}

                              {/* Itens da compra */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', borderLeft: '2px solid rgba(0, 242, 255, 0.2)', paddingLeft: '8px', marginLeft: '4px', marginBottom: '4px' }}>
                                {sale.items.map(item => (
                                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
                                    <span>{item.quantity}x {item.description}</span>
                                    <span>R$ {item.totalPrice.toFixed(2)}</span>
                                  </div>
                                ))}
                              </div>

                              {sale.notes && (
                                <p style={{ fontSize: '10px', color: 'var(--warning)', marginTop: '4px', fontStyle: 'italic' }}>
                                  Obs: {sale.notes}
                                </p>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* COLUNA PAGAMENTOS */}
                    <div>
                      <h3 style={{ fontSize: '12px', color: 'var(--accent)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <CheckCircle size={14} /> HISTÓRICO DE PAGAMENTOS
                      </h3>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '400px', overflowY: 'auto' }}>
                        {customerDetails.payments.length === 0 ? (
                          <p style={{ color: 'var(--text-muted)', fontSize: '11px', fontStyle: 'italic' }}>Nenhum pagamento efetuado.</p>
                        ) : (
                          customerDetails.payments.map(payment => (
                            <div key={payment.id} style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', padding: '10px 12px', borderRadius: '8px', position: 'relative' }}>
                              <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '6px' }}>
                                <button 
                                  onClick={() => handlePrintPaymentTicket(payment)}
                                  style={{ background: 'none', border: 'none', color: 'var(--accent)', opacity: 0.8, cursor: 'pointer' }}
                                  title="Imprimir Recibo de Pagamento (40 colunas)"
                                >
                                  <Printer size={12} />
                                </button>
                                <button 
                                  onClick={() => handleDeletePayment(payment.id)}
                                  style={{ background: 'none', border: 'none', color: 'var(--danger)', opacity: 0.6, cursor: 'pointer' }}
                                  title="Excluir Pagamento"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>

                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{formatDate(payment.date)}</span>
                                <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--accent)', marginRight: '16px' }}>
                                  R$ {payment.amount.toFixed(2)}
                                </span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-secondary)' }}>
                                <span style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>{payment.paymentMethod}</span>
                                {payment.notes && <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>{payment.notes}</span>}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    )}

      {/* 2. REGISTRAR NOVA VENDA (FIADO) */}
      {activeTab === 'new-sale' && (
        <div className="narrow-container" style={{ maxWidth: '650px' }}>
          <div className="card-premium">
            <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={20} style={{ color: 'var(--primary)' }} /> REGISTRAR NOVA VENDA A PRAZO (FIADO)
            </h3>
            
            <form onSubmit={handleCreateSale} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Cliente *</label>
                  <select 
                    value={saleCustomerId} 
                    onChange={(e) => setSaleCustomerId(e.target.value)}
                    className="input-premium"
                    required
                  >
                    <option value="">Selecione o cliente...</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.balance > 0 ? `(Devendo R$ ${c.balance.toFixed(2)})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Data da Venda (Inserção) *</label>
                  <input 
                    type="date" 
                    value={saleDate} 
                    onChange={(e) => setSaleDate(e.target.value)}
                    className="input-premium"
                    required
                  />
                </div>
              </div>

              {/* Construtor de Itens */}
              <div style={{ border: '1px solid rgba(255,255,255,0.05)', padding: '1.2rem', borderRadius: '12px', background: 'rgba(0,0,0,0.2)' }}>
                <h4 style={{ fontSize: '12px', color: 'var(--primary)', marginBottom: '1rem', letterSpacing: '0.05em' }}>
                  ADICIONAR ITENS DO PEDIDO
                </h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.2fr auto', gap: '8px', alignItems: 'flex-end', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Descrição do Item</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Marmita Executiva" 
                      value={itemDesc}
                      onChange={(e) => setItemDesc(e.target.value)}
                      className="input-premium"
                      style={{ padding: '0.5rem', fontSize: '12px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Qtd</label>
                    <input 
                      type="number" 
                      step="0.1" 
                      value={itemQty}
                      onChange={(e) => setItemQty(e.target.value)}
                      className="input-premium"
                      style={{ padding: '0.5rem', fontSize: '12px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Preço Unit.</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      placeholder="R$ 0,00" 
                      value={itemPrice}
                      onChange={(e) => setItemPrice(e.target.value)}
                      className="input-premium"
                      style={{ padding: '0.5rem', fontSize: '12px' }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addItemToSale();
                        }
                      }}
                    />
                  </div>
                  <button 
                    type="button" 
                    onClick={addItemToSale}
                    className="btn-outline" 
                    style={{ padding: '0.6rem 1rem', fontSize: '11px', height: '38px', borderRadius: '8px' }}
                  >
                    Adicionar
                  </button>
                </div>

                {/* Tabela de Itens Adicionados */}
                {itemsList.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '11px', fontStyle: 'italic', textAlign: 'center', padding: '1rem' }}>
                    Nenhum item adicionado à lista ainda.
                  </p>
                ) : (
                  <div className="table-wrapper" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    <table className="table-premium" style={{ fontSize: '12px' }}>
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th style={{ textAlign: 'center' }}>Qtd</th>
                          <th style={{ textAlign: 'right' }}>Unitário</th>
                          <th style={{ textAlign: 'right' }}>Total</th>
                          <th style={{ width: '40px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {itemsList.map((item, idx) => (
                          <tr key={idx}>
                            <td>{item.description}</td>
                            <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                            <td style={{ textAlign: 'right' }}>R$ {item.unitPrice.toFixed(2)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--primary)' }}>
                              R$ {(item.quantity * item.unitPrice).toFixed(2)}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button 
                                type="button" 
                                onClick={() => removeItemFromSale(idx)}
                                style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                              >
                                <Trash2 size={12} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Observações (Opcional)</label>
                <input 
                  type="text" 
                  placeholder="Ex: Pegou refrigerante fiado para pagar no fim do mês" 
                  value={saleNotes} 
                  onChange={(e) => setSaleNotes(e.target.value)} 
                  className="input-premium" 
                />
              </div>

              {/* Totalizador da venda */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '1.2rem 1.5rem', borderRadius: '12px', border: '1px solid rgba(0, 242, 255, 0.15)' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>VALOR TOTAL DA COMPRA</span>
                <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--primary)' }}>
                  R$ {itemsList.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0).toFixed(2)}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button 
                  type="button" 
                  onClick={() => setActiveTab('customers')} 
                  className="btn-outline" 
                  style={{ flex: 1 }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmittingSale || itemsList.length === 0} 
                  className="btn-main" 
                  style={{ flex: 2 }}
                >
                  {isSubmittingSale ? "Gravando..." : "Gravar Venda a Prazo (FIADO)"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* 3. REGISTRAR PAGAMENTO (AMORTIZAÇÃO) */}
      {activeTab === 'new-payment' && (
        <div className="narrow-container" style={{ maxWidth: '500px' }}>
          <div className="card-premium">
            <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <DollarSign size={20} style={{ color: 'var(--accent)' }} /> REGISTRAR RECEBIMENTO DE FIADO
            </h3>

            <form onSubmit={handleCreatePayment} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Cliente *</label>
                <select 
                  value={payCustomerId} 
                  onChange={(e) => setPayCustomerId(e.target.value)}
                  className="input-premium"
                  required
                >
                  <option value="">Selecione o cliente...</option>
                  {customers.filter(c => c.balance > 0).map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} (Saldo Devedor: R$ {c.balance.toFixed(2)})
                    </option>
                  ))}
                  <option value="" disabled>--- Clientes sem dívidas ---</option>
                  {customers.filter(c => c.balance <= 0).map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} (Saldo Zerado)
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Valor Pago (R$) *</label>
                  <input 
                    type="number" 
                    step="0.01"
                    placeholder="R$ 0,00"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="input-premium"
                    required
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Data do Pagamento *</label>
                  <input 
                    type="date" 
                    value={payDate} 
                    onChange={(e) => setPayDate(e.target.value)}
                    className="input-premium"
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Método de Recebimento</label>
                <select 
                  value={payMethod} 
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="input-premium"
                >
                  <option value="DINHEIRO">Dinheiro</option>
                  <option value="PIX">Pix</option>
                  <option value="DEBITO">Cartão de Débito</option>
                  <option value="CREDITO">Cartão de Crédito</option>
                  <option value="OUTRO">Outro</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Observações (Opcional)</label>
                <input 
                  type="text" 
                  placeholder="Ex: Pagou parte do saldo devedor" 
                  value={payNotes} 
                  onChange={(e) => setPayNotes(e.target.value)} 
                  className="input-premium" 
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button 
                  type="button" 
                  onClick={() => setActiveTab('customers')} 
                  className="btn-outline" 
                  style={{ flex: 1 }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmittingPayment} 
                  className="btn-main" 
                  style={{ flex: 1, background: 'linear-gradient(135deg, var(--accent), #00d060)' }}
                >
                  {isSubmittingPayment ? "Gravando..." : "Gravar Pagamento"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL DE IMPRESSÃO - PREVIEW IMPRESSORA ELGIN I9 (40 COLUNAS) */}
      {printModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          zIndex: 99999,
          background: "rgba(0, 0, 0, 0.85)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem"
        }}>
          <div style={{
            background: "var(--surface-mid)",
            border: "1px solid var(--glass-border)",
            borderRadius: "16px",
            width: "100%",
            maxWidth: "460px",
            padding: "1.5rem",
            boxShadow: "0 20px 50px rgba(0,0,0,0.8)",
            display: "flex",
            flexDirection: "column",
            gap: "1.2rem",
            maxHeight: "90vh"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: "14px", color: "var(--primary)", display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
                <Printer size={18} /> {printModal.title}
              </h3>
              <button 
                onClick={() => setPrintModal(null)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: 0 }}>
              Pré-visualização ajustada para papel 80mm Elgin i9 (40 colunas):
            </p>

            {/* Container do Cupom Térmico impresso */}
            <div 
              id="elgin-i9-print-area"
              style={{
                background: "#ffffff",
                color: "#000000",
                padding: "1rem",
                borderRadius: "8px",
                fontFamily: "'Courier New', Courier, monospace",
                fontSize: "12px",
                lineHeight: "1.25",
                whiteSpace: "pre",
                overflowX: "auto",
                maxHeight: "50vh",
                border: "1px dashed #ccc"
              }}
            >
              {printModal.lines.join("\n")}
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "0.5rem" }}>
              <button 
                onClick={() => setPrintModal(null)}
                className="btn-outline"
                style={{ flex: 1, padding: "0.7rem", fontSize: "12px" }}
              >
                Fechar
              </button>
              <button 
                onClick={() => executeThermalPrint(printModal.lines)}
                className="btn-main"
                style={{ flex: 2, padding: "0.7rem", fontSize: "12px", gap: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <Printer size={16} /> Imprimir na Elgin i9
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Regras CSS para Impressão Térmica Direta (Elgin i9 80mm) */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #elgin-i9-print-area, #elgin-i9-print-area * {
            visibility: visible !important;
          }
          #elgin-i9-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 78mm !important;
            margin: 0 !important;
            padding: 2mm !important;
            font-family: 'Courier New', Courier, monospace !important;
            font-size: 11px !important;
            line-height: 1.2 !important;
            color: #000000 !important;
            background: #ffffff !important;
            border: none !important;
            box-shadow: none !important;
            white-space: pre-wrap !important;
            max-height: none !important;
            overflow: visible !important;
          }
        }
      `}</style>

    </div>
  );
}
