import { Shell } from "@/components/Shell";

export default function NotFound() {
  return (
    <Shell>
      <section className="hero hero--compact">
        <h1>页面不存在</h1>
        <p>4 位短链可能输入错了，或这条秘密已经离开了。</p>
      </section>
      <div className="oauth-panel state-panel">
        <div className="action-stack">
          <a className="btn-pill btn-pill-primary" href="/">
            回到首页
          </a>
        </div>
      </div>
    </Shell>
  );
}
