-- Option 1: Add demographics columns to existing drawings table
ALTER TABLE drawings 
ADD COLUMN IF NOT EXISTS user_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS user_age INTEGER,
ADD COLUMN IF NOT EXISTS user_sex CHAR(1) CHECK (user_sex IN ('M', 'F'));

-- Option 2: Create a separate demographics table (recommended for better organization)
CREATE TABLE IF NOT EXISTS user_demographics (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    user_name VARCHAR(255),
    user_age INTEGER,
    user_sex CHAR(1) CHECK (user_sex IN ('M', 'F')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_user_demographics_session_id ON user_demographics(session_id);

-- Add foreign key constraint if you want to link to drawings table
-- ALTER TABLE user_demographics 
-- ADD CONSTRAINT fk_user_demographics_session 
-- FOREIGN KEY (session_id) REFERENCES drawings(session_id) ON DELETE CASCADE; 