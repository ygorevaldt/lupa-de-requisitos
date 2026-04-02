import { AnalysisResult, FinalReport } from "./types";
import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { withRetry, safeParseJson } from "./utils";

export class Aggregator {
  private model: GenerativeModel;

  constructor(apiKey: string) {
    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({
      model: "gemini-2.5-pro",
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    });
  }

  async aggregate(results: AnalysisResult[]): Promise<FinalReport> {
    // Collect all data from agents
    const uniqueByJson = <T>(items: T[]) => {
      const seen = new Set<string>();
      return items.filter((item) => {
        const key = JSON.stringify(item);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };

    const functionalities = results
      .filter((r) => r.agent === "Functionalities")
      .flatMap((r) => r.funcionalidades || []);
    const uniqueFunctionalities = uniqueByJson(functionalities);

    const gaps = results.filter((r) => r.agent === "Business Rules").flatMap((r) => r.gaps || []);
    const uniqueGaps = uniqueByJson(gaps);

    const integracoes = results.filter((r) => r.agent === "Integrations").flatMap((r) => r.integracoes || []);
    const uniqueIntegracoes = uniqueByJson(integracoes);

    const problemasUX = results.filter((r) => r.agent === "Exceptions").flatMap((r) => r.problemas_ux || []);
    const uniqueProblemasUX = uniqueByJson(problemasUX);

    const conflitos = results.filter((r) => r.agent === "Conflicts").flatMap((r) => r.conflitos || []);
    const uniqueConflitos = uniqueByJson(conflitos);

    const crossChunkFindings = results
      .filter((r) => r.agent === "CrossChunk")
      .flatMap((r) => r.conflitos_cruzados || []);
    const uniqueCrossChunkFindings = uniqueByJson(crossChunkFindings);

    // Final prompt to synthesize everything into the expected format
    const prompt = `
      Você é um Arquiteto de Soluções Sênior responsável por gerar um relatório técnico completo para o BP refinar um documento de requisitos.
      Sua tarefa é consolidar os resultados parciais de diversos agentes de análise em um único relatório acionável, preciso e rico em contexto.
      
      DADOS COLETADOS:
      Funcionalidades: ${JSON.stringify(uniqueFunctionalities)}
      Gaps de Regra de Negócio: ${JSON.stringify(uniqueGaps)}
      Integrações: ${JSON.stringify(uniqueIntegracoes)}
      Problemas de UX/Exceções: ${JSON.stringify(uniqueProblemasUX)}
      Conflitos/Inconsistências: ${JSON.stringify(uniqueConflitos)}
      Conflitos Cruzados entre partes do documento: ${JSON.stringify(uniqueCrossChunkFindings)}

      OBJETIVOS PRINCIPAIS:
      1. Resumir o propósito do projeto e o valor esperado.
      2. Consolidar funcionalidades com título, descrição curta e referência de página.
      3. Identificar todos os gaps RN/RF, estados omitidos e comportamentos não cobertos.
      4. Classificar cada gap como RN ou RF sempre que possível e use isso para as métricas.
      5. Destacar falhas lógicas, inconsistências e impactos de produção.
      6. Listar integrações e dependências com situação de especificação, risco e impacto.
      7. Gerar sugestões claras e específicas para o BP corrigir o documento e reduzir bugs em produção.

      IMPORTANTE:
      - Utilize as páginas e descrições sempre que disponíveis.
      - Priorize itens que podem gerar quebra em produção, perda de dados ou comportamento incorreto.
      - Se um problema estiver relacionado a múltiplos pontos do documento, apresente o contexto mais relevante.
      - Se os agentes forneceram somente fragmentos, use o conjunto dos resultados para inferir problemas adicionais relacionados.
      - Retorne estritamente um JSON válido e nada mais.

      FORMATO OBRIGATÓRIO (JSON):
      {
        "projeto_resumo": "...",
        "funcionalidades_principais": ["..."],
        "metricas_qualidade": {
          "rn_satisfatorias": 0,
          "rn_com_gaps": 0,
          "rf_satisfatorios": 0,
          "rf_com_gaps": 0
        },
        "analise_integridade": "Nota de 0 a 10 com justificativa detalhada",
        "falhas_logicas_e_excecoes": [
          {
            "problema": "...",
            "impacto": "Alto/Médio/Baixo",
            "sessao": "...",
            "pagina": "...",
            "sugestao_correcao": "..."
          }
        ],
        "integracoes_e_dependencias": [
          {
            "sistema": "...",
            "status_especificacao": "Completo" | "Incompleto" | "Ausente",
            "detalhe": "...",
            "pagina": "...",
            "impacto": "..."
          }
        ],
        "gaps_regra_negocio": [
          {
            "regra": "...",
            "cenario_omitido": "...",
            "risco": "...",
            "pagina": "...",
            "sugestao_correcao": "..."
          }
        ],
        "mensagens_e_estados_ausentes": ["..."],
      "conflitos_cruzados": [
        {
          "descricao": "...",
          "pagina_referencia": "...",
          "impacto": "Alto" | "Médio" | "Baixo" | "Não Identificado",
          "tipo": "Contradição" | "Ambiguidade" | "Brecha de Cobertura" | "Inconsistência" | "Dependência Omitida",
          "sugestao_correcao": "..."
        }
      ],
      }
    `;

    const result = await withRetry(() => this.model.generateContent(prompt));
    const response = await result.response;
    const text = response.text().trim();
    const parsed = safeParseJson<Partial<FinalReport>>(text, "aggregator");

    if (!parsed || typeof parsed !== "object") {
      console.error("Error parsing final aggregation JSON or invalid report object.", { text: text.slice(0, 1000) });
      return {
        projeto_resumo: "Erro na consolidação",
        funcionalidades_principais: functionalities.slice(0, 10),
        metricas_qualidade: { rn_satisfatorias: 0, rn_com_gaps: 0, rf_satisfatorios: 0, rf_com_gaps: 0 },
        analise_integridade: "0 - Falha sistêmica",
        falhas_logicas_e_excecoes: [],
        integracoes_e_dependencias: [],
        gaps_regra_negocio: [],
        mensagens_e_estados_ausentes: problemasUX.slice(0, 10),
        conflitos_cruzados: [],
        conclusao_tecnica: "Não foi possível gerar um parecer automático.",
      };
    }

    return {
      projeto_resumo: String(parsed.projeto_resumo || "Relatório parcial gerado devido a erro de síntese."),
      funcionalidades_principais: Array.isArray(parsed.funcionalidades_principais)
        ? parsed.funcionalidades_principais
        : functionalities.slice(0, 10),
      metricas_qualidade: parsed.metricas_qualidade || {
        rn_satisfatorias: 0,
        rn_com_gaps: 0,
        rf_satisfatorios: 0,
        rf_com_gaps: 0,
      },
      analise_integridade: String(parsed.analise_integridade || "Não foi possível gerar a análise de integridade."),
      falhas_logicas_e_excecoes: Array.isArray(parsed.falhas_logicas_e_excecoes)
        ? parsed.falhas_logicas_e_excecoes
        : [],
      integracoes_e_dependencias: Array.isArray(parsed.integracoes_e_dependencias)
        ? parsed.integracoes_e_dependencias
        : [],
      gaps_regra_negocio: Array.isArray(parsed.gaps_regra_negocio) ? parsed.gaps_regra_negocio : [],
      mensagens_e_estados_ausentes: Array.isArray(parsed.mensagens_e_estados_ausentes)
        ? parsed.mensagens_e_estados_ausentes
        : problemasUX.slice(0, 10),
      conflitos_cruzados: Array.isArray(parsed.conflitos_cruzados) ? parsed.conflitos_cruzados : [],
      conclusao_tecnica: String(parsed.conclusao_tecnica || "Não foi possível gerar um parecer automático."),
    };
  }
}
