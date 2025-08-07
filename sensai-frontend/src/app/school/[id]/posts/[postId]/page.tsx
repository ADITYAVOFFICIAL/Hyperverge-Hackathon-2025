"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { ArrowLeft, ThumbsUp, ThumbsDown, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import ConfirmationDialog from "@/components/ConfirmationDialog";

// --- Best Practice: Define precise types for API data ---

// A reusable interface for items that can be voted on.
// `user_vote` tracks the logged-in user's vote status on the post and comments.
interface Votable {
  id: number;
  votes: number;
  user_vote: "up" | "down" | null; // 'up', 'down', or null
}

interface Comment extends Votable {
  content: string;
  created_at: string;
  author: string;
}

interface Post extends Votable {
  hub_id: number;
  title: string;
  content: string;
  post_type: string;
  created_at: string;
  author:string;
  comments: Comment[];
}

// --- Main Page Component ---
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

  /**
   * Fetches the post data from the server.
   * Includes the user's ID to get their specific vote status on the post and comments.
   */
  const fetchPost = async () => {
    if (!postId) return;

    // The API should accept a `userId` to return the `user_vote` field correctly.
    const url = user
      ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/hubs/posts/${postId}?userId=${user.id}`
      : `${process.env.NEXT_PUBLIC_BACKEND_URL}/hubs/posts/${postId}`;

    try {
      setLoading(true);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch post.");
      }
      const data: Post = await response.json();
      setPost(data);
    } catch (err) {
      setError("Could not load the post. It may have been deleted or the link is incorrect.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPost();
  }, [postId, user]); // Re-fetch if the post ID changes or the user logs in/out.

  /**
   * Handles all voting logic with optimistic updates and error rollback.
   * @param itemId The ID of the post or comment being voted on.
   * @param isComment A boolean to distinguish between post and comment votes.
   * @param newVote The vote being cast: 'up' or 'down'.
   */
  const handleVote = async (itemId: number, isComment: boolean, newVote: "up" | "down") => {
    if (!user) {
      alert("Please log in to vote.");
      return;
    }

    let originalVote: "up" | "down" | null = null;
    let voteChange = 0;

    // --- Step 1: Optimistic UI Update ---
    setPost(prevPost => {
      if (!prevPost) return null;

      const updateItem = (item: Post | Comment): Votable => {
        originalVote = item.user_vote;
        let newVoteState: "up" | "down" | null = newVote;

        // Case 1: Un-voting (clicking the same vote button again)
        if (originalVote === newVote) {
          voteChange = newVote === "up" ? -1 : 1;
          newVoteState = null;
        // Case 2: Changing vote (e.g., from up to down)
        } else if (originalVote) { 
          voteChange = newVote === "up" ? 2 : -2; // From down (-1) to up (+1) is a +2 change. From up (+1) to down (-1) is a -2 change.
        // Case 3: Casting a new vote
        } else {
          voteChange = newVote === "up" ? 1 : -1;
        }

        return { ...item, votes: item.votes + voteChange, user_vote: newVoteState };
      };

      if (!isComment) {
        return updateItem(prevPost) as Post;
      } else {
        return {
          ...prevPost,
          comments: prevPost.comments.map(c =>
            c.id === itemId ? (updateItem(c) as Comment) : c
          ),
        };
      }
    });
    

    // --- Step 2: API Call ---
    try {
      const endpoint = `${process.env.NEXT_PUBLIC_BACKEND_URL}/hubs/posts/${itemId}/vote`;

      // If the user is un-voting, the new state is null.
      // The API should handle `null` by deleting the vote.
      const finalVoteType = originalVote === newVote ? null : newVote;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          vote_type: finalVoteType,
          is_comment: isComment,
        }),
      });

      if (!response.ok) throw new Error("Server failed to process the vote.");
    } catch (err) {
      console.error("Failed to submit vote:", err);
      alert("There was an error submitting your vote. Please try again.");

      // --- Step 3: Revert Optimistic Update on Failure ---
      setPost(prevPost => {
        if (!prevPost) return null;
        const revertItem = (item: Post | Comment): Votable => ({
          ...item,
          votes: item.votes - voteChange,
          user_vote: originalVote,
        });
        if (!isComment) return revertItem(prevPost) as Post;
        return {
          ...prevPost,
          comments: prevPost.comments.map(c =>
            c.id === itemId ? (revertItem(c) as Comment) : c
          ),
        };
      });
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !user || !post) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/hubs/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hub_id: post.hub_id,
          user_id: parseInt(user.id),
          content: newComment,
          post_type: "reply",
          parent_id: post.id,
        }),
      });
      if (!response.ok) throw new Error("Failed to add comment.");
      
      // Re-fetch post to get the definitive new comment list from the server
      await fetchPost();
      setNewComment("");

    } catch (err) {
      console.error("handleAddComment error:", err);
      alert("Failed to post your comment. Please try again.");
    } finally {
      setIsSubmitting(false);
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
        router.back();
      }
    } catch (err) {
      console.error("Failed to delete item:", err);
      alert("Failed to delete. Please try again.");
    } finally {
      setItemToDelete(null);
    }
  };

  // Helper to apply dynamic styling to vote buttons based on the user's vote.
  const getVoteButtonClass = (userVote: "up" | "down" | null, type: "up" | "down") => {
    if (userVote === type) {
      return type === 'up' ? 'text-green-500' : 'text-red-500';
    }
    return 'text-gray-400';
  };

  if (loading) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-black text-white">
          <main className="max-w-4xl mx-auto pt-6 px-8 pb-12">
            <div className="flex justify-center items-center py-20">
              <div className="w-12 h-12 border-t-2 border-b-2 border-white rounded-full animate-spin"></div>
            </div>
          </main>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-black text-white">
        <main className="max-w-4xl mx-auto pt-6 px-8 pb-12">
          <button onClick={() => router.back()} className="flex items-center text-gray-400 hover:text-white transition-colors mb-6">
            <ArrowLeft size={16} className="mr-2" />
            Back to Hub
          </button>

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
                <p className="text-gray-300 leading-relaxed mb-6 whitespace-pre-wrap">{post.content}</p>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 transition-colors">
                    <button onClick={() => handleVote(post.id, false, 'up')} className={`p-1 rounded-full hover:bg-gray-700 ${getVoteButtonClass(post.user_vote, 'up')}`}>
                      <ThumbsUp size={16} />
                    </button>
                    <span className="font-semibold text-lg text-white">{post.votes}</span>
                    <button onClick={() => handleVote(post.id, false, 'down')} className={`p-1 rounded-full hover:bg-gray-700 ${getVoteButtonClass(post.user_vote, 'down')}`}>
                      <ThumbsDown size={16} />
                    </button>
                  </div>
                </div>
                <button onClick={() => setItemToDelete({ id: post.id, isComment: false })} className="absolute top-4 right-4 p-2 text-gray-500 hover:text-red-500 rounded-full bg-gray-800/50 opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Delete post">
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="mt-10">
                <h2 className="text-2xl font-light mb-6">Comments ({post.comments.length})</h2>
                <div className="bg-[#1A1A1A] p-4 rounded-lg mb-8">
                  <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Add your comment..." className="w-full h-24 p-3 bg-[#0D0D0D] text-white rounded-lg font-light resize-none focus:ring-2 focus:ring-white/50 outline-none" disabled={isSubmitting || !user} />
                  <div className="flex justify-end mt-4">
                    <button onClick={handleAddComment} className="px-6 py-2 bg-white text-black text-sm font-medium rounded-full disabled:bg-gray-500 disabled:cursor-not-allowed" disabled={isSubmitting || !newComment.trim() || !user}>
                      {isSubmitting ? "Posting..." : "Post Comment"}
                    </button>
                  </div>
                </div>

                <div className="space-y-6">
                  {post.comments.map((comment) => (
                    <div key={comment.id} className="border-t border-gray-800 pt-6 group relative">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-gray-300 mb-2">{comment.content}</p>
                          <div className="text-xs text-gray-500">
                            <span>By {comment.author}</span>
                            <span className="mx-2">•</span>
                            <span>{new Date(comment.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-xs flex-shrink-0 ml-4">
                          <button onClick={() => handleVote(comment.id, true, 'up')} className={`p-1 rounded-full hover:bg-gray-700 ${getVoteButtonClass(comment.user_vote, 'up')}`}>
                            <ThumbsUp size={14} />
                          </button>
                          <span className="font-semibold text-gray-200">{comment.votes}</span>
                          <button onClick={() => handleVote(comment.id, true, 'down')} className={`p-1 rounded-full hover:bg-gray-700 ${getVoteButtonClass(comment.user_vote, 'down')}`}>
                            <ThumbsDown size={14} />
                          </button>
                        </div>
                      </div>
                      <button onClick={() => setItemToDelete({ id: comment.id, isComment: true })} className="absolute top-6 right-[100px] p-2 text-gray-500 hover:text-red-500 rounded-full bg-gray-800/50 opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Delete comment">
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
