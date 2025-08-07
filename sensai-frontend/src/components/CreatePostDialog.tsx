"use client";

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { Post } from '@/lib/api';
import BlockNoteEditor from './BlockNoteEditor';
import { Block } from '@blocknote/core';
import { X, Plus, FileText, HelpCircle, StickyNote, ListChecks } from 'lucide-react';

interface CreatePostDialogProps {
  open: boolean;
  onClose: () => void;
  hubId: string;
  onPostCreated: (newPost: Post) => void;
}

const postTypeIcons = {
  thread: <FileText size={16} />,
  question: <HelpCircle size={16} />,
  note: <StickyNote size={16} />,
  poll: <ListChecks size={16} />,
  reply: <FileText size={16} />, // Not used in selector but good for consistency
};

export default function CreatePostDialog({
  open,
  onClose,
  hubId,
  onPostCreated,
}: CreatePostDialogProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState<Block[]>([]);
  const [postType, setPostType] = useState('thread');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const placeholderText = {
    thread: 'Share your thoughts, post updates, or ask questions...',
    question: 'Clearly state your question for the community...',
    note: 'Jot down a note, a piece of code, or a link to share...',
    poll: 'Describe your poll and add options below...',
    reply: 'Write your reply...',
  };

  useEffect(() => {
    if (open) {
      // Reset form when dialog opens
      setTitle('');
      setContent([]);
      setError('');
      setPostType('thread');
      setPollOptions(['', '']);
    }
  }, [open]);

  const handlePollOptionChange = (index: number, value: string) => {
    const newOptions = [...pollOptions];
    newOptions[index] = value;
    setPollOptions(newOptions);
  };

  const addPollOption = () => {
    if (pollOptions.length < 10) {
      setPollOptions([...pollOptions, '']);
    }
  };

  const removePollOption = (index: number) => {
    if (pollOptions.length > 2) {
      const newOptions = pollOptions.filter((_, i) => i !== index);
      setPollOptions(newOptions);
    }
  };

  const handleSubmit = async () => {
    console.log('[CreatePost] handleSubmit start', { title, content, postType });
    if (postType !== 'poll' && content.length === 0) {
      console.log('[CreatePost] validation failed: empty content');
      setError('Content is required.');
      return;
    }
    if (postType !== 'reply' && !title.trim()) {
      console.log('[CreatePost] validation failed: empty title for thread');
      setError('Title is required for a new post.');
      return;
    }
    if (!user || !user.id) {
      console.log('[CreatePost] validation failed: no user');
      setError('You must be logged in to post.');
      return;
    }
    if (postType === 'poll' && pollOptions.filter(opt => opt.trim()).length < 2) {
      setError('Polls must have at least two non-empty options.');
      return;
    }
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/hubs/posts`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hub_id: parseInt(hubId),
            user_id: parseInt(user.id),
            title: postType === 'reply' ? null : title,
            content: JSON.stringify(content), // Stringify the content array
            post_type: postType,
            parent_id: null,
            poll_options: postType === 'poll' ? pollOptions.filter(opt => opt.trim()) : null,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create post. Please try again.');
      }

      const newPost: Post = await response.json();

      onPostCreated(newPost);
      onClose();
    } catch (err) {
      console.error('[CreatePost] Error in handleSubmit', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      console.log('[CreatePost] handleSubmit end');
      setIsLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-2xl bg-[#1A1A1A] rounded-lg shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-lg font-medium text-white">
            Create a New Post
          </h2>
          <button onClick={onClose} className="p-1 text-gray-400 rounded-full hover:bg-gray-700 hover:text-white">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto">
            <div>
              <div className="flex bg-[#0D0D0D] rounded-lg p-1 w-full sm:w-auto">
                {(['thread', 'question', 'note', 'poll'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setPostType(type)}
                    className={`w-full flex items-center justify-center gap-2 text-center text-sm py-2 px-4 rounded-md transition-colors ${
                      postType === type
                        ? 'bg-white text-black font-medium'
                        : 'text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    {postTypeIcons[type]}
                    <span className="capitalize">{type}</span>
                  </button>
                ))}
              </div>
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title of your post"
              className="w-full px-4 py-3 bg-[#0D0D0D] text-white rounded-lg font-light placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            {postType === 'poll' && (
              <div className="space-y-2 pt-2">
                <label className="text-sm font-medium text-gray-300">Poll Options</label>
                {pollOptions.map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => handlePollOptionChange(index, e.target.value)}
                      placeholder={`Option ${index + 1}`}
                      className="w-full px-3 py-2 bg-[#0D0D0D] text-white rounded-md font-light placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                    {pollOptions.length > 2 && (
                      <button onClick={() => removePollOption(index)} className="p-1 text-gray-400 hover:text-red-500 rounded-full">
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))}
                {pollOptions.length < 10 && (
                  <button onClick={addPollOption} className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 pt-1">
                    <Plus size={14} />
                    Add Option
                  </button>
                )}
              </div>
            )}
            <div className="min-h-[150px] bg-[#0D0D0D] rounded-lg focus-within:ring-2 focus-within:ring-purple-500 p-1">
                <BlockNoteEditor
                    initialContent={content}
                    onChange={(blocks) => {
                        setContent(blocks);
                    }}
                    placeholder={placeholderText[postType as keyof typeof placeholderText]}
                    className="font-light"
                />
            </div>
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </div>
        <div className="flex justify-end items-center gap-4 px-6 py-4 bg-[#111111] rounded-b-lg border-t border-gray-800">
          {error && <p className="text-red-500 text-sm mr-auto">{error}</p>}
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-6 py-2 bg-white text-black text-sm font-medium rounded-full hover:opacity-90 transition-opacity flex items-center justify-center disabled:opacity-50"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin mr-2"></div>
                Posting...
              </>
            ) : (
              'Post'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
