import * as React from "react";
import { cn } from "@/lib/utils";

interface LogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
}

/**
 * A page whose hidden line is being swept away - two solid lines of real text,
 * one dotted line standing for the invisible marks, and a stroke through it.
 */
export function Logo({ size = 22, className, ...props }: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={cn("text-foreground", className)}
      aria-hidden="true"
      {...props}
    >
      <path
        d="M14 6 H38 L52 20 V56 A2 2 0 0 1 50 58 H14 A2 2 0 0 1 12 56 V8 A2 2 0 0 1 14 6 Z"
        fill="currentColor"
        opacity={0.1}
      />
      <path
        d="M14 6 H38 L52 20 V56 A2 2 0 0 1 50 58 H14 A2 2 0 0 1 12 56 V8 A2 2 0 0 1 14 6 Z"
        stroke="currentColor"
        strokeWidth={4}
        strokeLinejoin="round"
        fill="none"
      />
      <path d="M38 6 V20 H52" stroke="currentColor" strokeWidth={4} strokeLinejoin="round" />
      <path d="M21 32 H37" stroke="currentColor" strokeWidth={3.6} strokeLinecap="round" />
      <path d="M21 42 H43" stroke="currentColor" strokeWidth={3.6} strokeLinecap="round" />
      <path
        d="M21 48 H43"
        stroke="currentColor"
        strokeWidth={3.6}
        strokeLinecap="round"
        strokeDasharray="1.5 5.5"
        opacity={0.75}
      />
      <path
        d="M17 54 L48 26"
        stroke="currentColor"
        strokeWidth={4.5}
        strokeLinecap="round"
      />
    </svg>
  );
}
