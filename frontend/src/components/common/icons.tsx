/** Inline SVG icons. Stroke-based icons inherit `currentColor` from their parent. */

/**
 * Upload/cloud icon used on the file picker.
 *
 * @param className Optional CSS class.
 */
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

/** Monochrome "text bubble" brand mark; inherits the parent color (white on the accent tile). */
export function ChatLogo() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none">
      <path
        d="M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H10l-4 3.5V17H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M7 9h10M7 12.5h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Small sparkle accent used on the primary "generate" action.
 *
 * @param className Optional CSS class.
 */
export function Sparkle({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="1em" height="1em">
      <path
        d="M12 2c.8 4.6 2.6 6.4 7.2 7.2C14.6 10 12.8 11.8 12 16.4 11.2 11.8 9.4 10 4.8 9.2 9.4 8.4 11.2 6.6 12 2z"
        fill="currentColor"
      />
    </svg>
  );
}
