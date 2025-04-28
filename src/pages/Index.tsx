
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import DrawingToolbar from '@/components/DrawingToolbar';
import { useToast } from '@/components/ui/use-toast';

const Index = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [context, setContext] = useState<CanvasRenderingContext2D | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [color, setColor] = useState('#000000');
  const [size, setSize] = useState(5);
  const { toast } = useToast();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas dimensions to fill the available space
    const resizeCanvas = () => {
      const container = canvas.parentElement;
      if (container) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
      }
    };

    // Initial sizing
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Setup canvas context
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      setContext(ctx);
    }

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  useEffect(() => {
    if (!context) return;
    context.strokeStyle = tool === 'eraser' ? '#FFFFFF' : color;
    context.lineWidth = size;
  }, [context, color, size, tool]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    if (!context) return;

    // Get coordinates
    const coords = getCoordinates(e);
    if (!coords) return;

    const { x, y } = coords;
    context.beginPath();
    context.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !context) return;
    
    // Get coordinates
    const coords = getCoordinates(e);
    if (!coords) return;

    const { x, y } = coords;
    context.lineTo(x, y);
    context.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    if (context) {
      context.closePath();
    }
  };

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    let x, y;

    // Handle both mouse and touch events
    if ('touches' in e) {
      // Touch event
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      x = touch.clientX - rect.left;
      y = touch.clientY - rect.top;
    } else {
      // Mouse event
      const rect = canvas.getBoundingClientRect();
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    return { x, y };
  };

  const clearCanvas = () => {
    if (!context || !canvasRef.current) return;
    context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    toast({
      title: "Canvas Cleared",
      description: "Your drawing has been cleared.",
    });
  };

  const saveDrawing = () => {
    if (!canvasRef.current) return;
    
    try {
      const dataURL = canvasRef.current.toDataURL("image/png");
      const link = document.createElement('a');
      link.download = 'sketchpad-drawing.png';
      link.href = dataURL;
      link.click();
      
      toast({
        title: "Drawing Saved",
        description: "Your drawing has been saved successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save drawing. Try again later.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white p-4 border-b">
        <h1 className="text-2xl font-bold text-center text-gray-800">Web Sketchpad</h1>
      </header>
      
      {/* Toolbar */}
      <DrawingToolbar 
        tool={tool}
        setTool={setTool}
        color={color}
        setColor={setColor}
        size={size}
        setSize={setSize}
        clearCanvas={clearCanvas}
        saveDrawing={saveDrawing}
      />
      
      {/* Canvas Container */}
      <div className="flex-1 relative overflow-hidden bg-white border rounded-md m-4">
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
    </div>
  );
};

export default Index;
