import React, { useState, useEffect, useRef } from 'react';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  onError?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
  onClick?: () => void;
}

export const LazyImage: React.FC<LazyImageProps> = ({ src, alt, className, onError, onClick }) => {
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [imageLoaded, setImageLoaded] = useState(false);
    const imgRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!src) return;

        // Intersection Observer for lazy loading
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        // Reset state each time a new image starts loading
                        setImageLoaded(false);
                        setImageSrc(src);
                        observer.disconnect();
                    }
                });
            },
            { rootMargin: '50px' } // Start loading 50px before visible
        );

        const target = imgRef.current;
        if (target) {
            observer.observe(target);
        }

        return () => {
            observer.disconnect();
        };
    }, [src]);

    return (
        <div ref={imgRef} className={className} onClick={onClick}>
            {!imageLoaded && (
                <div className="absolute inset-0 bg-slate-200 animate-pulse"></div>
            )}
            {imageSrc && (
                <img
                    src={imageSrc}
                    alt={alt}
                    className={`${className} ${imageLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
                    onLoad={() => setImageLoaded(true)}
                    onError={onError}
                />
            )}
        </div>
    );
};
