export const WA_LINK = 'https://wa.me/94771696631';

export default function Logo({ size = 32 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.svg"
      alt="TheReplyte"
      style={{ height: size, width: 'auto' }}
      className="inline-block"
    />
  );
}
