-- Migration: Add Replit Auth columns to the users table
-- Run this in the Supabase SQL Editor for your project

-- ─── blog_posts table ────────────────────────────────────────────────────────
-- Create the table if it does not already exist.  The automated daily blog
-- generator inserts rows here; the /blog and /blog/:slug routes read them.

CREATE TABLE IF NOT EXISTS public.blog_posts (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title          TEXT        NOT NULL,
  slug           TEXT        NOT NULL UNIQUE,
  content        TEXT        NOT NULL DEFAULT '',
  meta_description TEXT,
  keywords       TEXT[],
  is_published   BOOLEAN     NOT NULL DEFAULT true,
  image          TEXT,
  image_prompt   TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS blog_posts_slug_unique ON public.blog_posts(slug);

-- Add new columns to any existing blog_posts table (safe to run more than once).
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS meta_description TEXT;
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS keywords        TEXT[];
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS is_published    BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS image           TEXT;
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS image_prompt    TEXT;

-- ─── Replit Auth ──────────────────────────────────────────────────────────────
-- Add replit_sub column to identify users by Replit's OpenID Connect subject claim
ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS replit_sub TEXT;

-- Add unique constraint on replit_sub (allows NULL, but non-NULL values must be unique)
CREATE UNIQUE INDEX IF NOT EXISTS users_replit_sub_unique 
  ON public.users(replit_sub) 
  WHERE replit_sub IS NOT NULL;

-- Optional: Add columns for cloud resume saving if not present
ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS resume_builder_save JSONB;

ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS resume_builder_saved_at TIMESTAMPTZ;

-- New table: one resume document per authenticated user.
CREATE TABLE IF NOT EXISTS public.resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Keep exactly one resume row per user and update that row on save.
CREATE UNIQUE INDEX IF NOT EXISTS resumes_user_id_unique ON public.resumes(user_id);

ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;

-- Users can only read/insert/update their own resume row.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'resumes'
      AND policyname = 'resumes_select_own'
  ) THEN
    CREATE POLICY resumes_select_own
      ON public.resumes
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'resumes'
      AND policyname = 'resumes_insert_own'
  ) THEN
    CREATE POLICY resumes_insert_own
      ON public.resumes
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'resumes'
      AND policyname = 'resumes_update_own'
  ) THEN
    CREATE POLICY resumes_update_own
      ON public.resumes
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
