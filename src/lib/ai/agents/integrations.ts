import { Agent, AnalysisResult, Chunk } from "../types";
import { GoogleGenerativeAI, GenerativeModel, SchemaType, Schema } from "@google/generative-ai";
import { withRetry, safeParseJson } from "../utils";

const integrationsSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    integracoes: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          sistema: { type: SchemaType.STRING, description: "Nome do sistema ou serviço integrado" },
          status_especificacao: { 
            type: SchemaType.STRING, 
            enum: ["Completo", "Incompleto", "Ausente"],
            format: "enum",
            description: "Grau de detalhamento da integração" 
          },
          detalhe: { type: SchemaType.STRING, description: "O que é integrado? (Processo, API, Banco de Dados)" },
          pagina: { type: SchemaType.STRING, description: "Número da página" },
          impacto: { type: SchemaType.STRING, description: "Risco técnico se faltar detalhamento" }
        },
        required: ["sistema", "status_especificacao", "detalhe", "pagina", "impacto"]
      }
    }
  },
  required: ["integracoes"]
};

export class IntegrationsAgent implements Agent {
  name = "Integrations";
  private model: GenerativeModel;
  private usingCache = false;

  constructor(apiKey: string) {
    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: "Você é um Arquiteto de Software Especialista em Integrações. Sua tarefa única e exclusiva é extrair SISTEMAS, APIs e DEPENDÊNCIAS de documentos de requisitos.",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: integrationsSchema,
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
      Extraia as integrações e dependências do seguinte conteúdo (Páginas ${chunk.startPage} a ${chunk.endPage}):
      
      CONTEÚDO:
      ${this.usingCache ? "(O conteúdo completo está disponível no contexto de cache)" : chunk.content}
    `;

    let rawText = "";
    try {
      const result = await withRetry(() => this.model.generateContent(prompt));
      const response = await result.response;
      rawText = response.text().trim();
      const parsed = safeParseJson<{ integracoes?: any[] }>(rawText, "integrations");

      if (!parsed || !parsed.integracoes || !Array.isArray(parsed.integracoes)) {
        throw new Error("Estrutura JSON inválida ou vazia recebida do modelo.");
      }

      return { integracoes: parsed.integracoes };
    } catch (error) {
      console.error(`[IntegrationsAgent] Erro de Parse nas páginas ${chunk.startPage}-${chunk.endPage}:`, {
        error: error instanceof Error ? error.message : "Erro desconhecido",
        rawResponse: rawText
      });
      return { integracoes: [] };
    }
  }
}
