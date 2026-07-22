export const WA_LINK = 'https://wa.me/94771696631';

export default function Logo({ size = 32 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="logo-grad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop stopColor="#00d8c7" />
            <stop offset="1" stopColor="#4a42fc" />
          </linearGradient>
        </defs>
        <path
          d="M24 4C12.954 4 4 12.058 4 22c0 5.35 2.68 10.13 6.86 13.39L9.5 43.5c-.23.94.76 1.7 1.63 1.25l9.1-4.66c1.2.2 2.45.31 3.77.31 11.046 0 20-8.058 20-18S35.046 4 24 4Z"
          fill="url(#logo-grad)"
        />
        <path
          d="M15 22.5h12M15 17.5h18M15 27.5h8"
          stroke="#0a0a12"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      </svg>
      <span className="text-lg font-bold tracking-tight text-white">
        The<span className="text-gradient">Replyte</span>
      </span>
    </span>
  );
}
