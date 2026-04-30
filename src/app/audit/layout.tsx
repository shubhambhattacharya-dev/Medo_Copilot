import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Audit Report — Medo Copilot",
  description: "Your AI-powered launch readiness audit report with actionable fix prompts.",
};

export default function AuditLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
