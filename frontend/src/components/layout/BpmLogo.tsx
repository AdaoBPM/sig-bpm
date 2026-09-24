import Image from "next/image";

type BpmLogoProps = {
  className?: string;
  priority?: boolean;
};

export function BpmLogo({ className = "h-8 w-auto", priority = false }: BpmLogoProps) {
  return (
    <Image
      src="/logo-bpm.svg"
      alt="BPM Pré-Moldados"
      width={100}
      height={56}
      className={className}
      priority={priority}
    />
  );
}
