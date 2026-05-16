-- Add recall_bot_status column to track live Recall.ai bot state
ALTER TABLE transcripts ADD COLUMN IF NOT EXISTS recall_bot_status text;
