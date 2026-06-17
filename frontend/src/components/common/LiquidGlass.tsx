import type { CSSProperties, ReactNode } from "react";

type LiquidGlassProps = {
  children: ReactNode;
  className?: string;
  radius?: number;
  displacement?: number;
  variant?: "panel" | "card";
  style?: CSSProperties;
};

/** Layout-neutral surface wrapper. Keeps the old API while avoiding expensive filter work. */
export default function LiquidGlass({
  children,
  className = "",
  radius = 32,
  variant = "card",
  style,
}: LiquidGlassProps) {
  const cssVars = {
    "--lg-radius": `${radius}px`,
    ...style,
  } as CSSProperties;

  return (
    <div className={`liquid-glass liquid-glass-${variant} ${className}`} style={cssVars}>
      <div className="liquid-content">{children}</div>
    </div>
  );
}
