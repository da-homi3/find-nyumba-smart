import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Bell } from "lucide-react";

type Props = Readonly<{
  unreadCount: number;
  onClick?: () => void;
  className?: string;
}>;

export function NotificationBell({ unreadCount, onClick, className = "" }: Props) {
  const reduceMotion = useReducedMotion();

  return (
    <button
      type="button"
      onClick={onClick}
      className={`notif-bell-btn relative inline-flex h-10 w-10 items-center justify-center rounded-xl border bg-card text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground ${className}`.trim()}
      aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : "Notifications"}
    >
      <Bell className="h-4 w-4" />
      <AnimatePresence>
        {unreadCount > 0 ? (
          <motion.span
            key={unreadCount}
            initial={reduceMotion ? false : { scale: 0 }}
            animate={{ scale: 1 }}
            exit={reduceMotion ? undefined : { scale: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 15 }}
            className="notif-badge absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </button>
  );
}
