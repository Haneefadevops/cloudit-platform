import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6" style={{ backgroundColor: '#F8F7F9' }}>
      <div className="w-full max-w-[400px] text-center">
        <div className="bg-white rounded-[20px] p-12 shadow-sm border border-[#F1F0F4]" style={{ boxShadow: '0 8px 32px rgba(26,23,39,0.08)' }}>
          <h1 className="text-[72px] font-black leading-none mb-4" style={{ color: '#534AB7' }}>
            404
          </h1>
          <h2 className="text-[22px] font-bold mb-2" style={{ color: '#1A1727' }}>
            Page not found
          </h2>
          <p className="text-[14px] mb-8" style={{ color: '#9994A8' }}>
            This page doesn&apos;t exist or has been moved.
          </p>
          <Link
            href="/"
            className="inline-block w-full py-[13px] rounded-lg text-white text-[14px] font-bold transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ backgroundColor: '#534AB7' }}
          >
            Go to Dashboard
          </Link>
        </div>
        <p className="mt-8 text-[12px] font-medium" style={{ color: '#9994A8' }}>
          &copy; 2026 TouchOrbit. All rights reserved.
        </p>
      </div>
    </div>
  )
}
