import Link from "next/link";
import { ReactNode } from "react";
import { siteName } from "@/lib/site";
import { LogoMark } from "./LogoMark";
import { SettingsPanel } from "./SettingsPanel";
import { ThemeToggle } from "./ThemeToggle";

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="page-shell">
      <nav className="nav-bar">
        <Link className="nav-brand" href="/">
          <LogoMark />
          <span>{siteName}</span>
        </Link>
        <div className="nav-actions">
          <SettingsPanel />
          <ThemeToggle />
        </div>
      </nav>
      <main className="main-stage">{children}</main>
      <footer className="footer">
        <a href="https://github.com/hmbbser/yuehou" target="_blank" rel="noreferrer">
          Yuehou
        </a>{" "}
        v1.0.0
      </footer>
    </div>
  );
}
