
-- Create the inverter firmware table to track firmware uploads and updates
CREATE TABLE IF NOT EXISTS public.inverter_firmware (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inverter_id UUID REFERENCES public.inverter_systems(id) ON DELETE CASCADE,
  firmware_version TEXT NOT NULL,
  firmware_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ready', -- ready, installing, installed, failed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE public.inverter_firmware ENABLE ROW LEVEL SECURITY;

-- Owner can see and modify their own firmware files
CREATE POLICY "Users can view their own firmware files" 
  ON public.inverter_firmware 
  FOR SELECT 
  USING (
    inverter_id IN (
      SELECT id FROM public.inverter_systems WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own firmware" 
  ON public.inverter_firmware 
  FOR INSERT 
  WITH CHECK (
    inverter_id IN (
      SELECT id FROM public.inverter_systems WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own firmware" 
  ON public.inverter_firmware 
  FOR UPDATE 
  USING (
    inverter_id IN (
      SELECT id FROM public.inverter_systems WHERE user_id = auth.uid()
    )
  );

-- Create the firmware storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('firmware', 'firmware', false)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies for firmware bucket
CREATE POLICY "Users can upload firmware" 
  ON storage.objects 
  FOR INSERT 
  WITH CHECK (
    bucket_id = 'firmware' AND
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can update firmware" 
  ON storage.objects 
  FOR UPDATE 
  USING (
    bucket_id = 'firmware' AND
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can read firmware" 
  ON storage.objects 
  FOR SELECT 
  USING (
    bucket_id = 'firmware' AND
    auth.uid() IS NOT NULL
  );
