import { useState } from "react";
import { Link } from "wouter";
import { useGetUserProfile, useGetProgressSummary, useListWeighIns, useListReviews, useListGoalCheckIns, useGetMilestones } from "@workspace/api-client-react";
import { AscendMark } from "@/components/ascend-mark";
import { Download, ArrowLeft, FileJson } from "lucide-react";

export default function DataExportPage() {
  const { data: profile } = useGetUserProfile();
  const { data: summary } = useGetProgressSummary();
  const { data: weighIns } = useListWeighIns();
  const { data: reviews } = useListReviews();
  const { data: goalCheckIns } = useListGoalCheckIns();
  const { data: milestones } = useGetMilestones();
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/users/export", { credentials: "include" });
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ascend-export-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    } finally {
      setExporting(false);
    }
  };

  const dataCategories = [
    { label: "Profile", count: profile ? 1 : 0, icon: "👤" },
    { label: "Progress Summary", count: summary ? 1 : 0, icon: "📊" },
    { label: "Weigh-Ins", count: weighIns?.length ?? 0, icon: "⚖️" },
    { label: "Daily Reviews", count: reviews?.length ?? 0, icon: "📝" },
    { label: "Goal Check-Ins", count: goalCheckIns?.length ?? 0, icon: "🎯" },
    { label: "Milestones", count: milestones?.milestones?.length ?? 0, icon: "🏆" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="px-4 py-8 max-w-lg mx-auto">
        <div className="flex items-center gap-2.5 mb-8">
          <AscendMark size="lg" />
          <div>
            <span className="text-[15px] font-black tracking-tight leading-none">Ascend</span>
            <p className="text-[9px] font-bold tracking-[0.18em] uppercase text-muted-foreground mt-0.5">Data Export</p>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h1 className="text-xl font-bold mb-2">Your Data</h1>
            <p className="text-sm text-muted-foreground">
              Download a complete export of all your data stored in Ascend.
            </p>
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            {dataCategories.map((cat) => (
              <div key={cat.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">{cat.icon}</span>
                  <span className="text-sm font-medium">{cat.label}</span>
                </div>
                <span className="text-sm font-bold text-muted-foreground">{cat.count} {cat.count === 1 ? "item" : "items"}</span>
              </div>
            ))}
          </div>

          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground h-14 rounded-2xl text-[15px] font-semibold active:scale-[0.99] transition-transform disabled:opacity-60"
          >
            {exporting ? (
              "Preparing export..."
            ) : (
              <>
                <Download className="w-[18px] h-[18px]" strokeWidth={2} />
                Download JSON Export
              </>
            )}
          </button>

          <div className="bg-elevated border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileJson className="w-4 h-4 text-muted-foreground" strokeWidth={2} />
              <p className="text-sm font-semibold">Format</p>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your data is exported as a JSON file containing all your profile, progress, weigh-ins, reviews, check-ins, and milestones. You can open this in any text editor or JSON viewer.
            </p>
          </div>

          <Link
            href="/settings"
            className="flex items-center justify-center gap-2 w-full bg-elevated border border-border text-foreground h-12 rounded-xl text-sm font-semibold active:scale-[0.99] transition-transform"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={2} />
            Back to Settings
          </Link>
        </div>
      </div>
    </div>
  );
}
