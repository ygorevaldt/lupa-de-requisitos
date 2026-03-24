"use client";

import { useState, useRef, useEffect } from "react";
import { FileText, AlertTriangle, CheckCircle, Search, UploadCloud, Download, Lightbulb } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type AnalysisResult = {
  projeto_resumo: string;
  funcionalidades: string[];
  falhas_logicas: { erro: string; impacto: string; sessao: string; pagina: string }[];
  gaps_negocio: { gap: string; sessao: string; pagina: string }[];
  sugestoes_melhoria: string[];
  sugestoes_ux: string[];
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [messageIndex, setMessageIndex] = useState(0);

  const loadingMessages = [
    "O Gemini está lendo os requisitos e paginando o texto...",
    "Procurando por bugs e brechas na lógica...",
    "Mapeando seções e páginas exatas dos erros...",
    "Estruturando as sugestões de melhoria...",
    "Quase lá! Preparando o dossiê da análise..."
  ];

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading) {
      interval = setInterval(() => {
        setMessageIndex((prev) => (prev + 1) % loadingMessages.length);
      }, 3000);
    } else {
      setMessageIndex(0);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type === "application/pdf") {
      setFile(droppedFile);
    } else {
      setError("Por favor, envie um arquivo PDF válido.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Falha ao analisar o documento.");
      }

      const data: AnalysisResult = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Ocorreu um erro inesperado.");
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePDF = () => {
    if (!result) return;
    
    // Default format A4
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let startY = 20;

    // Header superior
    doc.setFontSize(24);
    doc.setTextColor(37, 99, 235); // text-blue-600
    doc.text("Gemini Doc Analyzer", pageWidth / 2, startY, { align: "center" });
    
    startY += 8;
    doc.setFontSize(12);
    doc.setTextColor(100, 116, 139); // text-slate-500
    doc.text(`Relatório de Correção e Arquitetura - ${new Date().toLocaleDateString()}`, pageWidth / 2, startY, { align: "center" });
    
    startY += 20;

    // Seção Resumo
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text("Resumo do Projeto", 14, startY);
    startY += 8;
    
    doc.setFontSize(11);
    doc.setTextColor(51, 65, 85); // slate-700
    const splitResumo = doc.splitTextToSize(result.projeto_resumo, pageWidth - 28);
    doc.text(splitResumo, 14, startY);
    startY += (splitResumo.length * 5) + 12;

    // Tabela: Funcionalidades Principais
    autoTable(doc, {
      startY,
      head: [["Core Features / Funcionalidades"]],
      body: result.funcionalidades.map(f => [f]),
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129] }, // emerald-500
      styles: { fontSize: 10 }
    });
    startY = (doc as any).lastAutoTable.finalY + 15;

    // Tabela: Falhas Lógicas
    if (result.falhas_logicas && result.falhas_logicas.length > 0) {
      if (startY > doc.internal.pageSize.getHeight() - 40) { doc.addPage(); startY = 20; }
      autoTable(doc, {
        startY,
        head: [["Falha Lógica Entendida pelo Modelo", "Impacto Mensurado", "Seção", "Pág"]],
        body: result.falhas_logicas.map(f => [f.erro, f.impacto, f.sessao || "-", f.pagina || "-"]),
        theme: 'grid',
        headStyles: { fillColor: [239, 68, 68] }, // red-500
        columnStyles: { 
          0: { cellWidth: 70 }, 
          1: { cellWidth: 60 }, 
          2: { cellWidth: 35 }, 
          3: { cellWidth: 15, halign: 'center' } 
        },
        styles: { fontSize: 9 }
      });
      startY = (doc as any).lastAutoTable.finalY + 15;
    }

    // Tabela: Gaps de Negócio
    if (result.gaps_negocio && result.gaps_negocio.length > 0) {
      if (startY > doc.internal.pageSize.getHeight() - 40) { doc.addPage(); startY = 20; }
      autoTable(doc, {
        startY,
        head: [["Gap de Negócio Identificado", "Seção", "Pág"]],
        body: result.gaps_negocio.map(g => [g.gap, g.sessao || "-", g.pagina || "-"]),
        theme: 'grid',
        headStyles: { fillColor: [249, 115, 22] }, // orange-500
        columnStyles: { 
          0: { cellWidth: 110 }, 
          1: { cellWidth: 50 }, 
          2: { cellWidth: 20, halign: 'center' } 
        },
        styles: { fontSize: 9 }
      });
      startY = (doc as any).lastAutoTable.finalY + 15;
    }

    // Tabela: Sugestões de Melhorias da Lógica / Gaps
    if (result.sugestoes_melhoria && result.sugestoes_melhoria.length > 0) {
      if (startY > doc.internal.pageSize.getHeight() - 40) { doc.addPage(); startY = 20; }
      autoTable(doc, {
        startY,
        head: [["Plano de Ação e Sugestões de Melhoria (Gaps e Falhas)"]],
        body: result.sugestoes_melhoria.map(s => [s]),
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246] }, // blue-500
        styles: { fontSize: 10 }
      });
      startY = (doc as any).lastAutoTable.finalY + 15;
    }

    // Tabela: Sugestões de UX
    if (result.sugestoes_ux && result.sugestoes_ux.length > 0) {
      if (startY > doc.internal.pageSize.getHeight() - 40) { doc.addPage(); startY = 20; }
      autoTable(doc, {
        startY,
        head: [["Sugestões de User Experience (UX)"]],
        body: result.sugestoes_ux.map(s => [s]),
        theme: 'grid',
        headStyles: { fillColor: [99, 102, 241] }, // indigo-500
        styles: { fontSize: 10 }
      });
    }

    // Action final do PDF!
    doc.save("Relatorio_Arquitetura_GeminiAnalyzer.pdf");
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 p-4 md:p-8 font-sans">
      <main className="max-w-7xl mx-auto space-y-12">
        <header className="relative text-center space-y-4 pt-8 md:pt-12">
          <div className="absolute top-2 right-2 md:top-4 md:right-4">
            <ThemeToggle />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
            Gemini Doc Analyzer
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
             Análise Inteligente de Requisitos e Arquitetura com Mapeamento de Falhas e Melhorias.
          </p>
        </header>

        {/* Upload Section */}
        {!loading && !result && (
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors rounded-3xl p-16 flex flex-col items-center justify-center bg-white dark:bg-zinc-900 shadow-sm cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".pdf"
              onChange={handleFileChange}
            />
            <UploadCloud className="w-20 h-20 text-blue-500 mb-6" />
            <h3 className="text-3xl font-semibold mb-3 text-zinc-800 dark:text-zinc-200 text-center">
              {file ? file.name : "Arraste seu PDF aqui ou clique para selecionar"}
            </h3>
            <p className="text-zinc-500 dark:text-zinc-400 text-lg text-center">
              Apenas arquivos PDF são suportados pelo modelo atualmente.
            </p>
            {error && <p className="text-red-500 mt-4 font-medium text-lg">{error}</p>}
            {file && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleAnalyze();
                }}
                className="mt-10 px-10 py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold transition-colors shadow-lg hover:shadow-xl text-xl flex items-center gap-3"
              >
                Analisar Requisitos <Search className="w-6 h-6"/>
              </button>
            )}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="relative w-24 h-24 mb-10">
              <div className="absolute inset-0 border-4 border-blue-200/50 dark:border-blue-900/50 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-blue-600 dark:border-blue-500 rounded-full border-t-transparent animate-spin"></div>
            </div>
            <p className="text-3xl lg:text-4xl font-medium animate-pulse text-zinc-700 dark:text-zinc-300 tracking-tight text-center">
              {loadingMessages[messageIndex]}
            </p>
            <p className="text-zinc-500 mt-5 text-xl text-center">Isso pode levar alguns segundos com base nas 1 Milhão de Janelas de Token do Gemini.</p>
          </div>
        )}

        {/* Results Section */}
        {result && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <h2 className="text-3xl font-bold flex items-center gap-3">
                <Search className="w-8 h-8 text-blue-500" /> Resultado da Análise
              </h2>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={handleGeneratePDF}
                  className="flex-1 sm:flex-none px-6 py-3 text-sm font-semibold bg-white border border-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-full hover:bg-zinc-50 dark:hover:bg-zinc-700 transition shadow-sm flex items-center justify-center gap-2 text-zinc-700 dark:text-zinc-200"
                >
                  <Download className="w-5 h-5" /> Exportar PDF
                </button>
                <button
                  onClick={() => {
                    setResult(null);
                    setFile(null);
                  }}
                  className="flex-1 sm:flex-none px-6 py-3 text-sm font-semibold bg-blue-600 text-white rounded-full hover:bg-blue-700 transition shadow-sm"
                >
                  Nova Análise
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Resumo Card */}
              <div className="col-span-1 lg:col-span-2 bg-white dark:bg-zinc-900 p-8 md:p-10 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800">
                <h3 className="text-2xl font-bold mb-6 flex items-center gap-2 text-zinc-800 dark:text-zinc-100 uppercase tracking-wide">
                  <FileText className="w-6 h-6 text-blue-500" /> Resumo do Projeto
                </h3>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed text-lg lg:text-xl">
                  {result.projeto_resumo}
                </p>
              </div>

              {/* Funcionalidades */}
              <div className="bg-white dark:bg-zinc-900 p-8 md:p-10 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800">
                <h3 className="text-2xl font-bold mb-6 flex items-center gap-2 text-zinc-800 dark:text-zinc-100 uppercase tracking-wide">
                  <CheckCircle className="w-6 h-6 text-emerald-500" /> Funcionalidades
                </h3>
                <div className="flex flex-wrap gap-3">
                  {result.funcionalidades.map((func, i) => (
                    <span key={i} className="px-5 py-2.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800/50 rounded-xl text-[1.05rem] font-medium">
                      {func}
                    </span>
                  ))}
                </div>
              </div>

              {/* Sugestões UX */}
              <div className="bg-white dark:bg-zinc-900 p-8 md:p-10 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800">
                <h3 className="text-2xl font-bold mb-6 flex items-center gap-2 text-zinc-800 dark:text-zinc-100 uppercase tracking-wide">
                  <CheckCircle className="w-6 h-6 text-indigo-500" /> Sugestões de UX
                </h3>
                <div className="flex flex-wrap gap-3">
                  {result.sugestoes_ux?.map((sug, i) => (
                    <span key={i} className="px-5 py-2.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-800 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800/50 rounded-xl text-[1.05rem] font-medium">
                      {sug}
                    </span>
                  ))}
                </div>
              </div>

              {/* Sugestões de Melhoria (Gaps e Falhas) */}
              <div className="col-span-1 lg:col-span-2 bg-blue-50/50 dark:bg-blue-950/20 p-8 md:p-10 rounded-3xl border border-blue-200 dark:border-blue-900/50">
                <h3 className="text-2xl font-bold mb-6 flex items-center gap-2 text-blue-700 dark:text-blue-400 uppercase tracking-wide">
                  <Lightbulb className="w-6 h-6" /> Plano de Ação & Sugestões de Correção
                </h3>
                {result.sugestoes_melhoria && result.sugestoes_melhoria.length > 0 ? (
                  <ul className="space-y-4">
                    {result.sugestoes_melhoria.map((sug, i) => (
                      <li key={i} className="flex gap-4 items-start text-zinc-800 dark:text-zinc-200 p-6 bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-blue-100 dark:border-blue-900/40">
                        <span className="min-w-3 h-3 rounded-full bg-blue-500 mt-2"></span>
                        <span className="text-[1.1rem] leading-relaxed font-medium">{sug}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-zinc-600 dark:text-zinc-400 p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200">Nenhuma sugestão de melhoria identificada.</p>
                )}
              </div>

              {/* Falhas Lógicas */}
              <div className="col-span-1 lg:col-span-2 bg-red-50 dark:bg-red-950/20 p-8 md:p-10 rounded-3xl border border-red-200 dark:border-red-900/50">
                <h3 className="text-2xl font-bold mb-6 flex items-center gap-2 text-red-700 dark:text-red-400 uppercase tracking-wide">
                  <AlertTriangle className="w-6 h-6" /> Falhas Lógicas Identificadas
                </h3>
                {result.falhas_logicas && result.falhas_logicas.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {result.falhas_logicas.map((falha, i) => (
                      <div key={i} className="flex flex-col p-6 bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-red-100 dark:border-red-900/40 hover:shadow-md transition">
                        <p className="font-bold text-zinc-900 dark:text-zinc-100 mb-4 text-lg leading-relaxed">{falha.erro}</p>
                        
                        <div className="mt-auto grid grid-cols-2 gap-4 pt-4 border-t border-red-50 dark:border-red-900/30">
                          <p className="text-red-700 dark:text-red-400 text-sm font-medium">
                            <span className="block font-bold uppercase tracking-wide text-[0.7rem] text-red-500 mb-1">Seção / Título</span>
                            {falha.sessao || 'N/A'}
                          </p>
                          <p className="text-red-700 dark:text-red-400 text-sm font-medium">
                            <span className="block font-bold uppercase tracking-wide text-[0.7rem] text-red-500 mb-1">Localização</span>
                            Pág. {falha.pagina || '?'}
                          </p>
                          <p className="text-red-700 dark:text-red-400 text-sm col-span-2 font-medium">
                            <span className="block font-bold uppercase tracking-wide text-[0.7rem] text-red-500 mb-1">Impacto Previsto</span>
                            {falha.impacto}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-zinc-600 dark:text-zinc-400 p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">Nenhuma falha lógica gritante encontrada.</p>
                )}
              </div>

              {/* Gaps de Negócio */}
              <div className="col-span-1 lg:col-span-2 bg-orange-50 dark:bg-orange-950/20 p-8 md:p-10 rounded-3xl border border-orange-200 dark:border-orange-900/50">
                <h3 className="text-2xl font-bold mb-6 flex items-center gap-2 text-orange-700 dark:text-orange-400 uppercase tracking-wide">
                  <AlertTriangle className="w-6 h-6" /> Gaps de Negócio
                </h3>
                {result.gaps_negocio && result.gaps_negocio.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {result.gaps_negocio.map((g, i) => (
                      <div key={i} className="flex flex-col p-6 bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-orange-100 dark:border-orange-900/40 hover:shadow-md transition">
                        <p className="font-bold text-zinc-900 dark:text-zinc-100 mb-4 text-lg leading-relaxed">{g.gap}</p>
                        
                        <div className="mt-auto grid grid-cols-2 gap-4 pt-4 border-t border-orange-50 dark:border-orange-900/30">
                          <p className="text-orange-700 dark:text-orange-400 text-sm font-medium">
                            <span className="block font-bold uppercase tracking-wide text-[0.7rem] text-orange-500 mb-1">Seção / Título</span>
                            {g.sessao || 'N/A'}
                          </p>
                          <p className="text-orange-700 dark:text-orange-400 text-sm font-medium">
                            <span className="block font-bold uppercase tracking-wide text-[0.7rem] text-orange-500 mb-1">Localização</span>
                            Pág. {g.pagina || '?'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-zinc-600 dark:text-zinc-400 p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">Nenhum gap de negócio estrutural encontrado.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
