"use client";

import { motion, useReducedMotion } from "framer-motion";
import * as React from "react";

/**
 * Wraps a panel of content so it slides in horizontally with a spring,
 * keyed by `direction` so successive switches reverse the slide.
 * Use inside shadcn TabsContent to replace the default fade animation.
 */
export function TabMotion({
  motionKey,
  direction = 1,
  children,
}: {
  motionKey: string;
  direction?: 1 | -1;
  children: React.ReactNode;
}) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <div>{children}</div>;
  }

  return (
    <motion.div
      key={motionKey}
      initial={{ opacity: 0, x: direction * 24, scale: 0.985 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{
        opacity: { duration: 0.25, ease: [0.16, 1, 0.3, 1] },
        x: { type: "spring", stiffness: 260, damping: 28, mass: 0.7 },
        scale: { duration: 0.32, ease: [0.16, 1, 0.3, 1] },
      }}
    >
      {children}
    </motion.div>
  );
}
