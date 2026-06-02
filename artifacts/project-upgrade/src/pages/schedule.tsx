import { useLocation } from "wouter";
import { useGetTodaySchedule, useGetCurrentPlan, useGetUserProfile } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Clock, Zap } from "lucide-react";
import { useEffect } from "react";

const TYPE_COLORS: Record<string, string> = {
  meal: "text-green-400 border-green-400/30 bg-green-400/5",
  workout: "text-primary border-primary/30 bg-primary/5",
  sleep: "text-blue-400 border-blue-400/30 bg-blue-400/5",
  hydration: "text-cyan-400 border-cyan-400/30 bg-cyan-400/5",
  health: "text-purple-400 border-purple-400/30 bg-purple-400/5",
  work: "text-yellow-400 border-yellow-400/30 bg-yellow-400/5",
  habit: "text-orange-400 border-orange-400/30 bg-orange-400/5",
  journal: "text-pink-400 border-pink-400/30 bg-pink-400/5",
};

export default function SchedulePage() {
  const [, setLocation] = useLocation();
  const { data: profile, isError: profileError } = useGetUserProfile();
  const { data: schedule, isLoading } = useGetTodaySchedule();
  const { data: plan } = useGetCurrentPlan();

  useEffect(() => {
    if (profileError) setLocation("/onboarding");
  }, [profileError, setLocation]);

  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;

  return (
    <div className="h-full overflow-y-auto scroll-area">
      <div className="p-4 max-w-2xl mx-auto">
        <div className="mb-5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
          <h1 className="text-2xl font-bold uppercase tracking-tighter mt-0.5">Daily Schedule</h1>
        </div>

        {schedule?.todaysMission && (
          <div className="mb-5 bg-primary/10 border border-primary/20 p-3 flex gap-2.5">
            <Zap className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-0.5">Today's Mission</p>
              <p className="text-sm text-foreground">{schedule.todaysMission}</p>
            </div>
          </div>
        )}

        {plan && (
          <div className="mb-5 flex gap-2">
            {[
              { val: plan.calorieTarget, label: "Cal" },
              { val: `${plan.proteinTargetG}g`, label: "Protein" },
              { val: `${plan.waterTargetL}L`, label: "Water" },
            ].map((s, i) => (
              <div key={i} className="flex-1 bg-card border border-border p-3 text-center">
                <p className="text-lg font-bold text-primary">{s.val}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex gap-4 items-start">
                <Skeleton className="w-12 h-4 mt-1" />
                <Skeleton className="flex-1 h-16" />
              </div>
            ))}
          </div>
        ) : (
          <div className="relative">
            <div className="absolute left-14 top-0 bottom-0 w-px bg-border" />
            <div className="space-y-1">
              {schedule?.items.map((item, idx) => {
                const isPast = item.time < currentTime;
                const isCurrent = Math.abs(
                  parseInt(item.time.replace(":","")) - parseInt(currentTime.replace(":",""))
                ) < 30;
                const colorClass = TYPE_COLORS[item.type] || "text-muted-foreground border-border bg-muted/10";
                return (
                  <div
                    key={idx}
                    className={cn("flex gap-4 items-start py-2.5 transition-opacity", isPast && !isCurrent && "opacity-40")}
                    data-testid={`schedule-item-${idx}`}
                  >
                    <div className="w-12 text-right shrink-0">
                      <span className={cn("text-xs font-mono", isCurrent ? "text-primary font-bold" : "text-muted-foreground")}>
                        {item.time}
                      </span>
                    </div>
                    <div className="relative flex-1">
                      <div className={cn("absolute -left-[1.35rem] top-2 w-2 h-2 border", isCurrent ? "bg-primary border-primary" : "bg-background border-border")} />
                      <div className={cn("border p-3", colorClass)}>
                        <div className="flex items-center justify-between gap-2">
                          <p className={cn("text-sm font-semibold", isCurrent && "text-primary")}>{item.activity}</p>
                          <span className={cn("text-[10px] uppercase tracking-wider px-2 py-0.5 border shrink-0", colorClass)}>{item.type}</span>
                        </div>
                        {item.notes && <p className="text-xs text-muted-foreground mt-1">{item.notes}</p>}
                        {isCurrent && (
                          <p className="text-[10px] text-primary font-semibold mt-1 uppercase tracking-wider">Now</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!isLoading && !schedule && (
          <div className="text-center py-16 text-muted-foreground">
            <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm uppercase tracking-wider">No schedule generated yet.</p>
            <p className="text-xs mt-1">Complete onboarding to generate your plan.</p>
          </div>
        )}
      </div>
    </div>
  );
}
