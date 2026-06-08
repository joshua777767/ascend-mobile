import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Redirect } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, Search } from "lucide-react";
import { useMemo, useState } from "react";

const OWNER_EMAIL = "joshquag2010@icloud.com";

const CARD = "rounded-2xl bg-card border border-border p-4";
const VAL = "text-2xl font-black text-primary leading-none";
const LABEL = "text-[9px] font-black uppercase tracking-wider text-muted-foreground mt-1";

function formatDate(d: string | null): string {
  if (!d) return "Never";
  return new Date(d).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
  });
}

function timeAgo(d: string | null): string {
  if (!d) return "Never";
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function AdminPage() {
  const { user, isAuthed, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["adminStats"],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/stats`, { credentials: "include" });
      if (res.status === 403) throw new Error("forbidden");
      if (!res.ok) throw new Error("Failed to load stats");
      return res.json();
    },
    enabled: !!user,
    retry: false,
  });

  const filteredUsers = useMemo(() => {
    const all: any[] = stats?.allUsers ?? [];
    if (!search.trim()) return all;
    const q = search.trim().toLowerCase();
    return all.filter(
      (u) =>
        u.email?.toLowerCase().includes(q) ||
        u.name?.toLowerCase().includes(q),
    );
  }, [stats?.allUsers, search]);

  if (isLoading) {
    return (
      <div className="h-dvh bg-background flex flex-col items-center justify-center gap-4">
        <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Loading admin</p>
      </div>
    );
  }

  if (!isAuthed) {
    return <Redirect to="/login" />;
  }

  if (user?.email?.toLowerCase() !== OWNER_EMAIL) {
    return (
      <div className="h-dvh bg-background flex flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive">
          <Shield className="w-7 h-7" />
        </div>
        <p className="text-lg font-bold tracking-tight">Access denied</p>
        <p className="text-sm text-muted-foreground max-w-[300px]">
          You are not authorized to view this page.
        </p>
        <button
          onClick={() => setLocation("/dashboard")}
          className="mt-3 rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto scroll-area overscroll-contain">
      <div className="px-4 max-w-lg mx-auto pb-10">
        {/* Header */}
        <div className="pt-5 pb-4 flex items-center justify-between">
          <div>
            <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Admin</p>
            <h1 className="text-[1.6rem] font-black tracking-tight mt-0.5">Ascend Stats</h1>
          </div>
          <div className="shrink-0 rounded-xl bg-primary/10 border border-primary/20 px-3 py-1.5">
            <p className="text-[9px] font-black uppercase tracking-wider text-primary">Owner</p>
          </div>
        </div>

        {statsLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24 bg-elevated rounded-2xl" />
            ))}
          </div>
        ) : (
          <>
            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-2.5 mb-5">
              <div className={CARD}>
                <p className={VAL}>{stats?.totalUsers ?? 0}</p>
                <p className={LABEL}>Total users</p>
              </div>
              <div className={CARD}>
                <p className={VAL}>{stats?.newUsersToday ?? 0}</p>
                <p className={LABEL}>New today</p>
              </div>
              <div className={CARD}>
                <p className={VAL}>{stats?.activeUsersToday ?? 0}</p>
                <p className={LABEL}>Active today</p>
              </div>
              <div className={CARD}>
                <p className={VAL}>{stats?.mealsLoggedToday ?? 0}</p>
                <p className={LABEL}>Meals logged today</p>
              </div>
              <div className={CARD}>
                <p className={VAL}>{stats?.mealScansToday ?? 0}</p>
                <p className={LABEL}>Meal scans today</p>
              </div>
              <div className={CARD}>
                <p className={VAL}>{stats?.coachMessagesToday ?? 0}</p>
                <p className={LABEL}>Coach messages today</p>
              </div>
              <div className={CARD}>
                <p className={VAL}>{stats?.waterLogsToday ?? 0}</p>
                <p className={LABEL}>Water logs today</p>
              </div>
              <div className={CARD}>
                <p className={VAL}>{stats?.weeklyCheckinsCompleted ?? 0}</p>
                <p className={LABEL}>Weekly check-ins</p>
              </div>
            </div>

            {/* Users list */}
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-foreground">
                All Users
                <span className="ml-2 text-[10px] font-semibold text-muted-foreground">
                  {filteredUsers.length} / {stats?.allUsers?.length ?? 0}
                </span>
              </p>
            </div>

            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by name or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl bg-card border border-border pl-8 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="space-y-2.5">
              {filteredUsers.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6">No users match your search.</p>
              )}
              {filteredUsers.map((u: any) => (
                <div key={u.id} className={CARD}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                        {(u.name ?? u.email).charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold truncate leading-tight">{u.name ?? u.email}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                      </div>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                        style={
                          u.profileCompleted
                            ? { background: "rgba(52,211,153,0.15)", color: "#34D399" }
                            : { background: "rgba(156,163,175,0.15)", color: "#6B7280" }
                        }
                      >
                        {u.profileCompleted ? "Profile ✓" : "No profile"}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground mb-2">
                    <span>Signed up: <span className="text-foreground/70">{formatDate(u.signedUpAt)}</span></span>
                    <span>Last active: <span className="text-foreground/70">{timeAgo(u.lastActive)}</span></span>
                  </div>

                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                    <span>{u.mealsLogged} meals</span>
                    <span>{u.coachMessages} chats</span>
                    <span>{u.mealScans} scans</span>
                    {u.currentStreak > 0 && (
                      <span className="text-primary font-semibold">{u.currentStreak} streak</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
