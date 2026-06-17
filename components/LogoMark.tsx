import { siteLogoText } from "@/lib/site";

export function LogoMark({ large = false }: { large?: boolean }) {
  return (
    <span className={large ? "logo-mark logo-mark--large" : "logo-mark"} aria-hidden="true">
      {siteLogoText}
    </span>
  );
}
