import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createOpenAI } from "@ai-sdk/openai";
import { LanguageModel } from "ai";

export type AiProviderName = "gemini" | "groq" | "openrouter" | "tencent" | "poolside" | "nvidia";

export interface AiProvider {
  name: string;
  model: LanguageModel;
  supportsSchema: boolean;
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
          supportsVision: true
        };
      } 
      
      if (providerName === "openrouter") {
        const key = apiKey || process.env.OPENROUTER_API_KEY;
        if (!key) return null;
        const customOpenRouter = createOpenAI({ baseURL: "https://openrouter.ai/api/v1", apiKey: key });
        return {
          name: "openrouter",
          model: customOpenRouter("anthropic/claude-3.5-sonnet"),
          supportsSchema: false,
          supportsVision: true
        };
      }

      if (providerName === "tencent") {
        const key = apiKey || process.env.TENCENT_API;
        if (!key) return null;
        const customTencent = createOpenAI({ baseURL: "https://openrouter.ai/api/v1", apiKey: key });
        return {
          name: "tencent",
          model: customTencent("tencent/hunyuan-a13b-instruct"),
          supportsSchema: false,
          supportsVision: false
        };
      }

      if (providerName === "poolside") {
        const key = apiKey || process.env.POOLSIDE_API;
        if (!key) return null;
        const customPoolside = createOpenAI({ baseURL: "https://openrouter.ai/api/v1", apiKey: key });
        return {
          name: "poolside",
          model: customPoolside("poolside/laguna-m-1"),
          supportsSchema: false,
          supportsVision: false
        };
      }

      if (providerName === "nvidia") {
        const key = apiKey || process.env.NVIDIA_API;
        if (!key) return null;
        const customNvidia = createOpenAI({ baseURL: "https://openrouter.ai/api/v1", apiKey: key });
        return {
          name: "nvidia",
          model: customNvidia("nvidia/llama-3.1-nemotron-70b-instruct"),
          supportsSchema: false,
          supportsVision: false
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
  static getVisionModel(provider?: string, key?: string | null): AiProvider | null {
    // 1. Try specified provider if valid
    if (provider) {
      const p = this.getProviderModel(provider, key || null);
      if (p) return p;
    }

    // 2. Default Order: Gemini (Best Vision) -> Groq (Good Vision) -> OpenRouter
    const defaultVision = this.getProviderModel("gemini", null) || 
                         this.getProviderModel("groq", null);
    
    if (defaultVision && defaultVision.supportsVision) return defaultVision;
    
    return defaultVision;
  }

  /**
   * Resolves the best available code/logic model
   */
  static getCodeModel(provider?: string, key?: string | null): AiProvider | null {
    // 1. Try specified provider if valid
    if (provider) {
      const p = this.getProviderModel(provider, key || null);
      if (p) return p;
    }

    // 2. Default Order: Poolside (Dev specialized) -> Nvidia (Strong reasoning) -> Groq (Fastest) -> Gemini (Reliable)
    return (
      this.getProviderModel("poolside", null) ||
      this.getProviderModel("nvidia", null) ||
      this.getProviderModel("tencent", null) ||
      this.getProviderModel("groq", null) || 
      this.getProviderModel("gemini", null)
    );
  }
}
