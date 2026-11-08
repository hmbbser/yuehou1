"use client";

import { useState } from "react";
import { ImageLightbox } from "./ImageLightbox";
import { SecretImage, SecretVideo } from "@/lib/secret-content";
import { formatFileSize } from "@/lib/upload-limits";

type Props = {
  images: SecretImage[];
  videos: SecretVideo[];
  disabled?: boolean;
  onRemoveImage?: (index: number) => void;
  onRemoveVideo?: (index: number) => void;
};

export function MediaList({ images, videos, disabled, onRemoveImage, onRemoveVideo }: Props) {
  const [preview, setPreview] = useState<SecretImage | SecretVideo | null>(null);
  const count = images.length + videos.length;
  if (count === 0) return null;

  return (
    <div className="media-collection">
      <p className="media-summary">{images.length} 张照片 · {videos.length} 个视频 · 点击预览</p>
      <div aria-label="照片和视频列表" className={`photo-list${count > 4 ? " photo-list--scroll" : ""}`}>
        {images.map((image, index) => (
          <div className="photo-preview" key={`image-${index}`}>
            <button aria-label={`预览图片 ${image.name}`} className="photo-thumb-button" onClick={() => setPreview(image)} type="button">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt={image.name || "阅后即焚图片"} loading="lazy" src={image.dataUrl} />
            </button>
            <button className="media-file-name" onClick={() => setPreview(image)} type="button">
              <strong>{image.name || "图片"}</strong><span>{formatFileSize(image.size)}</span>
            </button>
            {onRemoveImage ? <button aria-label={`移除图片 ${image.name}`} className="icon-button" disabled={disabled} onClick={() => onRemoveImage(index)} type="button">移除</button> : null}
          </div>
        ))}
        {videos.map((video, index) => (
          <div className="photo-preview" key={video.id}>
            <button aria-label={`预览视频 ${video.name}`} className="photo-thumb-button video-thumb" onClick={() => setPreview(video)} type="button">
              <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m9 8 7 4-7 4V8Z" /></svg>
            </button>
            <button className="media-file-name" onClick={() => setPreview(video)} type="button">
              <strong>{video.name || "视频"}</strong><span>{formatFileSize(video.size)}</span>
            </button>
            {onRemoveVideo ? <button aria-label={`移除视频 ${video.name}`} className="icon-button" disabled={disabled} onClick={() => onRemoveVideo(index)} type="button">移除</button> : null}
          </div>
        ))}
      </div>
      {preview ? <ImageLightbox alt={preview.name || "媒体预览"} onClose={() => setPreview(null)} src={preview.kind === "video" ? `/api/media/${preview.id}?token=${encodeURIComponent(preview.token)}` : preview.dataUrl} video={preview.kind === "video"} /> : null}
    </div>
  );
}
