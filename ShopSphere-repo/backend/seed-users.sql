-- ============================================
-- SEED DATA: Test Users for Orders
-- ============================================
-- This file adds test users to the users table
-- to support foreign key constraints for orders

USE ecommerce_db;

-- Check if users already exist before inserting
INSERT INTO users (name, email, password, role, created_at) 
SELECT 'Test User', 'test@example.com', 'password123', 'customer', NOW()
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'test@example.com');

INSERT INTO users (name, email, password, role, created_at)
SELECT 'Admin User', 'admin@example.com', 'admin123', 'admin', NOW()
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@example.com');

INSERT INTO users (name, email, password, role, created_at)
SELECT 'John Doe', 'john@example.com', 'john123', 'customer', NOW()
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'john@example.com');

INSERT INTO users (name, email, password, role, created_at)
SELECT 'Jane Smith', 'jane@example.com', 'jane123', 'customer', NOW()
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'jane@example.com');

-- Verify users were created
SELECT id, name, email, role FROM users;
