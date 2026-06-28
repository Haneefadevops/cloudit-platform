import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login — CloudIT Hospitality",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold">CloudIT Hospitality</h1>
        <p className="mt-2 text-muted-foreground">Login page placeholder</p>
      </div>
    </main>
  );
}
