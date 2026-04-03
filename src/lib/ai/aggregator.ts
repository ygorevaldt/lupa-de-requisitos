import { AnalysisResult, FinalReport } from "./types";
import { GoogleGenerativeAI, GenerativeModel, SchemaType, Schema } from "@google/generative-ai";
import { withRetry, safeParseJson } from "./utils";

const aggregatorSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    projeto_resumo: { type: SchemaType.STRING, description: "Resumo executivo do projeto" },
    funcionalidades_principais: { 
      type: SchemaType.ARRAY, 
      items: { type: SchemaType.STRING },
      description: "Lista de títulos das funcionalidades mais importantes"
    },
    metricas_qualidade: {
      type: SchemaType.OBJECT,
      properties: {
        rn_satisfatorias: { type: SchemaType.NUMBER, description: "Contagem de Regras de Negócio sem problemas" },
        rn_com_gaps: { type: SchemaType.NUMBER, description: "Contagem de Regras de Negócio com gaps detectados" },
        rf_satisfatorios: { type: SchemaType.NUMBER, description: "Contagem de Requisitos Funcionais sem problemas" },
        rf_com_gaps: { type: SchemaType.NUMBER, description: "Contagem de Requisitos Funcionais com falhas de lógica/exceção" }
      },
      required: ["rn_satisfatorias", "rn_com_gaps", "rf_satisfatorios", "rf_com_gaps"]
    },
    analise_integridade: { type: SchemaType.STRING, description: "Avaliação técnica sobre a coesão do documento" },
    falhas_logicas_e_excecoes: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          problema: { type: SchemaType.STRING },
          impacto: { type: SchemaType.STRING },
          sessao: { type: SchemaType.STRING },
          pagina: { type: SchemaType.STRING },
          sugestao_correcao: { type: SchemaType.STRING }
        },
        required: ["problema", "impacto", "sessao", "pagina", "sugestao_correcao"]
      }
    },
    integracoes_e_dependencias: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          sistema: { type: SchemaType.STRING },
          status_especificacao: { type: SchemaType.STRING },
          detalhe: { type: SchemaType.STRING },
          pagina: { type: SchemaType.STRING },
          impacto: { type: SchemaType.STRING }
        },
        required: ["sistema", "status_especificacao", "detalhe", "pagina", "impacto"]
      }
    },
    gaps_regra_negocio: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          regra: { type: SchemaType.STRING },
          cenario_omitido: { type: SchemaType.STRING },
          risco: { type: SchemaType.STRING },
          pagina: { type: SchemaType.STRING },
          sugestao_correcao: { type: SchemaType.STRING }
        },
        required: ["regra", "cenario_omitido", "risco", "pagina", "sugestao_correcao"]
      }
    },
    mensagens_e_estados_ausentes: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: "Lista de feedbacks ou estados de erro que faltam no sistema"
    },
    conflitos_cruzados: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          descricao: { type: SchemaType.STRING },
          pagina_referencia: { type: SchemaType.STRING },
          impacto: { type: SchemaType.STRING },
          tipo: { type: SchemaType.STRING },
          sugestao_correcao: { type: SchemaType.STRING }
        },
        required: ["descricao", "pagina_referencia", "impacto", "tipo", "sugestao_correcao"]
      }
    },
    conclusao_tecnica: { type: SchemaType.STRING, description: "Parecer técnico final e recomendações" }
  },
  required: [
    "projeto_resumo", 
    "funcionalidades_principais", 
    "metricas_qualidade", 
    "analise_integridade", 
    "falhas_logicas_e_excecoes", 
    "integracoes_e_dependencias", 
    "gaps_regra_negocio", 
    "mensagens_e_estados_ausentes", 
    "conflitos_cruzados", 
    "conclusao_tecnica"
  ]
};

export class Aggregator {
  private model: GenerativeModel;

  constructor(apiKey: string) {
    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({
      model: "gemini-2.5-pro",
      systemInstruction: "Você é um Arquiteto de Soluções Sênior. Sua tarefa é consolidar os resultados de diversos agentes em um único RELATÓRIO TÉCNICO estruturado.",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: aggregatorSchema,
        temperature: 0.1,
      },
    });
  }

  setModel(model: GenerativeModel) {
    this.model = model;
  }

  async aggregate(results: AnalysisResult[]): Promise<FinalReport> {
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

    const prompt = `
      Consolide os seguintes dados coletados pelos agentes em um relatório técnico final:
      
      DADOS COLETADOS:
      Funcionalidades: ${JSON.stringify(uniqueFunctionalities)}
      Gaps de Regra de Negócio: ${JSON.stringify(uniqueGaps)}
      Integrações: ${JSON.stringify(uniqueIntegracoes)}
      Problemas de UX/Exceções: ${JSON.stringify(uniqueProblemasUX)}
      Conflitos/Inconsistências Locais: ${JSON.stringify(uniqueConflitos)}
      Conflitos Cruzados: ${JSON.stringify(uniqueCrossChunkFindings)}
    `;

    let rawText = "";
    try {
      const result = await withRetry(() => this.model.generateContent(prompt));
      const response = await result.response;
      rawText = response.text().trim();
      const parsed = safeParseJson<FinalReport>(rawText, "aggregator");

      if (!parsed) {
        throw new Error("Falha ao analisar o JSON do agregador.");
      }

      // Ensure data fidelity by merging back the original unique findings if the model omitted them
      return {
        ...parsed,
        funcionalidades_principais: parsed.funcionalidades_principais?.length ? parsed.funcionalidades_principais : uniqueFunctionalities.map(f => f.title || "Sem título"),
        falhas_logicas_e_excecoes: parsed.falhas_logicas_e_excecoes?.length ? parsed.falhas_logicas_e_excecoes : uniqueProblemasUX,
        integracoes_e_dependencias: parsed.integracoes_e_dependencias?.length ? parsed.integracoes_e_dependencias : uniqueIntegracoes,
        gaps_regra_negocio: parsed.gaps_regra_negocio?.length ? parsed.gaps_regra_negocio : uniqueGaps,
        conflitos_cruzados: parsed.conflitos_cruzados?.length ? parsed.conflitos_cruzados : uniqueCrossChunkFindings,
      };
    } catch (error) {
      console.error("[Aggregator] Erro ao consolidar relatório final:", {
        error: error instanceof Error ? error.message : "Erro desconhecido",
        rawResponse: rawText
      });
      
      // Full Fallback
      return {
        projeto_resumo: "Erro na consolidação automática.",
        funcionalidades_principais: uniqueFunctionalities.map(f => f.title || "Sem título"),
        metricas_qualidade: { rn_satisfatorias: 0, rn_com_gaps: uniqueGaps.length, rf_satisfatorios: 0, rf_com_gaps: uniqueProblemasUX.length },
        analise_integridade: "Não foi possível sintetizar a inteligência.",
        falhas_logicas_e_excecoes: uniqueProblemasUX,
        integracoes_e_dependencias: uniqueIntegracoes,
        gaps_regra_negocio: uniqueGaps,
        mensagens_e_estados_ausentes: uniqueProblemasUX.map((p: any) => p.problema || "Não identificado"),
        conflitos_cruzados: uniqueCrossChunkFindings,
        conclusao_tecnica: "O modelo de agregação falhou ao processar a resposta. Verifique os dados detalhados acima.",
      };
    }
  }
}
