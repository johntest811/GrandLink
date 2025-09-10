import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gijnybivawnsilzqegik.supabase.co'; // Replace with your Supabase URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdpam55Yml2YXduc2lsenFlZ2lrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyODAyMjUsImV4cCI6MjA2OTg1NjIyNX0.-gO8DcuK9-Q7nQmHRGnKJX3j8W0xHk925KlALBth1gU'; // Replace with your Supabase anon key

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);