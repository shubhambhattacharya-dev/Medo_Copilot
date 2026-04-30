"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-background text-foreground">
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="space-y-2">
              <h1 className="text-4xl font-bold text-red-500">Oops!</h1>
              <p className="text-lg text-muted-foreground">
                Something went wrong.
              </p>
            </div>
            
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-400 font-mono">
                {error.message || "An unexpected error occurred"}
              </p>
            </div>

            <div className="flex gap-3">
              <Button onClick={reset} variant="default" className="flex-1">
                Try Again
              </Button>
              <Button 
                onClick={() => window.location.href = "/"} 
                variant="outline" 
                className="flex-1"
              >
                Go Home
              </Button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}