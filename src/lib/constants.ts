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
