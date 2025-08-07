-- Add moderation_status column to posts table
ALTER TABLE posts ADD COLUMN moderation_status TEXT DEFAULT 'approved';

-- Create moderation logs table
CREATE TABLE IF NOT EXISTS moderation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    is_flagged BOOLEAN NOT NULL,
    severity TEXT NOT NULL,
    reason TEXT,
    action TEXT NOT NULL,
    confidence REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts (id),
    FOREIGN KEY (user_id) REFERENCES users (id)
);