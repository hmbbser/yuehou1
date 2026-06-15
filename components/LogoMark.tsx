export function LogoMark({ large = false }: { large?: boolean }) {
  return (
    <span className={large ? "logo-mark logo-mark--large" : "logo-mark"} aria-hidden="true">
      焚
    </span>
  );
}
