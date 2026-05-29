// 内联 SVG 图标，配合黏土质感 UI。

export function CloudUp({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="1em" height="1em" fill="none">
      <path
        d="M7 18a4 4 0 0 1-.5-7.97A5 5 0 0 1 16 9.5a3.5 3.5 0 0 1 1 6.86"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 21v-7m0 0-2.2 2.2M12 14l2.2 2.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ChatLogo() {
  return (
    <svg viewBox="0 0 64 64" width="100%" height="100%">
      <rect x="6" y="8" width="46" height="38" rx="13" fill="#fff" />
      <path d="M18 46h12l-7 9z" fill="#fff" />
      <circle cx="24" cy="26" r="3.2" fill="#7bbf99" />
      <circle cx="38" cy="26" r="3.2" fill="#7bbf99" />
      <path d="M23 33c2.6 2.8 9.4 2.8 12 0" stroke="#7bbf99" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <path d="M50 30c.9-2 1.4-2.4 3.4-3.3-2-.9-2.5-1.3-3.4-3.3-.9 2-1.4 2.4-3.4 3.3 2 .9 2.5 1.3 3.4 3.3z" fill="#f5a8b0" />
    </svg>
  );
}

export function Sparkle({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="1em" height="1em">
      <path
        d="M12 2c.8 4.6 2.6 6.4 7.2 7.2C14.6 10 12.8 11.8 12 16.4 11.2 11.8 9.4 10 4.8 9.2 9.4 8.4 11.2 6.6 12 2z"
        fill="#f6c453"
      />
    </svg>
  );
}

export function Flower({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 80" width="100%" height="100%">
      <path d="M30 40c-6 8-10 18-8 36h12c0-18-2-28-4-36z" fill="#9bcfae" />
      <path d="M28 58c-8-4-14-3-18 2 6 4 12 3 18-2z" fill="#9bcfae" />
      <g>
        <circle cx="22" cy="20" r="9" fill="#f4a8b2" />
        <circle cx="40" cy="20" r="9" fill="#f4a8b2" />
        <circle cx="31" cy="10" r="9" fill="#f7b9c2" />
        <circle cx="26" cy="30" r="9" fill="#f7b9c2" />
        <circle cx="37" cy="30" r="9" fill="#f4a8b2" />
        <circle cx="31" cy="20" r="6" fill="#fae0b0" />
      </g>
    </svg>
  );
}

export function Heart({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="1em" height="1em">
      <path d="M12 21s-7-4.6-9.3-9C1 8.6 2.6 5 6 5c2 0 3.2 1.1 4 2.3C10.8 6.1 12 5 14 5c3.4 0 5 3.6 3.3 7-2.3 4.4-9.3 9-9.3 9z" fill="#f4a0aa" />
    </svg>
  );
}
