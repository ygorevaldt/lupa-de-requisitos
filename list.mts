import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const match = env.match(/GOOGLE_GEMINI_API_KEY=(.*)/);
if (!match) {
    console.error("API KEY não encontrada");
    process.exit(1);
}
const key = match[1].trim();

async function run() {
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        const data = await res.json();
        if (data.models) {
            console.log("Modelos Disponíveis:");
            console.log(data.models.map((m: any) => m.name).join('\n'));
        } else {
            console.log("Resposta:", data);
        }
    } catch(e) {
        console.error("Erro:", e);
    }
}
run();
