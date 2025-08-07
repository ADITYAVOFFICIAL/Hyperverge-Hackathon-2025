# adityavofficial-hyperverge-hackathon-2025/sensai-ai/src/api/routes/hub.py

from fastapi import APIRouter, HTTPException
from typing import List, Dict
from api.db import hub as hub_db
from api.models import (
    CreateHubRequest,
    Hub,
    CreatePostRequest,
    PostVoteRequest,
    Post,
    PostWithComments
)

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

@router.post("/posts", response_model=Dict[str, int])
async def create_post(request: CreatePostRequest) -> Dict[str, int]:
    """
    Creates a new post or a reply within a hub.
    """
    post_id = await hub_db.create_post(
        request.hub_id,
        request.user_id,
        request.title,
        request.content,
        str(request.post_type),
        request.parent_id
    )
    return {"id": post_id}

@router.get("/posts/{post_id}", response_model=PostWithComments)
async def get_post(post_id: int) -> PostWithComments:
    """
    Retrieves a single post along with its details and all associated comments.
    """
    post_details = await hub_db.get_post_with_details(post_id)
    if not post_details:
        raise HTTPException(status_code=404, detail="Post not found")

    return post_details


@router.post("/posts/{post_id}/vote", response_model=Dict[str, bool])
async def vote_on_post(post_id: int, request: PostVoteRequest) -> Dict[str, bool]:
    """
    Allows a user to cast a vote on a post (e.g., mark as helpful).
    """
    await hub_db.add_vote_to_post(post_id, request.user_id, request.vote_type)
    return {"success": True}