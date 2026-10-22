export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect width="40" height="40" rx="11" fill="#312E81" />
      <path
        d="M9 29 L16 13 L24 25 L31 10"
        fill="none"
        stroke="#fff"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="29" r="3.2" fill="#fff" />
      <circle cx="16" cy="13" r="3.2" fill="#fff" />
      <circle cx="24" cy="25" r="3.2" fill="#fff" />
      <circle cx="31" cy="10" r="4.2" fill="#2DD4BF" />
    </svg>
  );
}
