import { useState } from "react";
import { useLocation, Redirect } from "wouter";
import { useGetUserProfile } from "@workspace/api-client-react";
import { ArrowRight } from "lucide-react";
import { AuthHeader } from "@/components/ascend-mark";

const SLIDES = [
  {
    icon: "⚡",
    title: "Your Personal AI Fitness Coach",
    text: "Whether your goal is to lose weight, gain weight, build muscle, stay fit, or improve energy, Ascend builds a plan specifically for you.",
  },
  {
    icon: "🎯",
    title: "Everything You Need In One Place",
    text: "Get personalized nutrition, custom workouts, daily coaching, progress tracking, habit building, and streaks — without guessing what to do next.",
  },
  {
    icon: "🗺️",
    title: "Built Around Your Goal",
    text: "Tell Ascend about your body, lifestyle, goal, timeline, gym access, and activity level. Then get a personalized roadmap made for you.",
  },
];

function IntroGuard() {
  const { data: profile, isLoading, isFetching } = useGetUserProfile();

  if (isLoading || isFetching) return null;
  if (profile) return <Redirect to="/dashboard" />;
  return <IntroSlides />;
}

function IntroSlides() {
  const [, setLocation] = useLocation();
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [animating, setAnimating] = useState(false);

  const isLast = current === SLIDES.length - 1;

  function goTo(next: number, dir: "forward" | "back") {
    if (animating) return;
    setDirection(dir);
    setAnimating(true);
    setTimeout(() => {
      setCurrent(next);
      setAnimating(false);
    }, 220);
  }

  function handleNext() {
    if (isLast) {
      setLocation("/onboarding");
    } else {
      goTo(current + 1, "forward");
    }
  }

  const slide = SLIDES[current];

  return (
    <div
      className="flex flex-col bg-background text-foreground"
      style={{
        minHeight: "100dvh",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* Ambient background */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute w-96 h-96 rounded-full blur-3xl opacity-10"
          style={{ top: "-15%", right: "-20%", background: "radial-gradient(circle, rgba(245,158,11,0.6) 0%, transparent 70%)" }}
        />
        <div
          className="absolute w-80 h-80 rounded-full blur-3xl opacity-8"
          style={{ bottom: "5%", left: "-15%", background: "radial-gradient(circle, rgba(245,158,11,0.15) 0%, transparent 70%)" }}
        />
      </div>

      {/* Logo */}
      <div className="relative z-10">
        <AuthHeader />
      </div>

      {/* Slide content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6">
        <div
          key={current}
          className="w-full max-w-sm flex flex-col items-center text-center gap-6"
          style={{
            animation: animating
              ? direction === "forward"
                ? "slideOutLeft 220ms ease forwards"
                : "slideOutRight 220ms ease forwards"
              : direction === "forward"
              ? "slideInRight 220ms ease forwards"
              : "slideInLeft 220ms ease forwards",
          }}
        >
          {/* Icon orb */}
          <div
            className="w-24 h-24 rounded-3xl flex items-center justify-center text-5xl shadow-2xl"
            style={{
              background: "linear-gradient(145deg, hsl(38 95% 20%) 0%, hsl(38 95% 12%) 100%)",
              border: "1px solid hsl(38 95% 54% / 0.3)",
              boxShadow: "0 0 48px rgba(245,158,11,0.15), inset 0 1px 0 rgba(255,255,255,0.06)",
            }}
          >
            {slide.icon}
          </div>

          <div className="space-y-3">
            <h1 className="text-[1.7rem] font-extrabold tracking-tight leading-tight">
              {slide.title}
            </h1>
            <p className="text-[15px] text-muted-foreground leading-relaxed">
              {slide.text}
            </p>
          </div>
        </div>
      </div>

      {/* Bottom controls */}
      <div className="relative z-10 px-6 pb-8 flex flex-col items-center gap-6">
        {/* Progress dots */}
        <div className="flex items-center gap-2">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i, i > current ? "forward" : "back")}
              className="transition-all duration-300"
              style={{
                width: i === current ? 24 : 8,
                height: 8,
                borderRadius: 4,
                background: i === current ? "hsl(38 95% 54%)" : "hsl(217 32% 20%)",
              }}
              aria-label={`Go to screen ${i + 1}`}
            />
          ))}
        </div>

        {/* Next / Start My Plan button */}
        <button
          onClick={handleNext}
          className="flex items-center justify-center gap-2 w-full max-w-sm h-14 rounded-2xl text-[15px] font-bold text-background transition-transform active:scale-[0.98]"
          style={{
            background: "linear-gradient(135deg, hsl(38 95% 54%) 0%, hsl(38 90% 44%) 100%)",
            boxShadow: "0 4px 24px rgba(245,158,11,0.3), 0 0 0 1px rgba(255,255,255,0.06) inset",
          }}
        >
          {isLast ? "Start My Plan" : "Next"}
          <ArrowRight className="w-[18px] h-[18px]" strokeWidth={2.5} />
        </button>

        {/* Skip — only on non-last screens */}
        {!isLast && (
          <button
            onClick={() => setLocation("/onboarding")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip intro
          </button>
        )}
      </div>

      {/* Slide animations */}
      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(40px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideOutLeft {
          from { opacity: 1; transform: translateX(0); }
          to   { opacity: 0; transform: translateX(-40px); }
        }
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-40px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideOutRight {
          from { opacity: 1; transform: translateX(0); }
          to   { opacity: 0; transform: translateX(40px); }
        }
      `}</style>
    </div>
  );
}

export default IntroGuard;
