import { AnalysisResult, Chunk } from "../types";
import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { withRetry, safeParseJson } from "../utils";

export class CrossChunkAgent {
  name = "CrossChunk";
  private model: GenerativeModel;

  constructor(apiKey: string) {
    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({
      model: "gemini-2.5-pro",
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    });
  }

  async analyzeDocument(chunks: Chunk[], results: AnalysisResult[]): Promise<AnalysisResult> {
    const chunkReferences = chunks.map((chunk) => ({
      id: chunk.id,
      pages: `${chunk.startPage}-${chunk.endPage}`,
      excerpt: chunk.content.slice(0, 1200).replace(/\s+/g, " "),
    }));

    const prompt = `
      Você é um Auditor de Requisitos especializado em análise de documentos por inteiro.
      Seu objetivo é identificar conflitos e inconsistências que só aparecem ao cruzar informações entre páginas e seções diferentes do documento.
      Use os resultados parciais abaixo para encontrar:
      - regras que mudam de significado entre partes do texto.
      - requisitos que aparecem duplicados com condições diferentes.
      - RN/RF que são parcialmente descritas em um ponto e completadas em outro.
      - fluxos que exigem comportamento de ponta a ponta, mas não estão totalmente cobertos.
      - requisitos que podem quebrar em produção por falta de consistência entre trechos.

      CHUNKS DO DOCUMENTO:
      ${JSON.stringify(chunkReferences, null, 2)}

      RESULTADOS DOS AGENTES:
      Funcionalidades: ${JSON.stringify(
        results.filter((r) => r.agent === "Functionalities").flatMap((r) => r.funcionalidades || []),
        null,
        2,
      )}
      Gaps de Regra de Negócio: ${JSON.stringify(
        results.filter((r) => r.agent === "Business Rules").flatMap((r) => r.gaps || []),
        null,
        2,
      )}
      Integrações: ${JSON.stringify(
        results.filter((r) => r.agent === "Integrations").flatMap((r) => r.integracoes || []),
        null,
        2,
      )}
      Problemas de UX/Exceções: ${JSON.stringify(
        results.filter((r) => r.agent === "Exceptions").flatMap((r) => r.problemas_ux || []),
        null,
        2,
      )}
      Conflitos: ${JSON.stringify(
        results.filter((r) => r.agent === "Conflicts").flatMap((r) => r.conflitos || []),
        null,
        2,
      )}

      RETORNE apenas JSON válido, sem explicações adicionais.
      {
        "conflitos_cruzados": [
          {
            "descricao": string,
            "pagina_referencia": string,
            "impacto": "Alto" | "Médio" | "Baixo" | "Não Identificado",
            "tipo": "Contradição" | "Ambiguidade" | "Brecha de Cobertura" | "Inconsistência" | "Dependência Omitida",
            "sugestao_correcao": string
          }
        ]
      }
    `;

    const result = await withRetry(() => this.model.generateContent(prompt));
    const response = await result.response;
    const text = response.text().trim();
    const parsed = safeParseJson<{ conflitos_cruzados?: any[] }>(text, "crossChunk");

    if (!parsed || !Array.isArray(parsed.conflitos_cruzados)) {
      console.error("Error parsing cross-chunk JSON or missing conflitos_cruzados array.", {
        text: text.slice(0, 1000),
      });
      return { conflitos_cruzados: [] };
    }

    return { conflitos_cruzados: parsed.conflitos_cruzados };
  }
}
