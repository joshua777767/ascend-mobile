import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import {
  useGetTodaySchedule,
  useGetCurrentPlan,
  useGetUserProfile,
  useUpdateScheduleItem,
  useCreateCustomTask,
  useDeleteCustomTask,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useTrialDay } from "@/hooks/use-trial";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Clock, Zap, Check, X, Pencil, GripVertical, Plus, Trash2 } from "lucide-react";

// ─── types ────────────────────────────────────────────────────────────────────

type ScheduleItem = {
  id?: number;
  time: string;
  activity: string;
  type: string;
  notes: string | null;
  status: string | null;
  isCustom?: boolean;
};

// ─── constants ────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, { card: string; badge: string }> = {
  meal:      { card: "border-l-success/40 bg-success/5",  badge: "bg-success/10 text-success border border-success/20" },
  workout:   { card: "border-l-primary/40 bg-primary/5",  badge: "bg-primary/10 text-primary border border-primary/20" },
  sleep:     { card: "border-l-primary/40 bg-primary/5",  badge: "bg-primary/10 text-primary border border-primary/20" },
  hydration: { card: "border-l-primary/40 bg-primary/5",  badge: "bg-primary/10 text-primary border border-primary/20" },
  health:    { card: "border-l-success/40 bg-success/5",  badge: "bg-success/10 text-success border border-success/20" },
  work:      { card: "border-l-warning/40 bg-warning/5",  badge: "bg-warning/10 text-warning border border-warning/20" },
  habit:     { card: "border-l-warning/40 bg-warning/5",  badge: "bg-warning/10 text-warning border border-warning/20" },
  journal:   { card: "border-l-primary/40 bg-primary/5",  badge: "bg-primary/10 text-primary border border-primary/20" },
  sport:     { card: "border-l-success/40 bg-success/5",  badge: "bg-success/10 text-success border border-success/20" },
};
const FB = { card: "border-l-border bg-muted/10", badge: "bg-muted/20 text-muted-foreground border border-border" };

const BTN = "inline-flex items-center justify-center gap-1 rounded-lg text-xs font-semibold transition-all active:scale-95 select-none min-h-[34px] px-2.5 py-1";
const BTN_DEFAULT = `${BTN} bg-elevated border border-border/60 text-muted-foreground hover:text-foreground hover:border-border`;
const BTN_PRIMARY = `${BTN} bg-primary/10 border border-primary/30 text-primary hover:bg-primary/15 px-3`;
const BTN_SUCCESS = `${BTN} bg-green-500/10 border border-green-500/30 text-green-400`;
const BTN_SKIP    = `${BTN} bg-elevated border border-border/60 text-muted-foreground hover:text-destructive hover:border-destructive/40`;
const BTN_SKIP_ON = `${BTN} bg-elevated border border-border/60 text-foreground`;
const BTN_DEL     = `${BTN} bg-red-500/5 border border-red-500/20 text-red-400 hover:bg-red-500/10 hover:border-red-500/40`;

const CATEGORIES = [
  { label: "Meal",    value: "meal" },
  { label: "Workout", value: "workout" },
  { label: "Water",   value: "hydration" },
  { label: "Journal", value: "journal" },
  { label: "Custom",  value: "habit" },
] as const;

// ─── helpers ──────────────────────────────────────────────────────────────────

function addMins(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = ((h ?? 0) * 60 + (m ?? 0) + mins + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
function ikey(item: ScheduleItem) { return `${item.activity}::${item.type}::${item.id ?? ""}`; }
function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function toMins(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

// ─── localStorage order ───────────────────────────────────────────────────────

const ORDER_KEY = `ascend.scheduleOrder.${new Date().toISOString().slice(0, 10)}`;
function getSavedOrder(): string[] { try { return JSON.parse(localStorage.getItem(ORDER_KEY) ?? "[]"); } catch { return []; } }
function setSavedOrder(keys: string[]) { localStorage.setItem(ORDER_KEY, JSON.stringify(keys)); }
function clearSavedOrder() { localStorage.removeItem(ORDER_KEY); }

function mergeWithOrder(serverItems: ScheduleItem[], savedOrder: string[]): ScheduleItem[] {
  if (!savedOrder.length) return [...serverItems].sort((a, b) => a.time.localeCompare(b.time));
  const map = new Map(serverItems.map(i => [ikey(i), i]));
  const result: ScheduleItem[] = [];
  const seen = new Set<string>();
  for (const k of savedOrder) {
    const item = map.get(k);
    if (item) { result.push(item); seen.add(k); }
  }
  const extras = serverItems.filter(i => !seen.has(ikey(i))).sort((a, b) => a.time.localeCompare(b.time));
  return [...result, ...extras];
}

// ─── Add Task modal ───────────────────────────────────────────────────────────

function AddTaskModal({
  onClose,
  onSave,
  saving,
}: {
  onClose: () => void;
  onSave: (data: { activity: string; type: string; time: string; notes?: string }) => void;
  saving: boolean;
}) {
  const [name, setName] = useState("");
  const [time, setTime] = useState(nowHHMM());
  const [category, setCategory] = useState<string>("habit");
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState("");

  const handleSave = () => {
    if (!name.trim()) { setErr("Task name is required."); return; }
    onSave({ activity: name.trim(), type: category, time, notes: notes.trim() || undefined });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}>
      <div className="w-full max-w-lg rounded-t-3xl p-5 pb-8 flex flex-col gap-4"
        style={{ background: "hsl(220 14% 10%)", border: "1px solid hsl(217 32% 18%)" }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight">Add Task</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors text-xl leading-none">×</button>
        </div>

        {/* Task name */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-muted-foreground">Task name</label>
          <input
            type="text"
            value={name}
            onChange={e => { setName(e.target.value); setErr(""); }}
            placeholder="e.g. Take vitamins"
            autoFocus
            className="w-full bg-elevated border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        {/* Time */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-muted-foreground">Time</label>
          <input
            type="time"
            value={time}
            onChange={e => setTime(e.target.value)}
            className="w-full bg-elevated border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        {/* Category */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-muted-foreground">Category</label>
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map(c => (
              <button key={c.value} type="button"
                onClick={() => setCategory(c.value)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all",
                  category === c.value
                    ? "bg-primary/15 border-primary/40 text-primary"
                    : "bg-elevated border-border text-muted-foreground hover:text-foreground"
                )}>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-muted-foreground">Notes <span className="text-muted-foreground/50">(optional)</span></label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Any details…"
            rows={2}
            className="w-full bg-elevated border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
          />
        </div>

        {err && <p className="text-xs text-destructive">{err}</p>}

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 h-12 rounded-2xl border border-border text-sm font-semibold text-muted-foreground hover:bg-elevated transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 h-12 rounded-2xl text-sm font-semibold text-primary-foreground disabled:opacity-60 transition-all active:scale-[0.99]"
            style={{ background: "#C89A3E" }}>
            {saving ? "Saving…" : "Add to Schedule"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export default function SchedulePage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { isPro } = useTrialDay();
  const { data: profile, isError: profileError } = useGetUserProfile();
  const { data: schedule, isLoading } = useGetTodaySchedule();
  const { data: plan } = useGetCurrentPlan();
  const { mutateAsync: updateItem } = useUpdateScheduleItem();
  const { mutateAsync: createTask, isPending: creating } = useCreateCustomTask();
  const { mutateAsync: deleteTask } = useDeleteCustomTask();

  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editTime, setEditTime] = useState("");
  const [currentTime, setCurrentTime] = useState(nowHHMM);
  const [showAddModal, setShowAddModal] = useState(false);

  const dragIdx = useRef<number | null>(null);
  const dragOverIdx = useRef<number | null>(null);

  useEffect(() => { if (profileError) setLocation("/onboarding"); }, [profileError, setLocation]);
  useEffect(() => {
    const id = setInterval(() => setCurrentTime(nowHHMM()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!schedule?.items) return;
    const order = getSavedOrder();
    setItems(mergeWithOrder(schedule.items as ScheduleItem[], order));
  }, [schedule]);

  void profile;

  // ── mutations ─────────────────────────────────────────────────────────────

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["getTodaySchedule"] });

  const patchItem = async (item: ScheduleItem, patch: { time?: string; status?: string }) => {
    try {
      await updateItem({ data: { activity: item.activity, type: item.type, ...patch } as any });
      invalidate();
    } catch { invalidate(); }
  };

  const handleTimeChange = (item: ScheduleItem, newTime: string) => {
    setItems(prev =>
      prev.map(i => ikey(i) === ikey(item) ? { ...i, time: newTime } : i)
          .sort((a, b) => a.time.localeCompare(b.time))
    );
    clearSavedOrder();
    setEditingKey(null);
    patchItem(item, { time: newTime });
  };

  const handleStatusChange = (item: ScheduleItem, newStatus: string) => {
    setItems(prev => prev.map(i => ikey(i) === ikey(item) ? { ...i, status: newStatus } : i));
    patchItem(item, { status: newStatus });
  };

  const handleDelete = async (item: ScheduleItem) => {
    if (!item.id) return;
    setItems(prev => prev.filter(i => ikey(i) !== ikey(item)));
    try {
      await deleteTask({ id: item.id });
      invalidate();
    } catch { invalidate(); }
  };

  const handleAddTask = async (data: { activity: string; type: string; time: string; notes?: string }) => {
    try {
      await createTask({ data });
      invalidate();
      setShowAddModal(false);
    } catch {
      // keep modal open on error
    }
  };

  // ── drag and drop ─────────────────────────────────────────────────────────

  const onDragStart = (idx: number) => { dragIdx.current = idx; };
  const onDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx.current === null || dragIdx.current === idx || dragOverIdx.current === idx) return;
    dragOverIdx.current = idx;
    setItems(prev => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx.current!, 1);
      next.splice(idx, 0, moved);
      dragIdx.current = idx;
      return next;
    });
  };
  const onDragEnd = () => {
    setSavedOrder(items.map(ikey));
    dragIdx.current = null;
    dragOverIdx.current = null;
  };

  // ── derived ───────────────────────────────────────────────────────────────

  const nowMins = toMins(currentTime);
  const nextIdx = items.findIndex(i => i.status !== "completed" && i.status !== "skipped" && toMins(i.time) >= nowMins);

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="h-full overflow-y-auto scroll-area overscroll-contain">
      <div className="px-4 max-w-lg mx-auto pb-10">

        {/* Header */}
        <div className="pt-5 pb-4 flex items-end justify-between">
          <div>
            <p className="text-xs text-muted-foreground">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>
            <h1 className="text-[1.6rem] font-bold tracking-tight mt-0.5">Daily schedule</h1>
          </div>
          {/* + Add Task button */}
          <button
            onClick={() => { if (!isPro) { setLocation("/pricing"); } else { setShowAddModal(true); } }}
            className="flex items-center gap-1.5 h-9 px-4 rounded-xl text-sm font-semibold text-primary-foreground shrink-0 active:scale-95 transition-all"
            style={{ background: "#C89A3E" }}
          >
            <Plus className="w-3.5 h-3.5" />
            Add Task
            {!isPro && <span className="text-[10px] font-bold opacity-70 ml-0.5">PRO</span>}
          </button>
        </div>

        {/* Mission banner */}
        {schedule?.todaysMission && (
          <div className="mb-4 rounded-2xl p-3.5 flex gap-2.5"
            style={{ background: "rgba(107,139,174,0.08)", border: "1px solid rgba(107,139,174,0.20)" }}>
            <Zap className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-primary font-semibold mb-0.5">Daily mission</p>
              <p className="text-sm text-foreground leading-relaxed">{schedule.todaysMission}</p>
            </div>
          </div>
        )}

        {/* Target chips */}
        {plan && (
          <div className="mb-5 flex gap-2">
            {[
              { val: plan.calorieTarget.toLocaleString(), label: "calories" },
              { val: `${plan.proteinTargetG}g`, label: "protein" },
              { val: `${plan.waterTargetL}L`, label: "water" },
            ].map((s, i) => (
              <div key={i} className="flex-1 rounded-xl p-3 text-center"
                style={{ background: "hsl(220 52% 8%)", border: "1px solid hsl(217 32% 14%)" }}>
                <p className="text-base font-bold text-primary leading-none">{s.val}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Drag hint */}
        {items.length > 0 && (
          <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
            <GripVertical className="w-3 h-3" /> Drag to reorder · ±15m or Edit Time to adjust
          </p>
        )}

        {/* Schedule items */}
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
            {items.map((item, idx) => {
              const itemMins = toMins(item.time);
              const isPast = itemMins < nowMins - 5;
              const isNext = idx === nextIdx;
              const isCompleted = item.status === "completed";
              const isSkipped = item.status === "skipped";
              const isMissed = isPast && !isCompleted && !isSkipped;
              const colors = TYPE_COLORS[item.type] ?? FB;
              const key = ikey(item);
              const isEditing = editingKey === key;

              return (
                <div key={key}
                  draggable
                  onDragStart={() => onDragStart(idx)}
                  onDragOver={e => onDragOver(e, idx)}
                  onDragEnd={onDragEnd}
                  className={cn(
                    "flex gap-2 transition-all duration-200",
                    isCompleted && "opacity-40",
                    isSkipped && "opacity-30",
                    isMissed && "opacity-50",
                  )}>

                  {/* Drag handle */}
                  <div className="w-5 shrink-0 flex items-start pt-4 cursor-grab active:cursor-grabbing">
                    <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40" />
                  </div>

                  {/* Time column */}
                  <div className="w-11 shrink-0 text-right pt-3.5">
                    <span className={cn(
                      "text-[11px] font-mono leading-none",
                      isNext ? "text-primary font-bold" : "text-muted-foreground"
                    )}>
                      {item.time}
                    </span>
                  </div>

                  {/* Card */}
                  <div className={cn("flex-1 min-w-0 rounded-2xl border-l-4 px-3.5 py-3", colors.card)}
                    style={{
                      border: isNext ? "1px solid hsl(217 80% 45% / 0.45)" : "1px solid hsl(217 32% 14%)",
                      borderLeftWidth: "3px",
                      background: isNext ? "hsl(220 52% 8%)" : undefined,
                    }}>

                    {/* Row 1: badge + title + pills */}
                    <div className="flex items-start gap-2 mb-1.5 flex-wrap">
                      <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-semibold shrink-0 mt-0.5", colors.badge)}>
                        {item.isCustom ? "custom" : item.type}
                      </span>
                      <p className={cn(
                        "text-sm font-bold flex-1 min-w-0 leading-snug",
                        isNext && "text-primary",
                        (isSkipped || isCompleted) && "line-through",
                      )}>
                        {item.activity}
                      </p>
                      {isNext && !isSkipped && !isCompleted && (
                        <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                          style={{ background: "rgba(107,139,174,0.15)", color: "#6B8BAE" }}>
                          Next up
                        </span>
                      )}
                      {isCompleted && (
                        <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold text-green-400"
                          style={{ background: "rgba(34,197,94,0.1)" }}>
                          Done ✓
                        </span>
                      )}
                      {isMissed && (
                        <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] text-muted-foreground/60">
                          Missed
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
                        <input type="time" value={editTime}
                          onChange={e => setEditTime(e.target.value)}
                          autoFocus
                          className="flex-1 min-w-0 bg-elevated border border-primary/40 rounded-lg text-sm text-foreground px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/40" />
                        <button className={BTN_SUCCESS} onClick={() => handleTimeChange(item, editTime)}>
                          <Check className="w-3.5 h-3.5" /> Save
                        </button>
                        <button className={BTN_DEFAULT} onClick={() => setEditingKey(null)}>
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Action buttons */}
                    {!isEditing && (
                      <div className="flex flex-wrap gap-1.5">
                        <button className={BTN_DEFAULT} onClick={() => handleTimeChange(item, addMins(item.time, -15))} title="−15 min">−15m</button>
                        <button className={BTN_DEFAULT} onClick={() => handleTimeChange(item, addMins(item.time, 15))} title="+15 min">+15m</button>
                        <button className={BTN_PRIMARY} onClick={() => { setEditingKey(key); setEditTime(item.time); }}>
                          <Pencil className="w-3 h-3" /> Edit Time
                        </button>
                        <button
                          className={isCompleted ? BTN_SUCCESS : BTN_DEFAULT}
                          onClick={() => handleStatusChange(item, isCompleted ? "active" : "completed")}>
                          <Check className="w-3.5 h-3.5" />
                          {isCompleted ? "Done" : "Mark Done"}
                        </button>
                        <button
                          className={isSkipped ? BTN_SKIP_ON : BTN_SKIP}
                          onClick={() => handleStatusChange(item, isSkipped ? "active" : "skipped")}>
                          {isSkipped ? "Restore" : "Skip"}
                        </button>
                        {item.isCustom && (
                          <button className={BTN_DEL} onClick={() => handleDelete(item)} title="Delete task">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && items.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-semibold">No schedule yet.</p>
            <p className="text-xs mt-1">Complete onboarding to generate your plan.</p>
          </div>
        )}

        {/* + Add Task (bottom) */}
        {!isLoading && items.length > 0 && (
          <button
            onClick={() => { if (!isPro) { setLocation("/pricing"); } else { setShowAddModal(true); } }}
            className="w-full mt-5 h-12 rounded-2xl border border-dashed border-border text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all flex items-center justify-center gap-2 active:scale-[0.99]"
          >
            <Plus className="w-4 h-4" />
            Add Task
            {!isPro && <span className="text-[10px] font-bold text-primary ml-0.5">PRO</span>}
          </button>
        )}

      </div>

      {/* Add Task modal */}
      {showAddModal && (
        <AddTaskModal
          onClose={() => setShowAddModal(false)}
          onSave={handleAddTask}
          saving={creating}
        />
      )}
    </div>
  );
}
