"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUp,
  Eye,
  PanelRightClose,
  ScanLine,
  Sparkles,
  Square,
} from "lucide-react";

import { ScrollArea } from "@/components/ui/scroll-area";
import {
  API_BASE,
  ApiError,
  fetchHealth,
  streamTutor,
  type HealthResponse,
} from "@/lib/api";
import { alertSnapshot, hush, say, setPose } from "@/lib/mascot";
import { receiveTutorOpen } from "@/lib/tutor-bus";
import {
  mascotPresent as catOnScreen,
  subscribeMascotRoom,
} from "@/lib/mascot";

/** A store with nothing to subscribe to: the answer cannot change. */
import { subscribeCircuit, type ScreenCircuit } from "@/lib/circuit-store";
import { TUTOR_SUGGESTIONS, type ChatTurn } from "@/lib/data";
import { cn } from "@/lib/utils";

/**
 * The tutor.
 *
 * Answers come from the FastAPI service: it rebuilds the learner's circuit with
 * Qiskit, computes the state, and streams a reply token by token. With an
 * OpenAI key the prose is a model's; without one the service streams a
 * deterministic read-out it computed itself. Either way the numbers quoted are
 * the learner's own, which is the only version of "reads your screen" worth
 * shipping.
 */

interface Message extends ChatTurn {
  streaming?: boolean;
  failed?: boolean;
}

const ROUTE_LABEL: Record<string, string> = {
  "/": "Landing page",
  "/sandbox": "Circuit sandbox",
  "/curriculum": "Curriculum hub",
  "/dashboard": "Your dashboard",
};

const CIRCUIT_SUGGESTIONS = [
  "Are my qubits entangled?",
  "What will measuring give me?",
  "What should I fix?",
];

function routeLabel(pathname: string) {
  if (ROUTE_LABEL[pathname]) return ROUTE_LABEL[pathname];
  if (pathname.startsWith("/curriculum/")) return "Module page";
  return pathname.replace(/^\//, "") || "QuantaVerse";
}

function ContextStrip({
  pathname,
  circuit,
}: {
  pathname: string;
  circuit: ScreenCircuit;
}) {
  return (
    <div className="relative overflow-hidden border-b border-edge bg-nebula px-4 py-2.5">
      <div className="relative flex items-center gap-2">
        <Eye className="size-3.5 shrink-0 text-filament" />
        <span className="eyebrow shrink-0">Reading</span>
        <span className="truncate font-mono text-[11px] text-paper">
          {routeLabel(pathname)}
        </span>
        <span className="ml-auto shrink-0 truncate font-mono text-[11px] text-frost">
          {circuit.summary}
        </span>
      </div>
    </div>
  );
}

function CodeDiff({ code }: { code: string }) {
  return (
    <pre className="mt-2.5 overflow-x-auto rounded-lg border border-edge bg-void p-3 font-mono text-[11px] leading-relaxed">
      <code>
        {code.split("\n").map((line, index) => {
          const added = line.startsWith("+");
          const removed = line.startsWith("-");
          return (
            <span
              key={index}
              className={cn(
                "block whitespace-pre",
                added && "bg-photon/10 text-photon",
                removed &&
                  "bg-strata text-collapse line-through decoration-collapse/40",
                !added && !removed && "text-frost",
              )}
            >
              {line}
            </span>
          );
        })}
      </code>
    </pre>
  );
}

function Turn({
  turn,
  onChip,
}: {
  turn: Message;
  onChip: (chip: string) => void;
}) {
  const isTutor = turn.from === "tutor";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={cn("flex gap-2.5", isTutor ? "flex-row" : "flex-row-reverse")}
    >
      {isTutor && (
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center bg-filament">
          <Sparkles className="size-3 text-void" />
        </span>
      )}
      <div className={cn("min-w-0 max-w-[86%]", !isTutor && "text-right")}>
        <div
          className={cn(
            "rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed",
            isTutor
              ? turn.failed
                ? "border border-edge-hi bg-strata text-paper"
                : "border border-edge bg-strata text-paper"
              : "border border-paper bg-strata text-paper",
          )}
        >
          <p className="text-left whitespace-pre-wrap">
            {turn.body}
            {turn.streaming && (
              <span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-breathe bg-filament" />
            )}
          </p>
          {turn.code && <CodeDiff code={turn.code} />}
        </div>

        {turn.looking && (
          <span className="mt-1.5 inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.1em] text-frost uppercase">
            <ScanLine className="size-3 text-filament" />
            {turn.looking}
          </span>
        )}

        {turn.chips && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {turn.chips.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => onChip(chip)}
                className="border border-filament px-2.5 py-1 font-mono text-[11px] text-filament transition-colors hover:bg-filament hover:text-void"
              >
                {chip}
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/**
 * The opening sentence, for the speech bubble.
 *
 * Falls back to a character count when the answer has no sentence break yet —
 * which is most of the time, because this runs on a stream that is still
 * arriving one token at a time.
 */
function lead(body: string) {
  const stop = body.search(/[.!?](\s|$)/);
  if (stop > 20) return body.slice(0, stop + 1);
  return body.length > 130 ? `${body.slice(0, 130).trimEnd()}…` : body;
}

export function TutorSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  /* Whether the mascot can exist here.
     Read through `useSyncExternalStore` with a store that never changes — the
     same idiom the 3D layer uses to answer "are we on the client yet". The
     server snapshot is false so the pill renders in the HTML, the client
     snapshot is the real capability, and there is no effect writing state and
     no subscription to lose a race with. */
  const mascotPresent = useSyncExternalStore(
    subscribeMascotRoom,
    catOnScreen,
    () => false,
  );
  const [draft, setDraft] = useState("");
  const [circuit, setCircuit] = useState<ScreenCircuit>({
    ir: null,
    summary: "no circuit open",
    lessonId: null,
    challengeSlug: null,
  });
  const [health, setHealth] = useState<HealthResponse | null>(null);
  /* Whether the probe has answered yet. Until it has, the panel does not know
     the service is missing — and showing "offline" for the second it took to
     find out told people to start an API that was already running. */
  const [probed, setProbed] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);
  const counter = useRef(0);

  useEffect(() => subscribeCircuit(setCircuit), []);

  /* ⌘/Ctrl + I opens the tutor; Escape closes it. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "i") {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* Probe once the panel is first opened, not on every page load. */
  useEffect(() => {
    if (!open || health) return;
    const controller = new AbortController();
    fetchHealth(controller.signal)
      .then(setHealth)
      .catch(() => setHealth(null))
      .finally(() => {
        if (!controller.signal.aborted) setProbed(true);
      });
    return () => controller.abort();
  }, [open, health]);

  useEffect(() => () => abort.current?.abort(), []);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ block: "end" });
  }, [open, messages]);

  const shortcut = useMemo(() => {
    if (typeof navigator === "undefined") return "Ctrl I";
    return /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent)
      ? "⌘ I"
      : "Ctrl I";
  }, []);

  const send = useCallback(
    async (prompt: string) => {
      const text = prompt.trim();
      if (!text || busy) return;

      counter.current += 1;
      const askId = `l${counter.current}`;
      const replyId = `t${counter.current}`;
      const history = messages
        .filter((message) => !message.failed && message.body.trim())
        .slice(-6)
        .map((message) => ({
          role:
            message.from === "tutor"
              ? ("assistant" as const)
              : ("user" as const),
          content: message.body,
        }));

      setMessages((current) => [
        ...current,
        { id: askId, from: "learner", body: text },
        { id: replyId, from: "tutor", body: "", streaming: true },
      ]);
      setDraft("");
      setBusy(true);

      /* The cat is the same conversation, embodied. It rattles while the model
         reads the circuit and snaps upright when words start arriving. */
      setPose("thinking");
      hush();
      /** The answer so far, for the bubble. Per-ask, so it resets each time. */
      let spoken = "";

      const patch = (change: (message: Message) => Message) =>
        setMessages((current) =>
          current.map((message) =>
            message.id === replyId ? change(message) : message,
          ),
        );

      const controller = new AbortController();
      abort.current = controller;

      try {
        await streamTutor(
          {
            prompt: text,
            circuit: circuit.ir,
            lesson_id: circuit.lessonId,
            challenge_slug: circuit.challengeSlug ?? null,
            history,
          },
          {
            onMeta: (meta) =>
              patch((message) => ({
                ...message,
                looking: meta.looking?.reading
                  ? `${meta.looking.qubits} qubits · ${meta.looking.reading}`
                  : `${meta.live && meta.model ? meta.model : "local read-out"} · no circuit open`,
              })),
            onDelta: (chunk) => {
              /* Accumulated out here, not inside the updater. A `setState`
                 callback has to be pure — notifying the mascot store from
                 inside one renders another component in the middle of this
                 one's update, and React discards it. That is why the bubble
                 stayed empty while the panel filled in perfectly. */
              if (!spoken) setPose("resolving");
              spoken += chunk;
              /* The panel already carries the whole answer; the bubble carries
                 its opening sentence. Streaming the same paragraph into two
                 places at once is not two features, it is one shown twice. */
              say(lead(spoken), {
                eyebrow: "reading your circuit",
                streaming: true,
              });
              patch((message) => ({ ...message, body: message.body + chunk }));
            },
            onDone: () => {
              say(lead(spoken), { eyebrow: "reading your circuit" });
              patch((message) => ({ ...message, streaming: false }));
            },
          },
          controller.signal,
        );
        patch((message) => ({ ...message, streaming: false }));
      } catch (error) {
        const aborted = controller.signal.aborted;
        const reason =
          error instanceof ApiError
            ? error.message
            : "the tutor service returned an error";
        patch((message) => ({
          ...message,
          streaming: false,
          failed: !aborted,
          body: aborted
            ? message.body || "Stopped."
            : `${reason}\n\nStart it from the backend folder and ask again:`,
          code: aborted ? undefined : "uvicorn app.main:app --reload",
        }));
      } finally {
        abort.current = null;
        setBusy(false);
        /* Back to pointing at the mistake if it is still there: asking about a
           fault does not fix it, and a cat gone idle beside a live notice looks
           as though it has stopped minding it. */
        setPose(alertSnapshot().alert ? "flagging" : "idle");
        // Long enough to read the opening line, then the cat stops talking.
        window.setTimeout(hush, 9000);
      }
    },
    [busy, circuit.ir, circuit.lessonId, circuit.challengeSlug, messages],
  );

  /* The open handler is registered once, so it reads these through a ref:
     a `send` captured at mount would be asking with the first render's history
     and the first render's idea of whether an answer is still streaming. */
  const latest = useRef({ send, busy });
  useEffect(() => {
    latest.current = { send, busy };
  });

  /* The mascot is the same tutor with a face on, so it needs a way in. It
     hands over an optional question, which lands in the box ready to send
     rather than opening an empty panel the reader now has to fill in. */
  useEffect(() => {
    receiveTutorOpen((question, options) => {
      setOpen(true);
      if (!question) return;
      /* Asked outright when the caller said to — unless an answer is already
         streaming, in which case sending would be silently dropped, so the
         question waits in the box instead of vanishing. */
      const { send: ask, busy: answering } = latest.current;
      if (options?.send && !answering) void ask(question);
      else setDraft(question);
    });
    return () => receiveTutorOpen(null);
  }, []);

  /* An empty grid is not a circuit — a measurement on its own is. */
  const hasCircuit = Boolean(
    circuit.ir &&
    (circuit.ir.timeline.length || circuit.ir.measurements?.length),
  );
  const suggestions = hasCircuit ? CIRCUIT_SUGGESTIONS : TUTOR_SUGGESTIONS;
  const live = health?.tutor?.live;
  const status = !health
    ? probed
      ? "offline · start the API"
      : "connecting…"
    : live
      ? `${health.tutor.model} · streaming`
      : "local read-out · Qiskit";

  return (
    <>
      {/* Collapsed handle.

          Hidden whenever the mascot is on screen, because the mascot is this
          same button with a face on and they would otherwise sit on top of one
          another in the same corner. It survives for the case the 3D layer
          cannot run — no WebGL, or reduced hardware — where this pill is then
          the only way in. */}
      <AnimatePresence>
        {!open && !mascotPresent && (
          <motion.button
            type="button"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            onClick={() => setOpen(true)}
            aria-label="Open the AI tutor"
            className="panel fixed right-4 bottom-6 z-40 flex items-center gap-2.5 py-3 pr-4 pl-3 text-sm text-paper transition-colors hover:border-filament focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-filament sm:bottom-8"
          >
            <span className="flex size-7 items-center justify-center bg-filament">
              <Sparkles className="size-3.5 text-void" />
            </span>
            <span className="hidden sm:inline">Ask the tutor</span>
            <kbd className="hidden rounded border border-edge bg-strata px-1.5 py-0.5 font-mono text-[11px] text-frost sm:inline">
              {shortcut}
            </kbd>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Expanded panel. */}
      <AnimatePresence>
        {open && (
          <motion.aside
            initial={{ opacity: 0, x: 34 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 34 }}
            transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
            data-tutor-panel
            className="panel fixed inset-x-3 bottom-3 z-40 flex flex-col overflow-hidden rounded-2xl sm:inset-x-auto sm:top-20 sm:right-4 sm:bottom-5 sm:w-[384px]"
            aria-label="AI tutor"
          >
            <header className="flex items-center gap-2.5 border-b border-edge px-4 py-3">
              <span className="flex size-7 items-center justify-center bg-filament">
                <Sparkles className="size-3.5 text-void" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold">Tutor</p>
                <p
                  className={cn(
                    "truncate font-mono text-[11px] tracking-[0.14em] uppercase",
                    health ? "text-filament" : "text-frost",
                  )}
                >
                  {status}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Collapse the tutor"
                className="ml-auto flex size-8 items-center justify-center rounded-full text-frost transition-colors hover:bg-strata hover:text-paper"
              >
                <PanelRightClose className="size-4" />
              </button>
            </header>

            <ContextStrip pathname={pathname} circuit={circuit} />

            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-4 px-4 py-4">
                {/* Opening turn: what it can see, and where the answer comes from. */}
                <Turn
                  turn={{
                    id: "intro",
                    from: "tutor",
                    body: hasCircuit
                      ? `I can see the circuit in your sandbox — ${circuit.summary}. Ask about it and I will rebuild it with Qiskit before answering, so the numbers I quote are yours.`
                      : "Open the sandbox and build something, and I will read the circuit straight off the page. You can also ask a plain question about any module.",
                    looking: hasCircuit ? circuit.summary : undefined,
                  }}
                  onChip={send}
                />

                {messages.map((message) => (
                  <Turn key={message.id} turn={message} onChip={send} />
                ))}

                {busy && (
                  <div className="flex items-center gap-2 pl-8">
                    <span className="flex gap-1">
                      {[0, 1, 2].map((dot) => (
                        <motion.span
                          key={dot}
                          className="size-1.5 bg-filament"
                          animate={{ opacity: [0.25, 1, 0.25] }}
                          transition={{
                            duration: 1.3,
                            repeat: Infinity,
                            delay: dot * 0.18,
                            ease: "easeInOut",
                          }}
                        />
                      ))}
                    </span>
                    <span className="font-mono text-[11px] tracking-[0.14em] text-frost uppercase">
                      {live
                        ? "Thinking about your circuit"
                        : "Measuring your circuit"}
                    </span>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>
            </ScrollArea>

            <div className="border-t border-edge px-4 py-3">
              <div className="mb-2.5 flex flex-wrap gap-1.5">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => void send(suggestion)}
                    disabled={busy}
                    className="border border-edge bg-strata px-2.5 py-1 text-left text-[11px] text-frost transition-colors hover:border-filament hover:text-paper disabled:opacity-40"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void send(draft);
                }}
                className="flex items-end gap-2 rounded-xl border border-edge bg-void/80 p-2 focus-within:border-filament"
              >
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void send(draft);
                    }
                  }}
                  rows={1}
                  placeholder="Ask about the circuit on screen…"
                  className="max-h-28 min-h-8 flex-1 resize-none bg-transparent px-1.5 py-1.5 text-[13px] text-paper placeholder:text-frost focus:outline-none"
                />
                {busy ? (
                  <button
                    type="button"
                    onClick={() => abort.current?.abort()}
                    aria-label="Stop the answer"
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-edge-hi bg-strata text-collapse transition-colors hover:bg-strata"
                  >
                    <Square className="size-3.5" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    aria-label="Send message"
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-filament text-void transition-colors hover:bg-[#ffa855] disabled:opacity-35"
                    disabled={!draft.trim()}
                  >
                    <ArrowUp className="size-4" />
                  </button>
                )}
              </form>
              <p className="mt-2 font-mono text-[11px] leading-relaxed text-frost">
                {health
                  ? live
                    ? "Explanations are generated. Verify anything you plan to submit."
                    : "No model key on the server, so answers are computed from your circuit."
                  : probed
                    ? `No tutor service at ${API_BASE}. The sandbox still works without it.`
                    : "Looking for the tutor service…"}
              </p>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
