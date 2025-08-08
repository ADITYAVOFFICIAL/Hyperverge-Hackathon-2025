"use client";

import React, { useState, useEffect } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { PostWithComments, Comment, getUserPoints, investInComment, addCommentView } from "@/lib/api";

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
    const [points, setPoints] = useState<number>(0);
    const [investError, setInvestError] = useState<string | null>(null);
    const [investingFor, setInvestingFor] = useState<number | null>(null);
    const [commentInvestAmounts, setCommentInvestAmounts] = useState<{[key: number]: string}>({});

    const loadPoints = React.useCallback(async () => {
        console.log('loadPoints called, user:', user);
        if (user?.id) {
            console.log('Loading points for user ID:', user.id);
            try {
                const bal = await getUserPoints(parseInt(user.id));
                console.log('Points loaded:', bal);
                setPoints(bal);
            } catch (error) {
                console.error('Error loading points:', error);
            }
        } else {
            console.log('No user ID available for loading points');
        }
    }, [user?.id]);

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
        // Load points
        loadPoints();
    }, [postId, user?.id, loadPoints]);

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
            // Refresh points (might have earned streak bonus)
            loadPoints();

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
            await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/hubs/posts/${targetPostId}/vote`, {
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

    const handleInvest = async (commentId: number) => {
        if (!user) return;
        setInvestError(null);
        setInvestingFor(commentId);
        const amount = parseInt(commentInvestAmounts[commentId] || '0', 10);
        if (!amount || amount <= 0) {
            setInvestError('Enter a valid amount');
            setInvestingFor(null);
            return;
        }
        try {
            await investInComment(commentId, parseInt(user.id), amount);
            // refresh points
            loadPoints();
            // Clear the specific comment's invest amount
            setCommentInvestAmounts(prev => ({ ...prev, [commentId]: "" }));
            setInvestError(null);
        } catch (e: unknown) {
            setInvestError((e as Error)?.message || 'Investment failed');
        } finally {
            setInvestingFor(null);
        }
    };

    const updateInvestAmount = (commentId: number, value: string) => {
        setCommentInvestAmounts(prev => ({ ...prev, [commentId]: value }));
    };

    const handleCommentVisible = async (commentId: number) => {
        try { await addCommentView(commentId); } catch {}
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
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-medium text-white">Add Comment</h3>
                        <div className="flex items-center gap-4 text-sm">
                            <div className="text-gray-400">
                                Your points: <span className="text-green-400 font-semibold">{points}</span>
                            </div>
                            <button 
                                onClick={loadPoints}
                                className="text-xs px-2 py-1 bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
                            >
                                Refresh
                            </button>
                        </div>
                    </div>
                    <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Add your comment... (Earn +20 points for daily streak!)"
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
                                <div className="flex-1">
                                    <p className="text-gray-300 mb-2 whitespace-pre-wrap">{comment.content}</p>
                                    <div className="text-xs text-gray-500 flex items-center gap-2">
                                        <span>By {comment.author}</span>
                                        <span>•</span>
                                        <span>{new Date(comment.created_at).toLocaleDateString()}</span>
                                        {comment.views && (
                                            <>
                                                <span>•</span>
                                                <span>{comment.views} views</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-xs flex-shrink-0 ml-4">
                                    <button onClick={() => handleVote(comment.id, true, 'up')} className="p-1 rounded-full hover:bg-gray-700"><ThumbsUp size={14} /></button>
                                    <span className="font-semibold">{comment.votes}</span>
                                    <button onClick={() => handleVote(comment.id, true, 'down')} className="p-1 rounded-full hover:bg-gray-700"><ThumbsDown size={14} /></button>
                                </div>
                            </div>
                            
                            {/* Investment Section */}
                            <div className="mt-4 p-3 bg-[#0D0D0D] rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-sm font-medium text-gray-300">Investment</h4>
                                    <div className="text-xs text-gray-500">
                                        Invest now, earn 3x if this becomes top comment in 2 days
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        placeholder="Amount (min 10)"
                                        value={commentInvestAmounts[comment.id] || ""}
                                        onChange={(e) => updateInvestAmount(comment.id, e.target.value)}
                                        className="w-32 bg-[#1A1A1A] text-white text-xs rounded px-2 py-1 border border-gray-700 focus:border-purple-500"
                                        onFocus={() => handleCommentVisible(comment.id)}
                                        min="10"
                                    />
                                    <button
                                        onClick={() => handleInvest(comment.id)}
                                        className="text-xs px-3 py-1 rounded-full bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
                                        disabled={!!investingFor || !commentInvestAmounts[comment.id] || parseInt(commentInvestAmounts[comment.id] || '0') < 10}
                                    >
                                        {investingFor === comment.id ? 'Investing...' : 'Invest'}
                                    </button>
                                    <div className="text-xs text-gray-500 ml-2">
                                        Potential return: {(parseInt(commentInvestAmounts[comment.id] || '0') * 3) || 0} pts
                                    </div>
                                </div>
                                {investError && investingFor === comment.id && (
                                    <div className="mt-1 text-xs text-red-400">{investError}</div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
                
                {/* Bottom Stats */}
                <div className="mt-8 p-4 bg-[#1A1A1A] rounded-lg">
                    <div className="flex justify-between items-center">
                        <div className="text-sm text-gray-400">
                            <div className="mb-1">Your current balance: <span className="text-green-400 font-semibold">{points} points</span></div>
                            <div className="text-xs text-gray-500">
                                • Daily comment streak: +20 points
                                • Investment returns: up to 3x your stake
                                • Higher points = better comment visibility
                            </div>
                        </div>
                        <button 
                            onClick={loadPoints}
                            className="px-3 py-1 bg-gray-700 text-gray-300 rounded text-sm hover:bg-gray-600"
                        >
                            Refresh Points
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}