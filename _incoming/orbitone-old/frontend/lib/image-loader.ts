export default function imageLoader({
  src,
}: {
  src: string;
  width: number;
  quality?: number;
}) {
  if (src.startsWith("http://") || src.startsWith("https://")) {
    return src;
  }
  return src;
}
