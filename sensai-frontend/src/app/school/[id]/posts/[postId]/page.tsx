"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { ArrowLeft, ThumbsUp, ThumbsDown, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import BlockNoteEditor from "@/components/BlockNoteEditor";
import { Block } from "@blocknote/core";
import ConfirmationDialog from "@/components/ConfirmationDialog";

// A reusable interface for items that can be voted on.
// `user_vote` tracks the logged-in user's vote status on the post and comments.
interface Votable {
  id: number;
  votes: number;
  user_vote: "up" | "down" | null; // 'up', 'down', or null
}

interface Comment extends Votable {
  content: string; // Will be stringified JSON
  created_at: string;
  author: string;
}

interface PollOption {
  id: number;
  option_text: string;
  votes: number;
}

interface Post extends Votable {
  hub_id: number;
  title: string;
  content: string; // Will be stringified JSON
  post_type: string;
  created_at: string;
  author:string;
  comments: Comment[];
  poll_options?: PollOption[];
  user_poll_vote?: number | null; // ID of the option the user voted for
  moderation_status?: 'pending' | 'approved' | 'flagged' | 'removed';
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
  
  const [newComment, setNewComment] = useState<Block[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<{ id: number; isComment: boolean } | null>(null);

  const fetchPost = useCallback(async () => {
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
  }, [postId, user]);

  useEffect(() => {
    if (postId) {
      fetchPost();
    }
  }, [postId, fetchPost]);

  const handleAddComment = async () => {
    if (newComment.length === 0 || !user || !post) return;
    setIsSubmitting(true);
    setCommentError(null);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/hubs/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hub_id: post.hub_id,
          user_id: parseInt(user.id),
          content: JSON.stringify(newComment), // Stringify the content array
          post_type: 'reply',
          parent_id: post.id
        })
      });
      if (!response.ok) throw new Error('Failed to add comment.');
      
      // Refetch post to get the full new comment object with author etc.
      fetchPost(); 
      setNewComment([]);

    } catch (err) {
      console.error("Failed to add comment:", err);
      setCommentError("Failed to post comment. Please try again.");
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

  const handlePollVote = async (optionId: number) => {
    if (!user || !post) {
      alert("Please log in to vote.");
      return;
    }

    const originalPostState = { ...post };

    // Optimistic update
    setPost(prevPost => {
      if (!prevPost || !prevPost.poll_options) return prevPost;

      const newOptions = prevPost.poll_options.map(opt => {
        // If user is re-voting for the same option, we'll un-vote.
        // The API should handle this logic, but we reflect it optimistically.
        if (opt.id === optionId && prevPost.user_poll_vote === optionId) {
          return { ...opt, votes: opt.votes - 1 };
        }
        // If user is changing vote
        if (prevPost.user_poll_vote && opt.id === prevPost.user_poll_vote) {
          return { ...opt, votes: opt.votes - 1 };
        }
        // New vote
        if (opt.id === optionId) {
          return { ...opt, votes: opt.votes + 1 };
        }
        return opt;
      });
      
      const newUserVote = prevPost.user_poll_vote === optionId ? null : optionId;

      return { ...prevPost, poll_options: newOptions, user_poll_vote: newUserVote };
    });

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/hubs/posts/polls/${optionId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id })
      });

      if (!response.ok) {
        throw new Error('Failed to submit poll vote.');
      }
      
      // Fetch the latest post state to ensure data is in sync
      fetchPost();

    } catch (err) {
      console.error("Failed to vote on poll:", err);
      alert("There was an error submitting your vote. Please try again.");
      // Revert on failure
      setPost(originalPostState);
    }
  };

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
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="w-12 h-12 border-t-2 border-b-2 border-white rounded-full animate-spin"></div>
            </div>
          ) : error || !post ? (
            <div className="text-center py-20">
              {error ? (
                <p className="text-red-500">{error}</p>
              ) : (
                <p className="text-gray-500">Post not found.</p>
              )}
              <button onClick={() => router.back()} className="mt-4 text-sm text-blue-500 hover:underline">
                Go back
              </button>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <button onClick={() => router.back()} className="flex items-center text-gray-400 hover:text-white transition-colors mb-4">
                  <ArrowLeft size={16} className="mr-2" />
                  Back to Hub
                </button>
                <h1 className="text-3xl font-light text-white">{post.title}</h1>
                <div className="text-sm text-gray-500 mt-2">
                  <span>By {post.author}</span>
                  <span className="mx-2">•</span>
                  <span>{new Date(post.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="text-gray-300 mt-6 prose prose-invert prose-sm max-w-none">
                {post.moderation_status === 'removed' ? (
                  <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 text-center">
                    <p className="text-red-400">This post has been removed due to policy violations.</p>
                  </div>
                ) : post.moderation_status === 'flagged' ? (
                  <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4 mb-4">
                    <p className="text-yellow-400 text-sm">⚠️ This post is under review</p>
                  </div>
                ) : null}
                
                {post.moderation_status !== 'removed' && (
                  <BlockNoteEditor
                    initialContent={post.content ? JSON.parse(post.content) : []}
                    readOnly={true}
                  />
                )}
              </div>

              {post.post_type === 'poll' && post.poll_options && (
                <div className="mt-8 space-y-3">
                  {post.poll_options.map(option => {
                    const totalVotes = post.poll_options?.reduce((acc, opt) => acc + opt.votes, 0) || 1;
                    const percentage = totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0;
                    const isVotedByUser = post.user_poll_vote === option.id;

                    return (
                      <div key={option.id} onClick={() => handlePollVote(option.id)} className="relative bg-[#1A1A1A] p-3 rounded-lg cursor-pointer border-2 border-transparent hover:border-purple-500 transition-colors">
                        <div
                          className={`absolute top-0 left-0 h-full bg-purple-500/20 rounded-md ${isVotedByUser ? 'bg-purple-500/40' : ''}`}
                          style={{ width: `${percentage}%`, transition: 'width 0.5s ease-in-out' }}
                        ></div>
                        <div className="relative flex justify-between items-center">
                          <span className={`font-medium ${isVotedByUser ? 'text-purple-300' : 'text-white'}`}>{option.option_text}</span>
                          <span className="text-sm text-gray-400">{option.votes} vote{option.votes !== 1 ? 's' : ''} ({percentage.toFixed(0)}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="relative group flex items-center gap-2 text-gray-400 mt-6 border-t border-b border-gray-800 py-2">
                <button onClick={() => handleVote(post.id, false, 'up')} className={`p-1 rounded-full hover:bg-gray-700 ${getVoteButtonClass(post.user_vote, 'up')}`}>
                  <ThumbsUp size={16} />
                </button>
                <span className="font-semibold text-lg text-white">{post.votes}</span>
                <button onClick={() => handleVote(post.id, false, 'down')} className={`p-1 rounded-full hover:bg-gray-700 ${getVoteButtonClass(post.user_vote, 'down')}`}>
                  <ThumbsDown size={16} />
                </button>
                <button onClick={() => setItemToDelete({ id: post.id, isComment: false })} className="absolute top-1/2 -translate-y-1/2 right-0 p-2 text-gray-500 hover:text-red-500 rounded-full bg-gray-800/50 opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Delete post">
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="mt-10">
                <h2 className="text-2xl font-light mb-6">Comments ({post.comments.length})</h2>
                
                <div className="bg-[#1A1A1A] p-4 rounded-lg mb-8">
                  <div className="min-h-[100px] bg-[#0D0D0D] rounded-lg focus-within:ring-2 focus-within:ring-purple-500 p-1">
                    <BlockNoteEditor
                      initialContent={[]}
                      onChange={(blocks) => {
                        setNewComment(blocks);
                      }}
                      placeholder="Add your comment..."
                      className="font-light"
                    />
                  </div>
                  <div className="flex justify-end items-center mt-4">
                    {commentError && <p className="text-red-500 text-sm mr-4">{commentError}</p>}
                    <button onClick={handleAddComment} className="px-6 py-2 bg-white text-black text-sm font-medium rounded-full disabled:bg-gray-500 disabled:cursor-not-allowed" disabled={isSubmitting || newComment.length === 0}>
                      {isSubmitting ? "Posting..." : "Post Comment"}
                    </button>
                  </div>
                </div>

                <div className="space-y-6">
                  {post.comments.map((comment) => (
                    <div key={comment.id} className="border-t border-gray-800 pt-6 group relative">
                      {comment.moderation_status === 'removed' ? (
                        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 text-center">
                          <p className="text-red-400 text-sm">This comment has been removed due to policy violations.</p>
                        </div>
                      ) : (
                        <>
                          {comment.moderation_status === 'flagged' && (
                            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-2 mb-2">
                              <p className="text-yellow-400 text-xs">⚠️ Under review</p>
                            </div>
                          )}
                          <div className="flex justify-between items-start">
                            <div className="flex-grow mr-4">
                              <div className="text-gray-300 mb-2 prose prose-invert prose-sm max-w-none">
                                <BlockNoteEditor
                                  initialContent={comment.content ? JSON.parse(comment.content) : []}
                                  readOnly={true}
                                />
                              </div>
                              <div className="text-xs text-gray-500">
                                <span>By {comment.author}</span>
                                <span className="mx-2">•</span>
                                <span>{new Date(comment.created_at).toLocaleDateString()}</span>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
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
