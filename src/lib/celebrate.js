// Reward moments — confetti bursts and a gold-medal overlay.
// Web Animations API, zero dependencies, honors prefers-reduced-motion.
const COLORS = ["#C9A557", "#1E4D38", "#8A6A24", "#2E6B4F", "#F5F2EA", "#7C3A4D"];

export function burst(x, y, { count = 26, spread = 90, power = 130 } = {}) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const host = document.createElement("div");
  host.className = "fx-burst";
  document.body.appendChild(host);
  for (let i = 0; i < count; i++) {
    const p = document.createElement("i");
    const size = 4 + Math.random() * 6;
    const round = Math.random() < 0.4;
    p.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:${size}px;height:${round ? size : size * 0.45}px;background:${COLORS[i % COLORS.length]};border-radius:${round ? "50%" : "1px"};pointer-events:none;z-index:9999;`;
    host.appendChild(p);
    const ang = (Math.random() - 0.5) * ((spread * Math.PI) / 90) - Math.PI / 2;
    const v = power * (0.5 + Math.random() * 0.9);
    const dx = Math.cos(ang) * v;
    const midY = Math.sin(ang) * v * 0.7;
    const dy = Math.sin(ang) * v + 90 + Math.random() * 60; // gravity settle
    const rot = (Math.random() - 0.5) * 540;
    p.animate(
      [
        { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
        { transform: `translate(${dx * 0.7}px,${midY}px) rotate(${rot * 0.6}deg)`, opacity: 1, offset: 0.45 },
        { transform: `translate(${dx}px,${dy}px) rotate(${rot}deg)`, opacity: 0 },
      ],
      { duration: 850 + Math.random() * 500, easing: "cubic-bezier(0.16,1,0.3,1)", fill: "forwards" }
    );
  }
  setTimeout(() => host.remove(), 1500);
}

export function burstFrom(el, opts) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  burst(r.left + r.width / 2, r.top + r.height / 2, opts);
}

/* Full milestone moment: gold medal pops center-screen with a message. */
export function medal(text = "כל הכבוד!") {
  if (document.querySelector(".fx-medal-overlay")) return;
  const o = document.createElement("div");
  o.className = "fx-medal-overlay";
  const box = document.createElement("div");
  box.className = "fx-medal";
  const coin = document.createElement("div");
  coin.className = "fx-medal-coin";
  coin.textContent = "★";
  const label = document.createElement("div");
  label.className = "fx-medal-text";
  label.textContent = text;
  box.append(coin, label);
  o.appendChild(box);
  document.body.appendChild(o);
  burst(innerWidth / 2, innerHeight / 2 - 40, { count: 42, spread: 160, power: 190 });
  setTimeout(() => o.classList.add("out"), 1500);
  setTimeout(() => o.remove(), 1900);
}
