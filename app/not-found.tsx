import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-neutral-600">That page doesn&rsquo;t exist.</p>
      <Link href="/" className="mt-6 inline-block rounded-full bg-black px-5 py-2 text-white">Back to the home page</Link>
    </main>
  );
}
