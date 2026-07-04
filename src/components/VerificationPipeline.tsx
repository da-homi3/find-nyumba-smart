import { motion } from "framer-motion";

const LEVELS = [
  {
    n: 1,
    title: "Phone verified",
    desc: "Landlord reachable via verified line.",
    color: "var(--verify-l1)",
  },
  {
    n: 2,
    title: "ID verified",
    desc: "National ID matched to landlord profile.",
    color: "var(--verify-l2)",
  },
  {
    n: 3,
    title: "Business verified",
    desc: "Registered agency or property company.",
    color: "var(--verify-l3)",
  },
  {
    n: 4,
    title: "Ownership verified",
    desc: "Title deed or lease cross-checked.",
    color: "var(--verify-l4)",
  },
] as const;

export function VerificationPipeline() {
  return (
    <div className="verify-pipeline relative mt-8">
      <svg
        className="verify-pipeline-line pointer-events-none absolute left-0 right-0 top-8 hidden h-1 w-full sm:block"
        viewBox="0 0 800 4"
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <linearGradient id="verify-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--verify-l1)" />
            <stop offset="33%" stopColor="var(--verify-l2)" />
            <stop offset="66%" stopColor="var(--verify-l3)" />
            <stop offset="100%" stopColor="var(--verify-l4)" />
          </linearGradient>
        </defs>
        <motion.line
          x1="0"
          y1="2"
          x2="800"
          y2="2"
          stroke="url(#verify-gradient)"
          strokeWidth="2"
          initial={{ pathLength: 0, opacity: 0.4 }}
          whileInView={{ pathLength: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, ease: "easeInOut" }}
        />
      </svg>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {LEVELS.map((lv, i) => (
          <motion.div
            key={lv.n}
            className="verify-node relative flex flex-col items-center text-center sm:items-start sm:text-left"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.15 }}
          >
            <motion.div
              className="verify-node-circle grid h-14 w-14 place-items-center rounded-2xl text-lg font-bold text-white shadow-lg"
              style={{ background: lv.color }}
              whileHover={{ scale: 1.12 }}
              transition={{ type: "spring", stiffness: 400, damping: 18 }}
            >
              {lv.n}
            </motion.div>
            <h4 className="mt-4 font-display text-base font-semibold">{lv.title}</h4>
            <p className="mt-1 text-sm text-muted-foreground">{lv.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
