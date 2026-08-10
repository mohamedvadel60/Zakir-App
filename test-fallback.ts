import { GoogleGenAI } from "@google/genai";
async function run() {
  const apiKey = "AQ.Ab8RN6JA9TBAz03QrFC_kJRiQpD_6cGb39axCwr30VrK5xufww";
  const ai = new GoogleGenAI({ apiKey });
  let response;
  try {
    response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: "Hello",
    });
  } catch (apiError: any) {
    console.warn("Primary model failed, falling back to gemini-3-flash-preview", apiError.message);
    if (apiError.status === 429 || apiError.message?.includes("exceeded")) {
      response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: "Hello",
      });
    } else {
      throw apiError;
    }
  }
  console.log(response.text);
}
run();
