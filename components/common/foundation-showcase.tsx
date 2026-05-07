"use client";

import * as React from "react";
import { motion } from "framer-motion";
import gsap from "gsap";
import { CheckCircle2, FileText, Send, Sparkles } from "lucide-react";
import { Area, AreaChart, Tooltip } from "recharts";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useMounted } from "@/hooks/use-mounted";

const chartData = [
  { step: "Deal", value: 18 },
  { step: "Notes", value: 36 },
  { step: "Proposition", value: 72 },
  { step: "Validation", value: 88 },
  { step: "Envoi", value: 100 },
];

export function FoundationShowcase() {
  const markerRef = React.useRef<HTMLDivElement>(null);
  const chartRef = React.useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = React.useState(0);
  const mounted = useMounted();

  React.useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (!markerRef.current || prefersReducedMotion) {
      return;
    }

    const context = gsap.context(() => {
      gsap.fromTo(
        markerRef.current,
        { opacity: 0.72, y: 8 },
        { opacity: 1, y: 0, duration: 0.7, ease: "power2.out" },
      );
    }, markerRef);

    return () => context.revert();
  }, []);

  React.useEffect(() => {
    if (!chartRef.current) {
      return;
    }

    const updateWidth = () => {
      const width = chartRef.current?.getBoundingClientRect().width ?? 0;
      setChartWidth(Math.max(0, Math.floor(width)));
    };

    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(chartRef.current);

    return () => observer.disconnect();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: "easeOut" }}
      className="relative"
    >
      <Card className="shadow-primary/5 bg-card/90 overflow-hidden border shadow-2xl">
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <Badge className="bg-accent text-accent-foreground hover:bg-accent">
              Fondation prête
            </Badge>
            <div
              ref={markerRef}
              className="bg-primary/10 text-primary rounded-full p-2"
            >
              <Sparkles className="size-4" aria-hidden="true" />
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl tracking-tight">
              Chaîne commerciale structurée
            </CardTitle>
            <CardDescription>
              Un socle sobre pour bâtir ensuite l’expérience complète, sans
              exposer la mécanique technique au client.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: "Deal", icon: FileText },
              { label: "Validation", icon: CheckCircle2 },
              { label: "Envoi", icon: Send },
            ].map((item) => (
              <div
                key={item.label}
                className="bg-muted/60 rounded-2xl border p-4"
              >
                <item.icon
                  className="text-primary mb-3 size-5"
                  aria-hidden="true"
                />
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-muted-foreground text-xs">Étape préparée</p>
              </div>
            ))}
          </div>

          <div ref={chartRef} className="h-36 min-w-0">
            {mounted && chartWidth > 0 ? (
              <AreaChart width={chartWidth} height={144} data={chartData}>
                <defs>
                  <linearGradient
                    id="foundation-gradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="var(--primary)"
                      stopOpacity={0.28}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--primary)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <Tooltip
                  cursor={false}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid var(--border)",
                    background: "var(--card)",
                    color: "var(--card-foreground)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  fill="url(#foundation-gradient)"
                />
              </AreaChart>
            ) : (
              <div className="bg-muted/60 h-full rounded-2xl" />
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Préparation technique</span>
              <span className="text-muted-foreground">Step 1</span>
            </div>
            <Progress value={72} />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
