import { GoogleGenAI } from "@google/genai";
async function run() {
  const apiKey = "AQ.Ab8RN6JA9TBAz03QrFC_kJRiQpD_6cGb39axCwr30VrK5xufww";
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: "Hello",
    });
    console.log(response.text);
  } catch (e) {
    console.error("Error:", e);
  }
}
run();
