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
