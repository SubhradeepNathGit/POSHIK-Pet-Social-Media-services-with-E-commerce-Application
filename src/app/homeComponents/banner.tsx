'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Play, ChevronDown } from 'lucide-react';

/* ================== Types ================== */
interface BannerSlide {
  id: number;
  videoSrc: string;
  title: string;
  subtitle: string;
  description: string;
}

const Banner = () => {
  const slides: BannerSlide[] = [
    {
      id: 1,
      videoSrc: '/videos/BannerDog.mp4',
      title: 'Connect with Pet Lovers',
      subtitle: 'WELCOME TO POSHIK',
      description:
        'The ultimate social platform for pet lovers. Share moments, find services, and build a community around your furry friends.',
    },
    {
      id: 2,
      videoSrc: '/videos/BannerCat.mp4',
      title: 'Expert Pet Care Services',
      subtitle: 'PROFESSIONAL CARE',
      description:
        'Book veterinary appointments, find grooming services, and ensure your pets get the best care they deserve.',
    },
    {
      id: 3,
      videoSrc: '/videos/BannerPuppy.mp4',
      title: 'Everything Your Pet Needs',
      subtitle: 'PET MARKETPLACE',
      description:
        'Discover premium pet products, accessories, and services all in one convenient platform.',
    },
    {
      id: 4,
      videoSrc: '/videos/BannerDog4.mp4',
      title: 'Discover Pets Nearby',
      subtitle: 'GEOLOCATION MAP',
      description:
        'Find and connect with pets and owners around you using our interactive map and community discovery tools.',
    },
    {
      id: 5,
      videoSrc: '/videos/Bannerimg5.mp4',
      title: 'Safe & Easy Payments',
      subtitle: 'SECURE WALLET',
      description:
        'Enjoy seamless transactions with our secure wallet for bookings, services, and pet product purchases.',
    },
  ];

  /* ================== State ================== */
  const [currentSlide, setCurrentSlide] = useState(0);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [isMuted] = useState(true);

  const videoRefs = useRef<(HTMLVideoElement | null)[]>(
    new Array(slides.length).fill(null)
  );
  const slideTimerRef = useRef<NodeJS.Timeout | null>(null);

  /* ================== User Interaction ================== */
  const handleUserInteraction = useCallback(() => {
    if (!hasUserInteracted) {
      setHasUserInteracted(true);
      const currentVideo = videoRefs.current[currentSlide];
      if (currentVideo) {
        currentVideo.play().catch(console.error);
      }
    }
  }, [hasUserInteracted, currentSlide]);

  useEffect(() => {
    const events = ['click', 'touchstart', 'keydown'];
    events.forEach((event) =>
      document.addEventListener(event, handleUserInteraction, {
        once: true,
        passive: true,
      })
    );
    return () => {
      events.forEach((event) =>
        document.removeEventListener(event, handleUserInteraction)
      );
    };
  }, [handleUserInteraction]);

  /* ================== Slide Timer ================== */
  const startSlideTimer = useCallback(() => {
    if (slideTimerRef.current) clearInterval(slideTimerRef.current);
    slideTimerRef.current = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
  }, [slides.length]);

  useEffect(() => {
    startSlideTimer();
    return () => {
      if (slideTimerRef.current) clearInterval(slideTimerRef.current);
    };
  }, [startSlideTimer]);

  /* ================== Video Playback ================== */
  useEffect(() => {
    const playVideo = async () => {
      const currentVideo = videoRefs.current[currentSlide];
      if (!currentVideo) return;

      try {
        // Pause other videos
        videoRefs.current.forEach((video, idx) => {
          if (video && idx !== currentSlide) video.pause();
        });

        // Video is already preloaded

        currentVideo.muted = isMuted;
        await currentVideo.play();
      } catch (error) {
        console.warn('Video autoplay failed:', error);
      }
    };
    playVideo();
  }, [currentSlide, isMuted, hasUserInteracted]);

  /* ================== Helpers ================== */
  const handleSlideChange = (index: number) => {
    setCurrentSlide(index);
    startSlideTimer();
  };

  const scrollToContent = () => {
    const element = document.getElementById('main-content');
    if (element) element.scrollIntoView({ behavior: 'smooth' });
  };

  /* ================== JSX ================== */
  return (
    <section className="relative h-screen w-full overflow-hidden">
      {/* Video Backgrounds */}
      {slides.map((slide, index) => (
        <div
          key={slide.id}
          className={`absolute inset-0 transition-opacity duration-1000 ${
            index === currentSlide ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <video
            ref={(el) => {
              videoRefs.current[index] = el;
            }}
            className={`absolute inset-0 w-full h-full object-cover ${index === currentSlide ? 'banner-video' : ''}`}
            muted={isMuted}
            loop
            playsInline
            preload="auto"
          >
            <source src={slide.videoSrc} type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-black/40" />
        </div>
      ))}

      {/* Removed loader overlay for immediate loading */}

      {/* Content */}
      <div className="relative z-10 h-full flex items-center justify-center">
        <div className="text-center max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            transition={{ duration: 0.8 }}
            className="space-y-4 sm:space-y-6 lg:space-y-8"
          >
            <motion.p
              className="text-orange-500 font-semibold text-sm sm:text-base lg:text-lg tracking-wider uppercase [text-stroke:0.2px_black] [-webkit-text-stroke:0.2px_black]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              {slides[currentSlide].subtitle}
            </motion.p>

            <motion.h1
              className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-white leading-tight"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              {slides[currentSlide].title}
            </motion.h1>

            <motion.p
              className="text-white/90 text-sm sm:text-base md:text-lg lg:text-xl max-w-xs sm:max-w-md md:max-w-2xl lg:max-w-3xl mx-auto leading-relaxed px-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              {slides[currentSlide].description}
            </motion.p>
          </motion.div>

          {/* CTA Button */}
          <motion.div
            className="mt-8 sm:mt-12 inline-flex items-center space-x-2 sm:space-x-3 bg-white/10 backdrop-blur-sm rounded-full px-4 sm:px-6 py-2 sm:py-3 cursor-pointer"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
          >
            <motion.div
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 300, damping: 15 }}
              className="w-8 h-8 sm:w-10 sm:h-10 bg-orange-500 rounded-full flex items-center justify-center"
            >
              <Play className="w-3 h-3 sm:w-5 sm:h-5 text-white" />
            </motion.div>

            <span className="text-white font-semibold text-sm sm:text-base lg:text-lg">
              Get Started
            </span>
          </motion.div>
        </div>
      </div>

      {/* Slide Indicators */}
      <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 flex space-x-2 z-20">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => handleSlideChange(index)}
            className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full transition-all duration-300 ${
              index === currentSlide
                ? 'bg-white scale-125'
                : 'bg-white/50 hover:bg-white/75'
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>

      {/* Scroll Indicator */}
      <motion.button
        onClick={scrollToContent}
        className="absolute bottom-20 right-6 sm:right-8 text-white hover:text-orange-400 transition-colors duration-200 z-20"
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
        aria-label="Scroll to main content"
      >
        <ChevronDown className="w-6 h-6 sm:w-8 sm:h-8" />
      </motion.button>

      {/* Overlay (ignores navbar area) */}
      {!hasUserInteracted && (
        <div
          className="absolute left-0 right-0 bottom-0 top-16 md:top-20 z-40 cursor-pointer"
          onClick={handleUserInteraction}
          aria-label="Click to enable video playback"
        />
      )}
    </section>
  );
};

export default Banner;
