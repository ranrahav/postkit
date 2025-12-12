import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import SlidePreview from './SlidePreview';

// Function to detect if text is primarily Hebrew (RTL) or English (LTR)
const detectTextDirection = (text: string): "ltr" | "rtl" => {
  if (!text || text.trim() === '') return "ltr";
  
  // Count Hebrew characters (Unicode range for Hebrew)
  const hebrewChars = text.match(/[\u0590-\u05FF]/g) || [];
  const totalChars = text.replace(/\s/g, '').length; // Remove spaces from count
  
  // If more than 30% of non-space characters are Hebrew, use RTL
  const hebrewRatio = totalChars > 0 ? hebrewChars.length / totalChars : 0;
  return hebrewRatio > 0.3 ? "rtl" : "ltr";
};

interface LinkedInCarouselPreviewProps {
  slides: Array<{
    title: string;
    body: string;
  }>;
  template: "dark" | "light";
  coverStyle: "minimalist" | "big_number" | "accent_block" | "gradient_overlay" | "geometric" | "bold_frame";
  backgroundColor?: string;
  textColor?: string;
  aspectRatio?: "1:1" | "4:5";
  accentColor?: string;
  onUpdateSlide: (slideIndex: number, updates: { title?: string; body?: string }) => void;
  editingSlideIndex: number;
  onEditStart: (slideIndex: number) => void;
  onEditEnd: () => void;
}

const LinkedInCarouselPreview = ({
  slides,
  template,
  coverStyle,
  backgroundColor,
  textColor,
  aspectRatio,
  accentColor,
  onUpdateSlide,
  editingSlideIndex,
  onEditStart,
  onEditEnd
}: LinkedInCarouselPreviewProps) => {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(editingSlideIndex || 0);

  // Keep the visible slide in sync with the parent-selected editing slide
  useEffect(() => {
    setCurrentSlideIndex(editingSlideIndex || 0);
  }, [editingSlideIndex]);

  const nextSlide = () => {
    setCurrentSlideIndex((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setCurrentSlideIndex((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const goToSlide = (index: number) => {
    setCurrentSlideIndex(index);
  };

  if (!slides.length) return null;

  // Use a fixed logical width that matches the export base size (540px)
  // so that text wrapping and proportions are identical between preview and PNG export.
  const previewWidth = 540;

  return (
    <div
      className="relative mx-auto flex flex-col items-center gap-3"
      style={{ width: `${previewWidth}px` }}
    >
      {/* LinkedIn-style container with rounded corners and shadow */}
      <div className="relative bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200 w-full">
        {/* Slide content */}
        <div className="relative">
          <SlidePreview
            slide={slides[currentSlideIndex]}
            template={template}
            slideNumber={currentSlideIndex + 1}
            totalSlides={slides.length}
            coverStyle={coverStyle}
            backgroundColor={backgroundColor}
            textColor={textColor}
            aspectRatio={aspectRatio}
            accentColor={accentColor}
            slideIndex={currentSlideIndex}
            // Allow inline editing on whichever slide is currently visible
            isEditing={true}
            onEditStart={() => onEditStart(currentSlideIndex)}
            onEditEnd={onEditEnd}
            onUpdateSlide={(updates) => onUpdateSlide(currentSlideIndex, updates)}
            showSlideNumber={false}
            textDirection={detectTextDirection(slides[currentSlideIndex].title + " " + slides[currentSlideIndex].body)}
          />
        </div>
      </div>

      {/* Footer controls below the preview */}
      {slides.length > 1 && (
        <div className="flex w-full items-center justify-between">
          {/* Left: arrows */}
          <div className="flex items-center gap-2">
            {/* Right-pointing arrow goes to NEXT slide */}
            <button
              onClick={nextSlide}
              className="bg-white/90 hover:bg-white rounded-full p-2 shadow-md transition-all duration-200 hover:scale-110 border border-gray-200"
              aria-label="Next slide"
            >
              <ChevronRight className="w-5 h-5 text-gray-700" />
            </button>
            {/* Left-pointing arrow goes to PREVIOUS slide */}
            <button
              onClick={prevSlide}
              className="bg-white/90 hover:bg-white rounded-full p-2 shadow-md transition-all duration-200 hover:scale-110 border border-gray-200"
              aria-label="Previous slide"
            >
              <ChevronLeft className="w-5 h-5 text-gray-700" />
            </button>
          </div>

          {/* Center: navigation dots (force LTR so first slide is left, last is right) */}
          <div className="flex flex-row gap-1.5" dir="ltr">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${
                  index === currentSlideIndex
                    ? 'bg-gray-800 scale-125'
                    : 'bg-gray-400/60 hover:bg-gray-600/80'
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>

          {/* Right: slide counter */}
          <div className="text-xs text-gray-600 font-medium">
            {currentSlideIndex + 1}/{slides.length}
          </div>
        </div>
      )}
    </div>
  );
};

export default LinkedInCarouselPreview;
