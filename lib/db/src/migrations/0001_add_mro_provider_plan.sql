-- Migration: Add mro_provider value to user_plan enum
-- Applied: 2026-05-23
-- Note: PostgreSQL ADD VALUE to an enum cannot run inside a transaction block.
-- This migration must be run outside a transaction or via the executeSql tool.

ALTER TYPE user_plan ADD VALUE IF NOT EXISTS 'mro_provider';
