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
  "Can I eat this?",
  "I missed the gym today. What now?",
  "I'm starving. What do I do?",
  "Why am I not losing weight?",
  "Why am I not gaining weight?",
  "What should my schedule be tomorrow?",
  "How do I get better skin?",
  "Why is my energy low?",
];

export default function CoachPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: profile, isError: profileError } = useGetUserProfile();
  const { data: history, isLoading: loadingHistory } = useGetChatHistory();
  const sendMessage = useSendChatMessage();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (profileError) setLocation("/onboarding");
  }, [profileError, setLocation]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

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

  return (
    <div className="h-full flex flex-col">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto scroll-area p-4 space-y-4">
        {loadingHistory ? (
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
                    "max-w-[85%] px-4 py-3 text-sm",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border border-border text-foreground"
                  )}
                >
                  {msg.role === "assistant" && (
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-1.5">Coach</p>
                  )}
                  <p className="leading-relaxed">{msg.content}</p>
                  <p className={cn("text-[10px] mt-1.5 opacity-60")}>
                    {new Date(msg.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))}
            {sendMessage.isPending && (
              <div className="flex justify-start">
                <div className="bg-card border border-border px-4 py-3 text-sm max-w-[85%]">
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
      <div className="shrink-0 p-3 border-t border-border bg-card">
        <div className="flex gap-2 items-end">
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
