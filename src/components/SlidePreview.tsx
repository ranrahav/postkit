import { useState, useEffect } from 'react';

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
  onUpdateSlide: (updates: { title?: string; body?: string }) => void;
  isEditing: boolean;
  onEditStart: () => void;
  onEditEnd: () => void;
  showSlideNumber?: boolean;
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
  accentColor,
  onUpdateSlide,
  isEditing,
  onEditStart,
  onEditEnd,
  showSlideNumber = true
}: SlidePreviewProps) => {
  const [editingField, setEditingField] = useState<'title' | 'body' | null>(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    if (!isEditing) {
      setEditingField(null);
    }
  }, [isEditing]);

  const handleFieldClick = (field: 'title' | 'body', value: string) => {
    if (!isEditing) return;
    onEditStart();
    setEditingField(field);
    setEditValue(value);
  };

  const handleSave = () => {
    if (editingField && editValue.trim() !== '') {
      onUpdateSlide({ [editingField]: editValue });
    }
    setEditingField(null);
    onEditEnd();
  };

  const finalAccentColor = accentColor || (template === 'dark' ? '#FFFFFF' : '#000000');
  const aspectRatioClass = aspectRatio === '4:5' ? 'aspect-[4/5]' : 'aspect-square';

  const handleContainerClick = (e: React.MouseEvent) => {
    // Only handle the click if we're not clicking on an interactive element
    const target = e.target as HTMLElement;
    if (isEditing && !target.closest('input, textarea, button, a, [role="button"]')) {
      onEditStart();
    }
  };

  return (
    <div 
      className={`w-full ${aspectRatioClass} rounded-lg overflow-hidden shadow-2xl`} 
      dir="rtl"
      onClick={handleContainerClick}
    >
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
        <div className="flex-1 flex flex-col justify-center relative z-10">
          {editingField === 'title' ? (
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleSave}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              className="text-4xl font-bold mb-4 bg-transparent border-b border-gray-400 focus:outline-none w-full"
              autoFocus
            />
          ) : (
            <h2 
              className="text-4xl font-bold mb-4 cursor-text select-text"
              onClick={(e) => {
                e.stopPropagation();
                handleFieldClick('title', slide.title);
              }}
            >
              {slide.title}
            </h2>
          )}

          {editingField === 'body' ? (
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleSave}
              className="text-xl leading-relaxed bg-transparent border-b border-gray-400 focus:outline-none resize-none w-full min-h-[100px]"
              autoFocus
            />
          ) : (
            <p 
              className="text-xl leading-relaxed whitespace-pre-line cursor-text select-text"
              onClick={(e) => {
                e.stopPropagation();
                handleFieldClick('body', slide.body);
              }}
            >
              {slide.body}
            </p>
          )}
        </div>

        {/* Post24.ai logo - positioned at bottom right */}
        <div className="absolute bottom-4 right-4 text-sm font-medium opacity-40">
          Post24.ai
        </div>
      </div>
    </div>
  );
};

export default SlidePreview;
