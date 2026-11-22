import { formatTime } from "@/lib/format";
import { Icon } from "../Icon";

/** Soft background behind every conversation, like a messaging app. */
export const CHAT_BACKGROUND = "bg-[#e9eef5]";

/** The small "Today" / "Yesterday" pill between days. */
export function DayPill({ label }: { label: string }) {
  return (
    <div className="flex justify-center py-2">
      <span className="rounded-lg bg-white/90 px-3 py-1 text-[11px] font-medium text-zinc-500 shadow-sm">{label}</span>
    </div>
  );
}

/**
 * One text message. Mine sit on the right in light blue, theirs on the left in white.
 * The time (and a tick once the server has it) sits inside the bubble's bottom corner.
 * `first` is true for the first bubble of a run from the same person, which gets a squared corner.
 */
export function ChatBubble({
  body,
  at,
  mine,
  first,
  pending,
  failed,
  senderName,
  onRetry,
}: {
  body: string;
  at: string;
  mine: boolean;
  first: boolean;
  pending?: boolean;
  failed?: boolean;
  senderName?: string;
  onRetry?: () => void;
}) {
  const corner = first ? (mine ? "rounded-tr-none" : "rounded-tl-none") : "";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"} ${first ? "mt-2" : "mt-0.5"}`}>
      <div
        className={`relative max-w-[82%] rounded-xl px-2.5 pb-1.5 pt-1.5 text-[15px] leading-snug shadow-sm ${corner} ${
          mine ? "bg-[#d3e4fd] text-zinc-900" : "bg-white text-zinc-900"
        }`}
      >
        {!mine && senderName && first && <p className="mb-0.5 text-xs font-semibold text-blue-700">{senderName}</p>}
        <p className="whitespace-pre-wrap break-words">
          {body}
          {/* Reserves room so the time never covers the last word. */}
          <span className={`inline-block ${mine ? "w-[4.5rem]" : "w-12"}`} />
        </p>
        <span className="absolute bottom-1 right-2 flex items-center gap-1 text-[10px] text-zinc-500">
          {failed ? (
            <button onClick={onRetry} className="font-semibold text-red-600 underline">
              Not sent. Tap to retry
            </button>
          ) : (
            <>
              {formatTime(at)}
              {mine && (pending ? <Icon name="clock" className="h-3 w-3" /> : <Icon name="check" className="h-3.5 w-3.5 text-blue-600" />)}
            </>
          )}
        </span>
      </div>
    </div>
  );
}
