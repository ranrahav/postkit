import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';

interface ColorPickerProps {
  color: string;
  setColor: (color: string) => void;
  title: string;
  disabled?: boolean;
}

const colors = [
  '#000000',
  '#FFFFFF',
  '#FF0000',
  '#00FF00',
  '#0000FF',
  '#FFFF00',
  '#FF00FF',
  '#00FFFF',
];

const ColorPicker = ({ color, setColor, title, disabled = false }: ColorPickerProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover open={isOpen && !disabled} onOpenChange={disabled ? () => {} : setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          className="w-40 justify-between"
          disabled={disabled}
        >
          <span>{title}</span>
          <div className="flex items-center gap-2">
            <div
              className="h-4 w-4 rounded-full border"
              style={{ backgroundColor: color }}
            ></div>
            <ChevronDown className="h-4 w-4" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-40 p-2">
        <div className="grid grid-cols-4 gap-2">
          {colors.map((c) => (
            <button
              key={c}
              className="h-8 w-8 rounded-full border"
              style={{ backgroundColor: c }}
              onClick={() => {
                setColor(c);
                setIsOpen(false);
              }}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ColorPicker;
