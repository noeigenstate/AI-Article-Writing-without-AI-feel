import type { CSSProperties, ReactNode } from "react";
import { useEffect, useId, useState } from "react";

type LiquidGlassProps = {
  children: ReactNode;
  className?: string;
  radius?: number;
  displacement?: number;
  variant?: "panel" | "card";
  style?: CSSProperties;
};

function roundedRectSdf(x: number, y: number, width: number, height: number, radius: number) {
  const qx = Math.abs(x - width / 2) - width / 2 + radius;
  const qy = Math.abs(y - height / 2) - height / 2 + radius;
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  const inside = Math.min(Math.max(qx, qy), 0);
  return outside + inside - radius;
}

function createDisplacementMap(width: number, height: number, radius: number, depth: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return "";

  const image = context.createImageData(width, height);
  const data = image.data;
  const sample = 2.2;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const center = roundedRectSdf(x, y, width, height, radius);
      const dx = roundedRectSdf(x + sample, y, width, height, radius) - roundedRectSdf(x - sample, y, width, height, radius);
      const dy = roundedRectSdf(x, y + sample, width, height, radius) - roundedRectSdf(x, y - sample, width, height, radius);
      const edge = Math.max(0, 1 - Math.abs(center) / depth);
      const rim = Math.pow(edge, 1.7);
      const offset = (rim * 92);
      const i = (y * width + x) * 4;

      data[i] = 128 + dx * offset;
      data[i + 1] = 128 + dy * offset;
      data[i + 2] = 128 + rim * 72;
      data[i + 3] = Math.min(255, 72 + rim * 183);
    }
  }

  context.putImageData(image, 0, 0);
  return canvas.toDataURL("image/png");
}

/** Layout-neutral liquid glass surface using SDF displacement maps like shuding/liquid-glass. */
export default function LiquidGlass({
  children,
  className = "",
  radius = 32,
  displacement = 34,
  variant = "card",
  style,
}: LiquidGlassProps) {
  const filterId = `lg-${useId().replace(/:/g, "")}`;
  const [map, setMap] = useState("");
  const mapWidth = variant === "panel" ? 520 : 360;
  const mapHeight = variant === "panel" ? 320 : 180;

  useEffect(() => {
    setMap(createDisplacementMap(mapWidth, mapHeight, radius, variant === "panel" ? 42 : 30));
  }, [mapHeight, mapWidth, radius, variant]);

  const cssVars = {
    "--lg-radius": `${radius}px`,
    "--lg-filter": `url(#${filterId})`,
    ...style,
  } as CSSProperties;

  return (
    <div className={`liquid-glass liquid-glass-${variant} ${className}`} style={cssVars}>
      <svg className="liquid-filter" aria-hidden="true" focusable="false">
        <defs>
          <filter id={filterId} x="-18%" y="-18%" width="136%" height="136%" colorInterpolationFilters="sRGB">
            {map && <feImage href={map} x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="map" />}
            <feDisplacementMap
              in="SourceGraphic"
              in2="map"
              scale={displacement}
              xChannelSelector="R"
              yChannelSelector="G"
              result="displaced"
            />
            <feColorMatrix
              in="displaced"
              type="matrix"
              values="1.06 0 0 0 0  0 1.08 0 0 0  0 0 1.16 0 0  0 0 0 1 0"
            />
          </filter>
        </defs>
      </svg>
      <span className="liquid-refract" />
      <span className="liquid-edge" />
      <span className="liquid-sheen" />
      <span className="liquid-beads" />
      <div className="liquid-content">{children}</div>
    </div>
  );
}
