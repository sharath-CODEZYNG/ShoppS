-- Migration: Add image_url column to products table
-- This file can be executed manually if automatic migrations fail

ALTER TABLE products ADD COLUMN image_url TEXT DEFAULT NULL;
