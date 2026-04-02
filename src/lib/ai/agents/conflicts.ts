import { Agent, AnalysisResult, Chunk } from "../types";
import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { withRetry, safeParseJson } from "../utils";

export class ConflictsAgent implements Agent {
  name = "Conflicts";
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
      Você é um Auditor de Sistemas e Especialista em Garantia de Qualidade.
      Seu objetivo é identificar contradições, ambiguidades ou conflitos lógicos no texto abaixo.
      
      Regras:
      1. Procure por trechos que descrevem regras diferentes para o mesmo fluxo.
      2. Identifique termos ou condições ambíguas que podem gerar interpretações variadas.
      3. Aponte conflitos entre requisitos funcionais, regras de negócio e exceções.
      4. Para cada conflito, indique gravidade, página e recomendação de correção.
      5. Retorne no formato JSON sugerido.

      Texto do Documento (Páginas ${chunk.startPage} a ${chunk.endPage}):
      ${chunk.content}

      Retorne estritamente um JSON:
      {
        "conflitos": [
          {
            "descricao": string,
            "tipo": "Contradição" | "Ambiguidade" | "Inconsistência",
            "pagina": string,
            "gravidade": "Alto" | "Médio" | "Baixo",
            "recomendacao": string
          }
        ]
      }
    `;

    const result = await withRetry(() => this.model.generateContent(prompt));
    const response = await result.response;
    const text = response.text().trim();
    const parsed = safeParseJson<{ conflitos?: any[] }>(text, "conflicts");

    if (!parsed || !Array.isArray(parsed.conflitos)) {
      console.error("Error parsing conflicts JSON or missing conflitos array.", { text: text.slice(0, 1000) });
      return { conflitos: [] };
    }

    return { conflitos: parsed.conflitos };
  }
}
