interface SlidePreviewProps {
  slide: {
    title: string;
    body: string;
  };
  template: "dark" | "light";
  slideNumber: number;
  totalSlides: number;
  coverStyle: "minimalist" | "big_number" | "accent_block";
  slideIndex: number;
}

const SlidePreview = ({ slide, template, slideNumber, totalSlides, coverStyle, slideIndex }: SlidePreviewProps) => {
  const isDark = template === "dark";

  return (
    <div className="w-full aspect-square rounded-lg overflow-hidden shadow-2xl" dir="rtl">
      <div
        className={`w-full h-full p-12 flex flex-col justify-between relative ${
          isDark
            ? "bg-template-dark-bg text-template-dark-text"
            : "bg-template-light-bg text-template-light-text"
        } ${!isDark && "border-4 border-template-light-border"}`}
      >
        {/* Style Rendering (applied to all slides) */}
        {coverStyle === "big_number" && (
          <div className="absolute top-8 right-12 text-9xl font-bold opacity-10">
            {slideNumber}
          </div>
        )}
        {coverStyle === "accent_block" && (
          <div className={`absolute top-0 right-0 w-64 h-64 ${
            isDark ? "bg-template-dark-accent" : "bg-template-light-accent"
          } opacity-20 rounded-bl-full`} />
        )}
        {coverStyle === "minimalist" && (
          <>
            {isDark ? (
              <div className="absolute top-0 right-0 w-32 h-2 bg-template-dark-accent" />
            ) : (
              <div className="absolute top-12 right-12 w-24 h-3 bg-template-light-accent/30 -z-0" />
            )}
          </>
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
          <div className={`text-lg font-medium ${isDark ? "text-template-dark-accent" : "text-template-light-accent"}`} data-slide-number>
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
