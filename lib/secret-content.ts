export type SecretImage = {
  kind?: "image";
  dataUrl: string;
  height: number;
  name: string;
  size: number;
  type: string;
  width: number;
};

export type SecretVideo = {
  kind: "video";
  id: string;
  name: string;
  size: number;
  token: string;
  type: string;
};

export type SecretContent = {
  image?: SecretImage | null;
  images: SecretImage[];
  text: string;
  videos: SecretVideo[];
};

const contentKind = "yuehou-content-v1";

export function packSecretContent(content: SecretContent) {
  return JSON.stringify({
    kind: contentKind,
    text: content.text,
    images: content.images,
    videos: content.videos,
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
      const videos = Array.isArray(parsed.videos)
        ? parsed.videos.filter((video): video is SecretVideo =>
            Boolean(video?.kind === "video" && video.id && video.token),
          )
        : [];

      return {
        images,
        text: typeof parsed.text === "string" ? parsed.text : "",
        videos,
      };
    }
  } catch {
    // Old text-only secrets are stored as plain strings.
  }

  return {
    images: [],
    text: value,
    videos: [],
  };
}
