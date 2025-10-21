-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.about (
  id integer NOT NULL DEFAULT nextval('about_id_seq'::regclass),
  grand text NOT NULL,
  description text NOT NULL,
  mission text NOT NULL,
  vision text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT about_pkey PRIMARY KEY (id)
);
CREATE TABLE public.activity_logs (
  id bigint NOT NULL DEFAULT nextval('activity_logs_id_seq'::regclass),
  admin_id text NOT NULL,
  admin_name text NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  details text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  page text,
  metadata jsonb,
  CONSTRAINT activity_logs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.addresses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  full_name text NOT NULL,
  phone text NOT NULL,
  address text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  first_name text,
  last_name text,
  branch text,
  CONSTRAINT addresses_pkey PRIMARY KEY (id)
);
CREATE TABLE public.admins (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  role text NOT NULL CHECK (role = ANY (ARRAY['superadmin'::text, 'admin'::text, 'manager'::text])),
  created_at timestamp with time zone DEFAULT now(),
  last_login timestamp with time zone,
  employee_id integer,
  employee_number character varying,
  full_name text,
  position text CHECK ("position" = ANY (ARRAY['Sales Manager'::text, 'Site Manager'::text, 'Media Handler'::text, 'Supervisor'::text, 'Employee'::text, 'Manager'::text, 'Admin'::text, 'Superadmin'::text])),
  is_active boolean DEFAULT true,
  password text NOT NULL DEFAULT 'admin123'::text,
  CONSTRAINT admins_pkey PRIMARY KEY (id),
  CONSTRAINT admins_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);
CREATE TABLE public.calendar_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  start timestamp with time zone NOT NULL,
  end timestamp with time zone,
  location text,
  created_at timestamp without time zone DEFAULT now(),
  created_by uuid,
  CONSTRAINT calendar_events_pkey PRIMARY KEY (id),
  CONSTRAINT calendar_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.email_notifications (
  id bigint NOT NULL DEFAULT nextval('email_notifications_id_seq'::regclass),
  recipient_email text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  notification_type text NOT NULL,
  sent_at timestamp with time zone DEFAULT now(),
  status text DEFAULT 'sent'::text CHECK (status = ANY (ARRAY['sent'::text, 'failed'::text, 'pending'::text])),
  related_entity_type text,
  related_entity_id text,
  CONSTRAINT email_notifications_pkey PRIMARY KEY (id)
);
CREATE TABLE public.employees (
  id integer NOT NULL DEFAULT nextval('employees_id_seq'::regclass),
  employee_number character varying NOT NULL UNIQUE,
  name character varying NOT NULL,
  role character varying NOT NULL CHECK (role::text = ANY (ARRAY['employee'::character varying, 'manager'::character varying, 'admin'::character varying]::text[])),
  department character varying,
  email character varying UNIQUE,
  phone character varying,
  date_hired date DEFAULT CURRENT_DATE,
  status character varying DEFAULT 'Active'::character varying CHECK (status::text = ANY (ARRAY['Active'::character varying, 'Inactive'::character varying]::text[])),
  position text CHECK ("position" = ANY (ARRAY['Sales Manager'::text, 'Site Manager'::text, 'Media Handler'::text, 'Supervisor'::text, 'Employee'::text, 'Manager'::text, 'Admin'::text])),
  admin_account boolean NOT NULL DEFAULT false,
  admin_user_uuid uuid,
  CONSTRAINT employees_pkey PRIMARY KEY (id)
);
CREATE TABLE public.event_participants (
  id bigint NOT NULL DEFAULT nextval('event_participants_id_seq'::regclass),
  event_id bigint,
  user_id uuid,
  role text DEFAULT 'attendee'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT event_participants_pkey PRIMARY KEY (id),
  CONSTRAINT event_participants_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT event_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.event_tags (
  id bigint NOT NULL DEFAULT nextval('event_tags_id_seq'::regclass),
  event_id bigint,
  tag text NOT NULL,
  CONSTRAINT event_tags_pkey PRIMARY KEY (id),
  CONSTRAINT event_tags_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id)
);
CREATE TABLE public.events (
  id bigint NOT NULL DEFAULT nextval('events_id_seq'::regclass),
  title text NOT NULL,
  description text,
  category text DEFAULT 'Other'::text CHECK (category = ANY (ARRAY['Production'::text, 'Meeting'::text, 'Deadline'::text, 'Personal'::text, 'Other'::text])),
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone NOT NULL,
  location text,
  recurrence_rule text,
  reminder_minutes integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT events_pkey PRIMARY KEY (id)
);
CREATE TABLE public.faq_categories (
  id bigint NOT NULL DEFAULT nextval('faq_categories_id_seq'::regclass),
  name text NOT NULL,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT faq_categories_pkey PRIMARY KEY (id)
);
CREATE TABLE public.faq_questions (
  id bigint NOT NULL DEFAULT nextval('faq_questions_id_seq'::regclass),
  category_id bigint,
  question text NOT NULL,
  answer text NOT NULL,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT faq_questions_pkey PRIMARY KEY (id),
  CONSTRAINT faq_questions_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.faq_categories(id)
);
CREATE TABLE public.faqs (
  id bigint NOT NULL DEFAULT nextval('faqs_id_seq'::regclass),
  category text NOT NULL,
  question text NOT NULL,
  answer text NOT NULL,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT faqs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.featured_projects (
  id bigint NOT NULL DEFAULT nextval('featured_projects_id_seq'::regclass),
  title text NOT NULL,
  description text,
  created_at timestamp without time zone DEFAULT now(),
  image_url text,
  link_url text,
  CONSTRAINT featured_projects_pkey PRIMARY KEY (id)
);
CREATE TABLE public.home_content (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  content jsonb NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT home_content_pkey PRIMARY KEY (id)
);
CREATE TABLE public.inqruire_content (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  phone text,
  email text,
  facebook text,
  CONSTRAINT inqruire_content_pkey PRIMARY KEY (id)
);
CREATE TABLE public.inquiries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text,
  inquiry_type text NOT NULL CHECK (inquiry_type = ANY (ARRAY['Doors'::text, 'Windows'::text, 'Enclosure'::text, 'Casement'::text, 'Sliding'::text, 'Railings'::text, 'Canopy'::text, 'Curtain Wall'::text, 'Custom Design'::text])),
  message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT inquiries_pkey PRIMARY KEY (id)
);
CREATE TABLE public.notifications (
  id bigint NOT NULL DEFAULT nextval('notifications_id_seq'::regclass),
  title text NOT NULL,
  message text NOT NULL,
  type text DEFAULT 'general'::text CHECK (type = ANY (ARRAY['report'::text, 'stock'::text, 'task'::text, 'general'::text, 'product_added'::text, 'stock_updated'::text, 'order_status'::text])),
  recipient_role text DEFAULT 'all'::text CHECK (recipient_role = ANY (ARRAY['employee'::text, 'manager'::text, 'admin'::text, 'all'::text])),
  recipient_id uuid,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  priority text DEFAULT 'medium'::text,
  metadata jsonb DEFAULT '{}'::jsonb,
  action_url text,
  expires_at timestamp with time zone,
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES auth.users(id)
);
CREATE TABLE public.orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  customer_email text,
  customer_phone text,
  product_name text NOT NULL,
  quantity integer DEFAULT 1,
  total_amount numeric DEFAULT 0.00,
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'reserved'::text, 'completed'::text, 'cancelled'::text])),
  order_type text DEFAULT 'order'::text CHECK (order_type = ANY (ARRAY['order'::text, 'reservation'::text])),
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT orders_pkey PRIMARY KEY (id)
);
CREATE TABLE public.payment_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  user_item_id uuid,
  stripe_session_id text NOT NULL UNIQUE,
  amount numeric NOT NULL,
  currency text DEFAULT 'php'::text,
  status text DEFAULT 'pending'::text,
  payment_type text DEFAULT 'reservation'::text,
  created_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  payment_provider text DEFAULT 'paymongo'::text,
  paypal_order_id text,
  converted_amount numeric,
  converted_currency text,
  CONSTRAINT payment_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT payment_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT payment_sessions_user_item_id_fkey FOREIGN KEY (user_item_id) REFERENCES public.user_items(id)
);
CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price numeric NOT NULL DEFAULT 0,
  images ARRAY DEFAULT '{}'::text[],
  fbx_url text,
  created_at timestamp with time zone DEFAULT now(),
  category text,
  height numeric,
  width numeric,
  thickness numeric,
  material text,
  type text,
  image1 text,
  image2 text,
  image3 text,
  image4 text,
  image5 text,
  fullproductname text,
  additionalfeatures text,
  inventory integer DEFAULT 0,
  reserved_stock integer DEFAULT 0,
  fbx_urls ARRAY DEFAULT '{}'::text[],
  last_stock_update timestamp with time zone DEFAULT now(),
  stock_notification_sent boolean DEFAULT false,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT products_pkey PRIMARY KEY (id)
);
CREATE TABLE public.reservations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  user_item_id uuid,
  name text NOT NULL,
  last_name text NOT NULL,
  phone text NOT NULL,
  email text NOT NULL,
  store_branch text NOT NULL,
  type_of_product text NOT NULL,
  product_model text,
  width numeric,
  height numeric,
  thickness numeric,
  construction text,
  remarks text,
  address text,
  agree boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT reservations_pkey PRIMARY KEY (id),
  CONSTRAINT fk_user_item FOREIGN KEY (user_item_id) REFERENCES public.user_items(id)
);
CREATE TABLE public.sales_reports (
  id bigint NOT NULL DEFAULT nextval('sales_reports_id_seq'::regclass),
  report_date date NOT NULL DEFAULT CURRENT_DATE,
  total_sales numeric DEFAULT 0.00,
  total_products_sold integer DEFAULT 0,
  total_orders integer DEFAULT 0,
  successful_orders integer DEFAULT 0,
  cancelled_orders integer DEFAULT 0,
  pending_orders integer DEFAULT 0,
  report_data jsonb,
  generated_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  products_data jsonb DEFAULT '{}'::jsonb,
  inventory_summary jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT sales_reports_pkey PRIMARY KEY (id),
  CONSTRAINT sales_reports_generated_by_fkey FOREIGN KEY (generated_by) REFERENCES auth.users(id)
);
CREATE TABLE public.services (
  id bigint NOT NULL DEFAULT nextval('services_id_seq'::regclass),
  name text NOT NULL,
  short_description text,
  long_description text,
  created_at timestamp without time zone DEFAULT now(),
  icon text,
  CONSTRAINT services_pkey PRIMARY KEY (id)
);
CREATE TABLE public.showrooms (
  id bigint NOT NULL DEFAULT nextval('showrooms_id_seq'::regclass),
  title text NOT NULL,
  address text,
  description text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  image text,
  CONSTRAINT showrooms_pkey PRIMARY KEY (id)
);
CREATE TABLE public.tasks (
  id integer NOT NULL DEFAULT nextval('tasks_id_seq'::regclass),
  task_number character varying NOT NULL,
  product_name character varying NOT NULL,
  task_name character varying NOT NULL,
  employee_id integer,
  employee_name character varying NOT NULL,
  employee_number character varying NOT NULL,
  start_date date NOT NULL,
  due_date date NOT NULL,
  status character varying DEFAULT 'Pending'::character varying,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT tasks_pkey PRIMARY KEY (id)
);
CREATE TABLE public.user_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL,
  item_type text NOT NULL CHECK (item_type = ANY (ARRAY['my-list'::text, 'reserve'::text, 'order'::text, 'reservation'::text])),
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'pending_payment'::text, 'reserved'::text, 'approved'::text, 'in_production'::text, 'ready_for_delivery'::text, 'completed'::text, 'cancelled'::text, 'pending_cancellation'::text])),
  quantity integer NOT NULL DEFAULT 1,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  reservation_fee numeric DEFAULT 500,
  payment_intent_id text,
  delivery_address_id uuid,
  special_instructions text,
  admin_notes text,
  estimated_delivery_date date,
  payment_id text,
  payment_status text DEFAULT 'pending'::text,
  updated_at timestamp with time zone DEFAULT now(),
  price numeric,
  total_amount numeric,
  customer_name text,
  customer_email text,
  customer_phone text,
  delivery_address text,
  payment_method text,
  order_status text DEFAULT 'pending_payment'::text,
  order_progress text DEFAULT 'awaiting_payment'::text,
  admin_accepted_at timestamp with time zone,
  accepted_by_admin_id uuid,
  cancellation_requested_at timestamp with time zone,
  cancellation_approved_at timestamp with time zone,
  cancelled_by_admin_id uuid,
  cancellation_notes text,
  progress_history jsonb DEFAULT '[]'::jsonb,
  CONSTRAINT user_items_pkey PRIMARY KEY (id),
  CONSTRAINT user_items_delivery_address_id_fkey FOREIGN KEY (delivery_address_id) REFERENCES public.addresses(id)
);
CREATE TABLE public.user_notification_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  email_notifications boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  new_product_notifications boolean DEFAULT true,
  stock_update_notifications boolean DEFAULT true,
  order_status_notifications boolean DEFAULT true,
  CONSTRAINT user_notification_preferences_pkey PRIMARY KEY (id),
  CONSTRAINT user_notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_notifications (
  id bigint NOT NULL DEFAULT nextval('user_notifications_id_seq'::regclass),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text DEFAULT 'general'::text CHECK (type = ANY (ARRAY['new_product'::text, 'stock_update'::text, 'order_status'::text, 'general'::text])),
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  action_url text,
  product_id uuid,
  order_id uuid,
  CONSTRAINT user_notifications_pkey PRIMARY KEY (id),
  CONSTRAINT user_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT user_notifications_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.warranties (
  id bigint NOT NULL DEFAULT nextval('warranties_id_seq'::regclass),
  title text,
  description text,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT warranties_pkey PRIMARY KEY (id)
);