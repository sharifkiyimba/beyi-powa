import Link from "next/link";
import { APP_NAME } from "@/lib/config";

/** The split-screen frame shared by the login and signup pages. */
export function AuthShell({
  tagline,
  children,
}: {
  tagline: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-white">
      <div className="hidden w-1/2 flex-col justify-between bg-zinc-900 p-12 text-white lg:flex">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold">BP</div>
          <span className="text-xl font-bold">{APP_NAME}</span>
        </Link>
        <h1 className="text-4xl font-bold">{tagline}</h1>
        <div className="text-sm text-zinc-500">&copy; {new Date().getFullYear()} {APP_NAME}.</div>
      </div>

      <div className="flex w-full items-center justify-center bg-white px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">BP</div>
            <span className="text-lg font-bold text-zinc-900">{APP_NAME}</span>
          </Link>
          {children}
        </div>
      </div>
    </div>
  );
}
