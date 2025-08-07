"use client";

import { useState, useEffect } from 'react';
import { Hub } from '@/lib/api'; // Assuming Hub type is in api.ts

interface CreateHubDialogProps {
    open: boolean;
    onClose: () => void;
    schoolId: string;
    onHubCreated: (newHub: Hub) => void;
}

export default function CreateHubDialog({ open, onClose, schoolId, onHubCreated }: CreateHubDialogProps) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (open) {
            setName('');
            setDescription('');
            setError('');
            setIsLoading(false);
        }
    }, [open]);

    const handleSubmit = async () => {
        if (!name.trim()) {
            setError('Hub name is required.');
            return;
        }
        setIsLoading(true);
        setError('');

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/hubs/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    org_id: parseInt(schoolId),
                    name,
                    description
                })
            });

            if (!response.ok) {
                throw new Error('Failed to create hub. Please try again.');
            }

            const newHub = await response.json();
            onHubCreated(newHub);
            onClose();

        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="w-full max-w-md bg-[#1A1A1A] rounded-lg shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="p-6">
                    <h2 className="text-xl font-light text-white mb-4">Create a New Hub</h2>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="hubName" className="text-sm text-gray-400 mb-1 block">Name</label>
                            <input
                                id="hubName"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g., General Discussion, Q&A"
                                className="w-full px-4 py-3 bg-[#0D0D0D] text-white rounded-lg font-light placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                        </div>
                        <div>
                            <label htmlFor="hubDescription" className="text-sm text-gray-400 mb-1 block">Description</label>
                            <textarea
                                id="hubDescription"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="What is this hub for?"
                                className="w-full h-24 px-4 py-3 bg-[#0D0D0D] text-white rounded-lg font-light placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                        </div>
                        {error && <p className="text-red-500 text-sm">{error}</p>}
                    </div>
                </div>
                <div className="flex justify-end gap-4 px-6 py-4 bg-[#111111] rounded-b-lg">
                    <button onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white transition-colors" disabled={isLoading}>Cancel</button>
                    <button onClick={handleSubmit} className="px-6 py-2 bg-white text-black text-sm font-medium rounded-full hover:opacity-90 transition-opacity" disabled={isLoading}>
                        {isLoading ? 'Creating...' : 'Create Hub'}
                    </button>
                </div>
            </div>
        </div>
    );
}