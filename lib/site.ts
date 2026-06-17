const fallbackSiteName = "阅后即焚";

function cleanSiteName(value: string | undefined) {
  const trimmed = value?.trim();

  return trimmed ? trimmed.slice(0, 24) : fallbackSiteName;
}

export const siteName = cleanSiteName(process.env.NEXT_PUBLIC_SITE_NAME);
export const siteDescription = `4 位极短链接的无服务器${siteName}工具`;
export const siteLogoText = Array.from(siteName).slice(-1)[0] ?? "焚";
