"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { Post } from '@/lib/api'; // Make sure to export the Post type from your api lib

interface CreatePostDialogProps {
  open: boolean;
  onClose: () => void;
  hubId: string;
  onPostCreated: (newPost: Post) => void;
  parentPostId?: number; // Optional: for creating replies
}

export default function CreatePostDialog({
  open,
  onClose,
  hubId,
  onPostCreated,
  parentPostId,
}: CreatePostDialogProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [postType, setPostType] = useState(parentPostId ? 'reply' : 'thread');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      // Reset form when dialog opens
      setTitle('');
      setContent('');
      setError('');
      setPostType(parentPostId ? 'reply' : 'thread');
    }
  }, [open, parentPostId]);

  const handleSubmit = async () => {
    console.log('[CreatePost] handleSubmit start', { title, content, postType, parentPostId });
    if (!content.trim()) {
      console.log('[CreatePost] validation failed: empty content');
      setError('Content is required.');
      return;
    }
    if (postType !== 'reply' && !title.trim()) {
      console.log('[CreatePost] validation failed: empty title for thread');
      setError('Title is required for a new post.');
      return;
    }
    if (!user || !user.id) {
      console.log('[CreatePost] validation failed: no user');
      setError('You must be logged in to post.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      console.log('[CreatePost] sending POST to /hubs/posts', {
        hub_id: hubId,
        user_id: user.id,
        title,
        content,
        post_type: postType,
        parent_id: parentPostId,
      });
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/hubs/posts`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hub_id: parseInt(hubId),
            user_id: parseInt(user.id),
            title: postType === 'reply' ? null : title,
            content,
            post_type: postType,
            parent_id: parentPostId,
          }),
        }
      );

      console.log('[CreatePost] POST response status', response.status);
      if (!response.ok) {
        const text = await response.text();
        console.error('[CreatePost] POST failed response text:', text);
        throw new Error('Failed to create post. Please try again.');
      }

      const newPostData = await response.json();
      console.log('[CreatePost] created post data', newPostData);

      // Refetch the full post
      console.log('[CreatePost] fetching full post details for id', newPostData.id);
      const postResponse = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/hubs/posts/${newPostData.id}`
      );
      console.log('[CreatePost] fetch full post status', postResponse.status);
      if (!postResponse.ok) {
        const text = await postResponse.text();
        console.error('[CreatePost] fetch full post failed text:', text);
        throw new Error('Failed to retrieve the created post.');
      }

      const newPost: Post = await postResponse.json();
      console.log('[CreatePost] full post object', newPost);

      onPostCreated(newPost);
      onClose();
    } catch (err) {
      console.error('[CreatePost] Error in handleSubmit', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      console.log('[CreatePost] handleSubmit end');
      setIsLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#1A1A1A] rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <h2 className="text-xl font-light text-white mb-4">
            {parentPostId ? 'Write a Reply' : 'Create a New Post'}
          </h2>
          <div className="space-y-4">
            {!parentPostId && (
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title of your post"
                className="w-full px-4 py-3 bg-[#0D0D0D] text-white rounded-lg font-light placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            )}
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Share your thoughts, ask a question, or post a note..."
              className="w-full h-32 px-4 py-3 bg-[#0D0D0D] text-white rounded-lg font-light placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
          </div>
        </div>
        <div className="flex justify-end gap-4 px-6 py-4 bg-[#111111] rounded-b-lg">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-6 py-2 bg-white text-black text-sm font-medium rounded-full hover:opacity-90 transition-opacity"
            disabled={isLoading}
          >
            {isLoading ? 'Posting...' : 'Post'}
          </button>
        </div>
      </div>
    </div>
  );
}
