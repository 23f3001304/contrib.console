// The Control Lib mark: two faders, a control surface that also reads as stacked
// shelves. Uses currentColor so callers set the color (text-brand on the dark
// sidebar). The favicon is the same mark on a tile.
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <line
        x1="6.5"
        y1="12"
        x2="25.5"
        y2="12"
        stroke="currentColor"
        strokeOpacity="0.32"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <rect x="17" y="8.5" width="5" height="7" rx="2" fill="currentColor" />
      <line
        x1="6.5"
        y1="20"
        x2="25.5"
        y2="20"
        stroke="currentColor"
        strokeOpacity="0.32"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <rect x="10" y="16.5" width="5" height="7" rx="2" fill="currentColor" />
    </svg>
  )
}
