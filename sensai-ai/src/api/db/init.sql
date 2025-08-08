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

-- Reputation: ensure views column exists on posts
ALTER TABLE posts ADD COLUMN views INTEGER DEFAULT 0;

-- Reputation: user points balance
CREATE TABLE IF NOT EXISTS user_points (
    user_id INTEGER PRIMARY KEY,
    balance INTEGER NOT NULL DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Reputation: points ledger
CREATE TABLE IF NOT EXISTS user_points_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    delta INTEGER NOT NULL,
    reason TEXT NOT NULL,
    ref_comment_id INTEGER,
    ref_post_id INTEGER,
    investment_id INTEGER,
    day_key TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (ref_comment_id) REFERENCES posts (id) ON DELETE SET NULL,
    FOREIGN KEY (ref_post_id) REFERENCES posts (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_user_points_ledger_user ON user_points_ledger (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_user_points_ledger_day ON user_points_ledger (user_id, day_key);

-- Reputation: comment investments
CREATE TABLE IF NOT EXISTS comment_investments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    investor_user_id INTEGER NOT NULL,
    comment_id INTEGER NOT NULL,
    post_id INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('pending','won','lost','cancelled')) DEFAULT 'pending',
    settle_at DATETIME NOT NULL,
    settled_at DATETIME,
    payout_amount INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (investor_user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (comment_id) REFERENCES posts (id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_comment_investments_investor ON comment_investments (investor_user_id);
CREATE INDEX IF NOT EXISTS idx_comment_investments_settlement ON comment_investments (status, settle_at);