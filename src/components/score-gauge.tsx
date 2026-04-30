"use client";

import { useEffect, useRef, useState } from "react";

type ScoreGaugeProps = {
  score: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
};

export function ScoreGauge({
  score,
  size = 200,
  strokeWidth = 12,
  className = "",
}: ScoreGaugeProps) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const rafRef = useRef<number>(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const arc = circumference * 0.75; // 270-degree arc
  const offset = arc - (arc * animatedScore) / 100;

  useEffect(() => {
    const clamped = Math.max(0, Math.min(100, Math.round(score)));
    const duration = 1200;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(Math.round(clamped * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [score]);

  const getColor = (s: number) => {
    if (s >= 85) return { stroke: "url(#gaugeGradientGreen)", text: "text-emerald-400", glow: "drop-shadow-[0_0_24px_rgba(16,185,129,0.2)]" };
    if (s >= 55) return { stroke: "url(#gaugeGradientAmber)", text: "text-amber-400", glow: "drop-shadow-[0_0_24px_rgba(245,158,11,0.2)]" };
    return { stroke: "url(#gaugeGradientRed)", text: "text-red-400", glow: "drop-shadow-[0_0_24px_rgba(239,68,68,0.2)]" };
  };

  const color = getColor(score);
  const center = size / 2;

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className={color.glow}
        role="img"
        aria-label={`Launch score: ${animatedScore} out of 100`}
      >
        <defs>
          <linearGradient id="gaugeGradientGreen" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="50%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#84cc16" />
          </linearGradient>
          <linearGradient id="gaugeGradientAmber" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
          <linearGradient id="gaugeGradientRed" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#dc2626" />
          </linearGradient>
        </defs>

        {/* Background arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={`${arc} ${circumference}`}
          strokeDashoffset={0}
          strokeLinecap="round"
          className="text-muted/40"
          transform={`rotate(135 ${center} ${center})`}
        />

        {/* Animated foreground arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color.stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={`${arc} ${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(135 ${center} ${center})`}
          style={{ transition: "stroke-dashoffset 0.1s ease-out" }}
        />
      </svg>

      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-5xl font-bold tracking-tighter ${color.text}`}>
          {animatedScore}
        </span>
        <span className="mt-1 text-sm text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}
