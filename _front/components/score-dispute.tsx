"use client";
import { useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { Flag, X } from "lucide-react";
import { apiSend } from "@/lib/api";

export function ScoreDispute({ matchId }: { matchId: string }) {
  return process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? (
    <SignedDispute matchId={matchId} />
  ) : (
    <DisputeDialog matchId={matchId} />
  );
}
function SignedDispute({ matchId }: { matchId: string }) {
  const { isSignedIn, getToken } = useAuth();
  return (
    <DisputeDialog
      matchId={matchId}
      auth={
        isSignedIn
          ? async (): Promise<Record<string, string>> => {
              const token = await getToken();
              return token ? { Authorization: `Bearer ${token}` } : {};
            }
          : undefined
      }
    />
  );
}
function DisputeDialog({
  matchId,
  auth,
}: {
  matchId: string;
  auth?: () => Promise<Record<string, string>>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <button
        className="icon-link"
        aria-label="Flag a score dispute"
        title="Flag a score dispute"
        onClick={() => dialog.current?.showModal()}
      >
        <Flag size={18} aria-hidden />
      </button>
      <dialog
        ref={dialog}
        className="dispute-dialog"
        aria-labelledby="dispute-title"
      >
        <button
          className="icon-link dispute-close"
          aria-label="Close dispute dialog"
          onClick={() => dialog.current?.close()}
        >
          <X size={18} />
        </button>
        <h2 id="dispute-title">Flag a score dispute?</h2>
        {sent ? (
          <p role="status">
            Your report has been sent to event staff for review.
          </p>
        ) : auth ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                await apiSend(
                  auth,
                  "POST",
                  `/v1/me/matches/${matchId}/disputes`,
                  { comment },
                );
                setSent(true);
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : "Could not send your report. Try again.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <p>
              Event staff will review the result. Reporting does not change the
              score.
            </p>
            <label>
              Comment (optional)
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={1000}
                rows={4}
              />
            </label>
            {error && <p role="alert">{error}</p>}
            <button className="primary-link" disabled={busy} type="submit">
              {busy ? "Sending…" : "Flag dispute"}
            </button>
          </form>
        ) : (
          <p>
            <Link href="/profile" className="underline">
              Sign in
            </Link>{" "}
            to report a score dispute to event staff.
          </p>
        )}
      </dialog>
    </>
  );
}
