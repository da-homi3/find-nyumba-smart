import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useRef, useState } from "react";
import { isTouchDevice } from "@/lib/motion/performance";
import { areaFromName } from "@/lib/seo/areas";

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
  const [imgFailed, setImgFailed] = useState(false);
  const touch = isTouchDevice();
  const showImage = Boolean(image) && !imgFailed;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (touch) return;
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: y * -15, y: x * 15 });
  };

  const area = areaFromName(name);
  const cardClass = "group relative block aspect-3/4 overflow-hidden rounded-[20px] no-underline";
  const cardInner = (
    <>
        <motion.div
          className="absolute inset-0 bg-cover bg-center bg-muted"
          style={
            showImage
              ? { backgroundImage: `url(${image})` }
              : {
                  backgroundImage: "linear-gradient(160deg, #1a2e28 0%, #0b1220 45%, #111827 100%)",
                }
          }
          animate={{ scale: isHovered ? 1.1 : 1 }}
          transition={{ duration: 0.4 }}
        />
        {image ? (
          <img
            src={image}
            alt=""
            className="pointer-events-none absolute h-0 w-0 opacity-0"
            onError={() => setImgFailed(true)}
          />
        ) : null}
        <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/35 to-black/10" />
        <div
          className="absolute inset-0 transition-opacity duration-300"
          style={{
            opacity: isHovered ? 0.15 : 0,
            background: `radial-gradient(circle at ${50 + tilt.y * 2}% ${50 + tilt.x * 2}%, rgba(255,255,255,0.8), transparent 60%)`,
          }}
        />
        <div className="absolute inset-x-0 bottom-0 p-3.5 sm:p-5">
          <h3 className="m-0 line-clamp-2 font-display text-base font-bold leading-snug text-white sm:text-xl">
            {name}
          </h3>
          <p className="mt-1 text-[11px] leading-snug text-white/75 sm:text-sm">
            <span className="whitespace-nowrap">From KES {minPrice.toLocaleString("en-KE")}</span>
            <span className="whitespace-nowrap">/mo</span>
          </p>
          <motion.div
            initial={false}
            animate={{ opacity: isHovered ? 1 : 0, y: isHovered ? 0 : 8 }}
            className="mt-2 hidden text-sm font-semibold text-[#1eb88a] sm:block"
          >
            {count > 0 ? `${count} homes available →` : "Explore →"}
          </motion.div>
        </div>
    </>
  );

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
      {area ? (
        <Link to="/areas/$slug" params={{ slug: area.slug }} className={cardClass}>
          {cardInner}
        </Link>
      ) : (
        <Link to="/tenant" search={{ neighborhood: name }} className={cardClass}>
          {cardInner}
        </Link>
      )}
    </motion.div>
  );
}
