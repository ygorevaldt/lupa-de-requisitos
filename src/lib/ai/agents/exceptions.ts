import { Agent, AnalysisResult, Chunk } from "../types";
import { GoogleGenerativeAI, GenerativeModel, SchemaType, Schema } from "@google/generative-ai";
import { withRetry, safeParseJson } from "../utils";

const exceptionsSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    problemas_ux: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          problema: { type: SchemaType.STRING, description: "O que está faltando? (ex: feedback de erro, empty state)" },
          impacto: { 
            type: SchemaType.STRING, 
            enum: ["Alto", "Médio", "Baixo"],
            format: "enum",
            description: "Impacto no negócio/usuário" 
          },
          sessao: { type: SchemaType.STRING, description: "Nome da seção ou tela impactada" },
          pagina: { type: SchemaType.STRING, description: "Número da página" },
          sugestao_correcao: { type: SchemaType.STRING, description: "O que deve ser adicionado no documento" }
        },
        required: ["problema", "impacto", "sessao", "pagina", "sugestao_correcao"]
      }
    }
  },
  required: ["problemas_ux"]
};

export class ExceptionsAgent implements Agent {
  name = "Exceptions";
  private model: GenerativeModel;
  private usingCache = false;

  constructor(apiKey: string) {
    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: "Você é um Especialista em UX e QA Sênior. Sua tarefa única e exclusiva é identificar ESTADOS DE ERRO E EXCEÇÕES AUSENTES em documentos de requisitos.",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: exceptionsSchema,
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
      Analise o seguinte conteúdo (Páginas ${chunk.startPage} a ${chunk.endPage}) em busca de estados de erro e exceções ausentes:
      
      CONTEÚDO:
      ${this.usingCache ? "(O conteúdo completo está disponível no contexto de cache)" : chunk.content}
    `;

    let rawText = "";
    try {
      const result = await withRetry(() => this.model.generateContent(prompt));
      const response = await result.response;
      rawText = response.text().trim();
      const parsed = safeParseJson<{ problemas_ux?: any[] }>(rawText, "exceptions");

      if (!parsed || !parsed.problemas_ux || !Array.isArray(parsed.problemas_ux)) {
        throw new Error("Estrutura JSON inválida ou vazia recebida do modelo.");
      }

      return { problemas_ux: parsed.problemas_ux };
    } catch (error) {
      console.error(`[ExceptionsAgent] Erro de Parse nas páginas ${chunk.startPage}-${chunk.endPage}:`, {
        error: error instanceof Error ? error.message : "Erro desconhecido",
        rawResponse: rawText
      });
      return { problemas_ux: [] };
    }
  }
}
