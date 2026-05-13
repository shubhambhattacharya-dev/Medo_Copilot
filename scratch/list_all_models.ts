import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function listModels() {
  try {
    const models = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GOOGLE_GENERATIVE_AI_API_KEY}`);
    const data = await models.json();
    console.log("Available Models:", JSON.stringify(data, null, 2));
  } catch (err: unknown) {
    console.error("Failed to list models:", (err as Error).message);
  }
}

listModels();
