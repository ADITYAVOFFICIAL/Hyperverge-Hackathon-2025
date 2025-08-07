import sqlalchemy

metadata = sqlalchemy.MetaData()

users = sqlalchemy.Table(
    "users",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True),
    sqlalchemy.Column("email", sqlalchemy.String(120), unique=True, nullable=False),
    sqlalchemy.Column("hashed_password", sqlalchemy.String(255), nullable=False),
    sqlalchemy.Column("full_name", sqlalchemy.String(100), nullable=True),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, server_default=sqlalchemy.func.now()),
)

organizations = sqlalchemy.Table(
    "organizations",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True),
    sqlalchemy.Column("name", sqlalchemy.String(100), nullable=False),
    sqlalchemy.Column("owner_id", sqlalchemy.Integer, sqlalchemy.ForeignKey("users.id")),
)

hubs = sqlalchemy.Table(
    "hubs",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True),
    sqlalchemy.Column("org_id", sqlalchemy.Integer, sqlalchemy.ForeignKey("organizations.id"), nullable=False),
    sqlalchemy.Column("name", sqlalchemy.String(100), nullable=False),
    sqlalchemy.Column("description", sqlalchemy.Text, nullable=True),
)

posts = sqlalchemy.Table(
    "posts",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True),
    sqlalchemy.Column("hub_id", sqlalchemy.Integer, sqlalchemy.ForeignKey("hubs.id"), nullable=False),
    sqlalchemy.Column("user_id", sqlalchemy.Integer, sqlalchemy.ForeignKey("users.id"), nullable=False),
    sqlalchemy.Column("parent_id", sqlalchemy.Integer, sqlalchemy.ForeignKey("posts.id"), nullable=True),
    sqlalchemy.Column("title", sqlalchemy.String(255), nullable=True),
    sqlalchemy.Column("content", sqlalchemy.Text, nullable=False),
    sqlalchemy.Column("post_type", sqlalchemy.String(50), nullable=False),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, server_default=sqlalchemy.func.now()),
)

poll_options = sqlalchemy.Table(
    "poll_options",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True),
    sqlalchemy.Column("post_id", sqlalchemy.Integer, sqlalchemy.ForeignKey("posts.id", ondelete="CASCADE"), nullable=False),
    sqlalchemy.Column("option_text", sqlalchemy.String(255), nullable=False),
)

post_votes = sqlalchemy.Table(
    "post_votes",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True),
    sqlalchemy.Column("post_id", sqlalchemy.Integer, nullable=False),
    sqlalchemy.Column("user_id", sqlalchemy.Integer, sqlalchemy.ForeignKey("users.id"), nullable=False),
    sqlalchemy.Column("vote_type", sqlalchemy.String(10), nullable=False),
    sqlalchemy.Column("is_comment", sqlalchemy.Boolean, default=False, nullable=False),
    sqlalchemy.UniqueConstraint("post_id", "user_id", "is_comment", name="uq_user_vote"),
)

moderation_logs = sqlalchemy.Table(
    "moderation_logs",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True),
    sqlalchemy.Column("post_id", sqlalchemy.Integer, sqlalchemy.ForeignKey("posts.id"), nullable=False),
    sqlalchemy.Column("user_id", sqlalchemy.Integer, sqlalchemy.ForeignKey("users.id"), nullable=False),
    sqlalchemy.Column("content", sqlalchemy.Text, nullable=False),
    sqlalchemy.Column("is_flagged", sqlalchemy.Boolean, nullable=False),
    sqlalchemy.Column("severity", sqlalchemy.String(20), nullable=False),
    sqlalchemy.Column("reason", sqlalchemy.Text, nullable=True),
    sqlalchemy.Column("action", sqlalchemy.String(20), nullable=False),
    sqlalchemy.Column("confidence", sqlalchemy.Float, nullable=False),
    sqlalchemy.Column("created_at", sqlalchemy.DateTime, server_default=sqlalchemy.func.now()),
)