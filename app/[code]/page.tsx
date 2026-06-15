import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { LogoMark } from "@/components/LogoMark";
import { Shell } from "@/components/Shell";
import { isBlacklisted, registerSuspiciousMiss } from "@/lib/rate-limit";
import { getRedis } from "@/lib/redis";
import { getSecretRecord } from "@/lib/secret-store";
import { getClientIpFromHeaders, hashIp, isValidCode } from "@/lib/security";
import { PublicSecretMeta } from "@/lib/types";
import { SecretReader } from "./SecretReader";

export const dynamic = "force-dynamic";

type PageProps = {
  params: {
    code: string;
  };
};

function StatePanel({ title, description }: { title: string; description: string }) {
  return (
    <div className="oauth-panel state-panel">
      <div className="identity-card">
        <div className="avatar">!</div>
        <div>
          <strong>{title}</strong>
          <span>{description}</span>
        </div>
      </div>
      <div className="action-stack">
        <a className="btn-pill btn-pill-primary" href="/">
          创建新的秘密
        </a>
      </div>
    </div>
  );
}

export default async function CodePage({ params }: PageProps) {
  noStore();

  if (!isValidCode(params.code)) {
    notFound();
  }

  const ipHash = hashIp(getClientIpFromHeaders());
  let redis: ReturnType<typeof getRedis>;

  try {
    redis = getRedis();
  } catch {
    return (
      <Shell>
        <Hero code={params.code} />
        <StatePanel title="存储未配置" description="请在 Vercel 绑定 KV 或填写 Upstash Redis 环境变量。" />
      </Shell>
    );
  }

  if (await isBlacklisted(redis, ipHash)) {
    return (
      <Shell>
        <Hero code={params.code} />
        <StatePanel title="访问过于频繁" description="该网络触发了撞码防护，请 24 小时后再试。" />
      </Shell>
    );
  }

  const record = await getSecretRecord(params.code);

  if (!record) {
    await registerSuspiciousMiss(redis, ipHash);

    return (
      <Shell>
        <Hero code={params.code} />
        <StatePanel title="秘密不可用" description="链接不存在、已过期，或已经被读取销毁。" />
      </Shell>
    );
  }

  const meta: PublicSecretMeta =
    record.mode === "plain"
      ? {
          exists: true,
          code: params.code,
          mode: "plain",
          createdAt: record.createdAt,
          expiresAt: record.expiresAt,
        }
      : {
          exists: true,
          code: params.code,
          mode: "password",
          createdAt: record.createdAt,
          expiresAt: record.expiresAt,
          salt: record.encrypted.salt,
          iterations: record.encrypted.iterations,
        };

  return (
    <Shell>
      <Hero code={params.code} />
      <SecretReader meta={meta} />
    </Shell>
  );
}

function Hero({ code }: { code: string }) {
  return (
    <section className="hero">
      <div className="hero-icon">
        <LogoMark large />
        <span className="verified-badge">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
      </div>
      <h1>/{code}</h1>
    </section>
  );
}
