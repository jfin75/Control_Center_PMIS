import Link from "next/link";

export default function NotFound() {
  return (
    <div className="panel mx-auto mt-10 max-w-lg px-8 py-10 text-center">
      <p className="num text-sm font-bold text-accent-ink">404</p>
      <h1 className="mt-2 text-2xl font-semibold text-ink">That page isn’t in the Control Center</h1>
      <p className="mt-2 text-sm text-ink-2">The link may point to a project or record that was removed. Search with Ctrl K, or start from the portfolio.</p>
      <Link href="/portfolio/" className="mt-5 inline-flex h-8 items-center rounded-md bg-accent px-3 text-sm font-semibold text-white hover:bg-accent-hover">
        Go to Portfolio
      </Link>
    </div>
  );
}
