import { z } from "zod";

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url().optional(),
  ENCRYPTION_MASTER_KEY: z.string().optional(),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1).optional(),
  GOOGLE_GENERATIVE_AI_MODEL: z.string().min(1).optional(),
  GROQ_API_KEY: z.string().min(1).optional(),
  GROQ_VISION_MODEL: z.string().min(1).optional(),
  OPENROUTER_API_KEY: z.string().min(1).optional(),
  TENCENT_API: z.string().min(1).optional(),
  POOLSIDE_API: z.string().min(1).optional(),
  NVIDIA_API: z.string().min(1).optional(),
  XOMINI_MIMO_API: z.string().min(1).optional(),
  PAGESPEED_API_KEY: z.string().min(1).optional(),
  GITHUB_TOKEN: z.string().min(1).optional(),
  LANGFUSE_PUBLIC_KEY: z.string().min(1).optional(),
  LANGFUSE_SECRET_KEY: z.string().min(1).optional(),
  LANGFUSE_BASE_URL: z.string().url().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | null = null;

function cleanEnv(raw: NodeJS.ProcessEnv) {
  return Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, value === "" ? undefined : value]));
}

export function getServerEnv() {
  if (cachedEnv) return cachedEnv;
  cachedEnv = serverEnvSchema.parse(cleanEnv(process.env));
  return cachedEnv;
}

export function assertProductionEnv() {
  const env = getServerEnv();
  if (env.NODE_ENV !== "production") return env;

  const missing: string[] = [];
  if (!env.DATABASE_URL) missing.push("DATABASE_URL");
  if (!env.ENCRYPTION_MASTER_KEY) missing.push("ENCRYPTION_MASTER_KEY");
  if (env.ENCRYPTION_MASTER_KEY && !/^[0-9a-fA-F]{64}$/.test(env.ENCRYPTION_MASTER_KEY)) {
    missing.push("valid ENCRYPTION_MASTER_KEY");
  }
  if (!env.GOOGLE_GENERATIVE_AI_API_KEY && !env.GROQ_API_KEY && !env.OPENROUTER_API_KEY) {
    missing.push("at least one AI provider API key");
  }

  if (missing.length > 0) {
    throw new Error(`Missing production environment variables: ${missing.join(", ")}`);
  }

  return env;
}

export function resetEnvCacheForTests() {
  cachedEnv = null;
}
