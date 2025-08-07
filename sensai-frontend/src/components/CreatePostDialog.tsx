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

export default function CreatePostDialog({ open, onClose, hubId, onPostCreated, parentPostId }: CreatePostDialogProps) {
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
        if (!content.trim()) {
            setError('Content is required.');
            return;
        }
        if (postType !== 'reply' && !title.trim()) {
            setError('Title is required for a new post.');
            return;
        }
        if (!user || !user.id) {
            setError('You must be logged in to post.');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/hubs/posts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    hub_id: parseInt(hubId),
                    user_id: parseInt(user.id), // <-- THE FIX IS HERE
                    title: postType === 'reply' ? null : title,
                    content,
                    post_type: postType,
                    parent_id: parentPostId
                })
            });

            if (!response.ok) {
                throw new Error('Failed to create post. Please try again.');
            }

            const newPostData = await response.json();
            
            // Refetch the full post to get all details like author email and vote counts
            const postResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/hubs/posts/${newPostData.id}`);
            if (!postResponse.ok) throw new Error('Failed to retrieve the created post.');
            
            const newPost = await postResponse.json();

            onPostCreated(newPost);
            onClose();

        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="w-full max-w-lg bg-[#1A1A1A] rounded-lg shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="p-6">
                    <h2 className="text-xl font-light text-white mb-4">{parentPostId ? 'Write a Reply' : 'Create a New Post'}</h2>
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
                    <button onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white transition-colors" disabled={isLoading}>Cancel</button>
                    <button onClick={handleSubmit} className="px-6 py-2 bg-white text-black text-sm font-medium rounded-full hover:opacity-90 transition-opacity" disabled={isLoading}>
                        {isLoading ? 'Posting...' : 'Post'}
                    </button>
                </div>
            </div>
        </div>
    );
}