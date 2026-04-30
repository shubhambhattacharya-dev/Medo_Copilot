import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

import { ClerkProvider } from "@clerk/nextjs";
import { ui } from "@clerk/ui";

export const metadata: Metadata = {
  title: "Medo Copilot",
  description: "Audit MeDo apps for trust, UX clarity, and launch readiness.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider ui={ui}>
      <html
        lang="en"
        suppressHydrationWarning
        className="h-full antialiased"
      >
        <body className="min-h-full flex flex-col">
          <ThemeProvider
              attribute="class"
              defaultTheme="dark"
              enableSystem
              disableTransitionOnChange
            >
            {children}
            <Toaster position="top-right" richColors />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
