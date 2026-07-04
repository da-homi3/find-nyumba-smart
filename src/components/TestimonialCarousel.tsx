import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Star } from "lucide-react";
import type { FeaturedTestimonial } from "@/lib/api/homepage-shared";

export function TestimonialCarousel({
  testimonials,
}: Readonly<{ testimonials: FeaturedTestimonial[] }>) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || testimonials.length <= 1) return;
    const t = setInterval(() => setActive((a) => (a + 1) % testimonials.length), 6000);
    return () => clearInterval(t);
  }, [paused, testimonials.length]);

  if (!testimonials.length) return null;

  const current = testimonials[active];

  return (
    <div
      className="testimonial-carousel mx-auto max-w-3xl"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <AnimatePresence mode="wait">
        <motion.blockquote
          key={active}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="rounded-3xl border border-white/10 bg-(--surface-1) p-8 shadow-soft sm:p-10"
        >
          <div className="flex gap-0.5 text-gold">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`h-4 w-4 ${star <= Math.round(current.rating) ? "fill-current" : "opacity-30"}`}
              />
            ))}
          </div>
          <p className="display-heading mt-6 text-2xl leading-snug sm:text-3xl">
            &ldquo;{current.body}&rdquo;
          </p>
          <footer className="mt-8 flex items-center gap-4">
            <div className="testimonial-avatar-ring grid h-12 w-12 place-items-center rounded-full bg-gradient-emerald p-0.5">
              <div className="testimonial-avatar grid h-full w-full place-items-center rounded-full bg-(--surface-2) text-sm font-bold">
                {current.name[0]}
              </div>
            </div>
            <div>
              <strong className="block font-display text-sm">{current.name}</strong>
              <span className="text-xs text-muted-foreground">{current.roleLabel}</span>
            </div>
          </footer>
        </motion.blockquote>
      </AnimatePresence>

      <div className="testimonial-dots mt-6 flex justify-center gap-2">
        {testimonials.map((t, i) => (
          <button
            key={`${t.name}-${i}`}
            type="button"
            aria-label={`Show testimonial ${i + 1}`}
            onClick={() => setActive(i)}
            className={`h-2 rounded-full transition-all ${
              i === active ? "dot-active w-8 bg-primary" : "dot w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
