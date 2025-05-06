
-- Create a table to store shortened firmware URLs for hardware access
CREATE TABLE IF NOT EXISTS public.firmware_url_mapping (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  short_id TEXT NOT NULL UNIQUE,
  original_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  CONSTRAINT short_id_length CHECK (char_length(short_id) BETWEEN 4 AND 12)
);

-- Add indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_firmware_url_mapping_short_id ON public.firmware_url_mapping (short_id);
CREATE INDEX IF NOT EXISTS idx_firmware_url_mapping_expires_at ON public.firmware_url_mapping (expires_at);

-- Add RLS policies
ALTER TABLE public.firmware_url_mapping ENABLE ROW LEVEL SECURITY;

-- Anyone can read a short URL (used by devices)
CREATE POLICY "Anyone can read firmware URLs" ON public.firmware_url_mapping
  FOR SELECT USING (true);

-- Only authenticated users can create URLs
CREATE POLICY "Authenticated users can create firmware URLs" ON public.firmware_url_mapping
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Only the creator can update/delete their URLs
CREATE POLICY "Users can update/delete their own firmware URLs" ON public.firmware_url_mapping
  FOR UPDATE TO authenticated
  USING (auth.uid() IN (SELECT auth.uid()));

-- Automatically clean up expired URLs (can be done with a cron job)
-- For now, we'll filter out expired URLs in our queries
