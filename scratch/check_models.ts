import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function listModels() {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!);
  try {
    // There is no direct "listModels" in the simple SDK easily accessible without auth
    // but we can try to initialize one and see if it works.
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent("Hi");
    console.log("Success with gemini-1.5-flash:", result.response.text());
  } catch (err: unknown) {
    console.error("Failed with gemini-1.5-flash:", (err as Error).message);
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    const result = await model.generateContent("Hi");
    console.log("Success with gemini-1.5-flash-latest:", result.response.text());
  } catch (err: unknown) {
    console.error("Failed with gemini-1.5-flash-latest:", (err as Error).message);
  }
}

listModels();
