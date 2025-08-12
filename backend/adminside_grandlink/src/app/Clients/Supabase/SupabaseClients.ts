import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gijnybivawnsilzqegik.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdpam55Yml2YXduc2lsenFlZ2lrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyODAyMjUsImV4cCI6MjA2OTg1NjIyNX0.-gO8DcuK9-Q7nQmHRGnKJX3j8W0xHk925KlALBth1gU';

export const supabase = createClient(supabaseUrl, supabaseKey);

export async function getOrders() {
  const { data, error } = await supabase.from("orders").select("*");
  if (error) {
    throw new Error(error.message);
  }
  return data;
}