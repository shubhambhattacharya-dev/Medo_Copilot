import { ShieldCheck, Smartphone, Gauge } from "lucide-react";

export const AI_PROVIDERS = [
  { value: "default", label: "Default (Free Tier)", hint: "Uses server API keys" },
  { value: "gemini", label: "Google Gemini", hint: "Best for vision + structured output" },
  { value: "groq", label: "Groq (Llama)", hint: "Fastest inference speed" },
  { value: "openrouter", label: "OpenRouter (Claude)", hint: "Requires your own API key" },
  { value: "tencent", label: "Tencent Hunyuan", hint: "Good general accuracy (OpenRouter)" },
  { value: "poolside", label: "Poolside", hint: "Optimized for code analysis (OpenRouter)" },
  { value: "nvidia", label: "NVIDIA Nemotron", hint: "High reasoning capabilities (OpenRouter)" },
  { value: "mimo", label: "Mimo AI", hint: "Alternative high-performance model" },
];

/**
 * Centralized Model Mappings
 * Handles decommissioning and upgrades in one place.
 */
export const MODEL_UPGRADES: Record<string, string> = {
  // Gemini
  "gemini-1.5-flash": "gemini-2.0-flash",
  "gemini-1.5-flash-latest": "gemini-2.0-flash",
  "gemini-2.0-flash-exp": "gemini-2.0-flash",
  
  // Groq
  "llama-3.2-90b-vision-preview": "llama-4-scout-17b-16e-instruct",
};

export const DEFAULT_MODELS: Record<string, string> = {
  gemini: "gemini-2.0-flash",
  groq: "llama-4-scout-17b-16e-instruct",
  openrouter: "anthropic/claude-3.5-sonnet",
  tencent: "tencent/hunyuan-a13b-instruct",
  poolside: "poolside/laguna-m-1",
  nvidia: "nvidia/llama-3.1-nemotron-70b-instruct",
  mimo: "mimo-1",
};

/**
 * Scoring Weights
 * Adjust these to tune how "strict" the audit is.
 */
export const SCORING_WEIGHTS = {
  // Frontend: AI vs Deterministic (Lighthouse)
  frontend: {
    ai: 0.6,
    lighthouse: 0.4
  },
  // Backend: AI vs Deterministic (Static Analysis)
  backend: {
    ai: 0.6,
    static: 0.4
  },
  // Overall: Frontend vs Backend
  overall: {
    frontend: 0.5,
    backend: 0.5
  }
};

export const checks = [
  {
    title: "Trust signals",
    description: "Find missing proof, unclear pricing cues, and weak social trust.",
    icon: ShieldCheck,
  },
  {
    title: "Mobile clarity",
    description: "Spot cramped layouts, tiny tap targets, and broken hierarchy.",
    icon: Smartphone,
  },
  {
    title: "Conversion friction",
    description: "Catch distracting copy, unclear CTA flow, and noisy sections.",
    icon: Gauge,
  },
];

export const previewFixes = [
  "Add a stronger hero promise above the fold.",
  "Move the primary CTA higher and reduce competing actions.",
  "Show one concrete outcome instead of generic marketing copy.",
];

export const steps = [
  {
    step: "01",
    title: "Paste your MeDo URL",
    description: "Drop in the page you want audited. No setup, no config.",
  },
  {
    step: "02",
    title: "Scan the UX",
    description: "Medo Copilot checks the page for clarity, trust, and mobile issues.",
  },
  {
    step: "03",
    title: "Copy the fixes",
    description: "Use short prompts and specific edits you can apply immediately.",
  },
];

export const loadingSteps = [
  "Fetching page content...",
  "Capturing screenshots...",
  "Running AI analysis...",
  "Checking trust signals...",
  "Evaluating mobile layout...",
  "Generating fix prompts...",
];
