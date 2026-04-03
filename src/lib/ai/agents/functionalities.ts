import { Agent, AnalysisResult, Chunk } from "../types";
import { GoogleGenerativeAI, GenerativeModel, SchemaType, Schema } from "@google/generative-ai";
import { withRetry, safeParseJson } from "../utils";

const functionalitiesSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    funcionalidades: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          title: { type: SchemaType.STRING, description: "Título curto da funcionalidade" },
          description: { type: SchemaType.STRING, description: "Explicação detalhada do comportamento" },
          page_reference: { type: SchemaType.STRING, description: "Número da página" },
          type: { 
            type: SchemaType.STRING, 
            enum: ["functionality", "validation"],
            format: "enum",
            description: "Tipo de item extraído" 
          }
        },
        required: ["title", "description", "page_reference", "type"]
      }
    }
  },
  required: ["funcionalidades"]
};

export class FunctionalitiesAgent implements Agent {
  name = "Functionalities";
  private model: GenerativeModel;
  private usingCache = false;

  constructor(apiKey: string) {
    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: "Você é um Analista de Requisitos Sênior. Sua tarefa única e exclusiva é extrair FUNCIONALIDADES PRINCIPAIS de documentos de requisitos.",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: functionalitiesSchema,
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
      Extraia as funcionalidades e validações principais do seguinte conteúdo (Páginas ${chunk.startPage} a ${chunk.endPage}):
      
      CONTEÚDO:
      ${this.usingCache ? "(O conteúdo completo está disponível no contexto de cache)" : chunk.content}
    `;

    let rawText = "";
    try {
      const result = await withRetry(() => this.model.generateContent(prompt));
      const response = await result.response;
      rawText = response.text().trim();
      const parsed = safeParseJson<{ funcionalidades?: any[] }>(rawText, "functionalities");

      if (!parsed || !parsed.funcionalidades || !Array.isArray(parsed.funcionalidades)) {
        throw new Error("Estrutura JSON inválida ou vazia recebida do modelo.");
      }

      return { funcionalidades: parsed.funcionalidades };
    } catch (error) {
      console.error(`[FunctionalitiesAgent] Erro de Parse nas páginas ${chunk.startPage}-${chunk.endPage}:`, {
        error: error instanceof Error ? error.message : "Erro desconhecido",
        rawResponse: rawText
      });
      return { funcionalidades: [] };
    }
  }
}
