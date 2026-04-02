import { Agent, AnalysisResult, Chunk } from "../types";
import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { withRetry, safeParseJson } from "../utils";

export class IntegrationsAgent implements Agent {
  name = "Integrations";
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
      Você é um Arquiteto de Software Especialista em Integrações.
      Seu objetivo é extrair todas as menções a sistemas externos, APIs, webservices, integrações ou dependências de dados no texto abaixo.
      
      Regras:
      1. Identifique o nome do sistema ou serviço, o tipo de integração e a página de referência.
      2. Verifique se há detalhes técnicos, pré-requisitos, formatos de dado, autenticação ou endpoints ausentes.
      3. Aponte se a especificação está incompleta e quais informações faltam para evitar falhas na integração.
      4. Retorne no formato JSON sugerido.

      Texto do Documento (Páginas ${chunk.startPage} a ${chunk.endPage}):
      ${chunk.content}

      Retorne estritamente um JSON:
      {
        "integracoes": [
          {
            "sistema": string,
            "status_especificacao": "Completo" | "Incompleto" | "Ausente",
            "detalhe": string,
            "pagina": string,
            "impacto": string
          }
        ]
      }
    `;

    const result = await withRetry(() => this.model.generateContent(prompt));
    const response = await result.response;
    const text = response.text().trim();
    const parsed = safeParseJson<{ integracoes?: any[] }>(text, "integrations");

    if (!parsed || !Array.isArray(parsed.integracoes)) {
      console.error("Error parsing integrations JSON or missing integracoes array.", { text: text.slice(0, 1000) });
      return { integracoes: [] };
    }

    return { integracoes: parsed.integracoes };
  }
}
