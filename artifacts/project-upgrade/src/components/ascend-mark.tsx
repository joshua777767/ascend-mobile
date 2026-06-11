
export function AscendMark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dim = size === "sm" ? 28 : size === "lg" ? 36 : 32;
  return (
    <img
      src="/icon-120.png"
      alt="Ascend"
      width={dim}
      height={dim}
      className="shrink-0 select-none rounded-[20%]"
      style={{ objectFit: "cover" }}
    />
  );
}
