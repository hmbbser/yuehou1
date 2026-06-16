export type SecretImage = {
  dataUrl: string;
  height: number;
  name: string;
  size: number;
  type: string;
  width: number;
};

export type SecretContent = {
  image?: SecretImage | null;
  images: SecretImage[];
  text: string;
};

const contentKind = "yuehou-content-v1";

export function packSecretContent(content: SecretContent) {
  return JSON.stringify({
    kind: contentKind,
    text: content.text,
    images: content.images,
  });
}

export function unpackSecretContent(value: string): SecretContent {
  try {
    const parsed = JSON.parse(value) as Partial<SecretContent> & { kind?: unknown };

    if (parsed.kind === contentKind) {
      const images = Array.isArray(parsed.images)
        ? parsed.images.filter((image): image is SecretImage => Boolean(image?.dataUrl))
        : parsed.image?.dataUrl
          ? [parsed.image]
          : [];

      return {
        images,
        text: typeof parsed.text === "string" ? parsed.text : "",
      };
    }
  } catch {
    // Old text-only secrets are stored as plain strings.
  }

  return {
    images: [],
    text: value,
  };
}
