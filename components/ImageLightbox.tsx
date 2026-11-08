"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type ImageLightboxProps = {
  alt: string;
  onClose: () => void;
  src: string;
  video?: boolean;
};

export function ImageLightbox({ alt, onClose, src, video = false }: ImageLightboxProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const htmlOverflow = document.documentElement.style.overflow;
    const bodyOverflow = document.body.style.overflow;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.documentElement.style.overflow = htmlOverflow;
      document.body.style.overflow = bodyOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div aria-label={alt} aria-modal="true" className="image-lightbox" onClick={onClose} role="dialog">
      <button
        aria-label="关闭预览"
        className="image-lightbox__close"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
        type="button"
      >
        ×
      </button>
      {video ? <video aria-label={alt} autoPlay className="image-lightbox__image" controls onClick={(event) => event.stopPropagation()} playsInline src={src} /> : (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt={alt}
        className="image-lightbox__image"
        onClick={(event) => event.stopPropagation()}
        src={src}
      />
      )}
    </div>,
    document.body,
  );
}
