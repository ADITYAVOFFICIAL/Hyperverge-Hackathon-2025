// adityavofficial-hyperge-hackathon-2025/sensai-frontend/src/app/school/[id]/posts/[postId]/page.tsx

"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { ArrowLeft, ThumbsUp, MessageCircle } from "lucide-react";
import { useAuth } from "@/lib/auth";

// Define the types for Post and Comment
interface Comment {
    id: number;
    content: string;
    created_at: string;
    author: string;
    votes: number;
}

interface Post {
    id: number;
    title: string;
    content: string;
    post_type: string;
    created_at: string;
    author: string;
    votes: number;
    comments: Comment[];
}

// Main Page Component
export default function PostPage() {
    const params = useParams();
    const schoolId = params.id as string;
    const postId = params.postId as string;
    const router = useRouter();
    const { user } = useAuth();

    const [post, setPost] = useState<Post | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [newComment, setNewComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const fetchPost = async () => {
            try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/hubs/posts/${postId}`);
                if (!response.ok) throw new Error('Failed to fetch post.');
                const data = await response.json();
                setPost(data);
            } catch (err) {
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
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/hubs/posts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    hub_id: post.id, // In this simplified model, we assume hub_id can be derived or is not strictly needed for replies
                    user_id: user.id,
                    content: newComment,
                    post_type: 'reply',
                    parent_id: post.id
                })
            });
            if (!response.ok) throw new Error('Failed to add comment.');
            
            const newCommentData = await response.json();

            // To get author and vote info, we create a temporary comment object
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
            // In a real app, you'd show a toast notification for the error
            console.error("Failed to add comment:", err);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleVote = async (targetPostId: number, isComment: boolean) => {
        if (!user) return;
        try {
            await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/hubs/posts/${targetPostId}/vote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.id, vote_type: 'helpful' })
            });

            // Optimistically update the UI
            setPost(prevPost => {
                if (!prevPost) return null;
                if (!isComment) {
                    return { ...prevPost, votes: prevPost.votes + 1 };
                } else {
                    const updatedComments = prevPost.comments.map(c => 
                        c.id === targetPostId ? { ...c, votes: c.votes + 1 } : c
                    );
                    return { ...prevPost, comments: updatedComments };
                }
            });
        } catch (err) {
            console.error("Failed to vote:", err);
        }
    };

    return (
        <>
            <Header />
            <div className="min-h-screen bg-black text-white">
                <main className="max-w-4xl mx-auto pt-6 px-8 pb-12">
                    <button onClick={() => router.back()} className="flex items-center text-gray-400 hover:text-white transition-colors mb-6">
                        <ArrowLeft size={16} className="mr-2" />
                        Back to Hub
                    </button>

                    {loading && (
                        <div className="flex justify-center items-center py-20">
                            <div className="w-12 h-12 border-t-2 border-b-2 border-white rounded-full animate-spin"></div>
                        </div>
                    )}

                    {error && <p className="text-center text-red-500 py-20">{error}</p>}

                    {!loading && post && (
                        <div>
                            {/* Main Post */}
                            <div className="bg-[#1A1A1A] p-8 rounded-lg">
                                <h1 className="text-3xl font-light text-white mb-4">{post.title}</h1>
                                <div className="flex items-center text-sm text-gray-500 mb-6">
                                    <span>By {post.author}</span>
                                    <span className="mx-2">•</span>
                                    <span>{new Date(post.created_at).toLocaleDateString()}</span>
                                </div>
                                <p className="text-gray-300 leading-relaxed mb-6">{post.content}</p>
                                <div className="flex items-center gap-4">
                                    <button onClick={() => handleVote(post.id, false)} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
                                        <ThumbsUp size={16} /> {post.votes} Helpful
                                    </button>
                                </div>
                            </div>

                            {/* Comments Section */}
                            <div className="mt-10">
                                <h2 className="text-2xl font-light mb-6">Comments ({post.comments.length})</h2>
                                
                                {/* Add Comment Form */}
                                <div className="bg-[#1A1A1A] p-4 rounded-lg mb-8">
                                    <textarea
                                        value={newComment}
                                        onChange={(e) => setNewComment(e.target.value)}
                                        placeholder="Add your comment..."
                                        className="w-full h-24 p-3 bg-[#0D0D0D] text-white rounded-lg font-light resize-none"
                                        disabled={isSubmitting}
                                    />
                                    <div className="flex justify-end mt-4">
                                        <button onClick={handleAddComment} className="px-6 py-2 bg-white text-black text-sm font-medium rounded-full" disabled={isSubmitting}>
                                            {isSubmitting ? 'Posting...' : 'Post Comment'}
                                        </button>
                                    </div>
                                </div>
                                
                                {/* Comments List */}
                                <div className="space-y-6">
                                    {post.comments.map(comment => (
                                        <div key={comment.id} className="border-t border-gray-800 pt-6">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="text-gray-300 mb-2">{comment.content}</p>
                                                    <div className="text-xs text-gray-500">
                                                        <span>By {comment.author}</span>
                                                        <span className="mx-2">•</span>
                                                        <span>{new Date(comment.created_at).toLocaleDateString()}</span>
                                                    </div>
                                                </div>
                                                <button onClick={() => handleVote(comment.id, true)} className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors text-xs">
                                                    <ThumbsUp size={14} /> {comment.votes}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </>
    );
}