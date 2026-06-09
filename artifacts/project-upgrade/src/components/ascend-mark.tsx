
export function AscendMark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dim = size === "sm" ? 28 : size === "lg" ? 36 : 32;
  const uid = `ascend-${size}`;

  // Hollow A: peak→left-outer→left-inner→crossbar-left→crossbar-right→right-inner→right-outer→Z
  // Inner edges computed so crossbar is at y=21 in a 32px viewBox
  const d = "M16 2.5 L3.5 29.5 L9 29.5 L11.2 21 L20.8 21 L23 29.5 L28.5 29.5 Z";

  return (
    <svg
      width={dim}
      height={dim}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0 select-none"
      aria-label="Ascend"
      style={{ overflow: "visible" }}
    >
      <defs>
        <linearGradient
          id={`${uid}-grad`}
          x1="16" y1="2.5" x2="16" y2="29.5"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%"   stopColor="#DBEAFE" />
          <stop offset="28%"  stopColor="#60A5FA" />
          <stop offset="65%"  stopColor="#2563EB" />
          <stop offset="100%" stopColor="#1E3A8A" />
        </linearGradient>

        <linearGradient
          id={`${uid}-sheen`}
          x1="9" y1="2.5" x2="21" y2="22"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%"   stopColor="white" stopOpacity="0.30" />
          <stop offset="60%"  stopColor="white" stopOpacity="0.06" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>

        <filter id={`${uid}-glow`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Glow halo — blurred blue layer */}
      <path d={d} fill="#3B82F6" opacity="0.40" filter={`url(#${uid}-glow)`} />

      {/* Main mark — metallic blue gradient */}
      <path d={d} fill={`url(#${uid}-grad)`} />

      {/* Metallic sheen — diagonal highlight across left leg */}
      <path d={d} fill={`url(#${uid}-sheen)`} />
    </svg>
  );
}
