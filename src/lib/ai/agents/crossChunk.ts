import { AnalysisResult, Chunk } from "../types";
import { GoogleGenerativeAI, GenerativeModel, SchemaType, Schema } from "@google/generative-ai";
import { withRetry, safeParseJson } from "../utils";

const crossChunkSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    conflitos_cruzados: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          descricao: { type: SchemaType.STRING, description: "Descrição do conflito entre diferentes partes do documento" },
          pagina_referencia: { type: SchemaType.STRING, description: "Páginas envolvidas (ex: 2 e 15)" },
          impacto: { 
            type: SchemaType.STRING, 
            enum: ["Alto", "Médio", "Baixo"],
            format: "enum",
            description: "Gravidade do conflito global" 
          },
          tipo: { 
            type: SchemaType.STRING, 
            enum: ["Contradição", "Ambiguidade", "Inconsistência"],
            format: "enum",
            description: "Natureza do problema" 
          },
          sugestao_correcao: { type: SchemaType.STRING, description: "Sugestão para unificar os requisitos" }
        },
        required: ["descricao", "pagina_referencia", "impacto", "tipo", "sugestao_correcao"]
      }
    }
  },
  required: ["conflitos_cruzados"]
};

export class CrossChunkAgent {
  name = "CrossChunk";
  private model: GenerativeModel;
  private usingCache = false;

  constructor(apiKey: string) {
    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({
      model: "gemini-2.5-pro",
      systemInstruction: "Você é um Auditor de Requisitos e Arquiteto de Sistemas Sênior. Sua tarefa única e exclusiva é identificar CONFLITOS CRUZADOS E INCONSISTÊNCIAS GLOBAIS entre diferentes partes de um documento.",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: crossChunkSchema,
        temperature: 0.1,
      },
    });
  }

  setModel(model: GenerativeModel) {
    this.model = model;
    this.usingCache = true;
  }

  async analyzeDocument(chunks: Chunk[], results: AnalysisResult[]): Promise<AnalysisResult> {
    const prompt = `
      Analise as inconsistências globais e conflitos cruzados no documento com base nos dados abaixo:
      
      CONTEXTO DO DOCUMENTO:
      ${this.usingCache ? "(O conteúdo completo está disponível no contexto de cache)" : "CHUNKS: " + JSON.stringify(chunks.map(c => ({ id: c.id, pages: `${c.startPage}-${c.endPage}`, content: c.content })))}

      RESULTADOS PARCIAIS DOS AGENTES:
      Funcionalidades: ${JSON.stringify(results.filter((r) => r.agent === "Functionalities").flatMap((r) => r.funcionalidades || []))}
      Gaps de Regra de Negócio: ${JSON.stringify(results.filter((r) => r.agent === "Business Rules").flatMap((r) => r.gaps || []))}
      Integrações: ${JSON.stringify(results.filter((r) => r.agent === "Integrations").flatMap((r) => r.integracoes || []))}
      Problemas de UX/Exceções: ${JSON.stringify(results.filter((r) => r.agent === "Exceptions").flatMap((r) => r.problemas_ux || []))}
      Conflitos: ${JSON.stringify(results.filter((r) => r.agent === "Conflicts").flatMap((r) => r.conflitos || []))}
    `;

    let rawText = "";
    try {
      const result = await withRetry(() => this.model.generateContent(prompt));
      const response = await result.response;
      rawText = response.text().trim();
      const parsed = safeParseJson<{ conflitos_cruzados?: any[] }>(rawText, "cross-chunk");

      if (!parsed || !parsed.conflitos_cruzados || !Array.isArray(parsed.conflitos_cruzados)) {
        throw new Error("Estrutura JSON inválida ou vazia recebida do modelo.");
      }

      return { conflitos_cruzados: parsed.conflitos_cruzados };
    } catch (error) {
      console.error(`[CrossChunkAgent] Erro de Parse na análise cruzada:`, {
        error: error instanceof Error ? error.message : "Erro desconhecido",
        rawResponse: rawText,
      });
      return { conflitos_cruzados: [] };
    }
  }
}
