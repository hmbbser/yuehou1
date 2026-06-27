import { ReactNode } from "react";
import { appVersion } from "@/lib/site";
import { SettingsPanel } from "./SettingsPanel";
import { ThemeToggle } from "./ThemeToggle";

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="page-shell">
      <nav className="nav-bar">
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
        v{appVersion}
      </footer>
    </div>
  );
}
