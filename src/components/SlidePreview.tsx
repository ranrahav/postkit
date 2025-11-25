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
  customBgColor?: string;
  customTextColor?: string;
  customAccentColor?: string;
}

const SlidePreview = ({ slide, template, slideNumber, totalSlides, coverStyle, slideIndex, customBgColor, customTextColor, customAccentColor }: SlidePreviewProps) => {
  const isDark = template === "dark";
  
  const bgColor = customBgColor || (isDark ? undefined : undefined);
  const textColor = customTextColor || undefined;
  const accentColor = customAccentColor || (isDark ? undefined : undefined);

  return (
    <div className="w-full aspect-square rounded-lg overflow-hidden shadow-2xl" dir="rtl">
      <div
        style={{
          backgroundColor: bgColor,
          color: textColor,
        }}
        className={`w-full h-full p-12 flex flex-col justify-between relative ${
          !bgColor && (isDark ? "bg-template-dark-bg" : "bg-template-light-bg")
        } ${
          !textColor && (isDark ? "text-template-dark-text" : "text-template-light-text")
        } ${!isDark && "border-4 border-template-light-border"}`}
      >
        {/* Style Rendering (applied to all slides) */}
        {coverStyle === "big_number" && (
          <div className="absolute top-8 right-12 text-9xl font-bold opacity-10">
            {slideNumber}
          </div>
        )}
        {coverStyle === "accent_block" && (
          <div 
            style={{ backgroundColor: accentColor }}
            className={`absolute top-0 right-0 w-64 h-64 ${
              !accentColor && (isDark ? "bg-template-dark-accent" : "bg-template-light-accent")
            } opacity-20 rounded-bl-full`} 
          />
        )}
        {coverStyle === "minimalist" && (
          <>
            {isDark ? (
              <div 
                style={{ backgroundColor: accentColor }}
                className={`absolute top-0 right-0 w-32 h-2 ${!accentColor && "bg-template-dark-accent"}`} 
              />
            ) : (
              <div 
                style={{ backgroundColor: accentColor }}
                className={`absolute top-12 right-12 w-24 h-3 ${!accentColor && "bg-template-light-accent/30"} -z-0`} 
              />
            )}
          </>
        )}
        {coverStyle === "gradient_overlay" && (
          <div 
            style={{
              background: accentColor 
                ? `linear-gradient(to bottom right, ${accentColor}33, transparent, transparent)`
                : undefined
            }}
            className={`absolute inset-0 ${
              !accentColor && (isDark 
                ? "bg-gradient-to-br from-template-dark-accent/20 via-transparent to-transparent" 
                : "bg-gradient-to-br from-template-light-accent/30 via-transparent to-transparent")
            }`} 
          />
        )}
        {coverStyle === "geometric" && (
          <>
            <div 
              style={{ borderColor: accentColor }}
              className={`absolute top-0 left-0 w-32 h-32 border-t-4 border-l-4 ${
                !accentColor && (isDark ? "border-template-dark-accent" : "border-template-light-accent")
              }`} 
            />
            <div 
              style={{ borderColor: accentColor }}
              className={`absolute bottom-0 right-0 w-32 h-32 border-b-4 border-r-4 ${
                !accentColor && (isDark ? "border-template-dark-accent" : "border-template-light-accent")
              }`} 
            />
          </>
        )}
        {coverStyle === "bold_frame" && (
          <div 
            style={{ backgroundColor: accentColor }}
            className={`absolute top-0 right-0 w-3 h-full ${
              !accentColor && (isDark ? "bg-template-dark-accent" : "bg-template-light-accent")
            }`} 
          />
        )}

        {/* Content */}
        <div className="flex-1 flex flex-col justify-center space-y-8 relative z-10">
          <h2 className={`text-5xl font-bold leading-tight ${!isDark && "relative"} ${
            coverStyle === "big_number" ? "text-6xl" : ""
          }`} data-slide-title>
            {slide.title}
          </h2>
          <p className="text-2xl leading-relaxed opacity-90" data-slide-body>
            {slide.body}
          </p>
        </div>

        {/* Slide number */}
        <div className="flex justify-between items-end">
          <div 
            style={{ color: accentColor }}
            className={`text-lg font-medium ${!accentColor && (isDark ? "text-template-dark-accent" : "text-template-light-accent")}`} 
            data-slide-number
          >
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
