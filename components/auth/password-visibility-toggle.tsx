"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";

export function PasswordVisibilityToggle({
  visible,
  onToggle,
}: {
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.button
      type="button"
      aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
      aria-pressed={visible}
      className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md transition-colors"
      onClick={onToggle}
      whileTap={{ scale: 0.94 }}
      transition={{ duration: 0.12, ease: "easeOut" }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={visible ? "hide" : "show"}
          initial={{ opacity: 0, rotate: -8, scale: 0.88 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 8, scale: 0.88 }}
          transition={{ duration: 0.14, ease: "easeOut" }}
        >
          {visible ? (
            <EyeOff className="size-4" aria-hidden="true" />
          ) : (
            <Eye className="size-4" aria-hidden="true" />
          )}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}
