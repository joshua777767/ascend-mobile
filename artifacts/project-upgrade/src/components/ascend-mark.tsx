
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
    <div className="px-6 pt-8">
      <div className="text-2xl font-black tracking-tighter leading-none">
        Ascend<span style={{ color: "#C89A3E" }}>Fit</span>
      </div>
      <p className="text-[9px] font-medium tracking-wide text-muted-foreground mt-1">Your Daily Coach</p>
    </div>
  );
}
