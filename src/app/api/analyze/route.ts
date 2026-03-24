import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { PDFParse as pdfParse } from "pdf-parse";

// Configure Gemini
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || "");

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Read the file buffer
    const arrayBuffer = await file.arrayBuffer();

    // Extract text from PDF in memory
    const parser = new pdfParse({ data: arrayBuffer });
    const pdfData = await parser.getText() as any;
    
    let textContext = "";
    if (pdfData.pages && Array.isArray(pdfData.pages)) {
        textContext = pdfData.pages.map((p: any, i: number) => `\n--- PÁGINA ${i + 1} ---\n${p.text || p}`).join('\n');
    } else if (pdfData.text) {
        // Fallback usando page break character \f
        const pages = String(pdfData.text).split('\f');
        textContext = pages.map((text: string, i: number) => `\n--- PÁGINA ${i + 1} ---\n${text}`).join('\n');
    } else {
        textContext = String(pdfData.text || pdfData);
    }

    // Set up Gemini prompt
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const prompt = `
Você é um Analista de Sistemas e QA Senior. Analise o texto do documento de requisitos fornecido e retorne estritamente um JSON estruturado com:
- projeto_resumo: string
- funcionalidades: string[]
- falhas_logicas: [{ "erro": "...", "impacto": "...", "sessao": "...", "pagina": "X" }]
- gaps_negocio: [{ "gap": "...", "sessao": "...", "pagina": "X" }]
- sugestoes_melhoria: string[]
- sugestoes_ux: string[]

Importante: 
1. Ao encontrar 'falhas_logicas' e 'gaps_negocio', referencie o título ou 'sessao' do documento e preencha o número exato da 'pagina' analisando os marcadores explícitos de "--- PÁGINA X ---" inseridos no texto.
2. A seção 'sugestoes_melhoria' deve conter estratégias aplicáveis arquiteturalmente e funcionalmente para cobrir os gaps de negócio e falhas lógicas detectadas.
3. Retorne **APENAS** o objeto JSON válido, sem formatação markdown (como \`\`\`json) e sem explicações textuais extras.

Aqui está o conteúdo do documento com paginação injetada:

${textContext}
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let textResult = response.text();
    
    // Clean up potential markdown formatting from Gemini's response
    textResult = textResult.trim().replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    
    // Attempt to parse JSON to validate it, and send it as response
    const jsonResult = JSON.parse(textResult);

    return NextResponse.json(jsonResult, { status: 200 });
  } catch (error: any) {
    console.error("Error analyzing PDF:", error);
    return NextResponse.json(
      { error: "Failed to analyze PDF", details: error.message },
      { status: 500 }
    );
  }
}
