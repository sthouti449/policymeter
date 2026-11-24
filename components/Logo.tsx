/** PolicyMeter mark: a small gauge, because the product is about measuring. No state seals or logos (CLAUDE.md rule 12). */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-[10px] bg-gradient-to-br from-brand-400 to-brand-700 shadow-sm ring-1 ring-brand-700/20"
      style={{ width: size, height: size }}
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 17a8 8 0 1 1 16 0" opacity="0.55" />
        <path d="M12 17l4.2-5.6" />
        <circle cx="12" cy="17" r="1.6" fill="#fff" stroke="none" />
      </svg>
    </span>
  );
}
