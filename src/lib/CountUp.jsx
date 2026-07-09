import { useEffect, useRef, useState } from "react";

/* Animated numeral — counts from 0 to `value` with an ease-out curve.
   Used for the big display numbers so the dashboard feels alive on entry. */
export default function CountUp({ value, duration = 900 }) {
  const [n, setN] = useState(0);
  const raf = useRef();

  useEffect(() => {
    const target = Number(value) || 0;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setN(target);
      return;
    }
    const t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(target * eased));
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [value, duration]);

  return <>{n}</>;
}
