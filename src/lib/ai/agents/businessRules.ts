import { Agent, AnalysisResult, Chunk } from "../types";
import { GoogleGenerativeAI, GenerativeModel, SchemaType, Schema, GenerationConfig } from "@google/generative-ai";
import { withRetry, safeParseJson } from "../utils";

const businessRulesSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    gaps: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          regra: { type: SchemaType.STRING, description: "Descrição da regra impactada" },
          cenario_omitido: { type: SchemaType.STRING, description: "O que não foi coberto?" },
          risco: { type: SchemaType.STRING, description: "Impacto no negócio" },
          pagina: { type: SchemaType.STRING, description: "Número da página" },
          sugestao_correcao: { type: SchemaType.STRING, description: "Sugestão de texto para o BP" }
        },
        required: ["regra", "cenario_omitido", "risco", "pagina", "sugestao_correcao"]
      }
    }
  },
  required: ["gaps"]
};

const GENERATION_CONFIG: GenerationConfig = {
  responseMimeType: "application/json",
  responseSchema: businessRulesSchema,
  temperature: 0.1,
};

export class BusinessRulesAgent implements Agent {
  name = "Business Rules";
  private model: GenerativeModel;
  private usingCache = false;

  constructor(apiKey: string) {
    const genAI = new GoogleGenerativeAI(apiKey);

    this.model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: "Você é um Consultor de Processos e Analista de Negócios Sénior. Sua tarefa única e exclusiva é identificar GAPS DE REGRA DE NEGÓCIO em documentos de requisitos. Responda APENAS com JSON puro e válido, sem texto explicativo, sem markdown, sem formatação adicional.",
      generationConfig: GENERATION_CONFIG,
    });
  }

  setModel(model: GenerativeModel) {
    this.model = model;
    this.usingCache = true;
  }

  async analyze(chunk: Chunk): Promise<AnalysisResult> {
    const prompt = `
      Analisa o seguinte conteúdo (Páginas ${chunk.startPage} a ${chunk.endPage}):

      CONTEÚDO:
      ${this.usingCache ? "(O conteúdo completo está disponível no contexto de cache)" : chunk.content}
    `;

    let rawText = "";
    try {
      const result = await withRetry(() =>
        this.model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: GENERATION_CONFIG,
        })
      );
      rawText = result.response.text().trim();

      const parsed = safeParseJson<{ gaps?: any[] }>(rawText, "business-rules");

      if (!parsed || !parsed.gaps || !Array.isArray(parsed.gaps)) {
        throw new Error("Estrutura JSON inválida ou vazia recebida do modelo.");
      }

      return { gaps: parsed.gaps };
    } catch (error) {
      console.error(`[BusinessRulesAgent] Erro de Parse nas páginas ${chunk.startPage}-${chunk.endPage}:`, {
        error: error instanceof Error ? error.message : "Erro desconhecido",
        rawResponse: rawText
      });

      return { gaps: [] };
    }
  }
}