// Shown while any server-rendered page waits on the database.
export default function Loading() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-24 text-center" role="status" aria-live="polite">
      <p className="text-ink-600">Loading&hellip;</p>
    </main>
  );
}
