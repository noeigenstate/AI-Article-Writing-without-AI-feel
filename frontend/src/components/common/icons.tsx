type IconProps = {
  className?: string;
};

export function CloudUp({ className = "" }: IconProps) {
  return (
    <svg className={`icon-img ${className}`.trim()} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 16.5v2.25A1.25 1.25 0 0 0 5.25 20h13.5A1.25 1.25 0 0 0 20 18.75V16.5M12 4v11m0-11L7.75 8.25M12 4l4.25 4.25" />
    </svg>
  );
}

export function ChatLogo() {
  return (
    <svg className="icon-img icon-brand" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <path d="M6 7h23v27c0 11-6.5 18.5-19.5 23L6 47.5c7.5-3 11.5-7.5 12-13.5H6V7Z" />
      <path d="M35 7h23v27c0 11-6.5 18.5-19.5 23L35 47.5c7.5-3 11.5-7.5 12-13.5H35V7Z" />
    </svg>
  );
}

export function Sparkle({ className = "" }: IconProps) {
  return (
    <svg className={`icon-img ${className}`.trim()} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 2.75 13.55 8.45 19.25 10 13.55 11.55 12 17.25 10.45 11.55 4.75 10l5.7-1.55L12 2.75Z" />
      <path d="m18.5 15 .7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7.7-2.3Z" />
    </svg>
  );
}

export function WordIcon({ className = "" }: IconProps) {
  return (
    <svg className={`icon-img ${className}`.trim()} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M6 2.75h8l4 4v14.5H6zM14 2.75v4h4M8.5 11l1.3 6 2.2-4.25L14.2 17l1.3-6" />
    </svg>
  );
}

export function SamplesIcon({ className = "" }: IconProps) {
  return (
    <svg className={`icon-img ${className}`.trim()} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M7.5 3.5h10v14h-10zM4.5 6.5v14h10M10 7.5h5M10 11h5M10 14.5h3" />
    </svg>
  );
}

export function ArrowLeft({ className = "" }: IconProps) {
  return (
    <svg className={`icon-img ${className}`.trim()} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M20 12H4M10 6l-6 6 6 6" />
    </svg>
  );
}
