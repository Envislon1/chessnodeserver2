
import { Pencil, Eraser, Trash2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface DrawingToolbarProps {
  tool: 'pen' | 'eraser';
  setTool: (tool: 'pen' | 'eraser') => void;
  color: string;
  setColor: (color: string) => void;
  size: number;
  setSize: (size: number) => void;
  clearCanvas: () => void;
  saveDrawing: () => void;
}

const colorOptions = [
  '#000000', // Black
  '#ff0000', // Red
  '#0000ff', // Blue
  '#00ff00', // Green
  '#ffff00', // Yellow
  '#ff00ff', // Magenta
  '#00ffff', // Cyan
  '#ffa500', // Orange
  '#800080', // Purple
];

const DrawingToolbar: React.FC<DrawingToolbarProps> = ({
  tool,
  setTool,
  color,
  setColor,
  size,
  setSize,
  clearCanvas,
  saveDrawing,
}) => {
  return (
    <div className="bg-white p-4 border-b flex flex-wrap items-center gap-4 justify-center md:justify-between">
      {/* Tool Selection */}
      <div className="flex items-center gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={tool === 'pen' ? "default" : "outline"}
                size="icon"
                onClick={() => setTool('pen')}
                className="h-10 w-10"
              >
                <Pencil className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Pen</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={tool === 'eraser' ? "default" : "outline"}
                size="icon"
                onClick={() => setTool('eraser')}
                className="h-10 w-10"
              >
                <Eraser className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Eraser</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Color Picker */}
      <div className="flex items-center gap-2 flex-wrap justify-center">
        {colorOptions.map((c) => (
          <button
            key={c}
            className={`h-8 w-8 rounded-full border-2 transition-transform ${
              color === c ? 'border-gray-800 scale-110' : 'border-gray-300'
            }`}
            style={{ backgroundColor: c }}
            onClick={() => setColor(c)}
            aria-label={`Color: ${c}`}
          />
        ))}
      </div>

      {/* Size Slider */}
      <div className="flex items-center gap-2 flex-grow max-w-xs">
        <span className="text-sm whitespace-nowrap">Size: {size}px</span>
        <Slider
          value={[size]}
          min={1}
          max={50}
          step={1}
          onValueChange={(value) => setSize(value[0])}
          className="w-full"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={clearCanvas}
                className="h-10 w-10"
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Clear Canvas</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                onClick={saveDrawing}
                className="h-10 w-10"
              >
                <Save className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Save Drawing</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
};

export default DrawingToolbar;
