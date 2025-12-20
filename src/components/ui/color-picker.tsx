import { useState, useRef, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ChevronDown, Pipette } from 'lucide-react';

interface ColorPickerProps {
  color: string;
  setColor: (color: string) => void;
  title: string;
  disabled?: boolean;
  showLabel?: boolean;
}

// Theme colors (similar to PowerPoint)
const themeColors = [
  '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00',
  '#FF00FF', '#00FFFF', '#800000', '#008000', '#000080', '#808000',
  '#800080', '#008080', '#C0C0C0', '#808080', '#FF6B6B', '#4ECDC4',
  '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'
];

// Standard colors
const standardColors = [
  '#FF0000', '#FFA500', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF',
  '#800080', '#FF00FF', '#FFC0CB', '#A52A2A', '#808080', '#000000'
];

const ColorPicker = ({ color, setColor, title, disabled = false, showLabel = true }: ColorPickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'theme' | 'standard' | 'custom' | 'recent'>('theme');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load recent colors from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('recentColors');
    if (saved) {
      setRecentColors(JSON.parse(saved));
    }
  }, []);

  // Save color to recent colors
  const saveToRecent = (newColor: string) => {
    const updated = [newColor, ...recentColors.filter(c => c !== newColor)].slice(0, 10);
    setRecentColors(updated);
    localStorage.setItem('recentColors', JSON.stringify(updated));
  };

  // Handle color selection
  const handleColorSelect = (selectedColor: string) => {
    setColor(selectedColor);
    saveToRecent(selectedColor);
    setIsOpen(false);
  };

  // Handle spectrum picker click
  const handleSpectrumClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const imageData = ctx.getImageData(x, y, 1, 1);
    const [r, g, b] = imageData.data;
    const hex = '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
    
    handleColorSelect(hex);
  };

  // Initialize spectrum canvas
  useEffect(() => {
    if (activeTab !== 'custom') return;
    
    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // Clear canvas first
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Create spectrum gradient
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
      gradient.addColorStop(0, '#FF0000');
      gradient.addColorStop(0.17, '#FF00FF');
      gradient.addColorStop(0.33, '#0000FF');
      gradient.addColorStop(0.5, '#00FFFF');
      gradient.addColorStop(0.67, '#00FF00');
      gradient.addColorStop(0.83, '#FFFF00');
      gradient.addColorStop(1, '#FF0000');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Add lightness gradient
      const lightnessGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      lightnessGradient.addColorStop(0, 'rgba(255,255,255,0.8)');
      lightnessGradient.addColorStop(0.5, 'rgba(255,255,255,0)');
      lightnessGradient.addColorStop(0.5, 'rgba(0,0,0,0)');
      lightnessGradient.addColorStop(1, 'rgba(0,0,0,0.8)');
      
      ctx.fillStyle = lightnessGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }, 50);
    
    return () => clearTimeout(timer);
  }, [activeTab]);

  // Handle eyedropper (using EyeDropper API if available)
  const handleEyedropper = async () => {
    if (!('EyeDropper' in window)) {
      alert('Eyedropper is not supported in your browser. Please use Chrome or Edge.');
      return;
    }
    
    try {
      const eyeDropper = new (window as any).EyeDropper();
      const result = await eyeDropper.open();
      handleColorSelect(result.sRGBHex);
    } catch (e) {
      console.error('Eyedropper failed:', e);
    }
  };

  const renderColorGrid = (colors: string[]) => (
    <div className="grid grid-cols-8 gap-1">
      {colors.map((c) => (
        <button
          key={c}
          className="h-6 w-6 rounded-md border transition-transform duration-normal ease-ios-out hover:scale-105"
          style={{ backgroundColor: c }}
          onClick={() => handleColorSelect(c)}
        />
      ))}
    </div>
  );

  return (
    <Popover open={isOpen && !disabled} onOpenChange={disabled ? () => {} : setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          className="w-auto justify-between px-2"
          disabled={disabled}
        >
          {showLabel && <span>{title}</span>}
          <div className="flex items-center gap-2">
            <div
              className="h-4 w-4 rounded-full border"
              style={{ backgroundColor: color }}
            ></div>
            <ChevronDown className="h-4 w-4" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        {/* Tabs */}
        <div className="flex border-b">
          <button
            className={`flex-1 px-3 py-2 text-xs font-medium transition-colors duration-normal ease-ios-out ${
              activeTab === 'theme'
                ? 'bg-muted/60 border-b-2 border-primary text-foreground'
                : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
            }`}
            onClick={() => setActiveTab('theme')}
          >
            Theme
          </button>
          <button
            className={`flex-1 px-3 py-2 text-xs font-medium transition-colors duration-normal ease-ios-out ${
              activeTab === 'standard'
                ? 'bg-muted/60 border-b-2 border-primary text-foreground'
                : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
            }`}
            onClick={() => setActiveTab('standard')}
          >
            Standard
          </button>
          <button
            className={`flex-1 px-3 py-2 text-xs font-medium transition-colors duration-normal ease-ios-out ${
              activeTab === 'custom'
                ? 'bg-muted/60 border-b-2 border-primary text-foreground'
                : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
            }`}
            onClick={() => setActiveTab('custom')}
          >
            Custom
          </button>
          <button
            className={`flex-1 px-3 py-2 text-xs font-medium transition-colors duration-normal ease-ios-out ${
              activeTab === 'recent'
                ? 'bg-muted/60 border-b-2 border-primary text-foreground'
                : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
            }`}
            onClick={() => setActiveTab('recent')}
          >
            Recent
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-3">
          {activeTab === 'theme' && (
            <div>
              <div className="mb-3">
                <div className="text-xs font-medium mb-2">Theme</div>
                {renderColorGrid(themeColors)}
              </div>
            </div>
          )}

          {activeTab === 'standard' && (
            <div>
              <div className="text-xs font-medium mb-2">Standard Colors</div>
              {renderColorGrid(standardColors)}
            </div>
          )}

          {activeTab === 'recent' && (
            <div>
              <div className="text-xs font-medium mb-2">Recent Colors</div>
              {recentColors.length > 0 ? (
                renderColorGrid(recentColors)
              ) : (
                <div className="text-xs text-muted-foreground text-center py-4">
                  No recent colors yet
                </div>
              )}
            </div>
          )}

          {activeTab === 'custom' && (
            <div>
              <canvas
                ref={canvasRef}
                width={240}
                height={120}
                className="w-full border rounded-md cursor-crosshair"
                onClick={handleSpectrumClick}
              />
              
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleEyedropper}
                  className="flex items-center gap-1 text-xs"
                >
                  <Pipette className="h-3 w-3" />
                  Eyedropper
                </Button>
                
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <div
                    className="h-4 w-4 rounded border"
                    style={{ backgroundColor: color }}
                  ></div>
                  <span>{color.toUpperCase()}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ColorPicker;
