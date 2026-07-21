
export function AscendMark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dim = size === "sm" ? 28 : size === "lg" ? 36 : 32;
  return (
    <img
      src="/icon-120.png"
      alt="Ascend Fit"
      width={dim}
      height={dim}
      className="shrink-0 select-none rounded-[20%]"
      style={{ objectFit: "cover" }}
    />
  );
}

export function AuthHeader() {
  return (
    <div className="px-6 pt-8 flex items-center gap-2.5">
      <AscendMark size="lg" />
      <div>
        <span className="text-[15px] font-black tracking-tight leading-none">Ascend</span>
        <p className="text-[9px] font-medium tracking-wide text-muted-foreground mt-0.5">Your Daily Coach</p>
      </div>
    </div>
  );
}
