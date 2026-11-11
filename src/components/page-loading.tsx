"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

interface PageLoadingProps {
  message?: string;
  fullScreen?: boolean;
  className?: string;
}

export function PageLoading({
  message = "Loading...",
  fullScreen = true,
  className,
}: PageLoadingProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center bg-background/90 backdrop-blur-xs select-none transition-all duration-300",
        fullScreen ? "fixed inset-0 z-50 min-h-screen w-screen" : "w-full py-16 min-h-[300px]",
        className
      )}
      role="status"
      aria-live="polite"
    >
      {/* Centered Logo with Animated Spinner Rings */}
      <div className="relative flex items-center justify-center">
        {/* Outer glowing pulsing ring */}
        <div className="absolute -inset-4 rounded-full bg-linear-to-tr from-[#0A4A6B]/20 via-[#F4C400]/25 to-[#C8102E]/20 blur-md animate-pulse" />

        {/* Outer gradient rotating spinner ring */}
        <div className="h-28 w-28 rounded-full border-[3px] border-transparent border-t-[#0A4A6B] border-r-[#F4C400] animate-spin [animation-duration:1.2s]" />

        {/* Counter-rotating inner ring */}
        <div className="absolute h-22 w-22 rounded-full border-[2.5px] border-transparent border-b-[#0A4A6B] border-l-[#F4C400] animate-spin [animation-duration:1.8s] [animation-direction:reverse] opacity-80" />

        {/* Logo container with gentle breathing scale animation */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative h-16 w-16 rounded-full bg-white p-2 shadow-lg ring-1 ring-black/5 dark:ring-white/10 flex items-center justify-center overflow-hidden animate-pulse [animation-duration:2s]">
            <Image
              src="/iesm-logo.jpg"
              alt="IESM Logo"
              width={64}
              height={64}
              className="object-contain"
              priority
            />
          </div>
        </div>
      </div>

      {/* Loading message & modern progress dots */}
      <div className="mt-7 flex flex-col items-center gap-2">
        <p className="text-sm font-semibold tracking-wide text-foreground/80">
          {message}
        </p>
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[#0A4A6B] animate-bounce [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 rounded-full bg-[#F4C400] animate-bounce [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 rounded-full bg-[#C8102E] animate-bounce" />
        </div>
      </div>
    </div>
  );
}
