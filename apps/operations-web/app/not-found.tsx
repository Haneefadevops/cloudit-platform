import Link from "next/link";

export default function NotFound() {
  return <main className="simple-state"><h1>Page not found</h1><p>The requested protected portal route does not exist.</p><Link href="/overview">Return to overview</Link></main>;
}
