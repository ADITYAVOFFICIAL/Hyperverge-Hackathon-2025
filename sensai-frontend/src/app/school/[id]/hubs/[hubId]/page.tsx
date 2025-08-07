// adityavofficial-hyperverge-hackathon-2025/sensai-frontend/src/app/school/[id]/hubs/[hubId]/page.tsx

"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Plus, MessageSquare, ArrowLeft, ThumbsUp, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import CreatePostDialog from "@/components/CreatePostDialog";

// Define the types for Hub and Post
interface Hub {
    id: number;
    name: string;
    description: string;
}

interface Post {
    id: number;
    hub_id: number;
    title: string;
    content: string;
    post_type: string;
    created_at: string;
    author: string;
    votes: number;
    comment_count: number;
}

// Helper function to extract text from BlockNote content
const extractTextFromContent = (content: string): string => {
    try {
        // Attempt to parse the content as JSON (from BlockNote)
        const blocks = JSON.parse(content);
        if (!Array.isArray(blocks)) {
            // Fallback for plain text content
            return content.substring(0, 200);
        }

        // Extract text from each block and join them
        return blocks
            .map(block => {
                if (block.content && Array.isArray(block.content)) {
                    return block.content.map((inline: any) => inline.text || '').join('');
                }
                return '';
            })
            .join(' ')
            .substring(0, 200); // Limit preview length
    } catch (e) {
        // If parsing fails, assume it's plain text
        return content.substring(0, 200);
    }
};

// PostCard Component
const PostCard = ({ post, schoolId }: { post: Post, schoolId: string }) => {
    const previewText = extractTextFromContent(post.content);
    return (
        <Link href={`/school/${schoolId}/posts/${post.id}`} className="block">
            <div className="bg-[#1A1A1A] p-6 rounded-lg transition-all hover:bg-[#222222] cursor-pointer">
                <h3 className="text-lg font-medium text-white mb-2">{post.title}</h3>
                <p className="text-gray-400 text-sm line-clamp-2 mb-4">
                    {previewText}{previewText.length === 200 ? '...' : ''}
                </p>
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
            // Add more detailed error handling
            const postsResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/hubs/${hubId}/posts`);
            
            if (!postsResponse.ok) {
                const errorText = await postsResponse.text();
                console.error('Posts fetch failed:', postsResponse.status, errorText);
                throw new Error(`Failed to fetch posts: ${postsResponse.status}`);
            }
            
            const postsData = await postsResponse.json();
            setPosts(postsData);
        } catch (err) {
            console.error('Error fetching hub data:', err);
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
                onPostCreated={handlePostCreated}
            />
        </>
    );
}