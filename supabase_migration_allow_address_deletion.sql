-- Migration: Allow address deletion even when referenced in user_items
-- This script drops the existing foreign key constraint and recreates it with ON DELETE SET NULL
-- so that when an address is deleted, the delivery_address_id in user_items is set to NULL
-- rather than preventing the deletion.

-- Drop the existing constraint
ALTER TABLE public.user_items 
DROP CONSTRAINT IF EXISTS user_items_delivery_address_id_fkey;

-- Recreate the constraint with ON DELETE SET NULL
ALTER TABLE public.user_items 
ADD CONSTRAINT user_items_delivery_address_id_fkey 
FOREIGN KEY (delivery_address_id) 
REFERENCES public.addresses(id) 
ON DELETE SET NULL;

-- Optional: Add a comment to document the behavior
COMMENT ON CONSTRAINT user_items_delivery_address_id_fkey ON public.user_items 
IS 'Foreign key to addresses table. When an address is deleted, this field is set to NULL to preserve order history.';
