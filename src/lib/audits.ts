import { neon } from "@neondatabase/serverless";

type SaveAuditInput = {
  url: string;
  launchScore: number;
  verdict?: string;
  summary?: string;
  issues: unknown;
  improvementPrompt?: string;
  analysisMode?: string;
  provider?: string;
};

let sql: ReturnType<typeof neon> | null = null;
let tableReady = false;

function getSql() {
  if (!process.env.DATABASE_URL) return null;
  sql ??= neon(process.env.DATABASE_URL);
  return sql;
}

async function ensureAuditTable() {
  const db = getSql();
  if (!db || tableReady) return db;

  await db`
    CREATE TABLE IF NOT EXISTS audits (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      url text NOT NULL,
      launch_score integer NOT NULL,
      verdict text,
      summary text,
      issues jsonb NOT NULL DEFAULT '[]'::jsonb,
      improvement_prompt text,
      analysis_mode text,
      provider text,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  tableReady = true;
  return db;
}

export async function saveAudit(input: SaveAuditInput) {
  const db = await ensureAuditTable();
  if (!db) return null;

  const rows = (await db`
    INSERT INTO audits (
      url,
      launch_score,
      verdict,
      summary,
      issues,
      improvement_prompt,
      analysis_mode,
      provider
    )
    VALUES (
      ${input.url},
      ${input.launchScore},
      ${input.verdict ?? null},
      ${input.summary ?? null},
      ${JSON.stringify(input.issues)}::jsonb,
      ${input.improvementPrompt ?? null},
      ${input.analysisMode ?? null},
      ${input.provider ?? null}
    )
    RETURNING id
  `) as { id: string }[];

  return rows[0]?.id as string | null;
}

export async function ensureUserKeysTable() {
  const db = getSql();
  if (!db) return db;

  await db`
    CREATE TABLE IF NOT EXISTS user_api_keys (
      user_id text PRIMARY KEY,
      google_key text,
      groq_key text,
      openai_key text,
      anthropic_key text,
      model_preference text DEFAULT 'auto',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  return db;
}

export async function getUserApiKeys(userId: string) {
  const db = await ensureUserKeysTable();
  if (!db) return null;

  const rows = (await db`
    SELECT * FROM user_api_keys WHERE user_id = ${userId}
  `) as Array<{
    user_id: string;
    google_key: string | null;
    groq_key: string | null;
    openai_key: string | null;
    anthropic_key: string | null;
    model_preference: string;
  }>;

  if (!rows[0]) return null;
  const row = rows[0];
  return {
    userId: row.user_id,
    googleKey: row.google_key,
    groqKey: row.groq_key,
    openaiKey: row.openai_key,
    anthropicKey: row.anthropic_key,
    modelPreference: row.model_preference,
  };
}

export async function upsertUserApiKeys(userId: string, data: {
  googleKey?: string;
  groqKey?: string;
  openaiKey?: string;
  anthropicKey?: string;
  modelPreference?: string;
}) {
  const db = await ensureUserKeysTable();
  if (!db) return null;

  await db`
    INSERT INTO user_api_keys (user_id, google_key, groq_key, openai_key, anthropic_key, model_preference, updated_at)
    VALUES (
      ${userId},
      ${data.googleKey ?? null},
      ${data.groqKey ?? null},
      ${data.openaiKey ?? null},
      ${data.anthropicKey ?? null},
      ${data.modelPreference ?? 'auto'},
      now()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      google_key = COALESCE(EXCLUDED.google_key, user_api_keys.google_key),
      groq_key = COALESCE(EXCLUDED.groq_key, user_api_keys.groq_key),
      openai_key = COALESCE(EXCLUDED.openai_key, user_api_keys.openai_key),
      anthropic_key = COALESCE(EXCLUDED.anthropic_key, user_api_keys.anthropic_key),
      model_preference = COALESCE(EXCLUDED.model_preference, user_api_keys.model_preference),
      updated_at = now()
  `;

  return { success: true };
}
