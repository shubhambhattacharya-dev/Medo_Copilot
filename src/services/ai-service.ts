import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createOpenAI } from "@ai-sdk/openai";
import { LanguageModel } from "ai";

export type AiProviderName = "gemini" | "groq" | "openrouter";

export interface AiProvider {
  name: string;
  model: LanguageModel;
  supportsSchema: boolean;
  isVision: boolean;
  supportsVision: boolean;
}

/**
 * Service to initialize AI providers with custom or default keys
 */
export class AiService {
  private static getProviderModel(providerName: string, apiKey: string | null): AiProvider | null {
    try {
      if (providerName === "gemini") {
        const key = apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        if (!key) return null;
        const customGoogle = createGoogleGenerativeAI({ apiKey: key });
        return {
          name: "gemini",
          model: customGoogle(process.env.GOOGLE_GENERATIVE_AI_MODEL || "gemini-2.0-flash"),
          supportsSchema: true,
          isVision: true,
          supportsVision: true
        };
      } 
      
      if (providerName === "groq") {
        const key = apiKey || process.env.GROQ_API_KEY;
        if (!key) return null;
        const customGroq = createGroq({ apiKey: key });
        return {
          name: "groq",
          model: customGroq(process.env.GROQ_MODEL || "llama-3.2-90b-vision-preview"),
          supportsSchema: false,
          isVision: true,
          supportsVision: true
        };
      } 
      
      if (providerName === "openrouter") {
        const key = apiKey;
        if (!key) return null;
        const customOpenRouter = createOpenAI({ baseURL: "https://openrouter.ai/api/v1", apiKey: key });
        return {
          name: "openrouter",
          model: customOpenRouter("anthropic/claude-3.5-sonnet"),
          supportsSchema: false,
          isVision: true,
          supportsVision: true
        };
      }
    } catch (err) {
      console.warn(`Failed to initialize provider ${providerName}:`, err);
    }
    return null;
  }

  /**
   * Resolves the best available vision model based on user settings and defaults
   */
  static getVisionModel(provider?: string, key?: string | null): AiProvider {
    const model = provider ? this.getProviderModel(provider, key || null) : null;
    return model || this.getProviderModel("gemini", null) || this.getProviderModel("groq", null)!;
  }

  /**
   * Resolves the best available code/logic model
   */
  static getCodeModel(provider?: string, key?: string | null): AiProvider {
    const model = provider ? this.getProviderModel(provider, key || null) : null;
    // For code, we prefer Groq or Gemini if no custom key provided
    return model || this.getProviderModel("groq", null) || this.getProviderModel("gemini", null)!;
  }
}
