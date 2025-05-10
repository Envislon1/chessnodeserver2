
// Follow this setup guide to integrate the Deno runtime with your project:
// https://deno.land/manual/examples/supabase-functions

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.131.0/http/server.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') as string;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;

// Create a Supabase client with the service role key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  try {
    const { migration } = await req.json();
    
    if (migration === 'add_last_seen_columns') {
      // First check if the columns already exist
      const { data: columns, error: columnsError } = await supabase.rpc('run_add_last_seen_columns');
      
      if (columnsError) {
        console.error("Error running RPC function:", columnsError);
        
        // If RPC fails, try direct SQL as a fallback (requires elevated privileges)
        try {
          // Use direct SQL to add columns (this requires service role key)
          const { data: directResult, error: directError } = await supabase.from('inverter_systems').select('*').limit(1);
          
          if (directError) {
            console.error("Cannot access inverter_systems table:", directError);
            throw directError;
          }
          
          // Check if the columns exist by attempting to select them
          const { error: columnCheckError } = await supabase
            .from('inverter_systems')
            .select('last_seen_at, last_random_value')
            .limit(1);
            
          if (columnCheckError) {
            console.log("Columns don't exist, adding them directly with SQL...");
            
            // Execute SQL to add columns
            const sqlQuery = `
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
            `;
            
            // Execute the SQL query (requires service role)
            const { data: sqlResult, error: sqlError } = await supabase.rpc('exec_sql', { sql: sqlQuery });
            
            if (sqlError) {
              console.error("Error executing SQL:", sqlError);
              throw sqlError;
            }
            
            console.log("SQL executed successfully:", sqlResult);
            return new Response(
              JSON.stringify({ 
                success: true, 
                message: "Columns added directly with SQL",
                method: "direct_sql"
              }),
              { headers: { 'Content-Type': 'application/json' } },
            );
          } else {
            console.log("Columns already exist based on direct check");
            return new Response(
              JSON.stringify({ 
                success: true, 
                message: "Columns already exist",
                method: "column_check"
              }),
              { headers: { 'Content-Type': 'application/json' } },
            );
          }
        } catch (sqlError) {
          console.error("Error with direct SQL approach:", sqlError);
          throw new Error(`Migration failed: ${columnsError.message}, SQL fallback also failed: ${sqlError.message}`);
        }
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Migration completed successfully", 
          data: columns,
          method: "rpc_function"
        }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    } else {
      throw new Error(`Unknown migration: ${migration}`);
    }
  } catch (error) {
    console.error("Migration error:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        stack: error.stack 
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
