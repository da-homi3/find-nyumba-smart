import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useRef, useState } from "react";
import { isTouchDevice } from "@/lib/motion/performance";

type Props = {
  name: string;
  minPrice: number;
  image?: string;
  count?: number;
};

export function NeighborhoodCard3D({ name, minPrice, image, count = 0 }: Readonly<Props>) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const touch = isTouchDevice();

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (touch) return;
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: y * -15, y: x * 15 });
  };

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setTilt({ x: 0, y: 0 });
        setIsHovered(false);
      }}
      animate={{
        rotateX: tilt.x,
        rotateY: tilt.y,
        scale: isHovered ? 1.05 : 1,
      }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="transform-3d"
      style={{
        boxShadow: isHovered
          ? "0 24px 80px rgba(0,0,0,0.4), 0 0 0 1px rgba(30,184,138,0.4)"
          : "0 8px 24px rgba(0,0,0,0.2)",
      }}
    >
      <Link
        to="/tenant"
        search={{ neighborhood: name }}
        className="group relative block aspect-3/4 overflow-hidden rounded-[20px] no-underline"
      >
        <motion.div
          className="absolute inset-0 bg-cover bg-center bg-muted"
          style={image ? { backgroundImage: `url(${image})` } : undefined}
          animate={{ scale: isHovered ? 1.1 : 1 }}
          transition={{ duration: 0.4 }}
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/10 to-transparent" />
        <div
          className="absolute inset-0 transition-opacity duration-300"
          style={{
            opacity: isHovered ? 0.15 : 0,
            background: `radial-gradient(circle at ${50 + tilt.y * 2}% ${50 + tilt.x * 2}%, rgba(255,255,255,0.8), transparent 60%)`,
          }}
        />
        <div className="absolute inset-x-0 bottom-0 p-5">
          <h3 className="m-0 font-display text-xl font-bold text-white">{name}</h3>
          <p className="mt-1 text-sm text-white/70">From KES {minPrice.toLocaleString("en-KE")}/mo</p>
          <motion.div
            initial={false}
            animate={{ opacity: isHovered ? 1 : 0, y: isHovered ? 0 : 8 }}
            className="mt-3 text-sm font-semibold text-[#1eb88a]"
          >
            {count > 0 ? `${count} homes available →` : "Explore →"}
          </motion.div>
        </div>
      </Link>
    </motion.div>
  );
}
