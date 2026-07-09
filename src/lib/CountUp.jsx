import { useEffect, useRef, useState } from "react";

/* Animated numeral — eases toward `value` with an ease-out curve.
   Used for the big display numbers so the dashboard feels alive on entry.
   The first render animates from 0; later value changes animate from the
   previously displayed number (streak 5→6 ticks 5→6, not 0→6). */
export default function CountUp({ value, duration = 900 }) {
  const [n, setN] = useState(0);
  const raf = useRef();
  const shown = useRef(0); // last value actually displayed

  useEffect(() => {
    const target = Number(value) || 0;
    const from = shown.current;
    if (target === from || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      shown.current = target;
      setN(target);
      return;
    }
    const t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const cur = Math.round(from + (target - from) * eased);
      shown.current = cur;
      setN(cur);
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [value, duration]);

  return <>{n}</>;
}
