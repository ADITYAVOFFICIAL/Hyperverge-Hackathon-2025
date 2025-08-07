"use client";

import { useState, useEffect } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { PostWithComments, Comment } from "@/lib/api";

interface PostViewProps {
    postId: string;
}

export default function PostView({ postId }: PostViewProps) {
    const { user } = useAuth();
    const [post, setPost] = useState<PostWithComments | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [newComment, setNewComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [commentError, setCommentError] = useState<string | null>(null);

    useEffect(() => {
        const fetchPost = async () => {
            if (!postId) return;
            setLoading(true);
            try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/hubs/posts/${postId}`);
                if (!response.ok) throw new Error('Failed to fetch post.');
                const data = await response.json();
                setPost(data);
            } catch {
                setError('Could not load the post. It may have been deleted or the link is incorrect.');
            } finally {
                setLoading(false);
            }
        };
        fetchPost();
    }, [postId]);

    const handleAddComment = async () => {
        if (!newComment.trim() || !user || !post) return;
        setIsSubmitting(true);
        setCommentError(null);
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/hubs/posts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    hub_id: post.hub_id,
                    user_id: parseInt(user.id),
                    content: newComment,
                    post_type: 'reply',
                    parent_id: post.id
                })
            });
            if (!response.ok) throw new Error('Failed to add comment.');
            
            const newCommentData = await response.json();

            const tempNewComment: Comment = {
                id: newCommentData.id,
                content: newComment,
                created_at: new Date().toISOString(),
                author: user.email || 'You',
                votes: 0
            };

            setPost(prevPost => prevPost ? { ...prevPost, comments: [...prevPost.comments, tempNewComment] } : null);
            setNewComment('');

        } catch (err) {
            console.error("Failed to add comment:", err);
            setCommentError('An error occurred. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleVote = async (targetPostId: number, isComment: boolean, voteType: 'up' | 'down') => {
        if (!user) return;
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/hubs/posts/${targetPostId}/vote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: parseInt(user.id), vote_type: voteType, is_comment: isComment })
            });

            setPost(prevPost => {
                if (!prevPost) return null;
                if (!isComment) {
                    return { ...prevPost, votes: prevPost.votes + (voteType === 'up' ? 1 : -1) };
                } else {
                    const updatedComments = prevPost.comments.map(c => 
                        c.id === targetPostId ? { ...c, votes: c.votes + (voteType === 'up' ? 1 : -1) } : c
                    );
                    return { ...prevPost, comments: updatedComments };
                }
            });
        } catch (err) {
            console.error("Failed to vote:", err);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center py-20">
                <div className="w-12 h-12 border-t-2 border-b-2 border-white rounded-full animate-spin"></div>
            </div>
        );
    }

    if (error || !post) {
        return <p className="text-center text-red-500 py-20">{error || "Post not found."}</p>;
    }

    return (
        <div>
            <div className="bg-[#1A1A1A] p-8 rounded-lg">
                <h1 className="text-3xl font-light text-white mb-4">{post.title}</h1>
                <div className="flex items-center text-sm text-gray-500 mb-6">
                    <span>By {post.author}</span>
                    <span className="mx-2">•</span>
                    <span>{new Date(post.created_at).toLocaleDateString()}</span>
                </div>
                <p className="text-gray-300 leading-relaxed mb-6 whitespace-pre-wrap">{post.content}</p>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-gray-400">
                        <button onClick={() => handleVote(post.id, false, 'up')} className="p-1 rounded-full hover:bg-gray-700"><ThumbsUp size={16} /></button>
                        <span>{post.votes}</span>
                        <button onClick={() => handleVote(post.id, false, 'down')} className="p-1 rounded-full hover:bg-gray-700"><ThumbsDown size={16} /></button>
                    </div>
                </div>
            </div>

            <div className="mt-10">
                <h2 className="text-2xl font-light mb-6">Comments ({post.comments.length})</h2>
                
                <div className="bg-[#1A1A1A] p-4 rounded-lg mb-8">
                    <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Add your comment..."
                        className="w-full h-24 p-3 bg-[#0D0D0D] text-white rounded-lg font-light resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                        disabled={isSubmitting}
                    />
                    <div className="flex justify-end items-center mt-4">
                        {commentError && <p className="text-red-500 text-sm mr-4">{commentError}</p>}
                        <button onClick={handleAddComment} className="px-6 py-2 bg-white text-black text-sm font-medium rounded-full hover:opacity-90 transition-opacity" disabled={isSubmitting || !newComment.trim()}>
                            {isSubmitting ? 'Posting...' : 'Post Comment'}
                        </button>
                    </div>
                </div>
                
                <div className="space-y-6">
                    {post.comments.map(comment => (
                        <div key={comment.id} className="border-t border-gray-800 pt-6">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-gray-300 mb-2 whitespace-pre-wrap">{comment.content}</p>
                                    <div className="text-xs text-gray-500">
                                        <span>By {comment.author}</span>
                                        <span className="mx-2">•</span>
                                        <span>{new Date(comment.created_at).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors text-xs flex-shrink-0 ml-4">
                                    <button onClick={() => handleVote(comment.id, true, 'up')} className="p-1 rounded-full hover:bg-gray-700"><ThumbsUp size={14} /></button>
                                    <span>{comment.votes}</span>
                                    <button onClick={() => handleVote(comment.id, true, 'down')} className="p-1 rounded-full hover:bg-gray-700"><ThumbsDown size={14} /></button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}