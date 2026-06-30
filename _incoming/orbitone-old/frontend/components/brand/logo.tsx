export function Logo({ className = "" }: { className?: string }) {
  return (
    <span
      className={[
        "inline-flex items-center gap-2 font-semibold tracking-tight text-primary",
        className,
      ].join(" ")}
    >
      <svg
        width="28"
        height="28"
        viewBox="0 0 28 28"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        <circle cx="14" cy="14" r="12" stroke="#0F766E" strokeWidth="2.5" />
        <circle cx="14" cy="14" r="5" fill="#F97068" />
        <path
          d="M14 2C14 2 22 8 22 14C22 20 14 26 14 26"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      OrbitOne
    </span>
  );
}
