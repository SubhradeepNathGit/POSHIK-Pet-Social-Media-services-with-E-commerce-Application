'use client';

import Image from 'next/image';
import { shorten } from './FeedUtils';

interface MiniImageProps {
  url: string | null;
  label: string;
}

export function MiniImage({ url, label }: MiniImageProps) {
  const isImg = !!url && /(\.png|jpe?g|webp|gif|avif)$/i.test(url);
  
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-2 shadow-sm">
      <p className="mb-2 text-xs font-semibold text-gray-600">{label}</p>
      <div className="relative h-32 w-full overflow-hidden rounded-md bg-gray-100">
        {isImg ? (
          <Image src={url as string} alt={label} fill sizes="200px" className="object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-gray-500 p-2 text-center">
            {shorten(url)}
          </div>
        )}
      </div>
    </div>
  );
}






