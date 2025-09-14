'use client';

import Image from 'next/image';

export default function FeedHeader() {
  return (
    <div className="relative w-full h-48 sm:h-64 md:h-72 lg:h-80 mb-8">
      <Image
        src="/images/statbg11.jpg"
        alt="Products Banner"
        fill
        priority
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/40 to-black/60 flex flex-col justify-center items-center text-center">
        <h1 className="text-3xl md:text-5xl font-bold text-white mb-2">News Feed</h1>
        <p className="text-sm md:text-base text-gray-200">
          Home / Profile / Feed
        </p>
      </div>
    </div>
  );
}


