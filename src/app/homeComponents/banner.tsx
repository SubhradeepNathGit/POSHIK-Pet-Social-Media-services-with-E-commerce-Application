"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Play, ChevronDown } from "lucide-react";

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
      videoSrc: "/videos/Banner12.mp4",
      title: "Connect with Pet Lovers",
      subtitle: "WELCOME TO POSHIK",
      description:
        "The ultimate social platform for pet lovers. Share moments, find services, and build a community around your furry friends.",
    },
    {
      id: 2,
      videoSrc: "/videos/BannerCat.mp4",
      title: "Expert Pet Care Services",
      subtitle: "PROFESSIONAL CARE",
      description:
        "Book veterinary appointments, find grooming services, and ensure your pets get the best care they deserve.",
    },
    {
      id: 3,
      videoSrc: "/videos/BannerPuppy.mp4",
      title: "Everything Your Pet Needs",
      subtitle: "PET MARKETPLACE",
      description:
        "Discover premium pet products, accessories, and services all in one convenient platform.",
    },
    {
      id: 4,
      videoSrc: "/videos/BannerDog4.mp4",
      title: "Discover Pets Nearby",
      subtitle: "GEOLOCATION MAP",
      description:
        "Find and connect with pets and owners around you using our interactive map and community discovery tools.",
    },
    {
      id: 5,
      videoSrc: "/videos/Bannerimg5.mp4",
      title: "Safe & Easy Payments",
      subtitle: "SECURE WALLET",
      description:
        "Enjoy seamless transactions with our secure wallet for bookings, services, and pet product purchases.",
    },
  ];

  const [currentSlide, setCurrentSlide] = useState(0);
  const [isMuted] = useState(true);

  const videoRefs = useRef<(HTMLVideoElement | null)[]>(
    new Array(slides.length).fill(null)
  );
  const slideTimerRef = useRef<ReturnType<typeof setInterval> | null>(null); // ✅ fixed

  /* Slide Timer */
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

  /* Play current video */
  useEffect(() => {
    const playVideo = async () => {
      const currentVideo = videoRefs.current[currentSlide];
      if (!currentVideo) return;

      try {
        videoRefs.current.forEach((video, idx) => {
          if (video && idx !== currentSlide) video.pause();
        });

        currentVideo.muted = isMuted;
        await currentVideo.play();
      } catch {
        /* ignore autoplay errors */
      }
    };
    playVideo();
  }, [currentSlide, isMuted]);

  const handleSlideChange = (index: number) => {
    setCurrentSlide(index);
    startSlideTimer();
  };

  const scrollToContent = () => {
    const element = document.getElementById("main-content");
    if (element) element.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative h-screen w-full overflow-hidden">
      {/* Videos */}
      {slides.map((slide, index) => (
        <div
          key={slide.id}
          className={`absolute inset-0 transition-opacity duration-700 ${
            index === currentSlide ? "opacity-100" : "opacity-0"
          }`}
        >
          <video
            ref={(el) => {
              videoRefs.current[index] = el;
            }}
            className="absolute inset-0 w-full h-full object-cover"
            muted={isMuted}
            loop
            playsInline
            preload={index === 0 ? "auto" : "none"} // ✅ only preload first video
          >
            <source src={slide.videoSrc} type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-black/40" />
        </div>
      ))}

      {/* Content */}
      <div className="relative z-10 h-full flex items-center justify-center">
        <div className="text-center max-w-7xl mx-auto px-4">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-4 sm:space-y-6 lg:space-y-8"
          >
            <p className="text-orange-500 font-semibold text-sm sm:text-base lg:text-lg tracking-wider uppercase">
              {slides[currentSlide].subtitle}
            </p>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-white">
              {slides[currentSlide].title}
            </h1>

            <p className="text-white/90 text-sm sm:text-base md:text-lg lg:text-xl max-w-2xl mx-auto">
              {slides[currentSlide].description}
            </p>
          </motion.div>

          {/* CTA */}
          <div className="mt-8 sm:mt-12 inline-flex items-center space-x-3 bg-white/10 backdrop-blur-sm rounded-full px-6 py-3 cursor-pointer">
            <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center">
              <Play className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-semibold text-base lg:text-lg">
              Get Started
            </span>
          </div>
        </div>
      </div>

      {/* Slide Dots */}
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex space-x-2 z-20">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => handleSlideChange(index)}
            className={`w-3 h-3 rounded-full transition-all ${
              index === currentSlide
                ? "bg-white scale-125"
                : "bg-white/50 hover:bg-white/75"
            }`}
          />
        ))}
      </div>

      {/* Scroll Down */}
      <motion.button
        onClick={scrollToContent}
        className="absolute bottom-20 right-8 text-white hover:text-orange-400 z-20"
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <ChevronDown className="w-8 h-8" />
      </motion.button>
    </section>
  );
};

export default Banner;
