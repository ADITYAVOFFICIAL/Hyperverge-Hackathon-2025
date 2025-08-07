"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { ArrowLeft, ThumbsUp, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import ConfirmationDialog from "@/components/ConfirmationDialog";

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
  hub_id: number;
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
  const postId = params.postId as string;
  const router = useRouter();
  const { user } = useAuth();

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: number; isComment: boolean } | null>(null);

  useEffect(() => {
    const fetchPost = async () => {
      console.log("[PostPage] fetchPost start, postId:", postId);
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/hubs/posts/${postId}`
        );
        console.log("[PostPage] fetchPost response status:", response.status);
        if (!response.ok) {
          const text = await response.text();
          console.error("[PostPage] fetchPost failed response text:", text);
          throw new Error("Failed to fetch post.");
        }
        const data: Post = await response.json();
        console.log("[PostPage] fetchPost data:", data);
        setPost(data);
      } catch (err) {
        console.error("[PostPage] fetchPost error:", err);
        setError(
          "Could not load the post. It may have been deleted or the link is incorrect."
        );
      } finally {
        console.log("[PostPage] fetchPost end");
        setLoading(false);
      }
    };

    fetchPost();
  }, [postId]);

  const handleAddComment = async () => {
    console.log("[PostPage] handleAddComment start, newComment:", newComment);
    if (!newComment.trim()) {
      console.log("[PostPage] handleAddComment validation failed: empty comment");
      return;
    }
    if (!user) {
      console.log("[PostPage] handleAddComment validation failed: no user");
      return;
    }
    if (!post) {
      console.log("[PostPage] handleAddComment validation failed: no post");
      return;
    }

    setIsSubmitting(true);
    try {
      console.log("[PostPage] POST new comment:", {
        hub_id: post.hub_id,
        user_id: user.id,
        content: newComment,
        post_type: "reply",
        parent_id: post.id,
      });
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/hubs/posts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hub_id: post.hub_id,
            user_id: parseInt(user.id),
            content: newComment,
            post_type: "reply",
            parent_id: post.id,
          }),
        }
      );
      console.log(
        "[PostPage] handleAddComment response status:",
        response.status
      );
      if (!response.ok) {
        const text = await response.text();
        console.error(
          "[PostPage] handleAddComment failed response text:",
          text
        );
        throw new Error("Failed to add comment.");
      }

      const newCommentData = await response.json();
      console.log("[PostPage] handleAddComment newCommentData:", newCommentData);

      // Create a temp comment for immediate UI update
      const tempNewComment: Comment = {
        id: newCommentData.id,
        content: newComment,
        created_at: new Date().toISOString(),
        author: user.email || "You",
        votes: 0,
      };
      console.log(
        "[PostPage] handleAddComment tempNewComment:",
        tempNewComment
      );

      setPost((prev) =>
        prev ? { ...prev, comments: [...prev.comments, tempNewComment] } : prev
      );
      setNewComment("");
    } catch (err) {
      console.error("[PostPage] handleAddComment error:", err);
    } finally {
      console.log("[PostPage] handleAddComment end");
      setIsSubmitting(false);
    }
  };

  const handleVote = async (targetPostId: number, isComment: boolean) => {
    console.log(
      "[PostPage] handleVote start, targetPostId:",
      targetPostId,
      "isComment:",
      isComment
    );
    if (!user) {
      console.log("[PostPage] handleVote validation failed: no user");
      return;
    }

    try {
      console.log("[PostPage] POST vote for id:", targetPostId);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/hubs/posts/${targetPostId}/vote`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: user.id, vote_type: "helpful" }),
        }
      );
      console.log("[PostPage] vote response status:", response.status);
      if (!response.ok) {
        const text = await response.text();
        console.error("[PostPage] vote failed response text:", text);
        throw new Error("Vote request failed.");
      }

      // Optimistic UI update
      setPost((prev) => {
        if (!prev) return null;
        if (!isComment) {
          console.log("[PostPage] optimistically updating post votes");
          return { ...prev, votes: prev.votes + 1 };
        } else {
          console.log("[PostPage] optimistically updating comment votes");
          const updatedComments = prev.comments.map((c) =>
            c.id === targetPostId ? { ...c, votes: c.votes + 1 } : c
          );
          return { ...prev, comments: updatedComments };
        }
      });
    } catch (err) {
      console.error("[PostPage] handleVote error:", err);
    } finally {
      console.log("[PostPage] handleVote end");
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;

    try {
        await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/hubs/posts/${itemToDelete.id}`, {
            method: 'DELETE',
        });

        if (itemToDelete.isComment) {
            setPost(prev => prev ? { ...prev, comments: prev.comments.filter(c => c.id !== itemToDelete.id) } : null);
        } else {
            // If the post itself is deleted, go back to the hub page.
            router.back();
        }
    } catch (err) {
        console.error("Failed to delete item:", err);
    } finally {
        setItemToDelete(null);
    }
  };

  return (
    <>
      <Header />
      <div className="min-h-screen bg-black text-white">
        <main className="max-w-4xl mx-auto pt-6 px-8 pb-12">
          <button
            onClick={() => router.back()}
            className="flex items-center text-gray-400 hover:text-white transition-colors mb-6"
          >
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
              <div className="bg-[#1A1A1A] p-8 rounded-lg relative group">
                <h1 className="text-3xl font-light text-white mb-4">{post.title}</h1>
                <div className="flex items-center text-sm text-gray-500 mb-6">
                  <span>By {post.author}</span>
                  <span className="mx-2">•</span>
                  <span>{new Date(post.created_at).toLocaleDateString()}</span>
                </div>
                <p className="text-gray-300 leading-relaxed mb-6 whitespace-pre-wrap">
                  {post.content}
                </p>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => handleVote(post.id, false)}
                    className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                  >
                    <ThumbsUp size={16} /> {post.votes} Helpful
                  </button>
                </div>
                <button
                    onClick={() => setItemToDelete({ id: post.id, isComment: false })}
                    className="absolute top-4 right-4 p-2 text-gray-500 hover:text-red-500 rounded-full bg-gray-800/50 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Delete post"
                >
                    <Trash2 size={16} />
                </button>
              </div>

              {/* Comments Section */}
              <div className="mt-10">
                <h2 className="text-2xl font-light mb-6">
                  Comments ({post.comments.length})
                </h2>

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
                    <button
                      onClick={handleAddComment}
                      className="px-6 py-2 bg-white text-black text-sm font-medium rounded-full"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "Posting..." : "Post Comment"}
                    </button>
                  </div>
                </div>

                {/* Comments List */}
                <div className="space-y-6">
                  {post.comments.map((comment) => (
                    <div key={comment.id} className="border-t border-gray-800 pt-6 group relative">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-gray-300 mb-2">
                            {comment.content}
                          </p>
                          <div className="text-xs text-gray-500">
                            <span>By {comment.author}</span>
                            <span className="mx-2">•</span>
                            <span>
                              {new Date(comment.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleVote(comment.id, true)}
                          className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors text-xs"
                        >
                          <ThumbsUp size={14} /> {comment.votes}
                        </button>
                      </div>
                      <button
                        onClick={() => setItemToDelete({ id: comment.id, isComment: true })}
                        className="absolute top-6 right-0 p-2 text-gray-500 hover:text-red-500 rounded-full bg-gray-800/50 opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Delete comment"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
      <ConfirmationDialog
        show={itemToDelete !== null}
        title={`Delete ${itemToDelete?.isComment ? 'Comment' : 'Post'}`}
        message={`Are you sure you want to delete this ${itemToDelete?.isComment ? 'comment' : 'post'}? This action cannot be undone.`}
        confirmButtonText="Delete"
        onConfirm={handleDelete}
        onCancel={() => setItemToDelete(null)}
        type="delete"
      />
    </>
  );
}
