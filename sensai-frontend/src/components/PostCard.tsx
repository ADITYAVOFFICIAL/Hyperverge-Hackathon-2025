// adityavofficial-hyperverge-hackathon-2025/sensai-frontend/src/components/PostCard.tsx

import Link from "next/link";
import { ThumbsUp, MessageCircle, HelpCircle, FileText, StickyNote } from "lucide-react";
import { Block } from "@blocknote/core";

// Define the Post type for props validation
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

interface PostCardProps {
    post: Post;
    schoolId: string;
}

// Helper to get plain text from Block[]
const getPlainTextFromBlocks = (content: string): string => {
    if (!content || !content.startsWith('[')) {
        return content;
    }
    try {
        const blocks: Block[] = JSON.parse(content);
        if (!Array.isArray(blocks)) return content;
        return blocks
            .map((block) =>
                block.content?.map((inline) => ('text' in inline ? inline.text : '')).join('')
            )
            .join(' ')
            .trim();
    } catch (e) {
        return content;
    }
};

export default function PostCard({ post, schoolId }: PostCardProps) {
    const getPostIcon = () => {
        switch (post.post_type) {
            case 'question':
                return <HelpCircle size={16} className="text-blue-400" />;
            case 'note':
                return <StickyNote size={16} className="text-yellow-400" />;
            case 'thread':
            default:
                return <FileText size={16} className="text-gray-400" />;
        }
    };

    return (
        <Link href={`/school/${schoolId}/posts/${post.id}`} className="block">
            <div className="bg-[#1A1A1A] p-6 rounded-lg transition-all hover:bg-[#222222] cursor-pointer border border-transparent hover:border-gray-800">
                <div className="flex items-start justify-between mb-2">
                    <h3 className="text-lg font-medium text-white">{post.title}</h3>
                    <div className="flex items-center text-xs text-gray-500 bg-[#111111] px-2 py-1 rounded-full">
                        {getPostIcon()}
                        <span className="ml-2 capitalize">{post.post_type}</span>
                    </div>
                </div>
                <p className="text-gray-400 text-sm line-clamp-2 mb-4">{getPlainTextFromBlocks(post.content)}</p>
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
}