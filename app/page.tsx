import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col min-h-screen">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
              BP
            </div>
            <span className="text-lg font-bold text-zinc-900">BEYI POWA</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm font-medium">
            <Link href="/login" className="text-zinc-600 hover:text-zinc-900">Log in</Link>
            <Link href="/signup" className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">Sign up</Link>
          </nav>
        </div>
      </header>
      <section className="flex flex-1 items-center justify-center bg-gradient-to-b from-blue-50 to-white px-4 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl">
            Kampala&apos;s phone marketplace
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-zinc-600">
            Buy genuine phones from verified sellers. Sell to buyers near you. Restock from other sellers at wholesale prices.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/signup" className="w-full rounded-lg bg-blue-600 px-6 py-3 text-base font-semibold text-white hover:bg-blue-700 sm:w-auto">
              Browse phones
            </Link>
            <Link href="/signup" className="w-full rounded-lg border border-zinc-300 bg-white px-6 py-3 text-base font-semibold text-zinc-900 hover:bg-zinc-50 sm:w-auto">
              Become a seller
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}