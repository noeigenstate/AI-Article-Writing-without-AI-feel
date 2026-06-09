const drops = Array.from({ length: 150 }, (_, index) => {
  const left = (index * 47) % 100;
  const top = -35 - ((index * 83) % 120);
  const delay = -((index * 37) % 120) / 100;
  const duration = 0.72 + ((index * 19) % 38) / 100;
  const height = 42 + ((index * 23) % 58);
  const opacity = 0.16 + ((index * 29) % 45) / 100;

  return { left, top, delay, duration, height, opacity };
});

/** Decorative rain layer. It never receives pointer events. */
export default function RainLayer() {
  return (
    <div className="rain-layer" aria-hidden="true">
      {drops.map((drop, index) => (
        <span
          key={index}
          className="rain-drop"
          style={{
            left: `${drop.left}%`,
            top: `${drop.top}vh`,
            height: `${drop.height}px`,
            opacity: drop.opacity,
            animationDelay: `${drop.delay}s`,
            animationDuration: `${drop.duration}s`,
          }}
        />
      ))}
    </div>
  );
}
