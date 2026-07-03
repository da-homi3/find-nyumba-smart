import { motion } from "framer-motion";
import type { ReactNode } from "react";

export function PageTransition({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}
