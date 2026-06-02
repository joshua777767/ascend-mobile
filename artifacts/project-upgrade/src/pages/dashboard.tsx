import React from "react";
import { Link, useLocation } from "wouter";
import { useGetUserProfile } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldAlert, Crosshair, Dumbbell, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  const { data: profile, isLoading, error } = useGetUserProfile();

  React.useEffect(() => {
    if (error) {
      setLocation("/onboarding");
    }
  }, [error, setLocation]);

  if (isLoading || !profile) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-12 w-64 bg-muted" />
        <Skeleton className="h-32 w-full bg-muted" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Skeleton className="h-24 w-full bg-muted" />
          <Skeleton className="h-24 w-full bg-muted" />
          <Skeleton className="h-24 w-full bg-muted" />
          <Skeleton className="h-24 w-full bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header>
        <h1 className="text-3xl md:text-5xl font-bold uppercase tracking-tighter text-foreground mb-2">
          Operator <span className="text-primary">{profile.name}</span>
        </h1>
        <p className="text-muted-foreground uppercase tracking-widest text-sm">Status: Active // Training Phase</p>
      </header>

      <section className="bg-card border border-border p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
        <h2 className="text-xl font-bold uppercase tracking-tight text-primary mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5" /> Mission Status
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Current Mass</p>
            <p className="text-2xl font-bold">{profile.currentWeightKg} kg</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Target Mass</p>
            <p className="text-2xl font-bold text-primary">{profile.goalWeightKg} kg</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Fitness Level</p>
            <p className="text-2xl font-bold">{profile.fitnessLevel}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Workouts / Wk</p>
            <p className="text-2xl font-bold">{profile.workoutDaysPerWeek}</p>
          </div>
        </div>
      </section>

      <div className="grid md:grid-cols-2 gap-6">
        <section className="bg-card border border-border p-6 flex flex-col items-start justify-between">
          <div>
            <h2 className="text-xl font-bold uppercase tracking-tight mb-2 flex items-center gap-2">
              <Dumbbell className="w-5 h-5 text-primary" /> Today's Workout
            </h2>
            <p className="text-sm text-muted-foreground mb-6">Your daily physical protocol is ready.</p>
          </div>
          <Link href="/workouts" className="w-full">
            <Button className="w-full uppercase tracking-widest font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-none h-12" data-testid="btn-view-workout">
              Execute Protocol
            </Button>
          </Link>
        </section>

        <section className="bg-card border border-border p-6 flex flex-col items-start justify-between">
          <div>
            <h2 className="text-xl font-bold uppercase tracking-tight mb-2 flex items-center gap-2">
              <Crosshair className="w-5 h-5 text-primary" /> Daily Review
            </h2>
            <p className="text-sm text-muted-foreground mb-6">Log your nutrition and evening metrics.</p>
          </div>
          <Link href="/journal" className="w-full">
            <Button variant="outline" className="w-full uppercase tracking-widest font-bold border-primary text-primary hover:bg-primary/10 rounded-none h-12" data-testid="btn-view-journal">
              Initiate Review
            </Button>
          </Link>
        </section>
      </div>

    </div>
  );
}
