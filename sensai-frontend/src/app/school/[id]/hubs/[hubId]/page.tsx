// adityavofficial-hyperverge-hackathon-2025/sensai-frontend/src/app/school/[id]/hubs/[hubId]/page.tsx

"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Plus, MessageSquare, ArrowLeft, ThumbsUp, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";

// Define the types for Hub and Post
interface Hub {
    id: number;
    name: string;
    description: string;
}

interface Post {
    id: number;
    title: string;
    content: string;
    post_type: string;
    created_at: string;
    author: string;
    votes: number;
    comment_count: number;
}

// CreatePostDialog Component
const CreatePostDialog = ({ open, onClose, hubId, schoolId, onPostCreated }: { open: boolean, onClose: () => void, hubId: string, schoolId: string, onPostCreated: (newPost: Post) => void }) => {
    const { user } = useAuth();
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [postType, setPostType] = useState('thread');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async () => {
        if (!content.trim()) {
            setError('Content is required.');
            return;
        }
        if (postType !== 'reply' && !title.trim()) {
            setError('Title is required for new threads.');
            return;
        }
        setIsLoading(true);
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/hubs/posts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    hub_id: parseInt(hubId),
                    user_id: user?.id,
                    title,
                    content,
                    post_type
                })
            });
            if (!response.ok) throw new Error('Failed to create post.');
            const newPostData = await response.json();
            
            // Refetch the full post to get all details
            const postResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/hubs/posts/${newPostData.id}`);
            const newPost = await postResponse.json();

            onPostCreated(newPost);
            onClose();
        } catch (err) {
            setError('An error occurred. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-[#1A1A1A] rounded-lg shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="p-6">
                    <h2 className="text-xl font-light text-white mb-4">Create a New Post</h2>
                    <div className="space-y-4">
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Post Title"
                            className="w-full px-4 py-3 bg-[#0D0D0D] text-white rounded-lg font-light"
                        />
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="What's on your mind?"
                            className="w-full h-32 px-4 py-3 bg-[#0D0D0D] text-white rounded-lg font-light"
                        />
                        {error && <p className="text-red-500 text-sm">{error}</p>}
                    </div>
                </div>
                <div className="flex justify-end gap-4 p-6">
                    <button onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white" disabled={isLoading}>Cancel</button>
                    <button onClick={handleSubmit} className="px-6 py-2 bg-white text-black rounded-full" disabled={isLoading}>
                        {isLoading ? 'Posting...' : 'Post'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// PostCard Component
const PostCard = ({ post, schoolId }: { post: Post, schoolId: string }) => {
    return (
        <Link href={`/school/${schoolId}/posts/${post.id}`} className="block">
            <div className="bg-[#1A1A1A] p-6 rounded-lg transition-all hover:bg-[#222222] cursor-pointer">
                <h3 className="text-lg font-medium text-white mb-2">{post.title}</h3>
                <p className="text-gray-400 text-sm line-clamp-2 mb-4">{post.content}</p>
                <div className="flex justify-between items-center text-xs text-gray-500">
                    <span>By {post.author}</span>
                    <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1"><ThumbsUp size={14} /> {post.votes}</span>
                        <span className="flex items-center gap-1"><MessageCircle size={14} /> {post.comment_count}</span>
                        <span>{new Date(post.created_at).toLocaleDateString()}</span>
                    </div>
                </div>
            </div>
        </Link>
    );
};

// Main Page Component
export default function HubPage() {
    const params = useParams();
    const schoolId = params.id as string;
    const hubId = params.hubId as string;
    const router = useRouter();

    const [hub, setHub] = useState<Hub | null>(null);
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // In a real app, you might fetch hub details separately
                // For now, we'll just fetch posts
                const postsResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/hubs/${hubId}/posts`);
                if (!postsResponse.ok) throw new Error('Failed to fetch posts.');
                const postsData = await postsResponse.json();
                setPosts(postsData);

                // You would also fetch hub details here
                // const hubResponse = await fetch(...)
                // const hubData = await hubResponse.json();
                // setHub(hubData);

            } catch (err) {
                setError('Could not load hub content. Please try again later.');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [hubId]);
    
    const handlePostCreated = (newPost: Post) => {
        setPosts(prevPosts => [newPost, ...prevPosts]);
    };

    return (
        <>
            <Header />
            <div className="min-h-screen bg-black text-white">
                <main className="max-w-4xl mx-auto pt-6 px-8 pb-12">
                    <div className="mb-8">
                        <button onClick={() => router.back()} className="flex items-center text-gray-400 hover:text-white transition-colors mb-4">
                            <ArrowLeft size={16} className="mr-2" />
                            Back to Hubs
                        </button>
                        <div className="flex justify-between items-center">
                            <div>
                                <h1 className="text-3xl font-light">{hub?.name || 'Loading Hub...'}</h1>
                                <p className="text-gray-400 mt-1">{hub?.description}</p>
                            </div>
                            <button
                                onClick={() => setIsCreateDialogOpen(true)}
                                className="px-6 py-3 bg-white text-black text-sm font-medium rounded-full hover:opacity-90 transition-opacity flex items-center"
                            >
                                <Plus size={16} className="mr-2" />
                                Create Post
                            </button>
                        </div>
                    </div>

                    {loading && (
                        <div className="flex justify-center items-center py-12">
                            <div className="w-12 h-12 border-t-2 border-b-2 border-white rounded-full animate-spin"></div>
                        </div>
                    )}

                    {error && <p className="text-center text-red-500">{error}</p>}

                    {!loading && !error && (
                        <div className="space-y-6">
                            {posts.length > 0 ? (
                                posts.map(post => (
                                    <PostCard key={post.id} post={post} schoolId={schoolId} />
                                ))
                            ) : (
                                <div className="text-center py-20">
                                    <h2 className="text-2xl font-medium mb-2">Be the First to Post</h2>
                                    <p className="text-gray-400 mb-6">This hub is empty. Start a conversation!</p>
                                </div>
                            )}
                        </div>
                    )}
                </main>
            </div>
            <CreatePostDialog
                open={isCreateDialogOpen}
                onClose={() => setIsCreateDialogOpen(false)}
                hubId={hubId}
                schoolId={schoolId}
                onPostCreated={handlePostCreated}
            />
        </>
    );
}