import { cn } from "@/lib/utils";

/**
 * Branded squircle avatar — navy gradient with gold initials and a hairline
 * ring. Shared across the courtier space (client header, sender chips, account
 * block) so the identity feels consistent and distinctly FalconDraft, not a
 * generic flat-amber circle.
 */
export function BrokerAvatar({
  name,
  photoUrl,
  size = 40,
  className,
  onDark = false,
}: {
  name: string;
  photoUrl?: string | null;
  size?: number;
  className?: string;
  onDark?: boolean;
}) {
  const initials =
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.at(0)?.toUpperCase() ?? "")
      .join("") || "FD";

  const radius = Math.round(size * 0.3);

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden",
        className,
      )}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: "linear-gradient(155deg, #20304d 0%, #131b2c 100%)",
        boxShadow: onDark
          ? "inset 0 0 0 1px rgba(255,255,255,0.08)"
          : "inset 0 0 0 1px rgba(255,255,255,0.06), 0 1px 2px rgba(11,18,32,0.18)",
      }}
      aria-hidden="true"
    >
      {/* subtle gold sheen */}
      <span
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 30% 0%, rgba(184,146,42,0.22), transparent 60%)",
        }}
      />
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt=""
          className="relative size-full object-cover"
        />
      ) : (
        <span
          className="relative font-semibold tracking-[0.02em]"
          style={{
            color: "var(--accent)",
            fontSize: Math.max(11, Math.round(size * 0.36)),
          }}
        >
          {initials}
        </span>
      )}
    </span>
  );
}
