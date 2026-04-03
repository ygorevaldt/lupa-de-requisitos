import { Agent, AnalysisResult, Chunk } from "../types";
import { GoogleGenerativeAI, GenerativeModel, SchemaType, Schema } from "@google/generative-ai";
import { withRetry, safeParseJson } from "../utils";

const conflictsSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    conflitos: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          problema: { type: SchemaType.STRING, description: "O que está em conflito?" },
          gravidade: { 
            type: SchemaType.STRING, 
            enum: ["Crítica", "Média", "Baixa"],
            format: "enum",
            description: "Nível de severidade do conflito" 
          },
          pagina: { type: SchemaType.STRING, description: "Número da página de referência" },
          sugestao_correcao: { type: SchemaType.STRING, description: "Como o BP deve unificar a regra" }
        },
        required: ["problema", "gravidade", "pagina", "sugestao_correcao"]
      }
    }
  },
  required: ["conflitos"]
};

export class ConflictsAgent implements Agent {
  name = "Conflicts";
  private model: GenerativeModel;
  private usingCache = false;

  constructor(apiKey: string) {
    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: "Você é um Auditor de Sistemas e Especialista em Garantia de Qualidade. Sua tarefa única e exclusiva é identificar CONFLITOS E CONTRADIÇÕES em documentos de requisitos.",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: conflictsSchema,
        temperature: 0.1,
      },
    });
  }

  setModel(model: GenerativeModel) {
    this.model = model;
    this.usingCache = true;
  }

  async analyze(chunk: Chunk): Promise<AnalysisResult> {
    const prompt = `
      Analise o seguinte conteúdo (Páginas ${chunk.startPage} a ${chunk.endPage}) em busca de conflitos e contradições:
      
      CONTEÚDO:
      ${this.usingCache ? "(O conteúdo completo está disponível no contexto de cache)" : chunk.content}
    `;

    let rawText = "";
    try {
      const result = await withRetry(() => this.model.generateContent(prompt));
      const response = await result.response;
      rawText = response.text().trim();
      const parsed = safeParseJson<{ conflitos?: any[] }>(rawText, "conflicts");

      if (!parsed || !parsed.conflitos || !Array.isArray(parsed.conflitos)) {
        throw new Error("Estrutura JSON inválida ou vazia recebida do modelo.");
      }

      return { conflitos: parsed.conflitos };
    } catch (error) {
      console.error(`[ConflictsAgent] Erro de Parse nas páginas ${chunk.startPage}-${chunk.endPage}:`, {
        error: error instanceof Error ? error.message : "Erro desconhecido",
        rawResponse: rawText
      });
      return { conflitos: [] };
    }
  }
}
