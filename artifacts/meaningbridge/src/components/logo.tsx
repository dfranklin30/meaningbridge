import markSrc from "@/assets/brand/meaningbridge-mark.png";
import lockupSrc from "@/assets/brand/meaningbridge-lockup.png";

type Variant = "mark" | "lockup" | "mark-with-wordmark";

type Props = {
  variant?: Variant;
  size?: number;
  className?: string;
  withWordmark?: boolean;
};

const MARK_ASPECT = 787 / 340;
const LOCKUP_ASPECT = 957 / 535;

export function Logo({
  variant,
  size = 32,
  className = "",
  withWordmark = false,
}: Props) {
  const resolved: Variant =
    variant ?? (withWordmark ? "mark-with-wordmark" : "mark");

  if (resolved === "lockup") {
    const height = size;
    const width = Math.round(height * LOCKUP_ASPECT);
    return (
      <img
        src={lockupSrc}
        alt="MeaningBridge"
        width={width}
        height={height}
        style={{ width, height }}
        className={`object-contain shrink-0 ${className}`}
      />
    );
  }

  const markHeight = size;
  const markWidth = Math.round(markHeight * MARK_ASPECT);

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <img
        src={markSrc}
        alt="MeaningBridge"
        width={markWidth}
        height={markHeight}
        style={{ width: markWidth, height: markHeight }}
        className="object-contain shrink-0"
      />
      {resolved === "mark-with-wordmark" && (
        <span className="font-serif font-medium tracking-tight text-foreground">
          MeaningBridge
        </span>
      )}
    </span>
  );
}
