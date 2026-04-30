# Medo Copilot

Medo Copilot is a powerful, vision-aware audit tool designed for MeDo applications. It scans landing pages for UX/UI issues (copy, trust signals, CTA effectiveness, mobile responsiveness) and generates actionable, ready-to-paste improvement prompts.

## Key Features

- **Multi-Modal Analysis:** Processes both text content (via DOM scraping) and multiple visual screenshots to provide a holistic UX audit.
- **Resilient AI Pipeline:** Built-in multi-provider failover. If one AI service (Gemini, Groq, SiliconFlow) is rate-limited or unavailable, the system automatically falls back to the next, ensuring your audits never fail.
- **Vision-Aware:** Can process up to 7 user-uploaded screenshots to audit specific mobile flows, error states, and empty states.
- **Actionable Output:** Generates clear, structured JSON reports with severity levels, evidence-based reasoning, and ready-to-use prompts for fixing issues.

## Tech Stack

- **Framework:** Next.js (App Router)
- **AI Integration:** Vercel AI SDK
- **Browser Automation:** Playwright
- **UI:** Tailwind CSS, Radix UI
- **Deployment:** Ready for Vercel

## Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/shubhambhattacharya-dev/Medo_Copilot.git
   cd Medo_Copilot
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment:**
   Create a `.env.local` file in the root directory and add your API keys:
   ```env
   GOOGLE_GENERATIVE_AI_API_KEY=your_key
   GROQ_API_KEY=your_key
   SILICONFLOW_API_KEY=your_key
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```

## Documentation
- The analysis logic is located in `src/app/api/analyze/route.ts`.
- The frontend audit UI is located in `src/app/page.tsx`.
