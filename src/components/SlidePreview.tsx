interface SlidePreviewProps {
  slide: {
    title: string;
    body: string;
  };
  template: "dark" | "light";
  slideNumber: number;
  totalSlides: number;
  coverStyle: "minimalist" | "big_number" | "accent_block" | "gradient_overlay" | "geometric" | "bold_frame";
  slideIndex: number;
  backgroundColor?: string;
  textColor?: string;
  aspectRatio?: "1:1" | "4:5";
  accentColor?: string;
}

const SlidePreview = ({ 
  slide, 
  template,
  slideNumber, 
  totalSlides, 
  coverStyle, 
  backgroundColor, 
  textColor, 
  aspectRatio, 
  accentColor 
}: SlidePreviewProps) => {

  const finalAccentColor = accentColor || (template === 'dark' ? '#FFFFFF' : '#000000');
  const aspectRatioClass = aspectRatio === '4:5' ? 'aspect-[4/5]' : 'aspect-square';

  return (
    <div className={`w-full ${aspectRatioClass} rounded-lg overflow-hidden shadow-2xl`} dir="rtl">
      <div
        className="w-full h-full p-12 flex flex-col justify-between relative"
        style={{
          backgroundColor: backgroundColor,
          color: textColor,
        }}
      >
        {/* Style Rendering */}
        <div className="absolute inset-0">
          {coverStyle === "big_number" && (
            <div 
              className="absolute top-8 right-12 text-9xl font-bold opacity-10"
            >
              {slideNumber}
            </div>
          )}
          {coverStyle === "accent_block" && (
            <div 
              className="absolute top-0 right-0 w-64 h-64 opacity-20 rounded-bl-full"
              style={{ backgroundColor: finalAccentColor }}
            />
          )}
          {coverStyle === "minimalist" && (
            <div 
              className="absolute top-0 right-0 w-32 h-2"
              style={{ backgroundColor: finalAccentColor }}
            />
          )}
          {coverStyle === "gradient_overlay" && (
            <div 
              className="absolute inset-0"
              style={{ background: `linear-gradient(to bottom right, ${finalAccentColor}33, transparent)` }}
            />
          )}
          {coverStyle === "geometric" && (
            <>
              <div 
                className="absolute top-0 left-0 w-32 h-32 border-t-4 border-l-4"
                style={{ borderColor: finalAccentColor }}
              />
              <div 
                className="absolute bottom-0 right-0 w-32 h-32 border-b-4 border-r-4"
                style={{ borderColor: finalAccentColor }}
              />
            </>
          )}
          {coverStyle === "bold_frame" && (
            <div 
              className="absolute top-0 right-0 w-3 h-full"
              style={{ backgroundColor: finalAccentColor }}
            />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col justify-center space-y-8 relative z-10">
          <h2 className={`text-5xl font-bold leading-tight ${coverStyle === "big_number" ? "text-6xl" : ""}`} data-slide-title>
            {slide.title}
          </h2>
          <p className="text-2xl leading-relaxed opacity-90" data-slide-body>
            {slide.body}
          </p>
        </div>

        {/* Slide number */}
        <div className="flex justify-between items-end">
          <div className="text-lg font-medium" style={{ color: finalAccentColor }} data-slide-number>
            {slideNumber}/{totalSlides}
          </div>
          <div className="text-xl font-semibold opacity-50">
            SlideMint
          </div>
        </div>
      </div>
    </div>
  );
};

export default SlidePreview;
