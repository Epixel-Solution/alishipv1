import { cn } from "@/lib/utils";

let logoImg: string | undefined;
try {
  logoImg = new URL("../assets/aliship-logo.png", import.meta.url).href;
} catch {
  logoImg = undefined;
}

export function Logo({
  className,
  size = "md",
  variant = "auto",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "auto" | "light";
}) {
  const markSizes = { sm: "h-8 w-8", md: "h-11 w-11", lg: "h-16 w-16" };
  const sizes = { sm: "text-base", md: "text-2xl", lg: "text-4xl" };
  const taglineSizes = { sm: "text-[9px]", md: "text-[10px]", lg: "text-xs" };
  const wordmarkColor = variant === "light" ? "text-zinc-50" : "text-stone-950 dark:text-zinc-50";

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {logoImg ? (
        <img src={logoImg} alt="Aliship Logistics" className={cn("w-auto object-contain", markSizes[size])} />
      ) : (
        <div className={cn("flex shrink-0 items-center justify-center rounded-md border-2 border-primary/70 bg-primary/10 font-mono text-primary", markSizes[size])}>
          <span className="text-[10px] font-bold tracking-tight">LOGO</span>
        </div>
      )}
      <div className="flex flex-col leading-none">
        <span className={cn("font-heading font-extrabold tracking-tight", wordmarkColor, sizes[size])}>
          <span className="text-white">ALISHIP</span> <span className="text-primary text-color">LOGISTICS</span>
        </span>
        <span className={cn("mt-1 font-medium italic tracking-wide text-primary", taglineSizes[size])}>
          Sorted. Shipped. Simple.
        </span>
      </div>
    </div>
  );
}