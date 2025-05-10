
-- Create a function to run the add_last_seen_columns migration
CREATE OR REPLACE FUNCTION run_add_last_seen_columns()
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  -- Check if the column exists
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'inverter_systems' AND column_name = 'last_random_value'
  ) THEN
    -- Add last_random_value column
    ALTER TABLE inverter_systems 
    ADD COLUMN last_random_value INTEGER DEFAULT 0;
    
    result = jsonb_build_object('message', 'Added last_random_value column');
  ELSE
    result = jsonb_build_object('message', 'last_random_value column already exists');
  END IF;
  
  -- Check if the column exists
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'inverter_systems' AND column_name = 'last_seen_at'
  ) THEN
    -- Add last_seen_at column
    ALTER TABLE inverter_systems 
    ADD COLUMN last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
    
    -- Create index for faster queries
    CREATE INDEX IF NOT EXISTS idx_inverter_systems_last_seen
    ON inverter_systems(last_seen_at);
    
    result = jsonb_build_object('message', result->>'message' || ', Added last_seen_at column');
  ELSE
    result = jsonb_build_object('message', result->>'message' || ', last_seen_at column already exists');
  END IF;
  
  -- Check if the trigger exists
  IF NOT EXISTS (
    SELECT FROM pg_trigger
    WHERE tgname = 'update_last_seen'
  ) THEN
    -- Create a function to update last_seen_at when last_random_value changes
    CREATE OR REPLACE FUNCTION update_last_seen_timestamp()
    RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.last_random_value <> OLD.last_random_value OR (NEW.last_random_value IS NOT NULL AND OLD.last_random_value IS NULL) THEN
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
    
    result = jsonb_build_object('message', result->>'message' || ', Added trigger for automatic timestamp updates');
  ELSE
    result = jsonb_build_object('message', result->>'message' || ', Trigger already exists');
  END IF;

  RETURN result;
END;
$$ LANGUAGE plpgsql;
