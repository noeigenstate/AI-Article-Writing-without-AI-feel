/** Cute 3D image icons. Outer layout boxes keep their existing dimensions. */

type IconProps = {
  className?: string;
};

function IconImage({ className = "", src }: IconProps & { src: string }) {
  return <img className={`icon-img ${className}`.trim()} src={src} alt="" aria-hidden="true" draggable={false} />;
}

/**
 * Upload/cloud icon used on the file picker.
 *
 * @param className Optional CSS class.
 */
export function CloudUp({ className = "" }: IconProps) {
  return <IconImage className={className} src="/icons/upload-3d.png" />;
}

/**
 * Brand mark: violet gradient tile with a speech bubble holding plain text
 * lines, plus a sparkle. Matches the workspace theme; also used as favicon.
 */
export function ChatLogo() {
  return (
    <svg className="icon-img icon-brand" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="sp-tile" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6d8dff" />
          <stop offset="0.55" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#d946ef" />
        </linearGradient>
        <linearGradient id="sp-lines" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7c5cfc" />
          <stop offset="1" stopColor="#c026d3" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="12" fill="url(#sp-tile)" />
      <path
        d="M15 13 H31 A7 7 0 0 1 38 20 V26 A7 7 0 0 1 31 33 H22 L15.5 38.5 V33 H15 A7 7 0 0 1 8 26 V20 A7 7 0 0 1 15 13 Z"
        fill="#fff"
      />
      <rect x="14" y="19" width="17" height="3" rx="1.5" fill="url(#sp-lines)" />
      <rect x="14" y="24" width="10" height="3" rx="1.5" fill="url(#sp-lines)" opacity="0.7" />
      <path
        d="M40.5 5.5 c0.55 2 1.6 3.05 3.6 3.6 c-2 0.55 -3.05 1.6 -3.6 3.6 c-0.55 -2 -1.6 -3.05 -3.6 -3.6 c2 -0.55 3.05 -1.6 3.6 -3.6 Z"
        fill="#fff"
        opacity="0.92"
      />
    </svg>
  );
}

/**
 * Small sparkle accent used on the primary "generate" action.
 *
 * @param className Optional CSS class.
 */
export function Sparkle({ className = "" }: IconProps) {
  return <IconImage className={className} src="/icons/sparkle-3d.png" />;
}

/** 3D Word document icon used in the file type chip. */
export function WordIcon({ className = "" }: IconProps) {
  return <IconImage className={className} src="/icons/word-3d.png" />;
}

/** 3D sample document stack icon used in the reference-file chip. */
export function SamplesIcon({ className = "" }: IconProps) {
  return <IconImage className={className} src="/icons/samples-3d.png" />;
}

/** WeChat-green tile with article lines: the 公众号排版 tool icon. */
export function GzhIcon({ className = "" }: IconProps) {
  return (
    <svg className={`icon-img ${className}`.trim()} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <rect x="4" y="4" width="40" height="40" rx="11" fill="#07C160" />
      <rect x="12" y="13" width="24" height="5" rx="2.5" fill="#fff" />
      <rect x="12" y="23" width="24" height="3" rx="1.5" fill="#fff" opacity="0.9" />
      <rect x="12" y="29" width="15" height="3" rx="1.5" fill="#fff" opacity="0.9" />
      <rect x="30" y="29" width="6" height="3" rx="1.5" fill="#a7f3d0" />
      <rect x="12" y="35" width="20" height="3" rx="1.5" fill="#fff" opacity="0.65" />
    </svg>
  );
}
