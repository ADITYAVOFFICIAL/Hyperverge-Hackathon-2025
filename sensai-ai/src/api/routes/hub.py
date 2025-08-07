# adityavofficial-hyperverge-hackathon-2025/sensai-ai/src/api/routes/hub.py

from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Optional
from api.db import hub as hub_db
from api.models import (
    CreateHubRequest,
    Hub,
    CreatePostRequest,
    PostVoteRequest,
    Post,
    PostWithComments
)
# from api.utils.auth import get_current_user

router = APIRouter()

@router.post("/", response_model=Hub)
async def create_hub(request: CreateHubRequest) -> Hub:
    """
    Creates a new learning hub within an organization.
    """
    hub_id = await hub_db.create_hub(request.org_id, request.name, request.description)
    return {
        "id": hub_id,
        "name": request.name,
        "description": request.description
    }

@router.get("/organization/{org_id}", response_model=List[Hub])
async def get_hubs_for_organization(org_id: int) -> List[Hub]:
    """
    Retrieves all learning hubs for a specific organization.
    """
    return await hub_db.get_hubs_by_org(org_id)
@router.get("/{hub_id}/posts", response_model=List[Post])
async def get_posts_for_hub(hub_id: int) -> List[Post]:
    """
    Retrieves all top-level posts (threads, questions, notes) for a specific hub.
    """
    try:
        posts = await hub_db.get_posts_by_hub(hub_id)
        # Manually add hub_id to each post dictionary if it's missing.
        for post in posts:
            if 'hub_id' not in post:
                post['hub_id'] = hub_id
        return posts
    except Exception as e:
        # Log the error for debugging
        print(f"Error fetching posts for hub {hub_id}: {e}")

@router.post("/posts", response_model=Post, status_code=201)
async def create_post(request: CreatePostRequest):
    """
    Creates a new post and returns the complete post object.
    """
    try:
        post_id = await hub_db.create_post(
            hub_id=request.hub_id,
            user_id=request.user_id,
            title=request.title,
            content=request.content,
            post_type=request.post_type,
            parent_id=request.parent_id,
            poll_options=request.poll_options
        )

        # Try fetching with user_id first
        new_post = await hub_db.get_post_with_details(post_id, user_id=request.user_id)
        if not new_post:
            # Fallback: try fetching without user_id
            new_post = await hub_db.get_post_with_details(post_id)
        if not new_post:
            print(f"[ERROR] Created post {post_id} could not be retrieved (user_id={request.user_id})")
            raise HTTPException(status_code=404, detail="Failed to retrieve created post.")
        
        return new_post

    except Exception as e:
        # Log the exception e
        print(f"[ERROR] Exception in create_post: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/posts/{post_id}", response_model=PostWithComments)
async def get_post(post_id: int, userId: Optional[int] = None) -> PostWithComments:
    """
    Retrieves a single post along with its details and all associated comments.
    """
    post_details = await hub_db.get_post_with_details(post_id)
    if not post_details:
        raise HTTPException(status_code=404, detail="Post not found")

    # The following block is removed as hub_db.get_post_by_id does not exist.
    # The root cause is likely in hub_db.get_post_with_details not returning
    # all required fields, which should be fixed there.
    if 'hub_id' not in post_details:
        # Workaround: Fetch hub_id separately if not present.
        # A better long-term fix is to correct the get_post_with_details function.
        hub_id = await hub_db.get_hub_id_for_post(post_id)
        if hub_id is None:
             raise HTTPException(status_code=404, detail="Could not find hub for post")
        post_details['hub_id'] = hub_id

    # Propagate hub_id to comments and set a default post_type if missing.
    if post_details.get('comments'):
        for comment in post_details['comments']:
            comment.setdefault('hub_id', post_details['hub_id'])
            comment.setdefault('post_type', 'reply')

    return post_details


@router.post("/posts/{post_id}/vote", response_model=Dict[str, bool])
async def vote_on_post(post_id: int, request: PostVoteRequest) -> Dict[str, bool]:
    """
    Allows a user to cast a vote on a post (e.g., mark as helpful).
    """
    await hub_db.add_vote_to_post(post_id, request.user_id, request.vote_type, request.is_comment)
    return {"success": True}
@router.delete("/posts/{post_id}", status_code=204)
async def delete_post(post_id: int):
    """
    Deletes a post or a comment by its ID.
    """
    await hub_db.delete_post(post_id)
    return