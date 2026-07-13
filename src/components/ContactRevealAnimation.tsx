import { motion, useReducedMotion } from "framer-motion";
import { Check, MessageCircle } from "lucide-react";
import { whatsAppUrl } from "@/lib/phone";
import { MOTION_DURATION } from "@/lib/design/motion";

type Props = Readonly<{
  phone: string;
  listingTitle?: string;
  neighborhood?: string;
}>;

export function ContactRevealAnimation({ phone, listingTitle, neighborhood }: Props) {
  const reduceMotion = useReducedMotion();
  const waMessage = listingTitle
    ? `Hi, I saw your listing *${listingTitle}* (${neighborhood ?? "Nairobi"}) on NyumbaSearch. Is it still available?`
    : "Hi, I saw your listing on NyumbaSearch. Is it still available?";
  const waLink = whatsAppUrl(phone, waMessage);

  return (
    <motion.div
      className="contact-reveal rounded-2xl border border-primary/30 bg-primary/10 p-6 text-center"
      initial={reduceMotion ? false : { scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
    >
      <motion.div
        initial={reduceMotion ? false : { scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: reduceMotion ? 0 : 0.15, type: "spring", stiffness: 300 }}
        className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground"
      >
        <Check className="h-7 w-7" aria-hidden />
      </motion.div>

      <motion.p
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: reduceMotion ? 0 : 0.3, duration: MOTION_DURATION.fast }}
        className="font-display text-2xl font-bold"
      >
        {phone}
      </motion.p>

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: reduceMotion ? 0 : 0.45, duration: MOTION_DURATION.fast }}
        className="mt-4 flex flex-col gap-2"
      >
        {waLink ? (
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 text-sm font-semibold text-white hover:opacity-95"
          >
            <MessageCircle className="h-4 w-4" />
            Message on WhatsApp
          </a>
        ) : null}
        <a
          href={`tel:${phone}`}
          className="flex w-full items-center justify-center gap-2 rounded-xl border bg-background px-4 py-3 text-sm font-semibold"
        >
          Call landlord
        </a>
      </motion.div>
    </motion.div>
  );
}
