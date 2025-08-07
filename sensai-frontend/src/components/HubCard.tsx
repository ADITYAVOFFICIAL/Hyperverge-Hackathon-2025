import Link from "next/link";
import { MessageSquare, Trash2 } from "lucide-react";
import { Hub } from "@/lib/api";

interface HubCardProps {
    hub: Hub;
    schoolId: string;
    isAdmin?: boolean;
    onDelete?: (hubId: number) => void;
}

export default function HubCard({ hub, schoolId, isAdmin = false, onDelete }: HubCardProps) {
    const linkUrl = isAdmin
        ? `/school/${schoolId}/hubs/${hub.id}` // Corrected to point to the learner view which is the intended destination
        : `/school/${schoolId}/hubs/${hub.id}`;

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
        <div className="group relative">
            <Link href={linkUrl} className="block">
                <div className={`bg-[#1A1A1A] text-gray-300 rounded-lg p-6 h-full transition-all hover:bg-[#222222] cursor-pointer border-b-4 ${getBorderColor()} border-opacity-70 flex flex-col`}>
                    <div className="flex items-center mb-4">
                        <div className="w-10 h-10 bg-purple-800/30 rounded-lg flex items-center justify-center mr-4">
                            <MessageSquare size={20} className="text-purple-400" />
                        </div>
                        <h2 className="text-xl font-light text-white flex-1">{hub.name}</h2>
                    </div>
                    <p className="text-sm text-gray-400 flex-grow line-clamp-2">{hub.description}</p>
                </div>
            </Link>
            {isAdmin && onDelete && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onDelete(hub.id);
                    }}
                    className="absolute top-3 right-3 p-2 text-gray-500 hover:text-red-500 rounded-full bg-gray-800/50 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Delete hub"
                >
                    <Trash2 size={16} />
                </button>
            )}
        </div>
    );
}