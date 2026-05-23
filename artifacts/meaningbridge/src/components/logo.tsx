import logoSrc from "@assets/MeaningBridge_Logo_Infinity_transparent.png";

type Props = {
  size?: number;
  withWordmark?: boolean;
  className?: string;
};

export function Logo({ size = 32, withWordmark = false, className = "" }: Props) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <img
        src={logoSrc}
        alt="MeaningBridge"
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="object-contain shrink-0"
      />
      {withWordmark && (
        <span className="font-serif font-medium tracking-tight text-foreground">
          MeaningBridge
        </span>
      )}
    </span>
  );
}
