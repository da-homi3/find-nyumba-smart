import { motion, type Variants } from "framer-motion";
import { useMemo, type ReactNode } from "react";
import { prefersReducedMotion } from "@/hooks/useDeviceCapability";

function useItemVariants(): Variants {
  const reduced = useMemo(
    () => (typeof window !== "undefined" ? prefersReducedMotion() : false),
    [],
  );
  return {
    hidden: { opacity: reduced ? 1 : 0, y: reduced ? 0 : 24 },
    visible: { opacity: 1, y: 0 },
  };
}

export function ScrollReveal({
  children,
  className,
  delay = 0,
}: Readonly<{ children: ReactNode; className?: string; delay?: number }>) {
  const itemVariants = useItemVariants();
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-60px" }}
      variants={itemVariants}
      transition={{ duration: 0.55, delay, ease: [0.19, 1, 0.22, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function ScrollRevealStagger({
  children,
  className,
  stagger = 0.08,
}: Readonly<{ children: ReactNode; className?: string; stagger?: number }>) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-60px" }}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: stagger } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function ScrollRevealItem({
  children,
  className,
}: Readonly<{ children: ReactNode; className?: string }>) {
  const itemVariants = useItemVariants();
  return (
    <motion.div
      variants={itemVariants}
      transition={{ duration: 0.5, ease: [0.19, 1, 0.22, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
