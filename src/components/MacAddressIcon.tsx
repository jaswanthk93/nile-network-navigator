
import React from "react";
import { LucideProps } from "lucide-react";

export const MacAddressIcon: React.FC<LucideProps> = ({
  size = 24,
  strokeWidth = 2,
  className,
  ...props
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <text
        x="12"
        y="14.5"
        fontSize="7"
        fontFamily="monospace"
        fontWeight="bold"
        textAnchor="middle"
        fill="currentColor"
        stroke="none"
      >
        AA:BB:CC
      </text>
    </svg>
  );
};
