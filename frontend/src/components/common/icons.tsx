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

/** 3D text bubble brand mark. */
export function ChatLogo() {
  return <IconImage className="icon-brand" src="/icons/chat-3d.png" />;
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
