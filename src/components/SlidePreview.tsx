interface SlidePreviewProps {
  slide: {
    title: string;
    body: string;
  };
  template: "dark" | "light";
  slideNumber: number;
  totalSlides: number;
}

const SlidePreview = ({ slide, template, slideNumber, totalSlides }: SlidePreviewProps) => {
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
        {/* Accent element - Top left for dark, highlight for light */}
        {isDark ? (
          <div className="absolute top-0 right-0 w-32 h-2 bg-template-dark-accent" />
        ) : (
          <div className="absolute top-12 right-12 w-24 h-3 bg-template-light-accent/30 -z-0" />
        )}

        {/* Content */}
        <div className="flex-1 flex flex-col justify-center space-y-8 relative z-10">
          <h2 className={`text-5xl font-bold leading-tight ${!isDark && "relative"}`}>
            {slide.title}
          </h2>
          <p className="text-2xl leading-relaxed opacity-90">
            {slide.body}
          </p>
        </div>

        {/* Slide number */}
        <div className="flex justify-between items-end">
          <div className={`text-lg font-medium ${isDark ? "text-template-dark-accent" : "text-template-light-accent"}`}>
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
