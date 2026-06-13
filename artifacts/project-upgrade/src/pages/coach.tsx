import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useGetChatHistory, useSendChatMessage, useGetUserProfile, getGetChatHistoryQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Send, MessageSquare } from "lucide-react";

const SUGGESTED_QUESTIONS = [
  "What should I eat next?",
  "I missed my workout, what now?",
  "How do I get more energy?",
  "How do I stop snacking at night?",
  "How do I gain weight faster?",
  "How do I stay disciplined?",
];

// Read the ?emergency= param once at module-call time (before any re-renders)
function getEmergencyParam(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("emergency");
}

export default function CoachPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: profile, isError: profileError } = useGetUserProfile();
  const { data: history, isLoading: loadingHistory } = useGetChatHistory();
  const sendMessage = useSendChatMessage();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Emergency prompt: read once from URL, show instantly, send on mount
  const [pendingEmergency, setPendingEmergency] = useState<string | null>(getEmergencyParam);
  const emergencySentRef = useRef(false);

  useEffect(() => {
    if (profileError) setLocation("/onboarding");
  }, [profileError, setLocation]);

  // Auto-send the emergency message and clean the URL immediately on mount
  useEffect(() => {
    if (!pendingEmergency || emergencySentRef.current) return;
    emergencySentRef.current = true;
    // Clean the URL so back-navigation or re-mount doesn't re-trigger
    window.history.replaceState({}, "", window.location.pathname);
    sendMessage
      .mutateAsync({ data: { message: pendingEmergency } })
      .then(() => queryClient.invalidateQueries({ queryKey: getGetChatHistoryQueryKey() }))
      .catch(() => {})
      .finally(() => setPendingEmergency(null));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, pendingEmergency]);

  const handleSend = async (msg?: string) => {
    const text = (msg ?? input).trim();
    if (!text) return;
    setInput("");
    try {
      await sendMessage.mutateAsync({ data: { message: text } });
      queryClient.invalidateQueries({ queryKey: getGetChatHistoryQueryKey() });
    } catch (e) { console.error(e); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Optimistic emergency UI: show immediately before history loads/updates
  const showEmergencyOptimistic = !!pendingEmergency;

  return (
    <div className="h-full flex flex-col">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto scroll-area p-4 space-y-4">
        {showEmergencyOptimistic ? (
          // Instant optimistic view while emergency message is in-flight
          <>
            {/* Existing history if already loaded */}
            {history?.map((msg, i) => (
              <div
                key={i}
                className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
                data-testid={`chat-message-${i}`}
              >
                <div
                  className={cn(
                    "max-w-[85%] px-4 py-3 text-sm rounded-2xl",
                    msg.role === "user"
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-bl-sm bg-card border border-border text-foreground"
                  )}
                >
                  {msg.role === "assistant" && (
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-1.5">Coach</p>
                  )}
                  <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  <p className={cn("text-[10px] mt-1.5 opacity-60")}>
                    {new Date(msg.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))}
            {/* Optimistic user bubble */}
            <div className="flex justify-end">
              <div className="max-w-[85%] px-4 py-3 text-sm rounded-2xl rounded-br-sm bg-primary text-primary-foreground">
                <p className="leading-relaxed whitespace-pre-wrap">{pendingEmergency}</p>
              </div>
            </div>
            {/* Typing indicator */}
            <div className="flex justify-start">
              <div className="bg-card border border-border px-4 py-3 text-sm max-w-[85%] rounded-2xl rounded-bl-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-1.5">Coach</p>
                <div className="flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  <span className="text-[10px] text-muted-foreground ml-1.5">Coach is thinking…</span>
                </div>
              </div>
            </div>
          </>
        ) : loadingHistory ? (
          <div className="space-y-4">
            {Array.from({length:3}).map((_,i) => (
              <div key={i} className={cn("flex", i % 2 === 0 ? "justify-end" : "justify-start")}>
                <Skeleton className="h-16 w-3/4" />
              </div>
            ))}
          </div>
        ) : history && history.length > 0 ? (
          <>
            {history.map((msg, i) => (
              <div
                key={i}
                className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
                data-testid={`chat-message-${i}`}
              >
                <div
                  className={cn(
                    "max-w-[85%] px-4 py-3 text-sm rounded-2xl",
                    msg.role === "user"
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-bl-sm bg-card border border-border text-foreground"
                  )}
                >
                  {msg.role === "assistant" && (
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-1.5">Coach</p>
                  )}
                  <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  <p className={cn("text-[10px] mt-1.5 opacity-60")}>
                    {new Date(msg.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))}
            {sendMessage.isPending && (
              <div className="flex justify-start">
                <div className="bg-card border border-border px-4 py-3 text-sm max-w-[85%] rounded-2xl rounded-bl-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-1.5">Coach</p>
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-4">
            <div className="text-center py-8">
              <MessageSquare className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="text-sm text-muted-foreground uppercase tracking-wider">Ask your coach anything.</p>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest text-center mb-3">Common Questions</p>
              <div className="grid grid-cols-1 gap-2">
                {SUGGESTED_QUESTIONS.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(q)}
                    className="text-left text-sm px-3 py-2.5 border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40 active:bg-muted/50 transition-colors"
                    data-testid={`suggested-question-${i}`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-border bg-card">
        {history && history.length > 0 && (
          <div className="flex gap-2 overflow-x-auto scroll-area px-3 pt-3 pb-1">
            {SUGGESTED_QUESTIONS.map((q, i) => (
              <button
                key={i}
                onClick={() => handleSend(q)}
                disabled={sendMessage.isPending}
                className="shrink-0 whitespace-nowrap text-xs px-3 py-1.5 rounded-full border border-border bg-background text-muted-foreground hover:text-foreground hover:border-primary/40 active:bg-muted/50 transition-colors disabled:opacity-50"
                data-testid={`quick-question-${i}`}
              >
                {q}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2 items-end p-3">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask your coach..."
            className="bg-background border-border resize-none text-sm flex-1"
            style={{ minHeight: "44px", maxHeight: "120px" }}
            rows={1}
            data-testid="input-chat-message"
          />
          <Button
            onClick={() => handleSend()}
            disabled={sendMessage.isPending || !input.trim()}
            className="shrink-0 h-11 w-11 p-0"
            data-testid="button-send-message"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
