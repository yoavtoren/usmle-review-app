// useLongPress — fires callback(event) after an uninterrupted 450ms press
// (or desktop right-click). Cancels if the pointer travels > 8px, and
// suppresses the click that follows a completed long-press.
import { useRef, useCallback } from "react";

export function useLongPress(callback, { ms = 450 } = {}) {
  const timer = useRef(null);
  const start = useRef({ x: 0, y: 0 });
  const fired = useRef(false);

  const clear = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const onPointerDown = useCallback((e) => {
    if (e.button !== undefined && e.button !== 0) return; // right-click handled via contextmenu
    fired.current = false;
    start.current = { x: e.clientX, y: e.clientY };
    // capture the coordinates now — React pools/loses the event by fire time
    const at = { clientX: e.clientX, clientY: e.clientY, target: e.target };
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      fired.current = true;
      callback(at);
    }, ms);
  }, [callback, ms]);

  const onPointerMove = useCallback((e) => {
    if (!timer.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    if (dx * dx + dy * dy > 64) clear();
  }, [clear]);

  const onClickCapture = useCallback((e) => {
    if (fired.current) {
      e.preventDefault();
      e.stopPropagation();
      fired.current = false;
    }
  }, []);

  const onContextMenu = useCallback((e) => {
    e.preventDefault();
    fired.current = true;
    callback({ clientX: e.clientX, clientY: e.clientY, target: e.target });
  }, [callback]);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onClickCapture,
    onContextMenu,
  };
}
