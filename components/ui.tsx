// Small shared pieces so every page looks and behaves the same.

export function PageLoading({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <p className="text-sm text-zinc-500">{text}</p>
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700 ring-1 ring-inset ring-red-200">
      {message}
    </div>
  );
}

export function NoticeBox({ children, tone = "blue" }: { children: React.ReactNode; tone?: "blue" | "amber" | "green" }) {
  const tones = {
    blue: "bg-blue-50 text-blue-800 ring-blue-200",
    amber: "bg-amber-50 text-amber-800 ring-amber-200",
    green: "bg-green-50 text-green-800 ring-green-200",
  };
  return <div className={`rounded-lg p-3 text-sm ring-1 ring-inset ${tones[tone]}`}>{children}</div>;
}

export const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white p-2.5 text-zinc-900 outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-blue-600";

export const primaryButton =
  "rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";

export const secondaryButton =
  "rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60";
