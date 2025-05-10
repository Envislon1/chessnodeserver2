
-- Add last_random_value and last_seen_at columns to inverter_systems table
ALTER TABLE inverter_systems 
ADD COLUMN IF NOT EXISTS last_random_value INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_inverter_systems_last_seen
ON inverter_systems(last_seen_at);

-- Create a function to update last_seen_at when last_random_value changes
CREATE OR REPLACE FUNCTION update_last_seen_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.last_random_value <> OLD.last_random_value THEN
    NEW.last_seen_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically update the last_seen_at timestamp
DROP TRIGGER IF EXISTS update_last_seen ON inverter_systems;
CREATE TRIGGER update_last_seen
BEFORE UPDATE ON inverter_systems
FOR EACH ROW
EXECUTE FUNCTION update_last_seen_timestamp();
