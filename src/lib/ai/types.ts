import { GenerativeModel } from "@google/generative-ai";

export interface AnalysisResult {
  [key: string]: any;
}

export interface Chunk {
  id: string;
  startPage: number;
  endPage: number;
  content: string;
}

export interface Agent {
  name: string;
  analyze(chunk: Chunk): Promise<AnalysisResult>;
  setModel?(model: GenerativeModel): void;
}

export interface PipelineStep {
  agent: Agent;
}

export interface FinalReport {
  projeto_resumo: string;
  funcionalidades_principais: string[];
  metricas_qualidade: {
    rn_satisfatorias: number;
    rn_com_gaps: number;
    rf_satisfatorios: number;
    rf_com_gaps: number;
  };
  analise_integridade: string;
  falhas_logicas_e_excecoes: Array<{
    problema: string;
    impacto: string;
    sessao: string;
    pagina: string;
    sugestao_correcao: string;
  }>;
  integracoes_e_dependencias: Array<{
    sistema: string;
    status_especificacao: string;
    detalhe: string;
    pagina: string;
    impacto: string;
  }>;
  gaps_regra_negocio: Array<{
    regra: string;
    cenario_omitido: string;
    risco: string;
    pagina: string;
    sugestao_correcao: string;
  }>;
  mensagens_e_estados_ausentes: string[];
  conflitos_cruzados: Array<{
    descricao: string;
    pagina_referencia: string;
    impacto: string;
    tipo: string;
    sugestao_correcao: string;
  }>;
  conclusao_tecnica: string;
}
