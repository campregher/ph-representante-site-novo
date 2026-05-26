import { HTMLAttributes } from "react";

interface LogoProps extends HTMLAttributes<SVGElement> {
  variant?: "colored" | "white" | "dark";
  height?: number;
}

export default function Logo({ variant = "colored", height = 40, className = "", ...props }: LogoProps) {
  const red = "#dc2626";
  const textColor = variant === "white" ? "#ffffff" : variant === "dark" ? "#000000" : red;
  const phColor = variant === "white" ? "#ffffff" : red;

  return (
    <svg
      viewBox="0 0 220 50"
      height={height}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="PH Representante"
      {...props}
    >
      {/* P letter */}
      <rect x="2" y="4" width="8" height="42" rx="2" fill={phColor} />
      <rect x="2" y="4" width="24" height="8" rx="2" fill={phColor} />
      <rect x="2" y="21" width="24" height="8" rx="2" fill={phColor} />
      <rect x="18" y="4" width="8" height="25" rx="2" fill={phColor} />

      {/* H letter */}
      <rect x="32" y="4" width="8" height="42" rx="2" fill={phColor} />
      <rect x="32" y="21" width="22" height="8" rx="2" fill={phColor} />
      <rect x="46" y="4" width="8" height="42" rx="2" fill={phColor} />

      {/* Vertical line separator */}
      <rect x="60" y="8" width="1.5" height="34" rx="1" fill={textColor} opacity="0.3" />

      {/* Text: Representação */}
      <text x="68" y="24" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="14" fill={textColor} letterSpacing="0.5">
        REPRESENTAÇÃO
      </text>
      {/* Text: Automotiva */}
      <text x="68" y="40" fontFamily="Arial, sans-serif" fontWeight="400" fontSize="11" fill={textColor} letterSpacing="2" opacity="0.8">
        AUTOMOTIVA
      </text>
    </svg>
  );
}
