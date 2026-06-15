import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Axiom AI logo: the square icon mark (public/logo.jpeg, rounded) followed by the
 * "Axiom AI" wordmark. `size` sets the icon dimensions; `dark` switches the text to
 * white for dark backgrounds; `showText={false}` renders the icon alone.
 */
export function Logo({
  size = "h-9 w-9", showText = true, dark = false, priority = false, className,
}: {
  size?: string; showText?: boolean; dark?: boolean; priority?: boolean; className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Image
        src="/logo.jpeg"
        alt="Axiom AI"
        width={96}
        height={96}
        priority={priority}
        className={cn("rounded-xl object-cover shadow-sm ring-1 ring-black/5", size)}
      />
      {showText && (
        <span className={cn("text-lg font-bold tracking-tight", dark ? "text-white" : "text-brand-900")}>
          Axiom <span className={cn("font-serif font-normal italic", dark ? "text-white/60" : "text-brand-400")}>AI</span>
        </span>
      )}
    </span>
  );
}
