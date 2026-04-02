import { Agent, AnalysisResult, Chunk } from "../types";
import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { withRetry, safeParseJson } from "../utils";

export class ExceptionsAgent implements Agent {
  name = "Exceptions";
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
      Você é um Especialista em UX e QA Sênior.
      Seu objetivo é identificar a ausência de tratamentos de erro, estados vazios (empty states), feedbacks e mensagens de sucesso/erro no texto abaixo.
      
      Regras:
      1. Procure por ações e fluxos que não definem o que acontece em caso de erro ou resultados nulos.
      2. Identifique listagens que não contemplam o caso de "nenhum registro encontrado".
      3. Aponte falta de mensagens de confirmação, sucesso ou validação de entrada.
      4. Para cada item, indique o tipo, impacto e sugestão concreta.
      5. Retorne no formato JSON sugerido.

      Texto do Documento (Páginas ${chunk.startPage} a ${chunk.endPage}):
      ${chunk.content}

      Retorne estritamente um JSON:
      {
        "problemas_ux": [
          {
            "descricao": string,
            "tipo": "Erro" | "Estado Vazio" | "Feedback Ausente" | "Confirmação Ausente",
            "pagina": string,
            "impacto": string,
            "sugestao": string
          }
        ]
      }
    `;

    const result = await withRetry(() => this.model.generateContent(prompt));
    const response = await result.response;
    const text = response.text().trim();
    const parsed = safeParseJson<{ problemas_ux?: any[] }>(text, "exceptions");

    if (!parsed || !Array.isArray(parsed.problemas_ux)) {
      console.error("Error parsing exceptions JSON or missing problemas_ux array.", { text: text.slice(0, 1000) });
      return { problemas_ux: [] };
    }

    return { problemas_ux: parsed.problemas_ux };
  }
}
