// adityavofficial-hyperge-hackathon-2025/sensai-frontend/src/app/school/[id]/hubs/page.tsx

"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Plus, MessageSquare } from "lucide-react";
import Link from "next/link";

// Define the Hub type
interface Hub {
    id: number;
    name: string;
    description: string;
}

// HubCard Component
const HubCard = ({ hub, schoolId }: { hub: Hub, schoolId: string }) => {
    // Generate a unique border color based on the hub id
    const getBorderColor = () => {
        const colors = [
            'border-purple-500', 'border-green-500', 'border-pink-500',
            'border-yellow-500', 'border-blue-500', 'border-red-500',
            'border-indigo-500', 'border-orange-500'
        ];
        return colors[hub.id % colors.length];
    };

    return (
        <Link href={`/school/${schoolId}/hubs/${hub.id}`} className="block h-full">
            <div className={`bg-[#1A1A1A] text-gray-300 rounded-lg p-6 h-full transition-all hover:opacity-90 cursor-pointer border-b-2 ${getBorderColor()} border-opacity-70`}>
                <h2 className="text-xl font-light mb-2">{hub.name}</h2>
                <p className="text-sm text-gray-400">{hub.description}</p>
            </div>
        </Link>
    );
};

// CreateHubDialog Component
const CreateHubDialog = ({ open, onClose, schoolId, onHubCreated }: { open: boolean, onClose: () => void, schoolId: string, onHubCreated: (newHub: Hub) => void }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async () => {
        if (!name.trim()) {
            setError('Hub name is required.');
            return;
        }
        setIsLoading(true);
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/hubs/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ org_id: parseInt(schoolId), name, description })
            });
            if (!response.ok) throw new Error('Failed to create hub.');
            const newHub = await response.json();
            onHubCreated(newHub);
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
            <div className="w-full max-w-md bg-[#1A1A1A] rounded-lg shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="p-6">
                    <h2 className="text-xl font-light text-white mb-4">Create a New Hub</h2>
                    <div className="space-y-4">
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Hub Name (e.g., General Discussion)"
                            className="w-full px-4 py-3 bg-[#0D0D0D] text-white rounded-lg font-light"
                        />
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Hub Description"
                            className="w-full h-24 px-4 py-3 bg-[#0D0D0D] text-white rounded-lg font-light"
                        />
                        {error && <p className="text-red-500 text-sm">{error}</p>}
                    </div>
                </div>
                <div className="flex justify-end gap-4 p-6">
                    <button onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white" disabled={isLoading}>Cancel</button>
                    <button onClick={handleSubmit} className="px-6 py-2 bg-white text-black rounded-full" disabled={isLoading}>
                        {isLoading ? 'Creating...' : 'Create Hub'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Main Page Component
export default function HubsPage() {
    const params = useParams();
    const schoolId = params.id as string;
    const [hubs, setHubs] = useState<Hub[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

    useEffect(() => {
        const fetchHubs = async () => {
            try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/hubs/organization/${schoolId}`);
                if (!response.ok) throw new Error('Failed to fetch hubs.');
                const data = await response.json();
                setHubs(data);
            } catch (err) {
                setError('Could not load hubs. Please try again later.');
            } finally {
                setLoading(false);
            }
        };
        fetchHubs();
    }, [schoolId]);

    const handleHubCreated = (newHub: Hub) => {
        setHubs(prevHubs => [...prevHubs, newHub]);
    };

    return (
        <>
            <Header />
            <div className="min-h-screen bg-black text-white">
                <main className="max-w-6xl mx-auto pt-6 px-8 pb-12">
                    <div className="flex justify-between items-center mb-8">
                        <h1 className="text-3xl font-light flex items-center">
                            <MessageSquare size={28} className="mr-3 text-purple-400" />
                            Learning Hubs
                        </h1>
                        <button
                            onClick={() => setIsCreateDialogOpen(true)}
                            className="px-6 py-3 bg-white text-black text-sm font-medium rounded-full hover:opacity-90 transition-opacity flex items-center"
                        >
                            <Plus size={16} className="mr-2" />
                            Create Hub
                        </button>
                    </div>

                    {loading && (
                        <div className="flex justify-center items-center py-12">
                            <div className="w-12 h-12 border-t-2 border-b-2 border-white rounded-full animate-spin"></div>
                        </div>
                    )}

                    {error && <p className="text-center text-red-500">{error}</p>}

                    {!loading && !error && (
                        hubs.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {hubs.map(hub => (
                                    <HubCard key={hub.id} hub={hub} schoolId={schoolId} />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-20">
                                <h2 className="text-2xl font-medium mb-2">No Hubs Yet</h2>
                                <p className="text-gray-400 mb-6">Create the first hub to start the conversation.</p>
                            </div>
                        )
                    )}
                </main>
            </div>
            <CreateHubDialog
                open={isCreateDialogOpen}
                onClose={() => setIsCreateDialogOpen(false)}
                schoolId={schoolId}
                onHubCreated={handleHubCreated}
            />
        </>
    );
}