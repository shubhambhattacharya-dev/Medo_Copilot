# 🚀 Medo Copilot: The Launch-Readiness Auditor

**Medo Copilot** isn't just another technical auditor. While tools like Lighthouse tell you if your code is *clean*, Medo Copilot tells you if your app is *ready to sell*. It bridges the gap between "it works" and "it converts."

---

## 🧠 The Philosophy: Technical vs. Conversion
Most tools (Antigravity, Lighthouse) give you a **90/100** if your HTML is valid and your site is fast. 
**Medo Copilot might give that same site a 60/100.** 

Why? Because if your "Shop Now" button is buried, your value proposition is generic, and you have zero social proof, your app is "Broken" from a business perspective. We audit for:
- **UX/UI Hierarchy:** Is the focus on the right place?
- **Conversion Friction:** Are you making it hard for users to take action?
- **Trust Signals:** Do users feel safe buying from you?
- **Code Integrity:** Is your backend leaking secrets?

---

## ✨ Key Features

### 1. 🤖 Hybrid AI Scoring Engine
We use a weighted scoring algorithm that combines:
- **60% AI Insights:** Deep reasoning from LLMs (Gemini 2.0, Llama 4 Scout) on UX and Logic.
- **40% Hard Data:** Deterministic metrics from Google Lighthouse (Performance/SEO) and our custom Static Analyzer.

### 2. 🌊 Resilient Multi-Provider Pipeline
Never face "AI Downtime." Our system implements a **Waterfall Fallback Chain**:
- Primary: **Google Gemini 2.0 Flash** (Best for Vision).
- Secondary: **Groq (Llama 4 Scout)** (Extreme Speed).
- Tertiary: **OpenRouter** (Claude 3.5 Sonnet / GPT-4).

### 3. 👁️ Visual Intelligence (Vision-First)
Unlike text-only auditors, we capture desktop and mobile screenshots using **Playwright**. The AI reviews visual evidence alongside extracted page text and deterministic signals, then labels findings with confidence.

### 4. 🛡️ Static Backend Security Audit
Our built-in static analyzer scans your repository code for:
- **Hardcoded Secrets:** API Keys, Firebase configs, or Stripe keys.
- **Code Quality:** Excessive `any` types, missing `try/catch` in async functions.
- **Maintainability:** Deeply nested logic or monolithic files.

### 5. 🔑 BYOK (Bring Your Own Key)
Designed for flexibility. Users can use our server's default models or provide their own API keys for Gemini, Groq, or OpenRouter to bypass rate limits.

---

## 🛠️ Tech Stack
- **Framework:** Next.js 16 (App Router) + TypeScript
- **AI SDK:** Vercel AI SDK (Unified interface for all LLMs)
- **Browsing:** Playwright + Cheerio (Scraping & Screenshots)
- **Styling:** Tailwind CSS + Shadcn/UI
- **Auth:** Clerk

---

## ⚙️ Centralized Tuning
We believe in maintainability. All critical logic is centralized:
- **`src/lib/constants.ts`**: Update model mappings (e.g., upgrading to Llama 5) or adjust the **Scoring Weights** (e.g., making the auditor 80% AI-driven).
- **`src/services/ai-service.ts`**: The core logic for provider initialization and model resolution.

---

## 🚀 Getting Started

1. **Clone & Install:**
   ```bash
   npm install
   ```

2. **Env Setup:** Create a `.env.local` with:
   ```env
   GOOGLE_GENERATIVE_AI_API_KEY=your_key
   GROQ_API_KEY=your_key
   OPENROUTER_API_KEY=your_key
   DATABASE_URL=your_neon_database_url
   ENCRYPTION_MASTER_KEY=64_hex_characters_for_saved_user_keys
   PAGESPEED_API_KEY=optional_google_pagespeed_key
   ```

3. **Run Dev:**
   ```bash
   npm run dev
   ```

---

## 📈 Accuracy Statement
Medo Copilot is an **evidence-based launch-readiness assistant**, not a replacement for manual QA, security review, or user testing. It improves accuracy by combining structured LLM output, desktop/mobile screenshots, Lighthouse/PageSpeed metrics, static code heuristics, and confidence labels. Production launch decisions should use this report as a triage layer and verify high-impact findings manually.

**Stop guessing. Start auditing. Launch with Medo Copilot.**
