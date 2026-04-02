import { Agent, AnalysisResult, Chunk } from "../types";
import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { withRetry, safeParseJson } from "../utils";

export class BusinessRulesAgent implements Agent {
  name = "Business Rules";
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
      Você é um Consultor de Processos e Analista de Negócios Sênior.
      Seu objetivo é identificar gaps, contradições, regras de negócio incompletas e condições ausentes no texto abaixo.
      
      Regras:
      1. Foque em situações onde o fluxo de negócio, as regras de cálculo ou as exceções não ficaram documentadas.
      2. Identifique regras que dependem de informações não fornecidas, estados não cobertos ou decisões abertas.
      3. Para cada gap, indique o risco e uma sugestão clara para que o BP possa corrigir o documento.
      4. Retorne no formato JSON sugerido.

      Texto do Documento (Páginas ${chunk.startPage} a ${chunk.endPage}):
      ${chunk.content}

      Retorne estritamente um JSON:
      {
        "gaps": [
          {
            "regra": string,
            "tipo_regra": "RN" | "RF" | "Ambos" | "Não Identificado",
            "cenario_omitido": string,
            "risco": string,
            "pagina": string,
            "sugestao_correcao": string
          }
        ]
      }
    `;

    const result = await withRetry(() => this.model.generateContent(prompt));
    const response = await result.response;
    const text = response.text().trim();
    const parsed = safeParseJson<{ gaps?: any[] }>(text, "businessRules");

    if (!parsed || !Array.isArray(parsed.gaps)) {
      console.error("Error parsing business rules JSON or missing gaps array.", { text: text.slice(0, 1000) });
      return { gaps: [] };
    }

    return { gaps: parsed.gaps };
  }
}
