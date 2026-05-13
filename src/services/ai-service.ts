import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createOpenAI } from "@ai-sdk/openai";
import { LanguageModel } from "ai";
import { MODEL_UPGRADES, DEFAULT_MODELS } from "@/lib/constants";

export type AiProviderName = "gemini" | "groq" | "openrouter" | "tencent" | "poolside" | "nvidia" | "mimo";

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
  private static resolveModelName(provider: string, envModel?: string): string {
    if (envModel && MODEL_UPGRADES[envModel]) {
      return MODEL_UPGRADES[envModel];
    }
    return envModel || DEFAULT_MODELS[provider] || "unknown";
  }

  private static getProviderModel(providerName: string, apiKey: string | null): AiProvider | null {
    try {
      if (providerName === "gemini") {
        const key = apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        if (!key) return null;
        const customGoogle = createGoogleGenerativeAI({ apiKey: key });
        const modelName = this.resolveModelName("gemini", process.env.GOOGLE_GENERATIVE_AI_MODEL);
        
        return {
          name: "gemini",
          model: customGoogle(modelName),
          supportsSchema: true,
          supportsVision: true
        };
      } 
      
      if (providerName === "groq") {
        const key = apiKey || process.env.GROQ_API_KEY;
        if (!key) return null;
        const customGroq = createGroq({ apiKey: key });
        const modelName = this.resolveModelName("groq", process.env.GROQ_VISION_MODEL);

        return {
          name: "groq",
          model: customGroq(modelName),
          supportsSchema: true, // Modern Groq models support tool calling / JSON mode
          supportsVision: true
        };
      } 
      
      if (providerName === "openrouter") {
        const key = apiKey || process.env.OPENROUTER_API_KEY;
        if (!key) return null;
        const customOpenRouter = createOpenAI({ baseURL: "https://openrouter.ai/api/v1", apiKey: key });
        const modelName = this.resolveModelName("openrouter");
        return {
          name: "openrouter",
          model: customOpenRouter(modelName),
          supportsSchema: false,
          supportsVision: true
        };
      }

      if (providerName === "tencent") {
        const key = apiKey || process.env.TENCENT_API || process.env.OPENROUTER_API_KEY;
        if (!key) return null;
        const customTencent = createOpenAI({ baseURL: "https://openrouter.ai/api/v1", apiKey: key });
        const modelName = this.resolveModelName("tencent");
        return {
          name: "tencent",
          model: customTencent(modelName),
          supportsSchema: false,
          supportsVision: false
        };
      }

      if (providerName === "poolside") {
        const key = apiKey || process.env.POOLSIDE_API || process.env.OPENROUTER_API_KEY;
        if (!key) return null;
        const customPoolside = createOpenAI({ baseURL: "https://openrouter.ai/api/v1", apiKey: key });
        const modelName = this.resolveModelName("poolside");
        return {
          name: "poolside",
          model: customPoolside(modelName),
          supportsSchema: false,
          supportsVision: false
        };
      }

      if (providerName === "nvidia") {
        const key = apiKey || process.env.NVIDIA_API || process.env.OPENROUTER_API_KEY;
        if (!key) return null;
        const customNvidia = createOpenAI({ baseURL: "https://openrouter.ai/api/v1", apiKey: key });
        const modelName = this.resolveModelName("nvidia");
        return {
          name: "nvidia",
          model: customNvidia(modelName),
          supportsSchema: false,
          supportsVision: false
        };
      }

      if (providerName === "mimo") {
        const key = apiKey || process.env.XOMINI_MIMO_API;
        if (!key) return null;
        const customMimo = createOpenAI({ baseURL: "https://api.mimo.ai/v1", apiKey: key });
        const modelName = this.resolveModelName("mimo");
        return {
          name: "mimo",
          model: customMimo(modelName),
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
    if (provider && provider !== "default") {
      const p = this.getProviderModel(provider, key || null);
      if (p) return p;
    }

    // 2. Default Order: Gemini -> Groq -> OpenRouter
    return (
      this.getProviderModel("gemini", null) || 
      this.getProviderModel("groq", null) ||
      this.getProviderModel("openrouter", null)
    );
  }

  /**
   * Resolves the best available code/logic model
   */
  static getCodeModel(provider?: string, key?: string | null): AiProvider | null {
    // 1. Try specified provider if valid
    if (provider && provider !== "default") {
      const p = this.getProviderModel(provider, key || null);
      if (p) return p;
    }

    // 2. Default Order: Poolside -> Nvidia -> Groq -> Gemini -> Tencent -> Mimo
    return (
      this.getProviderModel("poolside", null) ||
      this.getProviderModel("nvidia", null) ||
      this.getProviderModel("groq", null) || 
      this.getProviderModel("gemini", null) ||
      this.getProviderModel("tencent", null) ||
      this.getProviderModel("mimo", null)
    );
  }
}
