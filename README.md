# 📄 Gemini Doc Analyzer

Uma aplicação Web inteligente construída com **Next.js 14+ (App Router)** que permite o envio de documentos de requisitos em formato PDF para realizar uma análise detalhada utilizando a API do **Gemini 2.5 Flash**. O sistema foca em performance, processando os documentos em memória, e fornece análises ricas e categorizadas sobre o conteúdo do documento.

## 🚀 Funcionalidades

- **Upload e Drag-and-drop:** Interface amigável para envio de arquivos PDF.
- **Processamento em Memória:** O arquivo PDF é processado no servidor (backend) sem ser salvo em disco, garantindo segurança e agilidade.
- **Integração com IA (Gemini 2.5 Flash):** Análise rápida e detalhada usando a mais recente tecnologia do Google Generative AI.
- **Extração Inteligente de Conteúdo:**
  - **📝 Resumo Executivo:** Visão geral do que o projeto ou documento aborda.
  - **✅ Funcionalidades:** Lista clara de todas as funcionalidades identificadas no escopo.
  - **⚠️ Falhas Lógicas:** Detecção estruturada de erros de lógica apresentados no documento, com análise de impacto e gravidade.
  - **🏢 Gaps de Negócio:** Mapeamento de regras de negócio faltantes ou ambíguas.
  - **🎨 Sugestões de UX:** Dicas de melhorias para a experiência do usuário baseadas nas regras apresentadas.
- **Exportação (Printable/PDF):** Resultados exibidos de forma otimizada e organizados em modais/cards limpos.

## 🛠️ Tecnologias Utilizadas

- **[Next.js 14+](https://nextjs.org/)** - Framework React com App Router
- **[TypeScript](https://www.typescriptlang.org/)** - Tipagem estática
- **[Tailwind CSS](https://tailwindcss.com/)** - Estilização utilitária
- **[Lucide React](https://lucide.dev/)** - Biblioteca de ícones
- **[Google Generative AI SDK](https://www.npmjs.com/package/@google/generative-ai)** - Integração com o modelo Gemini 1.5 Flash
- **[pdf-parse](https://www.npmjs.com/package/pdf-parse)** - Extração de texto de PDF no ambiente servidor
- **[jsPDF / jsPDF AutoTable](https://github.com/simonbengtsson/jsPDF-AutoTable)** - Para suporte opcional de exportação de PDF no lado cliente

## ⚙️ Pré-requisitos

Para rodar o projeto localmente, certifique-se de ter instalado:
- Node.js (versão 18.x ou superior recomendada)
- `npm`, `yarn` ou `pnpm`
- Uma chave de API válida do **Google Gemini** (Google AI Studio).

## 🏃‍♂️ Como Executar Localmente

**1. Clone o repositório ou acesse a pasta do projeto:**
```bash
cd gemini-analyzer
```

**2. Instale as dependências:**
```bash
npm install
# ou
yarn install
# ou
pnpm install
```

**3. Configure as Variáveis de Ambiente:**
Crie um arquivo `.env.local` na raiz do projeto e adicione a sua chave da API do Gemini:
```env
GOOGLE_GEMINI_API_KEY=sua_chave_de_api_aqui
```

**4. Inicie o servidor de desenvolvimento:**
```bash
npm run dev
# ou
yarn dev
# ou
pnpm dev
```

**5. Acesse a Aplicação:**
Abra [http://localhost:3000](http://localhost:3000) no seu navegador para utilizar a ferramenta.

## 📁 Estrutura do Projeto

- `src/app/page.tsx`: Interface principal da aplicação com a área de drag-and-drop e a exibição dos resultados. Utiliza `'use client'` estrategicamente para interações visuais.
- `src/app/api/analyze/route.ts`: API Route Handler (`POST`) encarregado de receber o `FormData` contendo o PDF, extrair o texto utilizando o `pdf-parse`, montar o prompt estruturado e enviar para a API do Gemini.
- `src/components/`: Componentes reutilizáveis da interface de usuário (Cards, Badges, Tabelas e estados de carregamento).

## 💡 Princípios de Arquitetura

- **Alta Performance:** O texto extraído e a chamada ao modelo de IA ocorrem inteiramente do lado do Servidor. O modelo utilizado (`gemini-1.5-flash`) foi escolhido pela sua otimização em rapidez sem comprometer a qualidade da inferência.
- **Nenhum Dado Armazenado:** Regra rigorosa de não utilizar banco de dados ou persistência no sistema de arquivos para o PDF, ideal para manusear projetos confidenciais.

---
*Projeto desenvolvido para análise inteligente de requisitos de software e auxílio para QAs e Analistas de Sistemas.*
