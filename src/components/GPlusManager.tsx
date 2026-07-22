"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { 
  Plus, Edit, Trash2, Search, FileText, 
  CheckCircle2, AlertCircle, X, ChevronLeft, ChevronRight, 
  Loader2, ArrowLeft, RefreshCw, Camera, Download, Zap, Upload,
  Copy, LogOut, User
} from "lucide-react";
import { 
  getGPlusProducts, 
  createOrUpdateProduct, 
  deleteProduct, 
  extractBarcodeWithAI,
  logoutGPlusUser,
  GPlusProductInput 
} from "@/lib/gplus-actions";

interface Product {
  id: string;
  nome: string;
  grupo: string | null;
  valor: number;
  codigoDeBarras: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface GPlusManagerProps {
  session?: {
    id: string;
    usuario: string;
    nome: string;
  };
}

export default function GPlusManager({ session }: GPlusManagerProps) {
  // CRUD states
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Form states
  const [formId, setFormId] = useState<string | undefined>(undefined);
  const [formNome, setFormNome] = useState("");
  const [formGrupo, setFormGrupo] = useState("");
  const [formValor, setFormValor] = useState("");
  const [formCodigo, setFormCodigo] = useState("");

  // Autocomplete states & refs
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const autocompleteRef = useRef<HTMLDivElement>(null);
  const codigoInputRef = useRef<HTMLInputElement>(null);

  // Camera scanner states
  const [isScanning, setIsScanning] = useState(false);
  const [cameras, setCameras] = useState<any[]>([]);
  const [activeCameraId, setActiveCameraId] = useState<string>("");
  const [torchOn, setTorchOn] = useState(false);
  const html5QrCodeRef = useRef<any>(null);
  const [isSaving, setIsSaving] = useState(false);



  // Notification states
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Fetch products
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getGPlusProducts(searchTerm, session?.id);
      if (res.success && res.products) {
        setProducts(res.products as any);
        setCurrentPage(1); // Reset page on new search
      } else {
        showNotification("error", res.error || "Erro ao carregar produtos.");
      }
    } catch (err) {
      console.error(err);
      showNotification("error", "Erro de conexão ao buscar produtos.");
    } finally {
      setLoading(false);
    }
  }, [searchTerm, session?.id]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Autocomplete outside click handler
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (autocompleteRef.current && !autocompleteRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Autocomplete data fetching (with debounce)
  useEffect(() => {
    if (formNome.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      try {
        const res = await getGPlusProducts(formNome);
        if (res.success && res.products) {
          // Filter out the current product being edited
          const filtered = (res.products as Product[]).filter(p => p.id !== formId);
          setSuggestions(filtered.slice(0, 8));
        }
      } catch (err) {
        console.error("Erro ao buscar sugestões:", err);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [formNome, formId]);

  const handleSelectSuggestion = (suggestion: Product) => {
    setFormId(suggestion.id);
    setFormNome(suggestion.nome);
    setFormGrupo(suggestion.grupo || "");
    setFormValor(suggestion.valor.toString());
    setFormCodigo(suggestion.codigoDeBarras || "");
    setShowSuggestions(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveSuggestionIndex(prev => 
        prev < suggestions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveSuggestionIndex(prev => 
        prev > 0 ? prev - 1 : suggestions.length - 1
      );
    } else if (e.key === "Enter") {
      if (activeSuggestionIndex >= 0 && activeSuggestionIndex < suggestions.length) {
        e.preventDefault();
        handleSelectSuggestion(suggestions[activeSuggestionIndex]);
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  // Helper to find existing product with same barcode
  const findDuplicateBarcodeProduct = (code: string, currentId?: string) => {
    if (!code || !code.trim()) return null;
    const cleanCode = code.trim().toLowerCase();
    return products.find(
      p => p.codigoDeBarras && p.codigoDeBarras.trim().toLowerCase() === cleanCode && p.id !== currentId
    );
  };

  // Submit Form as New Product (cloning/duplicating)
  const handleSaveAsNew = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!formNome.trim()) {
      showNotification("error", "O nome do produto é obrigatório.");
      return;
    }

    const valorNum = parseFloat(formValor.replace(",", ".")) || 0;
    if (valorNum < 0) {
      showNotification("error", "O valor não pode ser negativo.");
      return;
    }

    if (formCodigo.trim()) {
      const duplicate = findDuplicateBarcodeProduct(formCodigo);
      if (duplicate) {
        showNotification(
          "error",
          `⚠️ O código de barras "${formCodigo.trim()}" já está cadastrado no produto "${duplicate.nome}"!`
        );
        setTimeout(() => {
          codigoInputRef.current?.focus();
          codigoInputRef.current?.select();
        }, 50);
        return;
      }
    }

    setIsSaving(true);
    try {
      const res = await createOrUpdateProduct({
        id: undefined, // Clear ID to force creation of a new product
        loginGPlusId: session?.id || null,
        nome: formNome,
        grupo: formGrupo || null,
        valor: valorNum,
        codigoDeBarras: formCodigo || null,
      });

      if (res.success) {
        showNotification("success", "Produto cadastrado como novo com sucesso!");
        resetForm();
        fetchProducts();
      } else {
        showNotification("error", res.error || "Erro ao salvar produto.");
        if (res.error?.includes("código de barras")) {
          setTimeout(() => {
            codigoInputRef.current?.focus();
            codigoInputRef.current?.select();
          }, 50);
        }
      }
    } catch (err) {
      console.error(err);
      showNotification("error", "Erro de rede ao salvar produto.");
    } finally {
      setIsSaving(false);
    }
  };

  // Helper for notification
  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 5000);
  };

  // Submit Single Product Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNome.trim()) {
      showNotification("error", "O nome do produto é obrigatório.");
      return;
    }

    const valorNum = parseFloat(formValor.replace(",", ".")) || 0;
    if (valorNum < 0) {
      showNotification("error", "O valor não pode ser negativo.");
      return;
    }

    if (formCodigo.trim()) {
      const duplicate = findDuplicateBarcodeProduct(formCodigo, formId);
      if (duplicate) {
        showNotification(
          "error",
          `⚠️ O código de barras "${formCodigo.trim()}" já está cadastrado no produto "${duplicate.nome}"!`
        );
        setTimeout(() => {
          codigoInputRef.current?.focus();
          codigoInputRef.current?.select();
        }, 50);
        return;
      }
    }

    setIsSaving(true);
    try {
      const res = await createOrUpdateProduct({
        id: formId,
        loginGPlusId: session?.id || null,
        nome: formNome,
        grupo: formGrupo || null,
        valor: valorNum,
        codigoDeBarras: formCodigo || null,
      });

      if (res.success) {
        showNotification("success", formId ? "Produto atualizado com sucesso!" : "Produto cadastrado com sucesso!");
        resetForm();
        fetchProducts();
      } else {
        showNotification("error", res.error || "Erro ao salvar produto.");
        if (res.error?.includes("código de barras")) {
          setTimeout(() => {
            codigoInputRef.current?.focus();
            codigoInputRef.current?.select();
          }, 50);
        }
      }
    } catch (err) {
      console.error(err);
      showNotification("error", "Erro de rede ao salvar produto.");
    } finally {
      setIsSaving(false);
    }
  };

  // Edit action
  const handleEdit = (product: Product) => {
    setFormId(product.id);
    setFormNome(product.nome);
    setFormGrupo(product.grupo || "");
    setFormValor(product.valor.toString());
    setFormCodigo(product.codigoDeBarras || "");
    // Scroll smoothly to form
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Delete action
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja excluir o produto "${name}"?`)) return;

    try {
      const res = await deleteProduct(id);
      if (res.success) {
        showNotification("success", "Produto excluído com sucesso!");
        fetchProducts();
        if (formId === id) resetForm();
      } else {
        showNotification("error", res.error || "Erro ao excluir produto.");
      }
    } catch (err) {
      console.error(err);
      showNotification("error", "Erro de rede ao excluir produto.");
    }
  };

  // Reset Form
  const resetForm = () => {
    setFormId(undefined);
    setFormNome("");
    setFormGrupo("");
    setFormValor("");
    setFormCodigo("");
  };

  // Export list of products to Excel/CSV
  const exportProductsToCSV = () => {
    if (products.length === 0) {
      showNotification("error", "Não há produtos cadastrados para exportar.");
      return;
    }

    const headers = "Nome;Grupo;Valor;Código de Barras\r\n";
    const rows = products.map(p => {
      const nome = `"${(p.nome || '').replace(/"/g, '""')}"`;
      const grupo = `"${(p.grupo || '').replace(/"/g, '""')}"`;
      const valor = p.valor !== undefined && p.valor !== null ? p.valor.toFixed(2).replace('.', ',') : "0,00";
      const codigo = `"${(p.codigoDeBarras || '').replace(/"/g, '""')}"`;
      return `${nome};${grupo};${valor};${codigo}`;
    }).join("\r\n");

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + encodeURIComponent(headers + rows);
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", `produtos_gplus_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification("success", "Lista de produtos exportada com sucesso!");
  };

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(console.error);
      }
    };
  }, []);

  // Web Audio synthetic beep
  const playBeep = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {
      console.error(e);
    }
  };

  const startScanning = async () => {
    setIsScanning(true);
    setCameras([]);
    setTorchOn(false);
    
    // Allow DOM to render the scanner container
    setTimeout(async () => {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
        
        const formatsToSupport = [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.AZTEC,
          Html5QrcodeSupportedFormats.DATA_MATRIX,
        ];

        const html5QrCode = new Html5Qrcode("scanner-preview", {
          formatsToSupport,
          verbose: false,
        });
        html5QrCodeRef.current = html5QrCode;

        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          setCameras(devices);
          const backCamera = devices.find(d => 
            d.label.toLowerCase().includes("back") || 
            d.label.toLowerCase().includes("traseira") || 
            d.label.toLowerCase().includes("environment") || 
            d.label.toLowerCase().includes("rear")
          );
          const selectedId = backCamera ? backCamera.id : devices[0].id;
          setActiveCameraId(selectedId);
          await startCamera(html5QrCode, selectedId);
        } else {
          await startCameraWithFacingMode(html5QrCode);
        }
      } catch (err) {
        console.error("Camera access error:", err);
        showNotification("error", "Não foi possível acessar a câmera. Verifique as permissões.");
        setIsScanning(false);
      }
    }, 200);
  };

  const getScanConfig = () => ({
    fps: 15,
    qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
      const width = Math.min(Math.floor(viewfinderWidth * 0.9), 350);
      const height = Math.min(Math.floor(viewfinderHeight * 0.5), 180);
      return { width: Math.max(width, 220), height: Math.max(height, 100) };
    },
    aspectRatio: 1.333333,
  });

  const startCamera = async (scannerInstance: any, cameraId: string) => {
    try {
      await scannerInstance.start(
        cameraId,
        getScanConfig(),
        (decodedText: string) => {
          handleScanSuccess(decodedText);
        },
        () => {} // Suppress errors in scanning loop
      );
    } catch (err) {
      console.error("Camera start by ID error, trying facingMode:", err);
      await startCameraWithFacingMode(scannerInstance);
    }
  };

  const startCameraWithFacingMode = async (scannerInstance: any) => {
    try {
      await scannerInstance.start(
        { facingMode: "environment" },
        getScanConfig(),
        (decodedText: string) => {
          handleScanSuccess(decodedText);
        },
        () => {}
      );
    } catch (err) {
      console.error("Camera facingMode error:", err);
      throw err;
    }
  };

  const switchCamera = async (cameraId: string) => {
    if (!html5QrCodeRef.current) return;
    try {
      setTorchOn(false);
      await html5QrCodeRef.current.stop();
      setActiveCameraId(cameraId);
      await startCamera(html5QrCodeRef.current, cameraId);
    } catch (err) {
      console.error("Error switching camera:", err);
      showNotification("error", "Erro ao mudar de câmera.");
    }
  };

  const toggleTorch = async () => {
    if (!html5QrCodeRef.current) return;
    try {
      const newState = !torchOn;
      await html5QrCodeRef.current.applyVideoConstraints({
        advanced: [{ torch: newState }]
      });
      setTorchOn(newState);
    } catch (e) {
      console.error("Torch error:", e);
      showNotification("error", "Flash não suportado neste dispositivo.");
    }
  };

  const stopScanning = async () => {
    if (html5QrCodeRef.current) {
      try {
        setTorchOn(false);
        await html5QrCodeRef.current.stop();
      } catch (err) {
        console.error("Error stopping camera:", err);
      }
      html5QrCodeRef.current = null;
    }
    setIsScanning(false);
  };

  const handleScanSuccess = (decodedText: string) => {
    playBeep();
    setFormCodigo(decodedText);
    showNotification("success", `Código escaneado: ${decodedText}`);
    stopScanning();
  };

  const preprocessImage = (file: File, targetWidth: number, enhanceContrast: boolean = false): Promise<File> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const scale = Math.min(1, targetWidth / img.width);
          canvas.width = Math.floor(img.width * scale);
          canvas.height = Math.floor(img.height * scale);

          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve(file);

          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          if (enhanceContrast) {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
              const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
              const val = avg > 128 ? 255 : 0;
              data[i] = val;
              data[i + 1] = val;
              data[i + 2] = val;
            }
            ctx.putImageData(imageData, 0, 0);
          }

          canvas.toBlob((blob) => {
            if (blob) {
              resolve(new File([blob], file.name, { type: "image/png" }));
            } else {
              resolve(file);
            }
          }, "image/png");
        };
        img.onerror = () => resolve(file);
        img.src = e.target?.result as string;
      };
      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    });
  };

  const fileToCompressedBase64 = (file: File, maxWidth: number = 1200, quality: number = 0.8): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const scale = Math.min(1, maxWidth / img.width);
          canvas.width = Math.floor(img.width * scale);
          canvas.height = Math.floor(img.height * scale);

          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve(e.target?.result as string);

          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
          resolve(compressedDataUrl);
        };
        img.onerror = () => resolve(e.target?.result as string);
        img.src = e.target?.result as string;
      };
      reader.onerror = () => resolve("");
      reader.readAsDataURL(file);
    });
  };

  const handleScanImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      showNotification("success", "🤖 IA Gemini lendo foto do código de barras...");
      
      let decodedText: string | null = null;

      // Pass 1: AI Vision Gemini API (highest accuracy for smartphone photos)
      try {
        const base64 = await fileToCompressedBase64(file);
        const aiRes = await extractBarcodeWithAI(base64);
        if (aiRes.success && aiRes.barcode) {
          decodedText = aiRes.barcode;
        } else if (aiRes.error) {
          console.warn("AI Vision notice:", aiRes.error);
        }
      } catch (err) {
        console.error("AI Vision extraction error:", err);
      }

      // Pass 2: Local ZXing Canvas Multi-Scale Scanner (Fallback if AI key is missing or missed it)
      if (!decodedText) {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
        
        const formatsToSupport = [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.ITF,
        ];

        const tempScanner = new Html5Qrcode("temp-file-scanner", {
          formatsToSupport,
          verbose: false,
        });

        // 2a. Original file
        try {
          decodedText = await tempScanner.scanFile(file, false);
        } catch (err) {}

        // 2b. Scaled to 800px
        if (!decodedText) {
          try {
            const scaledFile800 = await preprocessImage(file, 800, false);
            decodedText = await tempScanner.scanFile(scaledFile800, false);
          } catch (err) {}
        }

        // 2c. Scaled to 1000px with High Contrast
        if (!decodedText) {
          try {
            const contrastFile = await preprocessImage(file, 1000, true);
            decodedText = await tempScanner.scanFile(contrastFile, false);
          } catch (err) {}
        }

        try {
          tempScanner.clear();
        } catch (e) {}
      }

      if (decodedText) {
        playBeep();
        setFormCodigo(decodedText);
        showNotification("success", `🤖 Código identificado: ${decodedText}`);
        if (isScanning) {
          stopScanning();
        }
      } else {
        showNotification("error", "Não foi possível identificar o código na foto. Certifique-se de que os números abaixo do código estejam visíveis.");
      }
    } catch (err: any) {
      console.error("Image file scan error:", err);
      showNotification("error", "Erro ao processar a imagem. Tente tirar a foto com foco.");
    } finally {
      e.target.value = "";
    }
  };



  // Pagination logic
  const filteredProducts = products;
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="page-container animate-entrance">
      {/* Toast Notification */}
      {notification && (
        <div style={{
          position: "fixed",
          top: "24px",
          right: "24px",
          zIndex: 9999,
          background: notification.type === "success" ? "rgba(0, 255, 136, 0.15)" : "rgba(255, 45, 85, 0.15)",
          border: `1px solid ${notification.type === "success" ? "var(--success)" : "var(--danger)"}`,
          color: notification.type === "success" ? "var(--success)" : "#ff4d6d",
          padding: "1rem 1.5rem",
          borderRadius: "12px",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          animation: "slideIn 0.3s ease-out"
        }}>
          {notification.type === "success" ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span style={{ fontSize: "14px", fontWeight: 600 }}>{notification.message}</span>
          <button 
            onClick={() => setNotification(null)}
            style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", marginLeft: "12px" }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Header */}
      <header style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center", 
        borderBottom: "1px solid rgba(255,255,255,0.05)", 
        paddingBottom: "1.5rem",
        marginBottom: "1rem",
        flexWrap: "wrap",
        gap: "1rem"
      }}>
        <div>
          <h1 style={{ fontSize: "2.2rem", marginBottom: "0.2rem" }}>PRODUTOS GPLUS</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "10px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.5em" }}>
            Painel Standalone de Consulta e Importação
          </p>
        </div>

        {session && (
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "0.5rem 1rem",
              background: "rgba(0, 242, 255, 0.08)",
              border: "1px solid rgba(0, 242, 255, 0.2)",
              borderRadius: "20px",
              fontSize: "12px",
              color: "var(--primary)"
            }}>
              <User size={14} />
              <span style={{ fontWeight: 700 }}>{session.nome || session.usuario}</span>
            </div>
            <button
              onClick={() => logoutGPlusUser()}
              className="btn-outline"
              style={{ padding: "0.5rem 1rem", fontSize: "12px", gap: "6px", display: "flex", alignItems: "center" }}
              title="Sair do painel GPlus"
            >
              <LogOut size={14} /> Sair
            </button>
          </div>
        )}
      </header>

      {/* UPPER SECTION: CRUD Form */}
      <div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
        <div style={{ width: "100%", maxWidth: "600px" }}>
          <div className="card-premium">
            <h3 style={{ marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "10px", color: formId ? "var(--primary)" : "#fff" }}>
              {formId ? <Edit size={18} /> : <Plus size={18} />}
              {formId ? "EDITAR PRODUTO" : "NOVO PRODUTO"}
            </h3>
            
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
              <div ref={autocompleteRef} style={{ position: "relative" }}>
                <label style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
                  Nome do Produto <span style={{ color: "var(--danger)" }}>*</span>
                </label>
                <div style={{ position: "relative" }}>
                  <input 
                    type="text" 
                    value={formNome} 
                    onChange={e => {
                      setFormNome(e.target.value);
                      setShowSuggestions(true);
                      setActiveSuggestionIndex(-1);
                    }} 
                    onFocus={() => setShowSuggestions(true)}
                    onKeyDown={handleKeyDown}
                    className="input-premium" 
                    placeholder="Ex: Coca-Cola Lata 350ml" 
                    required
                  />
                  
                  {/* Autocomplete Dropdown */}
                  {showSuggestions && suggestions.length > 0 && (
                    <div style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      zIndex: 1000,
                      background: "var(--glass)",
                      backdropFilter: "blur(20px)",
                      WebkitBackdropFilter: "blur(20px)",
                      border: "1px solid var(--glass-border)",
                      borderRadius: "8px",
                      marginTop: "4px",
                      boxShadow: "0 10px 25px rgba(0, 0, 0, 0.5)",
                      maxHeight: "260px",
                      overflowY: "auto"
                    }}>
                      {suggestions.map((suggestion, index) => (
                        <div 
                          key={suggestion.id}
                          onClick={() => handleSelectSuggestion(suggestion)}
                          onMouseEnter={() => setActiveSuggestionIndex(index)}
                          style={{
                            padding: "0.8rem 1rem",
                            cursor: "pointer",
                            background: index === activeSuggestionIndex ? "rgba(0, 242, 255, 0.15)" : "transparent",
                            borderBottom: index < suggestions.length - 1 ? "1px solid rgba(255, 255, 255, 0.05)" : "none",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            transition: "background 0.2s"
                          }}
                        >
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <span style={{ fontWeight: 600, fontSize: "14px", color: "#fff" }}>
                              {suggestion.nome}
                            </span>
                            {suggestion.grupo && (
                              <span style={{ fontSize: "10px", color: "var(--text-secondary)", textTransform: "uppercase" }}>
                                {suggestion.grupo}
                              </span>
                            )}
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px" }}>
                            <span style={{ fontWeight: 700, color: "var(--accent)", fontSize: "13px" }}>
                              R$ {suggestion.valor.toFixed(2)}
                            </span>
                            {suggestion.codigoDeBarras && (
                              <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "monospace" }}>
                                📷 {suggestion.codigoDeBarras}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {formNome.trim() && products.some(p => p.nome.trim().toLowerCase() === formNome.trim().toLowerCase() && p.id !== formId) && (
                  <span style={{ color: "var(--warning)", fontSize: "11px", marginTop: "4px", display: "block", fontWeight: 600 }}>
                    ⚠️ Já existe um produto cadastrado com este nome!
                  </span>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
                    Grupo / Categoria
                  </label>
                  <input 
                    type="text" 
                    value={formGrupo} 
                    onChange={e => setFormGrupo(e.target.value)} 
                    className="input-premium" 
                    placeholder="Ex: Bebidas" 
                  />
                </div>
                <div>
                  <label style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
                    Valor (R$) <span style={{ color: "var(--danger)" }}>*</span>
                  </label>
                  <input 
                    type="text" 
                    value={formValor} 
                    onChange={e => setFormValor(e.target.value)} 
                    className="input-premium" 
                    placeholder="0.00" 
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
                  Código de Barras
                </label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input 
                    ref={codigoInputRef}
                    type="text" 
                    value={formCodigo} 
                    onChange={e => setFormCodigo(e.target.value)} 
                    className="input-premium" 
                    placeholder="Ex: 7891000123456" 
                  />
                  <button 
                    type="button" 
                    onClick={startScanning} 
                    className="btn-outline" 
                    style={{ padding: "0 0.8rem", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "44px" }}
                    title="Escanear com a câmera ao vivo"
                  >
                    <Camera size={20} />
                  </button>
                  <label 
                    className="btn-outline" 
                    style={{ padding: "0 0.8rem", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "44px", cursor: "pointer" }}
                    title="Tirar foto ou selecionar imagem do código de barras"
                  >
                    <Upload size={20} />
                    <input 
                      type="file" 
                      accept="image/*" 
                      capture="environment" 
                      onChange={handleScanImageFile} 
                      style={{ display: "none" }} 
                    />
                  </label>
                </div>
                {formCodigo.trim() && findDuplicateBarcodeProduct(formCodigo, formId) && (
                  <span style={{ color: "var(--warning)", fontSize: "11px", marginTop: "4px", display: "block", fontWeight: 600 }}>
                    ⚠️ Este código de barras já pertence ao produto: "{findDuplicateBarcodeProduct(formCodigo, formId)?.nome}"
                  </span>
                )}
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "1rem" }}>
                {formId && (
                  <>
                    <button 
                      type="button" 
                      onClick={resetForm} 
                      className="btn-outline" 
                      style={{ flex: 1, padding: "0.8rem" }}
                    >
                      Cancelar
                    </button>
                    <button 
                      type="button"
                      onClick={handleSaveAsNew}
                      disabled={isSaving}
                      className="btn-outline"
                      style={{ flex: 1.5, padding: "0.8rem", gap: "6px", display: "flex", alignItems: "center", justifyContent: "center" }}
                      title="Criar um novo produto usando as informações deste formulário"
                    >
                      <Copy size={16} /> Salvar como Novo
                    </button>
                  </>
                )}
                <button 
                  type="submit" 
                  disabled={isSaving} 
                  className="btn-main" 
                  style={{ flex: 2, padding: "0.8rem", gap: "8px" }}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="spin" size={16} /> Salvando...
                    </>
                  ) : (
                    <>
                      Confirmar {formId ? "Edição" : "Cadastro"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* LOWER SECTION: PRODUCTS LIST */}
      <div className="card-premium" style={{ borderTop: "4px solid var(--primary)", marginTop: "2rem" }}>
        
        {/* Actions bar */}
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center", 
          marginBottom: "1.5rem",
          gap: "1.5rem",
          flexWrap: "wrap"
        }}>
          <h3 style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <FileText size={18} style={{ color: "var(--primary)" }} />
            LISTA DE PRODUTOS ({products.length})
          </h3>
          
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, maxWidth: "450px" }}>
            <div style={{ position: "relative", width: "100%" }}>
              <input 
                type="text" 
                placeholder="Buscar por nome, grupo ou código..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="input-premium"
                style={{ paddingLeft: "2.5rem" }}
              />
              <Search 
                size={18} 
                style={{ 
                  position: "absolute", 
                  left: "12px", 
                  top: "50%", 
                  transform: "translateY(-50%)", 
                  color: "var(--text-muted)" 
                }} 
              />
            </div>
            <button 
              onClick={exportProductsToCSV} 
              className="btn-outline" 
              style={{ padding: "0.6rem 1rem", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }}
              title="Baixar lista de produtos para Excel (CSV)"
            >
              <Download size={16} /> Exportar Excel
            </button>
            <button 
              onClick={fetchProducts} 
              className="btn-outline" 
              style={{ padding: "0.8rem", display: "flex", alignItems: "center", justifyContent: "center" }}
              title="Atualizar Tabela"
            >
              <RefreshCw size={16} className={loading ? "spin" : ""} />
            </button>
          </div>
        </div>

        {/* Table representation */}
        <div className="table-wrapper">
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "4rem", gap: "1rem" }}>
              <Loader2 className="spin" size={40} style={{ color: "var(--primary)" }} />
              <span style={{ fontSize: "11px", color: "var(--text-muted)", letterSpacing: "0.2em", textTransform: "uppercase" }}>
                Carregando Produtos...
              </span>
            </div>
          ) : paginatedProducts.length === 0 ? (
            <div style={{ padding: "4rem", textAlign: "center", color: "var(--text-muted)" }}>
              Nenhum produto cadastrado ou correspondente à busca.
            </div>
          ) : (
            <table className="table-premium">
              <thead>
                <tr>
                  <th>Nome do Produto</th>
                  <th>Grupo</th>
                  <th>Valor</th>
                  <th>Código de Barras</th>
                  <th style={{ width: "120px", textAlign: "center" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProducts.map(product => (
                  <tr key={product.id}>
                    <td style={{ fontWeight: 700, fontSize: "14px" }}>{product.nome}</td>
                    <td>
                      {product.grupo ? (
                        <span style={{ 
                          fontSize: "10px", 
                          fontWeight: 800, 
                          padding: "0.2rem 0.6rem", 
                          borderRadius: "4px",
                          background: "rgba(255,255,255,0.04)",
                          color: "var(--text-secondary)",
                          border: "1px solid rgba(255,255,255,0.06)"
                        }}>
                          {product.grupo.toUpperCase()}
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>--</span>
                      )}
                    </td>
                    <td style={{ fontWeight: 800, color: "var(--accent)", fontSize: "14px" }}>
                      R$ {product.valor.toFixed(2)}
                    </td>
                    <td>
                      {product.codigoDeBarras ? (
                        <span style={{ fontFamily: "monospace", fontSize: "12px", color: "var(--text-secondary)" }}>
                          {product.codigoDeBarras}
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>--</span>
                      )}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                        <button 
                          onClick={() => handleEdit(product)}
                          className="hover-primary"
                          style={{ 
                            padding: "0.4rem", 
                            background: "rgba(0, 242, 255, 0.08)", 
                            border: "1px solid rgba(0, 242, 255, 0.15)", 
                            borderRadius: "6px", 
                            color: "var(--primary)", 
                            cursor: "pointer",
                            transition: "all 0.2s" 
                          }}
                          title="Editar"
                        >
                          <Edit size={14} />
                        </button>
                        <button 
                          onClick={() => handleDelete(product.id, product.nome)}
                          style={{ 
                            padding: "0.4rem", 
                            background: "rgba(255, 45, 85, 0.08)", 
                            border: "1px solid rgba(255, 45, 85, 0.15)", 
                            borderRadius: "6px", 
                            color: "var(--danger)", 
                            cursor: "pointer",
                            transition: "all 0.2s" 
                          }}
                          title="Excluir"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1.5rem" }}>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong> (Exibindo {paginatedProducts.length} itens de {filteredProducts.length})
            </span>
            
            <div style={{ display: "flex", gap: "8px" }}>
              <button 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
                disabled={currentPage === 1}
                className="btn-outline" 
                style={{ padding: "0.5rem 1rem", fontSize: "12px", gap: "4px" }}
              >
                <ChevronLeft size={16} /> Anterior
              </button>
              <button 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} 
                disabled={currentPage === totalPages}
                className="btn-outline" 
                style={{ padding: "0.5rem 1rem", fontSize: "12px", gap: "4px" }}
              >
                Próximo <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Scanner Overlay Modal */}
      {isScanning && (
        <div style={{
          position: "fixed",
          top: 0, left: 0, width: "100vw", height: "100vh",
          background: "rgba(2, 2, 8, 0.95)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          zIndex: 100000,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem"
        }}>
          <div className="card-premium animate-entrance" style={{ width: "100%", maxWidth: "500px", position: "relative", border: "1px solid rgba(0, 242, 255, 0.3)" }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h4 style={{ color: "var(--primary)", display: "flex", alignItems: "center", gap: "8px" }}>
                <Camera size={18} /> Scanner de Código de Barras
              </h4>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: "auto" }}>
                <button
                  type="button"
                  onClick={toggleTorch}
                  className="btn-outline"
                  style={{
                    padding: "0.4rem 0.8rem",
                    fontSize: "12px",
                    borderColor: torchOn ? "var(--warning)" : "rgba(255,255,255,0.1)",
                    color: torchOn ? "var(--warning)" : "var(--text-secondary)"
                  }}
                  title="Alternar Flash"
                >
                  <Zap size={14} /> {torchOn ? "Flash ON" : "Flash"}
                </button>
                <button 
                  type="button"
                  onClick={stopScanning}
                  style={{ background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer", padding: "0.2rem" }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Camera selection dropdown */}
            {cameras.length > 1 && (
              <select 
                value={activeCameraId} 
                onChange={(e) => switchCamera(e.target.value)}
                className="input-premium"
                style={{ marginBottom: "1rem", fontSize: "12px", padding: "0.5rem" }}
              >
                {cameras.map((cam) => (
                  <option key={cam.id} value={cam.id}>{cam.label || `Câmera ${cam.id}`}</option>
                ))}
              </select>
            )}

            {/* Video Container */}
            <div style={{ 
              width: "100%", 
              overflow: "hidden", 
              borderRadius: "12px", 
              border: "1px solid var(--glass-border)",
              background: "#000",
              aspectRatio: "4/3",
              position: "relative"
            }}>
              <div id="scanner-preview" style={{ width: "100%", height: "100%" }}></div>
              
              {/* Scan box overlay */}
              <div style={{
                position: "absolute",
                top: "50%", left: "50%",
                transform: "translate(-50%, -50%)",
                width: "85%", height: "45%",
                border: "2px dashed var(--primary)",
                borderRadius: "10px",
                boxShadow: "0 0 25px rgba(0, 242, 255, 0.4)",
                pointerEvents: "none",
                zIndex: 10
              }}>
                <div style={{
                  position: "absolute",
                  top: 0, left: 0, width: "100%", height: "3px",
                  background: "linear-gradient(90deg, transparent, var(--primary), transparent)",
                  boxShadow: "0 0 12px var(--primary)",
                  animation: "laser 1.8s ease-in-out infinite"
                }}></div>
              </div>
            </div>

            <p style={{ color: "var(--text-secondary)", fontSize: "12px", textAlign: "center", marginTop: "1rem", fontWeight: 600 }}>
              Aponte a câmera diretamente para o código de barras EAN / QR Code.
            </p>

            <div style={{ display: "flex", gap: "10px", marginTop: "1rem" }}>
              <label 
                className="btn-outline" 
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", cursor: "pointer", padding: "0.8rem", fontSize: "12px" }}
              >
                <Upload size={16} /> Tirar Foto / Imagem
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="environment" 
                  onChange={handleScanImageFile} 
                  style={{ display: "none" }} 
                />
              </label>
              <button 
                type="button"
                onClick={stopScanning} 
                className="btn-outline" 
                style={{ flex: 1, padding: "0.8rem" }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden container for temp file scanner */}
      <div id="temp-file-scanner" style={{ display: "none" }}></div>

      {/* Embedded Animations and hover CSS rules */}
      <style jsx>{`
        @keyframes slideIn {
          from { transform: translateY(-20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes laser {
          0% { top: 0%; }
          50% { top: 100%; }
          100% { top: 0%; }
        }
        .hover-primary:hover {
          color: var(--primary) !important;
        }
        .hover-border-primary:hover {
          border-color: rgba(0, 242, 255, 0.4) !important;
          background: rgba(0, 242, 255, 0.02) !important;
        }
      `}</style>
    </div>
  );
}
