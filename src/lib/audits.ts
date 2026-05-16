import { neon } from "@neondatabase/serverless";
import { encrypt, decrypt } from "./encryption";

type SaveAuditInput = {
  url: string;
  launchScore: number;
  verdict?: string;
  summary?: string;
  issues: unknown;
  improvementPrompt?: string;
  analysisMode?: string;
  provider?: string;
  lighthouse?: unknown;
  backendMetrics?: unknown;
  warning?: string;
  userId?: string;
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
      user_id text,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  // Safely add columns if they don't exist
  await db`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audits' AND column_name='lighthouse') THEN
        ALTER TABLE audits ADD COLUMN lighthouse jsonb;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audits' AND column_name='backend_metrics') THEN
        ALTER TABLE audits ADD COLUMN backend_metrics jsonb;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audits' AND column_name='user_id') THEN
        ALTER TABLE audits ADD COLUMN user_id text;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audits' AND column_name='warning') THEN
        ALTER TABLE audits ADD COLUMN warning text;
      END IF;
    END
    $$;
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
      provider,
      lighthouse,
      backend_metrics,
      warning,
      user_id
    )
    VALUES (
      ${input.url},
      ${input.launchScore},
      ${input.verdict ?? null},
      ${input.summary ?? null},
      ${JSON.stringify(input.issues)}::jsonb,
      ${input.improvementPrompt ?? null},
      ${input.analysisMode ?? null},
      ${input.provider ?? null},
      ${input.lighthouse ? JSON.stringify(input.lighthouse) : null}::jsonb,
      ${input.backendMetrics ? JSON.stringify(input.backendMetrics) : null}::jsonb,
      ${input.warning ?? null},
      ${input.userId ?? null}
    )
    RETURNING id
  `) as { id: string }[];

  return rows[0]?.id as string | null;
}

export async function getCachedAudit(url: string, userId?: string | null) {
  const db = await ensureAuditTable();
  if (!db) return null;

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const rows = (await db`
    SELECT *
    FROM audits
    WHERE url = ${url}
      AND (
        (${userId ?? null}::text IS NULL AND user_id IS NULL)
        OR user_id = ${userId ?? null}
      )
      AND created_at >= ${oneHourAgo.toISOString()}
    ORDER BY created_at DESC
    LIMIT 1
  `) as Array<{
    id: string;
    url: string;
    launch_score: number;
    verdict: string | null;
    summary: string | null;
    issues: unknown;
    improvement_prompt: string | null;
    analysis_mode: string | null;
    provider: string | null;
    lighthouse: unknown;
    backend_metrics: unknown;
    user_id: string | null;
    warning: string | null;
    created_at: string;
  }>;

  if (!rows[0]) return null;

  const row = rows[0];
  return {
    id: row.id,
    url: row.url,
    launchScore: row.launch_score,
    verdict: row.verdict,
    summary: row.summary,
    issues: row.issues,
    improvementPrompt: row.improvement_prompt,
    analysisMode: row.analysis_mode,
    provider: row.provider,
    lighthouse: row.lighthouse,
    backendMetrics: row.backend_metrics,
    warning: row.warning,
    createdAt: row.created_at,
  };
}

export async function ensureUserSettingsTable() {
  const db = getSql();
  if (!db) return db;

  await db`
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id text PRIMARY KEY,
      vision_provider text DEFAULT 'default',
      vision_api_key_encrypted text,
      code_provider text DEFAULT 'default',
      code_api_key_encrypted text,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await db`CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id)`;

  return db;
}

export async function getUserSettings(userId: string) {
  const db = await ensureUserSettingsTable();
  if (!db) return null;

  const rows = (await db`
    SELECT * FROM user_settings WHERE user_id = ${userId}
  `) as Array<{
    user_id: string;
    vision_provider: string;
    vision_api_key_encrypted: string | null;
    code_provider: string;
    code_api_key_encrypted: string | null;
  }>;

  if (!rows[0]) return null;
  const row = rows[0];

  return {
    userId: row.user_id,
    visionProvider: row.vision_provider,
    visionKey: row.vision_api_key_encrypted ? decrypt(row.vision_api_key_encrypted) : null,
    codeProvider: row.code_provider,
    codeKey: row.code_api_key_encrypted ? decrypt(row.code_api_key_encrypted) : null,
  };
}

export async function saveUserSettings(userId: string, data: {
  visionProvider?: string;
  visionKey?: string | null;
  codeProvider?: string;
  codeKey?: string | null;
}) {
  const db = await ensureUserSettingsTable();
  if (!db) return null;

  const visionKeyEncrypted = data.visionKey ? encrypt(data.visionKey) : null;
  const codeKeyEncrypted = data.codeKey ? encrypt(data.codeKey) : null;

  await db`
    INSERT INTO user_settings (
      user_id, 
      vision_provider, 
      vision_api_key_encrypted, 
      code_provider, 
      code_api_key_encrypted, 
      updated_at
    )
    VALUES (
      ${userId},
      ${data.visionProvider ?? 'default'},
      ${visionKeyEncrypted},
      ${data.codeProvider ?? 'default'},
      ${codeKeyEncrypted},
      now()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      vision_provider = EXCLUDED.vision_provider,
      vision_api_key_encrypted = CASE WHEN EXCLUDED.vision_api_key_encrypted IS NOT NULL THEN EXCLUDED.vision_api_key_encrypted ELSE user_settings.vision_api_key_encrypted END,
      code_provider = EXCLUDED.code_provider,
      code_api_key_encrypted = CASE WHEN EXCLUDED.code_api_key_encrypted IS NOT NULL THEN EXCLUDED.code_api_key_encrypted ELSE user_settings.code_api_key_encrypted END,
      updated_at = now()
  `;

  return { success: true };
}
