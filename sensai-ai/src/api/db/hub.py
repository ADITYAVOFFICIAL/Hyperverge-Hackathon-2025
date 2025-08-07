# adityavofficial-hyperge-hackathon-2025/sensai-ai/src/api/db/hub.py

from typing import List, Dict, Optional
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

async def create_post(hub_id: int, user_id: int, title: Optional[str], content: str, post_type: str, parent_id: Optional[int] = None) -> int:
    """
    Creates a new post or a reply within a hub.

    Args:
        hub_id: The ID of the hub where the post is being created.
        user_id: The ID of the user creating the post.
        title: The title of the post (optional, for top-level posts).
        content: The main content of the post.
        post_type: The type of post (e.g., 'thread', 'question', 'reply').
        parent_id: The ID of the parent post if this is a reply.

    Returns:
        The ID of the newly created post.
    """
    return await execute_db_operation(
        f"""INSERT INTO {posts_table_name}
           (hub_id, user_id, title, content, post_type, parent_id)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (hub_id, user_id, title, content, post_type, parent_id),
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
            p.id, p.title, p.content, p.post_type, p.created_at, u.email,
            (SELECT COUNT(*) FROM {post_votes_table_name} WHERE post_id = p.id AND vote_type = 'helpful') as votes,
            (SELECT COUNT(*) FROM {posts_table_name} WHERE parent_id = p.id) as comment_count
        FROM {posts_table_name} p
        JOIN {users_table_name} u ON p.user_id = u.id
        WHERE p.hub_id = ? AND p.parent_id IS NULL
        ORDER BY p.created_at DESC
    """
    rows = await execute_db_operation(query, (hub_id,), fetch_all=True)
    return [
        {
            "id": row[0], "title": row[1], "content": row[2], "post_type": row[3],
            "created_at": row[4], "author": row[5], "votes": row[6], "comment_count": row[7]
        } for row in rows
    ]

async def get_post_with_details(post_id: int) -> Optional[Dict]:
    post_query = f"""
        SELECT p.id, p.hub_id, p.title, p.content, p.post_type, p.created_at, u.email as author,
               (SELECT COUNT(*) FROM {post_votes_table_name} WHERE post_id = p.id) as votes
        FROM {posts_table_name} p
        JOIN {users_table_name} u ON p.user_id = u.id
        WHERE p.id = ?
    """
    post_rows = await execute_db_operation(post_query, (post_id,), fetch_all=True)
    if not post_rows:
        return None
    post_row = post_rows[0]

    comments_query = f"""
        SELECT p.id, p.hub_id, p.title, p.content, p.post_type, p.created_at, u.email as author,
               (SELECT COUNT(*) FROM {post_votes_table_name} WHERE post_id = p.id) as votes
        FROM {posts_table_name} p
        JOIN {users_table_name} u ON p.user_id = u.id
        WHERE p.parent_id = ?
        ORDER BY p.created_at ASC
    """
    comments_rows = await execute_db_operation(comments_query, (post_id,), fetch_all=True)

    post_details = {
        "id": post_row[0], "hub_id": post_row[1], "title": post_row[2], "content": post_row[3],
        "post_type": post_row[4], "created_at": post_row[5], "author": post_row[6], "votes": post_row[7]
    }
    post_details["comments"] = [
        {
            "id": comment[0], "hub_id": comment[1], "title": comment[2], "content": comment[3],
            "post_type": comment[4], "created_at": comment[5], "author": comment[6], "votes": comment[7]
        } for comment in comments_rows
    ]
    return post_details

async def add_vote_to_post(post_id: int, user_id: int, vote_type: str):
    await execute_db_operation(
        f"INSERT INTO {post_votes_table_name} (post_id, user_id, vote_type) VALUES (?, ?, ?) ON CONFLICT DO NOTHING",
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