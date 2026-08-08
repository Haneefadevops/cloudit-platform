import { ReactNode } from 'react';

/**
 * Phone mockup frame — status bar + app header, content scrolls inside.
 * Scales down on small screens (max-w keeps it within viewport).
 */
export default function PhoneFrame({
  children,
  title,
  caption,
}: {
  children: ReactNode;
  title: string;
  caption?: string;
}) {
  return (
    <figure className="mx-auto w-full max-w-[310px]">
      <div className="overflow-hidden rounded-[2rem] border-[6px] border-brand-dark bg-brand-dark shadow-2xl shadow-brand-dark/25">
        {/* status bar */}
        <div className="flex items-center justify-between px-4 pt-2 text-[10px] font-medium text-white/80">
          <span>9:41</span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-white/70" />
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-white/70" />
            <span className="inline-block h-1.5 w-3 rounded-sm bg-white/70" />
          </span>
        </div>
        {/* app header */}
        <div className="flex items-center gap-2 px-4 pb-3 pt-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white font-heading text-[10px] font-bold text-brand-teal">
            F
          </span>
          <span className="font-heading text-xs font-semibold text-white">{title}</span>
        </div>
        {/* screen content */}
        <div className="max-h-[420px] min-h-[380px] overflow-y-auto rounded-t-2xl bg-[#f4fbfb] p-3">
          {children}
        </div>
      </div>
      {caption && (
        <figcaption className="mt-3 text-center text-xs font-medium text-gray-500">{caption}</figcaption>
      )}
    </figure>
  );
}
