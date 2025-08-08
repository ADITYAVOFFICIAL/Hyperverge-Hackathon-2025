# adityavofficial-hyperge-hackathon-2025/sensai-ai/src/api/db/hub.py

from typing import List, Dict, Optional
import json
from api.utils.db import execute_db_operation, execute_multiple_db_operations
from api.config import (
    hubs_table_name,
    posts_table_name,
    users_table_name,
    post_votes_table_name,
    post_links_table_name
)
from api.db.user import award_daily_comment_streak_points, add_user_points, get_user_points_balance
from api.config import INVEST_MIN_POINTS, INVEST_PAYOUT_MULTIPLIER, INVEST_WINDOW_DAYS, user_points_table_name, user_points_ledger_table_name, comment_investments_table_name

async def create_hub(org_id: int, name: str, description: Optional[str]) -> int:
    """
    Inserts a new hub into the database for a given organization.

    Args:
        org_id: The ID of the organization the hub belongs to.
        name: The name of the hub.
        description: A brief description of the hub.

    Returns:
        The ID of the newly created hub.
    """
    return await execute_db_operation(
        f"INSERT INTO {hubs_table_name} (org_id, name, description) VALUES (?, ?, ?)",
        (org_id, name, description),
        get_last_row_id=True
    )

async def get_hubs_by_org(org_id: int) -> List[Dict]:
    """
    Retrieves all hubs associated with a specific organization.

    Args:
        org_id: The ID of the organization.

    Returns:
        A list of dictionaries, each representing a hub.
    """
    rows = await execute_db_operation(
        f"SELECT id, name, description FROM {hubs_table_name} WHERE org_id = ? ORDER BY name ASC",
        (org_id,),
        fetch_all=True
    )
    return [{"id": row[0], "name": row[1], "description": row[2]} for row in rows]

async def delete_hub(hub_id: int):
    """Deletes a hub and all its associated posts and data."""
    await execute_db_operation(f"DELETE FROM {hubs_table_name} WHERE id = ?", (hub_id,))

async def delete_post(post_id: int):
    """Deletes a post or a comment."""
    await execute_db_operation(f"DELETE FROM {posts_table_name} WHERE id = ?", (post_id,))

async def create_post(hub_id: int, user_id: int, title: Optional[str], content: str, post_type: str, parent_id: Optional[int] = None, poll_options: Optional[List[str]] = None) -> int:
    """
    Creates a new post or a reply within a hub.

    Args:
        hub_id: The ID of the hub where the post is being created.
        user_id: The ID of the user creating the post.
        title: The title of the post (optional, for top-level posts).
        content: The main content of the post.
        post_type: The type of post (e.g., 'thread', 'question', 'reply').
        parent_id: The ID of the parent post if this is a reply.
        poll_options: A list of strings for poll options.

    Returns:
        The ID of the newly created post.
    """
    poll_options_json = json.dumps(poll_options) if poll_options else None
    
    # Add moderation_status field with default 'pending'
    post_id = await execute_db_operation(
        f"""INSERT INTO {posts_table_name}
           (hub_id, user_id, title, content, post_type, parent_id, poll_options, moderation_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')""",
        (hub_id, user_id, title, content, post_type, parent_id, poll_options_json),
        get_last_row_id=True
    )
    # Award daily streak only for comments (replies)
    if parent_id is not None:
        try:
            await award_daily_comment_streak_points(user_id)
        except Exception as e:
            print(f"Error awarding streak points for user {user_id}: {e}")
    return post_id


async def increment_post_views(post_id: int):
    await execute_db_operation(
        f"UPDATE {posts_table_name} SET views = COALESCE(views,0) + 1 WHERE id = ?",
        (post_id,)
    )


async def invest_in_comment(investor_user_id: int, comment_id: int, amount: int) -> Dict:
    # Validate basics
    if amount < INVEST_MIN_POINTS:
        raise ValueError("Amount below minimum")
    # Fetch comment and parent post
    row = await execute_db_operation(
        f"SELECT id, parent_id, user_id, moderation_status FROM {posts_table_name} WHERE id = ?",
        (comment_id,), fetch_one=True
    )
    if not row:
        raise ValueError("Comment not found")
    _, parent_id, author_id, moderation_status = row
    if parent_id is None:
        raise ValueError("Not a comment")
    if author_id == investor_user_id:
        raise ValueError("Cannot invest in own comment")
    if moderation_status in ('flagged','removed'):
        raise ValueError("Comment not eligible")

    # Check balance
    balance = await get_user_points_balance(investor_user_id)
    if balance < amount:
        raise ValueError("Insufficient balance")

    # Create investment and deduct points atomically
    from datetime import datetime, timedelta
    settle_at = (datetime.utcnow() + timedelta(days=INVEST_WINDOW_DAYS)).isoformat(sep=" ")
    commands = [
        (
            f"INSERT INTO {comment_investments_table_name} (investor_user_id, comment_id, post_id, amount, status, settle_at) VALUES (?, ?, ?, ?, 'pending', ?)",
            (investor_user_id, comment_id, parent_id, amount, settle_at),
        ),
        (
            f"INSERT OR IGNORE INTO {user_points_table_name} (user_id, balance) VALUES (?, 0)",
            (investor_user_id,),
        ),
        (
            f"UPDATE {user_points_table_name} SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
            (amount, investor_user_id),
        ),
        (
            f"INSERT INTO {user_points_ledger_table_name} (user_id, delta, reason, ref_comment_id) VALUES (?, ?, 'invest_stake', ?)",
            (investor_user_id, -amount, comment_id),
        ),
    ]
    await execute_multiple_db_operations(commands)

    # Return investment summary
    return {
        "investor_user_id": investor_user_id,
        "comment_id": comment_id,
        "post_id": parent_id,
        "amount": amount,
        "status": "pending",
        "settle_at": settle_at,
    }


async def settle_investment(investment_id: int) -> Dict:
    """Settle a single investment. Returns settlement summary."""
    # Fetch investment
    inv = await execute_db_operation(
        f"SELECT id, investor_user_id, comment_id, post_id, amount, status FROM {comment_investments_table_name} WHERE id = ?",
        (investment_id,), fetch_one=True
    )
    if not inv:
        raise ValueError("Investment not found")
    _, investor_user_id, comment_id, post_id, amount, status = inv
    if status != 'pending':
        return {"investment_id": investment_id, "status": status}

    # If the invested comment is moderated away, auto-loss
    comment_row = await execute_db_operation(
        f"SELECT moderation_status FROM {posts_table_name} WHERE id = ?",
        (comment_id,), fetch_one=True
    )
    moderated_away = comment_row and comment_row[0] in ('flagged','removed')

    # Compute top by votes and top by views among siblings
    rows = await execute_db_operation(
        f"""
        SELECT p.id,
               COALESCE(SUM(CASE WHEN pv.vote_type='up' THEN 1 WHEN pv.vote_type='down' THEN -1 ELSE 0 END), 0) AS score,
               COALESCE(p.views,0) AS views,
               p.created_at
        FROM {posts_table_name} p
        LEFT JOIN {post_votes_table_name} pv ON pv.post_id = p.id
        WHERE p.parent_id = ? AND (p.moderation_status IS NULL OR p.moderation_status NOT IN ('flagged','removed'))
        GROUP BY p.id
        """,
        (post_id,), fetch_all=True
    )
    # Determine tops
    if rows:
        # Top by score
        top_score_row = sorted(rows, key=lambda r: (-int(r[1]), -int(r[2]), r[3]))[0]
        # Top by views
        top_views_row = sorted(rows, key=lambda r: (-int(r[2]), -int(r[1]), r[3]))[0]
        is_top_score = top_score_row[0] == comment_id
        is_top_views = top_views_row[0] == comment_id
    else:
        is_top_score = False
        is_top_views = False

    won = (not moderated_away) and is_top_score and is_top_views
    payout = amount * INVEST_PAYOUT_MULTIPLIER if won else 0

    commands = []
    # Update investment status
    new_status = 'won' if won else 'lost'
    commands.append(
        (
            f"UPDATE {comment_investments_table_name} SET status = ?, payout_amount = ?, settled_at = CURRENT_TIMESTAMP WHERE id = ?",
            (new_status, payout, investment_id),
        )
    )
    # If win, credit points and add ledger entry
    if won and payout > 0:
        commands.append(
            (
                f"INSERT OR IGNORE INTO {user_points_table_name} (user_id, balance) VALUES (?, 0)",
                (investor_user_id,),
            )
        )
        commands.append(
            (
                f"UPDATE {user_points_table_name} SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
                (payout, investor_user_id),
            )
        )
        commands.append(
            (
                f"INSERT INTO {user_points_ledger_table_name} (user_id, delta, reason, ref_comment_id, investment_id) VALUES (?, ?, 'invest_payout', ?, ?)",
                (investor_user_id, payout, comment_id, investment_id),
            )
        )

    await execute_multiple_db_operations(commands)

    return {
        "investment_id": investment_id,
        "status": new_status,
        "payout": payout,
        "won": won,
    }

async def get_posts_by_hub(hub_id: int) -> List[Dict]:
    """
    Retrieves all top-level posts for a specific hub, along with author and vote count.

    Args:
        hub_id: The ID of the hub.

    Returns:
        A list of dictionaries, each representing a post.
    """
    query = f"""
        SELECT
            p.id, p.title, p.content, p.post_type, p.created_at, u.email as author,
            COALESCE(SUM(CASE WHEN pv.vote_type = 'up' THEN 1 WHEN pv.vote_type = 'down' THEN -1 ELSE 0 END), 0) as votes,
            (SELECT COUNT(*) FROM {posts_table_name} WHERE parent_id = p.id) as comment_count,
            p.poll_options
        FROM {posts_table_name} p
        JOIN {users_table_name} u ON p.user_id = u.id
        LEFT JOIN {post_votes_table_name} pv ON p.id = pv.post_id
        WHERE p.hub_id = ? AND p.parent_id IS NULL
        GROUP BY p.id, p.title, p.content, p.post_type, p.created_at, u.email, p.poll_options
        ORDER BY p.created_at DESC
    """
    rows = await execute_db_operation(query, (hub_id,), fetch_all=True)
    return [
        {
            "id": row[0], "title": row[1], "content": row[2], "post_type": row[3],
            "created_at": row[4], "author": row[5], "votes": int(row[6]), "comment_count": row[7],
            "poll_options": json.loads(row[8]) if row[8] else None
        } for row in rows
    ]


async def get_post_with_details(post_id: int, user_id: Optional[int] = None) -> Optional[Dict]:
    # Handle the case where user_id is None
    if user_id is None:
        post_query = f"""
            SELECT p.id, p.hub_id, p.title, p.content, p.post_type, p.created_at, u.email as author,
                   COALESCE(SUM(CASE WHEN pv.vote_type = 'up' THEN 1 WHEN pv.vote_type = 'down' THEN -1 ELSE 0 END), 0) as votes,
                   NULL as user_vote,
                   p.poll_options
            FROM {posts_table_name} p
            JOIN {users_table_name} u ON p.user_id = u.id
            LEFT JOIN {post_votes_table_name} pv ON p.id = pv.post_id
            WHERE p.id = ?
            GROUP BY p.id, p.hub_id, p.title, p.content, p.post_type, p.created_at, u.email, p.poll_options
        """
        post_rows = await execute_db_operation(post_query, (post_id,), fetch_all=True)
    else:
        post_query = f"""
            SELECT p.id, p.hub_id, p.title, p.content, p.post_type, p.created_at, u.email as author,
                   COALESCE(SUM(CASE WHEN pv.vote_type = 'up' THEN 1 WHEN pv.vote_type = 'down' THEN -1 ELSE 0 END), 0) as votes,
                   MAX(CASE WHEN pv.user_id = ? THEN pv.vote_type ELSE NULL END) as user_vote,
                   p.poll_options
            FROM {posts_table_name} p
            JOIN {users_table_name} u ON p.user_id = u.id
            LEFT JOIN {post_votes_table_name} pv ON p.id = pv.post_id
            WHERE p.id = ?
            GROUP BY p.id, p.hub_id, p.title, p.content, p.post_type, p.created_at, u.email, p.poll_options
        """
        post_rows = await execute_db_operation(post_query, (user_id, post_id), fetch_all=True)
    if not post_rows:
        return None
    post_row = post_rows[0]

    # Handle comments query based on whether user_id is provided
    if user_id is None:
        comments_query = f"""
            SELECT p.id, p.content, p.created_at, u.email as author,
                   COALESCE(SUM(CASE WHEN pv.vote_type = 'up' THEN 1 WHEN pv.vote_type = 'down' THEN -1 ELSE 0 END), 0) as votes,
                   NULL as user_vote,
                   p.hub_id, p.post_type
            FROM {posts_table_name} p
            JOIN {users_table_name} u ON p.user_id = u.id
            LEFT JOIN {post_votes_table_name} pv ON p.id = pv.post_id
            WHERE p.parent_id = ?
              AND (p.moderation_status IS NULL OR p.moderation_status NOT IN ('flagged', 'removed'))
            GROUP BY p.id, p.content, p.created_at, u.email, p.hub_id, p.post_type
            ORDER BY p.created_at ASC
        """
        comment_rows = await execute_db_operation(comments_query, (post_id,), fetch_all=True)
    else:
        comments_query = f"""
            SELECT p.id, p.content, p.created_at, u.email as author,
                   COALESCE(SUM(CASE WHEN pv.vote_type = 'up' THEN 1 WHEN pv.vote_type = 'down' THEN -1 ELSE 0 END), 0) as votes,
                   MAX(CASE WHEN pv.user_id = ? THEN pv.vote_type ELSE NULL END) as user_vote,
                   p.hub_id, p.post_type
            FROM {posts_table_name} p
            JOIN {users_table_name} u ON p.user_id = u.id
            LEFT JOIN {post_votes_table_name} pv ON p.id = pv.post_id
            WHERE p.parent_id = ?
              AND (p.moderation_status IS NULL OR p.moderation_status NOT IN ('flagged', 'removed'))
            GROUP BY p.id, p.content, p.created_at, u.email, p.hub_id, p.post_type
            ORDER BY p.created_at ASC
        """
        comment_rows = await execute_db_operation(comments_query, (user_id, post_id), fetch_all=True)

    post = {
        "id": post_row[0], "hub_id": post_row[1], "title": post_row[2], "content": post_row[3],
        "post_type": post_row[4], "created_at": post_row[5], "author": post_row[6],
        "votes": int(post_row[7]), "user_vote": post_row[8],
        "poll_options": json.loads(post_row[9]) if post_row[9] else None,
        "comments": [
            {
                "id": row[0], "content": row[1], "created_at": row[2], "author": row[3],
                "votes": int(row[4]), "user_vote": row[5], "hub_id": row[6], "post_type": row[7]
            } for row in comment_rows
        ]
    }
    return post


async def add_vote_to_post(post_id: int, user_id: int, vote_type: Optional[str], is_comment: bool):
    # If vote_type is None, it means the user is un-voting.
    if vote_type is None:
        await execute_db_operation(
            f"DELETE FROM {post_votes_table_name} WHERE post_id = ? AND user_id = ?",
            (post_id, user_id)
        )
    else:
        # Upsert the vote. This will insert a new vote or update an existing one.
        await execute_db_operation(
            f"""INSERT INTO {post_votes_table_name} (post_id, user_id, vote_type)
                VALUES (?, ?, ?)
                ON CONFLICT(post_id, user_id) DO UPDATE SET
                vote_type = excluded.vote_type""",
            (post_id, user_id, vote_type)
        )

async def add_link_to_post(post_id: int, item_type: str, item_id: int):
    """
    Links a post to another item in the system, like a task or course.

    Args:
        post_id: The ID of the post.
        item_type: The type of item to link (e.g., 'task', 'course').
        item_id: The ID of the item to link.
    """
    await execute_db_operation(
        f"INSERT INTO {post_links_table_name} (post_id, item_type, item_id) VALUES (?, ?, ?)",
        (post_id, item_type, item_id)
    )

async def create_moderation_record(post_id: int, user_id: int, content: str, moderation_result: dict):
    """Store moderation results in the database"""
    await execute_db_operation(
        f"""INSERT INTO moderation_logs 
           (post_id, user_id, content, is_flagged, severity, reason, action, confidence, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))""",
        (post_id, user_id, content, moderation_result['is_flagged'], 
         moderation_result['severity'], moderation_result['reason'], 
         moderation_result['action'], moderation_result['confidence'])
    )

async def update_post_moderation_status(post_id: int, status: str):
    """Update the moderation status of a post"""
    await execute_db_operation(
        f"UPDATE {posts_table_name} SET moderation_status = ? WHERE id = ?",
        (status, post_id)
    )

async def get_hub_id_for_post(post_id: int) -> Optional[int]:
    """Get the hub_id for a given post_id"""
    rows = await execute_db_operation(
        f"SELECT hub_id FROM {posts_table_name} WHERE id = ?",
        (post_id,),
        fetch_all=True
    )
    return rows[0][0] if rows else None