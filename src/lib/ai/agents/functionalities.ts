import { Agent, AnalysisResult, Chunk } from "../types";
import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { withRetry, safeParseJson } from "../utils";

export class FunctionalitiesAgent implements Agent {
  name = "Functionalities";
  private model: GenerativeModel;

  constructor(apiKey: string) {
    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    });
  }

  async analyze(chunk: Chunk): Promise<AnalysisResult> {
    const prompt = `
      Você é um Analista de Requisitos Sênior com foco em documentos que serão corrigidos pelo BP.
      Seu objetivo é identificar TODAS as funcionalidades, comportamentos e validações esperadas descritas no texto abaixo.
      
      Regras:
      1. Liste apenas funcionalidades explicitamente descritas ou exigidas pelo contexto.
      2. Para cada funcionalidade, registre título, descrição e referência de página.
      3. Diferencie funcionalidades principais de validações e fluxos de exceção importantes.
      4. Seja completo e preciso, apontando qualquer comportamento que pode impactar a entrega do produto.
      5. Retorne no formato JSON sugerido.

      Texto do Documento (Páginas ${chunk.startPage} a ${chunk.endPage}):
      ${chunk.content}

      Retorne estritamente um JSON:
      {
        "funcionalidades": [
          {
            "titulo": string,
            "descricao": string,
            "pagina": string,
            "tipo": "Primária" | "Secundária" | "Validação"
          }
        ]
      }
    `;

    const result = await withRetry(() => this.model.generateContent(prompt));
    const response = await result.response;
    const text = response.text().trim();
    const parsed = safeParseJson<{ funcionalidades?: any[] }>(text, "functionalities");

    if (!parsed || !Array.isArray(parsed.funcionalidades)) {
      console.error("Error parsing functionalities JSON or missing array.", { text: text.slice(0, 1000) });
      return { funcionalidades: [] };
    }

    return { funcionalidades: parsed.funcionalidades };
  }
}
