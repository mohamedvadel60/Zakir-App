import { GoogleGenAI } from "@google/genai";
async function run() {
  const apiKey = "AQ.Ab8RN6JA9TBAz03QrFC_kJRiQpD_6cGb39axCwr30VrK5xufww";
  const ai = new GoogleGenAI({ apiKey });
  try {
    const models = await ai.models.list();
    for await (const model of models) {
        console.log(model.name);
    }
  } catch (e) {
    console.error("Error:", e);
  }
}
run();
