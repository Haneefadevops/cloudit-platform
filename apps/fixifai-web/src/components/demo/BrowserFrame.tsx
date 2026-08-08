import { ReactNode } from 'react';

/**
 * Browser-chrome frame for the manager dashboard mockup —
 * same visual language as the hero's DashboardMockup.
 */
export default function BrowserFrame({
  children,
  url = 'app.fixifai.cloudit.lk/dashboard',
  caption,
}: {
  children: ReactNode;
  url?: string;
  caption?: string;
}) {
  return (
    <figure className="w-full">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_24px_60px_-24px_rgba(1,60,60,0.35)]">
        {/* browser chrome */}
        <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          <div className="ml-3 flex-1 truncate rounded-md bg-white px-3 py-1 text-[10px] font-medium text-gray-400 ring-1 ring-gray-200">
            {url}
          </div>
        </div>
        <div className="bg-[#f4fbfb] p-3 sm:p-4">{children}</div>
      </div>
      {caption && (
        <figcaption className="mt-3 text-center text-xs font-medium text-gray-500">{caption}</figcaption>
      )}
    </figure>
  );
}
