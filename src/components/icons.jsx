// Minimal line-icon set — 24×24, inherits currentColor, 1.8 stroke.
// One source of truth so every screen shares the same visual language.
const S = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

function Svg({ children, size = 24, ...rest }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} {...S} {...rest} aria-hidden="true">
      {children}
    </svg>
  );
}

export const IconHome = (p) => (
  <Svg {...p}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" /><path d="M9.5 21v-6h5v6" /></Svg>
);
export const IconDash = (p) => (
  <Svg {...p}><rect x="3" y="3" width="7.5" height="9" rx="1.5" /><rect x="13.5" y="3" width="7.5" height="5.5" rx="1.5" /><rect x="13.5" y="11.5" width="7.5" height="9.5" rx="1.5" /><rect x="3" y="15" width="7.5" height="6" rx="1.5" /></Svg>
);
export const IconClipboard = (p) => (
  <Svg {...p}><path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1Z" /><path d="M8 6H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-2" /><path d="M9 11h6M9 15h4" /></Svg>
);
export const IconBook = (p) => (
  <Svg {...p}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6.5A2.5 2.5 0 0 0 4 21.5Z" /><path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H20" /></Svg>
);
export const IconCap = (p) => (
  <Svg {...p}><path d="m2.5 8.5 9.5-4 9.5 4-9.5 4-9.5-4Z" /><path d="M6 10.5V16c0 1.4 2.7 2.8 6 2.8s6-1.4 6-2.8v-5.5" /><path d="M21.5 8.5v5" /></Svg>
);
export const IconCalendar = (p) => (
  <Svg {...p}><rect x="3.5" y="5" width="17" height="16" rx="2.5" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /></Svg>
);
export const IconTarget = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="0.6" fill="currentColor" stroke="none" /></Svg>
);
export const IconPulse = (p) => (
  <Svg {...p}><path d="M3 12h4l2.5-6 4 14 2.5-8H21" /></Svg>
);
export const IconHeart = (p) => (
  <Svg {...p}><path d="M12 20s-7-4.6-9.2-9C1.4 8 2.8 4.6 6 4.6c2 0 3.2 1.2 4 2.4.8-1.2 2-2.4 4-2.4 3.2 0 4.6 3.4 3.2 6.4C19 15.4 12 20 12 20Z" /></Svg>
);
export const IconBell = (p) => (
  <Svg {...p}><path d="M6 9a6 6 0 0 1 12 0c0 5.5 2 7 2 7H4s2-1.5 2-7" /><path d="M10.2 20a2 2 0 0 0 3.6 0" /></Svg>
);
export const IconMail = (p) => (
  <Svg {...p}><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m4 7 8 6 8-6" /></Svg>
);
export const IconChevron = (p) => (
  <Svg {...p}><path d="m15 6-6 6 6 6" /></Svg>
);
export const IconChevronDown = (p) => (
  <Svg {...p}><path d="m6 9 6 6 6-6" /></Svg>
);
export const IconArrow = (p) => (
  <Svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>
);
export const IconClose = (p) => (
  <Svg {...p}><path d="m6 6 12 12M18 6 6 18" /></Svg>
);
export const IconCheck = (p) => (
  <Svg {...p}><path d="m4 12.5 5 5 11-12" /></Svg>
);
export const IconSettings = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="3.2" /><path d="M12 2.5v2.4M12 19.1v2.4M21.5 12h-2.4M4.9 12H2.5M18.7 5.3l-1.7 1.7M7 17l-1.7 1.7M18.7 18.7 17 17M7 7 5.3 5.3" /></Svg>
);
export const IconClock = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Svg>
);
export const IconSparkle = (p) => (
  <Svg {...p}><path d="M12 3c.4 4 1.5 5.1 5.5 5.5-4 .4-5.1 1.5-5.5 5.5-.4-4-1.5-5.1-5.5-5.5C10.5 8.1 11.6 7 12 3Z" /><path d="M18.5 14c.2 2 .8 2.6 2.8 2.8-2 .2-2.6.8-2.8 2.8-.2-2-.8-2.6-2.8-2.8 2-.2 2.6-.8 2.8-2.8Z" /></Svg>
);
export const IconFlame = (p) => (
  <Svg {...p}><path d="M12 3c.5 3 2.5 4 2.5 4 2 1.6 3.5 3.8 3.5 6.5a6 6 0 0 1-12 0c0-1.6.7-3 1.6-4 .3 1 .9 1.6 1.7 1.8C9 9 9.5 6.5 12 3Z" /></Svg>
);
