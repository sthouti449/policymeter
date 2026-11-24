"use client";

// Shown when a page throws. It never prints the error message or stack: those can
// reveal internals. The `digest` is an opaque id that matches the server log entry.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-ink-600">This page could not be loaded. Please try again.</p>
      {error.digest && <p className="mt-2 font-mono text-xs text-ink-500">Reference: {error.digest}</p>}
      <button onClick={reset} className="mt-6 rounded-full bg-black px-5 py-2 text-white">Try again</button>
    </main>
  );
}
