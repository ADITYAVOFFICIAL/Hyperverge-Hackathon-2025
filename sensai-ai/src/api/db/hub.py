# adityavofficial-hyperge-hackathon-2025/sensai-ai/src/api/db/hub.py

from typing import List, Dict, Optional
import json
from api.utils.db import execute_db_operation
from api.config import (
    hubs_table_name,
    posts_table_name,
    users_table_name,
    post_votes_table_name,
    post_links_table_name
)

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
    return await execute_db_operation(
        f"""INSERT INTO {posts_table_name}
           (hub_id, user_id, title, content, post_type, parent_id, poll_options, moderation_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')""",
        (hub_id, user_id, title, content, post_type, parent_id, poll_options_json),
        get_last_row_id=True
    )

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