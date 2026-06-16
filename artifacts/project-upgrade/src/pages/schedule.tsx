import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useGetTodaySchedule, useGetCurrentPlan, useGetUserProfile, useUpdateScheduleItem } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Clock, Zap, Check, X, Pencil } from "lucide-react";

const TYPE_COLORS: Record<string, { card: string; badge: string; dot: string }> = {
  meal:       { card: "border-l-success/30 bg-success/5",     badge: "bg-success/10 text-success border border-success/20",   dot: "bg-success" },
  workout:    { card: "border-l-primary/30 bg-primary/5",       badge: "bg-primary/10 text-primary border border-primary/20",     dot: "bg-primary" },
  sleep:      { card: "border-l-primary/30 bg-primary/5",   badge: "bg-primary/10 text-primary border border-primary/20", dot: "bg-primary" },
  hydration:  { card: "border-l-primary/30 bg-primary/5",       badge: "bg-primary/10 text-primary border border-primary/20",     dot: "bg-primary" },
  health:     { card: "border-l-success/30 bg-success/5",   badge: "bg-success/10 text-success border border-success/20", dot: "bg-success" },
  work:       { card: "border-l-warning/30 bg-warning/5",   badge: "bg-warning/10 text-warning border border-warning/20", dot: "bg-warning" },
  habit:      { card: "border-l-warning/30 bg-warning/5",   badge: "bg-warning/10 text-warning border border-warning/20", dot: "bg-warning" },
  journal:    { card: "border-l-primary/30 bg-primary/5",       badge: "bg-primary/10 text-primary border border-primary/20",     dot: "bg-primary" },
  sport:      { card: "border-l-success/30 bg-success/5",     badge: "bg-success/10 text-success border border-success/20",  dot: "bg-success" },
};

const FALLBACK_COLORS = { card: "border-l-border bg-muted/10", badge: "bg-muted/20 text-muted-foreground border border-border", dot: "bg-muted-foreground" };

function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = (h ?? 0) * 60 + (m ?? 0) + mins;
  const nh = Math.floor(((total % 1440) + 1440) % 1440 / 60);
  const nm = ((total % 1440) + 1440) % 1440 % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

const BTN_BASE = "inline-flex items-center justify-center gap-1 rounded-lg text-xs font-semibold transition-all active:scale-95 select-none";
const BTN_DEFAULT = `${BTN_BASE} min-h-[34px] px-2.5 py-1 bg-elevated border border-border/60 text-muted-foreground hover:text-foreground hover:border-border`;
const BTN_PRIMARY = `${BTN_BASE} min-h-[34px] px-3 py-1 bg-primary/10 border border-primary/30 text-primary hover:bg-primary/15`;
const BTN_SUCCESS = `${BTN_BASE} min-h-[34px] px-2.5 py-1 bg-green-500/10 border border-green-500/30 text-green-400`;
const BTN_SKIP_ACTIVE = `${BTN_BASE} min-h-[34px] px-2.5 py-1 bg-elevated border border-border/60 text-foreground`;
const BTN_SKIP = `${BTN_BASE} min-h-[34px] px-2.5 py-1 bg-elevated border border-border/60 text-muted-foreground hover:text-destructive hover:border-destructive/40`;

export default function SchedulePage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: profile, isError: profileError } = useGetUserProfile();
  const { data: schedule, isLoading } = useGetTodaySchedule();
  const { data: plan } = useGetCurrentPlan();
  const { mutateAsync: updateItem } = useUpdateScheduleItem();

  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editTime, setEditTime] = useState("");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (profileError) setLocation("/onboarding");
  }, [profileError, setLocation]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const handleUpdate = async (
    item: { activity: string; type: string },
    patch: { time?: string; status?: "active" | "skipped" | "completed" }
  ) => {
    await updateItem({ data: { activity: item.activity, type: item.type, ...patch } });
    queryClient.invalidateQueries({ queryKey: ["getTodaySchedule"] });
  };

  return (
    <div className="h-full overflow-y-auto scroll-area overscroll-contain">
      <div className="px-4 max-w-lg mx-auto pb-10">

        {/* ── Header ── */}
        <div className="pt-5 pb-4">
          <p className="text-xs text-muted-foreground">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
          <h1 className="text-[1.6rem] font-bold tracking-tight mt-0.5">Daily schedule</h1>
        </div>

        {/* ── Mission banner ── */}
        {schedule?.todaysMission && (
          <div
            className="mb-4 rounded-2xl p-3.5 flex gap-2.5"
            style={{ background: "rgba(107,139,174,0.08)", border: "1px solid rgba(107,139,174,0.20)" }}
          >
            <Zap className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-primary font-semibold mb-0.5">Daily mission</p>
              <p className="text-sm text-foreground leading-relaxed">{schedule.todaysMission}</p>
            </div>
          </div>
        )}

        {/* ── Target chips ── */}
        {plan && (
          <div className="mb-5 flex gap-2">
            {[
              { val: plan.calorieTarget.toLocaleString(), label: "calories" },
              { val: `${plan.proteinTargetG}g`, label: "protein" },
              { val: `${plan.waterTargetL}L`, label: "water" },
            ].map((s, i) => (
              <div
                key={i}
                className="flex-1 rounded-xl p-3 text-center"
                style={{ background: "hsl(220 52% 8%)", border: "1px solid hsl(217 32% 14%)" }}
              >
                <p className="text-base font-bold text-primary leading-none">{s.val}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Schedule items ── */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex gap-3 items-start">
                <Skeleton className="w-12 h-4 mt-3 shrink-0 bg-elevated rounded" />
                <Skeleton className="flex-1 h-24 bg-elevated rounded-2xl" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2.5">
            {schedule?.items.map((item, idx) => {
              const timeMins = parseInt(item.time.replace(":", ""), 10);
              const nowMins = parseInt(currentTime.replace(":", ""), 10);
              const diffMins = Math.abs(
                parseInt(item.time.split(":")[0]!, 10) * 60 + parseInt(item.time.split(":")[1]!, 10) -
                (parseInt(currentTime.split(":")[0]!, 10) * 60 + parseInt(currentTime.split(":")[1]!, 10))
              );
              const isPast = item.time < currentTime;
              const isCurrent = diffMins < 30;
              const colors = TYPE_COLORS[item.type] ?? FALLBACK_COLORS;
              const isSkipped = item.status === "skipped";
              const isCompleted = item.status === "completed";
              const isEditing = editingIdx === idx;

              void timeMins; void nowMins;

              return (
                <div
                  key={idx}
                  data-testid={`schedule-item-${idx}`}
                  className={cn(
                    "flex gap-3 transition-opacity",
                    isPast && !isCurrent && "opacity-50",
                    isSkipped && "opacity-30"
                  )}
                >
                  {/* Time column */}
                  <div className="w-12 shrink-0 text-right pt-3.5">
                    <span className={cn(
                      "text-[11px] font-mono leading-none",
                      isCurrent ? "text-primary font-bold" : "text-muted-foreground"
                    )}>
                      {item.time}
                    </span>
                  </div>

                  {/* Card */}
                  <div
                    className={cn(
                      "flex-1 min-w-0 rounded-2xl border-l-4 px-3.5 py-3",
                      colors.card
                    )}
                    style={{ border: "1px solid hsl(217 32% 14%)", borderLeftWidth: "3px" }}
                  >
                    {/* Row 1: badge + title + NOW */}
                    <div className="flex items-start gap-2 mb-1.5 flex-wrap">
                      <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-semibold shrink-0 mt-0.5", colors.badge)}>
                        {item.type}
                      </span>
                      <p className={cn(
                        "text-sm font-bold flex-1 min-w-0 leading-snug",
                        isCurrent && "text-primary",
                        isSkipped && "line-through opacity-60"
                      )}>
                        {item.activity}
                      </p>
                      {isCurrent && !isSkipped && !isCompleted && (
                        <span
                          className="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold"
                          style={{ background: "rgba(107,139,174,0.12)", color: "#6B8BAE" }}
                        >
                          Now
                        </span>
                      )}
                    </div>

                    {/* Notes */}
                    {item.notes && !isEditing && (
                      <p className={cn("text-xs text-muted-foreground leading-relaxed mb-2.5", isSkipped && "line-through opacity-60")}>
                        {item.notes}
                      </p>
                    )}

                    {/* Edit time form */}
                    {isEditing && (
                      <div className="flex items-center gap-2 mb-2.5 pt-0.5">
                        <label className="text-xs text-muted-foreground shrink-0">New time:</label>
                        <input
                          type="time"
                          value={editTime}
                          onChange={e => setEditTime(e.target.value)}
                          autoFocus
                          className="flex-1 min-w-0 bg-elevated border border-primary/40 rounded-lg text-sm text-foreground px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/40"
                        />
                        <button
                          className={BTN_SUCCESS}
                          onClick={() => { handleUpdate(item, { time: editTime }); setEditingIdx(null); }}
                        >
                          <Check className="w-3.5 h-3.5" /> Save
                        </button>
                        <button
                          className={BTN_DEFAULT}
                          onClick={() => setEditingIdx(null)}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Action buttons */}
                    {!isEditing && (
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          className={BTN_DEFAULT}
                          onClick={() => handleUpdate(item, { time: addMinutes(item.time, -15) })}
                          title="Move 15 min earlier"
                        >
                          −15m
                        </button>
                        <button
                          className={BTN_DEFAULT}
                          onClick={() => handleUpdate(item, { time: addMinutes(item.time, 15) })}
                          title="Move 15 min later"
                        >
                          +15m
                        </button>
                        <button
                          className={BTN_PRIMARY}
                          onClick={() => { setEditingIdx(idx); setEditTime(item.time); }}
                        >
                          <Pencil className="w-3 h-3" /> Edit Time
                        </button>
                        <button
                          className={isCompleted ? BTN_SUCCESS : BTN_DEFAULT}
                          onClick={() => handleUpdate(item, { status: isCompleted ? "active" : "completed" })}
                        >
                          <Check className="w-3.5 h-3.5" />
                          {isCompleted ? "Done" : "Mark Done"}
                        </button>
                        <button
                          className={isSkipped ? BTN_SKIP_ACTIVE : BTN_SKIP}
                          onClick={() => handleUpdate(item, { status: isSkipped ? "active" : "skipped" })}
                        >
                          {isSkipped ? "Restore" : "Skip"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!isLoading && !schedule && (
          <div className="text-center py-16 text-muted-foreground">
            <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-semibold">No schedule generated yet.</p>
            <p className="text-xs mt-1">Complete onboarding to generate your plan.</p>
          </div>
        )}

      </div>
    </div>
  );
}
