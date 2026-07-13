import { motion } from "framer-motion";
import type { ReactNode } from "react";

export function PageTransition({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <motion.div
      // SSR renders visible HTML; avoid hiding the whole page before hydration completes.
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
