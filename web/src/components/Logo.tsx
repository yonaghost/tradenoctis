export function Logo({ size = 28 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2 select-none">
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="32" height="32" rx="9" fill="#111820" />
        <path d="M9 23V9h3.2l8.6 10.6V9H24v14h-3.2L12.2 12.4V23H9z" fill="#00E5A0" />
      </svg>
      <span className="text-lg font-semibold tracking-wide text-noctis-ink">NOCTIS</span>
    </div>
  );
}
