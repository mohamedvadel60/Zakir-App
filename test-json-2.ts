import { GoogleGenAI } from "@google/genai";
async function run() {
  const apiKey = "AQ.Ab8RN6JA9TBAz03QrFC_kJRiQpD_6cGb39axCwr30VrK5xufww";
  const ai = new GoogleGenAI({ apiKey });
  let response;
  try {
    response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: "Tell me a joke. Return JSON { joke: string }",
      config: {
        responseMimeType: "application/json"
      }
    });
    console.log(response.text);
  } catch (e: any) {
    console.log("Error:", e.message);
  }
}
run();
