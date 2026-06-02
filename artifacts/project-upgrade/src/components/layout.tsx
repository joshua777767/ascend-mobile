import React from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Calendar, 
  Dumbbell, 
  Utensils, 
  MessageSquare, 
  BookOpen, 
  LineChart, 
  CreditCard 
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/schedule", label: "Schedule", icon: Calendar },
  { href: "/workouts", label: "Workouts", icon: Dumbbell },
  { href: "/meals", label: "Meals", icon: Utensils },
  { href: "/coach", label: "Coach", icon: MessageSquare },
  { href: "/journal", label: "Journal", icon: BookOpen },
  { href: "/progress", label: "Progress", icon: LineChart },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="flex h-[100dvh] w-full flex-col md:flex-row bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-card">
        <div className="p-6 border-b border-border">
          <h1 className="text-xl font-bold uppercase tracking-tighter text-primary">Upgrade</h1>
        </div>
        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.href;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`flex items-center gap-3 px-3 py-3 text-sm font-medium uppercase tracking-wider transition-colors ${isActive ? 'bg-primary/10 text-primary border-l-2 border-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-border">
          <Link 
            href="/pricing"
            className="flex items-center gap-3 px-3 py-3 text-sm font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-muted/50"
            data-testid="nav-pricing"
          >
            <CreditCard className="w-5 h-5" />
            Pricing
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
        {children}
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around bg-card border-t border-border pb-safe">
        {NAV_ITEMS.slice(0, 5).map((item) => {
          const isActive = location === item.href;
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={`flex flex-col items-center justify-center w-full py-3 ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
              data-testid={`mobilenav-${item.label.toLowerCase()}`}
            >
              <item.icon className="w-5 h-5 mb-1" />
              <span className="text-[10px] uppercase tracking-wider font-semibold">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
