import { AnimatePresence, motion } from "framer-motion";
import { Heart } from "lucide-react";
import { useState } from "react";

type Props = {
  saved?: boolean;
  onToggle?: (e: React.MouseEvent) => void;
  compact?: boolean;
  className?: string;
};

export function SaveButton({
  saved = false,
  onToggle,
  compact = false,
  className = "",
}: Readonly<Props>) {
  const [burst, setBurst] = useState(false);
  const size = compact ? 32 : 36;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!saved) {
      setBurst(true);
      setTimeout(() => setBurst(false), 600);
    }
    onToggle?.(e);
  };

  return (
    <motion.button
      type="button"
      aria-label={saved ? "Remove from saved" : "Save listing"}
      onClick={handleClick}
      whileTap={{ scale: 0.85 }}
      className={`pointer-events-auto relative flex items-center justify-center rounded-full border-0 bg-black/50 text-white backdrop-blur-md ${className}`}
      style={{ width: size, height: size }}
    >
      <motion.span
        animate={{ scale: saved ? [1, 1.4, 1] : 1 }}
        transition={{ duration: 0.3 }}
        className="flex items-center justify-center"
      >
        <Heart
          className={`h-4 w-4 ${saved ? "fill-[#fc4a4a] text-[#fc4a4a]" : "text-white"}`}
          aria-hidden
        />
      </motion.span>
      <AnimatePresence>
        {burst &&
          [0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
            <motion.span
              key={angle}
              initial={{ scale: 0, x: 0, y: 0, opacity: 1 }}
              animate={{
                scale: 1,
                x: Math.cos((angle * Math.PI) / 180) * 20,
                y: Math.sin((angle * Math.PI) / 180) * 20,
                opacity: 0,
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="pointer-events-none absolute h-1 w-1 rounded-full bg-[#fc4a4a]"
            />
          ))}
      </AnimatePresence>
    </motion.button>
  );
}
