"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Scroll-triggered entrance wrapper. Fades + slides its children in the first
 * time they enter the viewport. Respects prefers-reduced-motion.
 */
export function Reveal({
  children, className, delay = 0, y = 24,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  const [animate, setAnimate] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      // Defer out of the effect body to avoid a synchronous cascading render.
      const id = requestAnimationFrame(() => {
        setAnimate(false);
        setShown(true);
      });
      return () => cancelAnimationFrame(id);
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          obs.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{
        transitionDelay: animate ? `${delay}ms` : undefined,
        transform: !animate || shown ? "translateY(0)" : `translateY(${y}px)`,
      }}
      className={cn(
        animate && "transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
        shown ? "opacity-100" : "opacity-0",
        className,
      )}
    >
      {children}
    </div>
  );
}
