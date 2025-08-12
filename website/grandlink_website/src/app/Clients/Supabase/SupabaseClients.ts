import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gijnybivawnsilzqegik.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdpam55Yml2YXduc2lsenFlZ2lrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyODAyMjUsImV4cCI6MjA2OTg1NjIyNX0.-gO8DcuK9-Q7nQmHRGnKJX3j8W0xHk925KlALBth1gU';

export const supabase = createClient(supabaseUrl, supabaseKey);

// Test function to check connection
export async function testSupabaseConnection() {
  const { data, error } = await supabase.from('test_table').select('*').limit(1);
  if (error) {
    console.error("Supabase connection error:", error.message);
  } else {
    console.log("Supabase connection successful! Sample data:", data);
  }
}