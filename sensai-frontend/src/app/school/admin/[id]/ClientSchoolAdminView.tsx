"use client";

import { useState, useEffect, useRef } from "react";
import { Header } from "@/components/layout/header";
import { Edit, Save, Users, BookOpen, Layers, Building, ChevronDown, Trash2, ExternalLink, MessageSquare, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import CourseCard from "@/components/CourseCard";
import CohortCard from "@/components/CohortCard";
import InviteMembersDialog from "@/components/InviteMembersDialog";
import CreateCohortDialog from "@/components/CreateCohortDialog";
import CreateCourseDialog from '@/components/CreateCourseDialog';
import Toast from "@/components/Toast";
import ConfirmationDialog from "@/components/ConfirmationDialog";
import { Cohort, TeamMember, Course } from "@/types";
import { useHubs, Hub } from "@/lib/api";
import HubCard from "@/components/HubCard";
import CreateHubDialog from "@/components/CreateHubDialog";

interface School {
    id: number;
    name: string;
    url: string;
    courses: Course[];
    cohorts: Cohort[];
    members: TeamMember[];
}

type TabType = 'courses' | 'cohorts' | 'members' | 'hubs';

export default function ClientSchoolAdminView({ id }: { id: string }) {
    const router = useRouter();
    const { data: session } = useSession();
    const [school, setSchool] = useState<School | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>('courses');
    const [isEditingName, setIsEditingName] = useState(false);
    const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [isCreateCohortDialogOpen, setIsCreateCohortDialogOpen] = useState(false);
    const [memberToDelete, setMemberToDelete] = useState<TeamMember | null>(null);
    const schoolNameRef = useRef<HTMLHeadingElement>(null);
    const [selectedMembers, setSelectedMembers] = useState<TeamMember[]>([]);
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState({
        title: '',
        description: '',
        emoji: ''
    });

    const { hubs, setHubs, isLoading: isLoadingHubs, error: hubsError } = useHubs(id);
    const [isCreateHubDialogOpen, setIsCreateHubDialogOpen] = useState(false);
    const [hubToDelete, setHubToDelete] = useState<number | null>(null);

    // Add useEffect to automatically hide toast after 5 seconds
    useEffect(() => {
        if (showToast) {
            const timer = setTimeout(() => {
                setShowToast(false);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [showToast]);

    // Initialize tab from URL hash
    useEffect(() => {
        const hash = window.location.hash.replace('#', '');
        if (['courses', 'cohorts', 'members', 'hubs'].includes(hash)) {
            setActiveTab(hash as TabType);
        }
    }, []);

    // Fetch school data
    useEffect(() => {
        const fetchSchool = async () => {
            setLoading(true);
            try {
                const [schoolResponse, membersResponse, cohortsResponse, coursesResponse] = await Promise.all([
                    fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/organizations/${id}`),
                    fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/organizations/${id}/members`),
                    fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/cohorts/?org_id=${id}`),
                    fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/courses/?org_id=${id}`)
                ]);

                if (!schoolResponse.ok) throw new Error(`API error (school): ${schoolResponse.status}`);
                if (!membersResponse.ok) throw new Error(`API error (members): ${membersResponse.status}`);
                if (!cohortsResponse.ok) throw new Error(`API error (cohorts): ${cohortsResponse.status}`);
                if (!coursesResponse.ok) throw new Error(`API error (courses): ${coursesResponse.status}`);

                const schoolData = await schoolResponse.json();
                const membersData = await membersResponse.json();
                const cohortsData = await cohortsResponse.json();
                const coursesData = await coursesResponse.json();

                const transformedSchool: School = {
                    id: parseInt(schoolData.id),
                    name: schoolData.name,
                    url: `${process.env.NEXT_PUBLIC_APP_URL}/school/${schoolData.slug}`,
                    courses: coursesData.map((course: any) => ({
                        id: course.id,
                        name: course.name,
                        moduleCount: 0,
                        description: ''
                    })),
                    cohorts: cohortsData.map((cohort: any) => ({
                        id: cohort.id,
                        name: cohort.name,
                    })),
                    members: membersData || []
                };

                setSchool(transformedSchool);
            } catch (error) {
                console.error("Error fetching school:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchSchool();
    }, [id]);

    // Handle clicking outside the name edit field
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (isEditingName && schoolNameRef.current && !schoolNameRef.current.contains(event.target as Node)) {
                setIsEditingName(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isEditingName]);

    // Toggle name editing
    const toggleNameEdit = () => {
        setIsEditingName(!isEditingName);
        if (!isEditingName) {
            setTimeout(() => {
                if (schoolNameRef.current) {
                    schoolNameRef.current.focus();
                    const range = document.createRange();
                    const selection = window.getSelection();
                    range.selectNodeContents(schoolNameRef.current);
                    range.collapse(false);
                    selection?.removeAllRanges();
                    selection?.addRange(range);
                }
            }, 0);
        }
    };

    const handleNameBlur = () => setIsEditingName(false);

    const handleNameKeyDown = (e: React.KeyboardEvent<HTMLHeadingElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            setIsEditingName(false);
        }
    };

    const handleInviteMembers = async (emails: string[]) => {
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/organizations/${id}/members`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ emails }),
            });

            if (!response.ok) throw new Error('Failed to invite members');

            const membersResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/organizations/${id}/members`);
            if (!membersResponse.ok) throw new Error('Failed to fetch updated members');
            const membersData = await membersResponse.json();

            setSchool(prev => prev ? { ...prev, members: membersData } : null);
            setIsInviteDialogOpen(false);

            setToastMessage({
                title: 'Growing the tribe',
                description: `${emails.length} ${emails.length === 1 ? 'member' : 'members'} has been invited to your team`,
                emoji: '🎉'
            });
            setShowToast(true);
        } catch (error) {
            console.error('Error inviting members:', error);
        }
    };

    const isCurrentUser = (member: TeamMember) => session?.user?.id === member.id.toString();

    const handleDeleteMember = (member: TeamMember) => {
        if (isCurrentUser(member)) return;
        setMemberToDelete(member);
        setSelectedMembers([]);
        setIsDeleteConfirmOpen(true);
    };

    const handleDeleteSelectedMembers = () => {
        setMemberToDelete(null);
        setIsDeleteConfirmOpen(true);
    };

    const confirmDeleteMember = async () => {
        const membersToDelete = memberToDelete ? [memberToDelete] : selectedMembers;
        if (membersToDelete.length === 0) return;

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/organizations/${id}/members`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_ids: membersToDelete.map(member => member.id) }),
            });

            if (!response.ok) throw new Error('Failed to delete member(s)');

            const membersResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/organizations/${id}/members`);
            if (!membersResponse.ok) throw new Error('Failed to fetch updated members');
            const membersData = await membersResponse.json();

            setSchool(prev => prev ? { ...prev, members: membersData } : null);

            setToastMessage({
                title: 'The tribe has shrunk!',
                description: membersToDelete.length === 1
                    ? `${membersToDelete[0].email} has been removed from your team`
                    : `${membersToDelete.length} members have been removed from your team`,
                emoji: '😢'
            });
            setShowToast(true);
        } catch (error) {
            console.error('Error deleting member(s):', error);
        } finally {
            setIsDeleteConfirmOpen(false);
            setMemberToDelete(null);
            setSelectedMembers([]);
        }
    };

    const handleMemberSelection = (member: TeamMember) => {
        if (isCurrentUser(member)) return;
        setSelectedMembers(prevSelected =>
            prevSelected.some(m => m.id === member.id)
                ? prevSelected.filter(m => m.id !== member.id)
                : [...prevSelected, member]
        );
    };

    const handleSelectAllMembers = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            const selectableMembers = school?.members.filter(member =>
                member.role !== 'owner' && !isCurrentUser(member)
            ) || [];
            setSelectedMembers(selectableMembers);
        } else {
            setSelectedMembers([]);
        }
    };

    const areAllMembersSelected = () => {
        if (!school) return false;
        const selectableMembers = school.members.filter(member => member.role !== 'owner' && !isCurrentUser(member));
        return selectableMembers.length > 0 && selectedMembers.length === selectableMembers.length;
    };

    const hasSelectableMembers = () => {
        if (!school) return false;
        return school.members.some(member => member.role !== 'owner' && !isCurrentUser(member));
    };

    const handleCreateCohort = (cohort: any) => {
        if (cohort && cohort.id) {
            router.push(`/school/admin/${id}/cohorts/${cohort.id}`);
        } else {
            console.error("Cohort ID is missing in the response:", cohort);
            setIsCreateCohortDialogOpen(false);
            router.push(`/school/admin/${id}#cohorts`);
        }
    };

    const handleCourseCreationSuccess = (courseData: { id: string; name: string }) => {
        router.push(`/school/admin/${id}/courses/${courseData.id}`);
    };

    const handleTabChange = (tab: TabType) => {
        setActiveTab(tab);
        if (tab !== 'courses') {
            window.location.hash = tab;
        } else {
            history.pushState("", document.title, window.location.pathname);
        }
    };

    const handleHubCreated = (newHub: Hub) => {
        setHubs(prevHubs => [...prevHubs, newHub]);
        setToastMessage({
            title: 'Hub Created!',
            description: `The "${newHub.name}" hub is now live.`,
            emoji: '🎉'
        });
        setShowToast(true);
    };

    const handleHubDelete = async () => {
        if (!hubToDelete) return;
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/hubs/${hubToDelete}/`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errorMessage = errorData.detail || `Failed to delete hub (status: ${response.status})`;
                throw new Error(errorMessage);
            }

            setHubs(prev => prev.filter(h => h.id !== hubToDelete));
            setToastMessage({
                title: 'Hub Deleted',
                description: 'The hub has been successfully deleted.',
                emoji: '🗑️'
            });
            setShowToast(true);
        } catch (error) {
            console.error("Error deleting hub:", error);
            setToastMessage({
                title: 'Error Deleting Hub',
                description: error instanceof Error ? error.message : 'An unknown error occurred.',
                emoji: '❌'
            });
            setShowToast(true);
        } finally {
            setHubToDelete(null);
        }
    };

    const refreshCohorts = async () => {
        try {
            const cohortsResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/cohorts/?org_id=${id}`);
            if (!cohortsResponse.ok) throw new Error('Failed to fetch updated cohorts');
            const cohortsData = await cohortsResponse.json();
            setSchool(prev => prev ? { ...prev, cohorts: cohortsData } : null);
        } catch (error) {
            console.error('Error refreshing cohorts list:', error);
        }
    };

    const handleCohortDelete = async (cohortId: number) => {
        await refreshCohorts();
        setToastMessage({
            title: 'Cohort removed',
            description: `Cohort has been removed from your school`,
            emoji: '✓'
        });
        setShowToast(true);
    };

    const refreshCourses = async () => {
        try {
            const coursesResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/courses/?org_id=${id}`);
            if (!coursesResponse.ok) throw new Error('Failed to fetch updated courses');
            const coursesData = await coursesResponse.json();
            setSchool(prev => prev ? { ...prev, courses: coursesData.map((c: any) => ({ id: c.id, name: c.name })) } : null);
        } catch (error) {
            console.error('Error refreshing courses list:', error);
        }
    };

    const handleCourseDelete = async (courseId: string | number) => {
        await refreshCourses();
        setToastMessage({
            title: 'Course removed',
            description: `Course has been removed from your school`,
            emoji: '✓'
        });
        setShowToast(true);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black text-white">
                <Header showCreateCourseButton={false} />
                <div className="flex justify-center items-center py-12">
                    <div className="w-12 h-12 border-t-2 border-b-2 border-white rounded-full animate-spin"></div>
                </div>
            </div>
        );
    }

    if (!school) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <Header showCreateCourseButton={false} />
                <p>School not found</p>
            </div>
        );
    }

    return (
        <>
            <Header showCreateCourseButton={false} />
            <div className="min-h-screen bg-black text-white">
                <div className="container mx-auto px-4 py-8">
                    <main>
                        {/* School header */}
                        <div className="mb-10">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <div className="w-12 h-12 bg-purple-700 rounded-lg flex items-center justify-center mr-4">
                                        <Building size={24} className="text-white" />
                                    </div>
                                    <div>
                                        <div className="flex items-center">
                                            <h1
                                                ref={schoolNameRef}
                                                contentEditable={isEditingName}
                                                suppressContentEditableWarning
                                                className={`text-3xl font-light outline-none ${isEditingName ? 'border-b border-white' : ''}`}
                                                onBlur={handleNameBlur}
                                                onKeyDown={handleNameKeyDown}
                                            >
                                                {school.name}
                                            </h1>
                                            {/* Edit button can be re-enabled if needed */}
                                            {/* <button onClick={toggleNameEdit} className="ml-2 p-2 text-gray-400 hover:text-white">
                                                {isEditingName ? <Save size={16} /> : <Edit size={16} />}
                                            </button> */}
                                        </div>
                                        <div className="flex items-center mt-1">
                                            <p className="text-gray-400">{school.url}</p>
                                            <a
                                                href={school.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="ml-2 text-gray-400 hover:text-white transition-colors cursor-pointer"
                                                aria-label="Open school URL"
                                            >
                                                <ExternalLink size={14} />
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="mb-8">
                            <div className="flex border-b border-gray-800">
                                <button className={`px-4 py-2 font-light flex items-center ${activeTab === 'courses' ? 'text-white border-b-2 border-white' : 'text-gray-400 hover:text-white'}`} onClick={() => handleTabChange('courses')}>
                                    <BookOpen size={16} className="mr-2" /> Courses
                                </button>
                                <button className={`px-4 py-2 font-light flex items-center ${activeTab === 'cohorts' ? 'text-white border-b-2 border-white' : 'text-gray-400 hover:text-white'}`} onClick={() => handleTabChange('cohorts')}>
                                    <Layers size={16} className="mr-2" /> Cohorts
                                </button>
                                <button className={`px-4 py-2 font-light flex items-center ${activeTab === 'members' ? 'text-white border-b-2 border-white' : 'text-gray-400 hover:text-white'}`} onClick={() => handleTabChange('members')}>
                                    <Users size={16} className="mr-2" /> Team
                                </button>
                                <button className={`px-4 py-2 font-light flex items-center ${activeTab === 'hubs' ? 'text-white border-b-2 border-white' : 'text-gray-400 hover:text-white'}`} onClick={() => handleTabChange('hubs')}>
                                    <MessageSquare size={16} className="mr-2" /> Hubs
                                </button>
                            </div>
                        </div>

                        {/* Tab Content */}
                        <div>
                            {activeTab === 'courses' && (
                                <div>
                                    {school.courses.length > 0 ? (
                                        <>
                                            <div className="flex justify-start items-center mb-6">
                                                <button onClick={() => setIsCreateCourseDialogOpen(true)} className="px-6 py-3 bg-white text-black text-sm font-medium rounded-full hover:opacity-90 transition-opacity">
                                                    Create course
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                {school.courses.map(course => (
                                                    <CourseCard key={course.id} course={{ id: course.id, title: course.name }} onDelete={handleCourseDelete} />
                                                ))}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-20">
                                            <h2 className="text-4xl font-light mb-4">What if your next big idea became a course?</h2>
                                            <p className="text-gray-400 mb-8">It might be easier than you think</p>
                                            <button onClick={() => setIsCreateCourseDialogOpen(true)} className="px-6 py-3 bg-white text-black text-sm font-medium rounded-full hover:opacity-90 transition-opacity">
                                                Create course
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'cohorts' && (
                                <div>
                                    {school.cohorts.length > 0 ? (
                                        <>
                                            <div className="flex justify-start items-center mb-6">
                                                <button onClick={() => setIsCreateCohortDialogOpen(true)} className="px-6 py-3 bg-white text-black text-sm font-medium rounded-full hover:opacity-90 transition-opacity">
                                                    Create cohort
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                {school.cohorts.map(cohort => (
                                                    <CohortCard key={cohort.id} cohort={cohort} schoolId={school.id} onDelete={handleCohortDelete} />
                                                ))}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-20">
                                            <h2 className="text-4xl font-light mb-4">Bring your courses to life with cohorts</h2>
                                            <p className="text-gray-400 mb-8">Create groups of learners and assign them courses to learn together</p>
                                            <button onClick={() => setIsCreateCohortDialogOpen(true)} className="px-6 py-3 bg-white text-black text-sm font-medium rounded-full hover:opacity-90 transition-opacity">
                                                Create cohort
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'members' && (
                                <div>
                                    <div className="flex justify-start items-center mb-6 gap-4">
                                        <button onClick={() => setIsInviteDialogOpen(true)} className="px-6 py-3 bg-white text-black text-sm font-medium rounded-full hover:opacity-90 transition-opacity">
                                            Invite members
                                        </button>
                                        {selectedMembers.length > 0 && (
                                            <button onClick={handleDeleteSelectedMembers} className="px-6 py-3 bg-red-800 text-white text-sm font-medium rounded-full hover:bg-red-900 transition-colors flex items-center">
                                                <Trash2 size={16} className="mr-2" />
                                                Remove ({selectedMembers.length})
                                            </button>
                                        )}
                                    </div>
                                    <div className="overflow-hidden rounded-lg border border-gray-800">
                                        <table className="min-w-full divide-y divide-gray-800">
                                            <thead className="bg-gray-900">
                                                <tr>
                                                    <th scope="col" className="w-10 px-3 py-3 text-left">
                                                        <div className="flex items-center justify-center">
                                                            {hasSelectableMembers() && (
                                                                <input type="checkbox" className="h-5 w-5 rounded-md border-2 border-purple-600 text-white appearance-none checked:bg-purple-600 focus:ring-2 focus:ring-purple-500 bg-[#111111] cursor-pointer" checked={areAllMembersSelected()} onChange={handleSelectAllMembers} title="Select all members" />
                                                            )}
                                                        </div>
                                                    </th>
                                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Email</th>
                                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Role</th>
                                                    <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-[#111] divide-y divide-gray-800">
                                                {school.members.map(member => (
                                                    <tr key={member.id}>
                                                        <td className="w-10 px-4 py-4 whitespace-nowrap">
                                                            <div className="flex justify-center">
                                                                {member.role !== 'owner' && !isCurrentUser(member) && (
                                                                    <input type="checkbox" className="h-5 w-5 rounded-md border-2 border-purple-600 text-white appearance-none checked:bg-purple-600 focus:ring-2 focus:ring-purple-500 bg-[#111111] cursor-pointer" checked={selectedMembers.some(m => m.id === member.id)} onChange={() => handleMemberSelection(member)} />
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{member.email}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                            <span className={`inline-flex items-center px-3 py-0.5 rounded-full text-xs font-medium ${member.role === 'owner' ? 'bg-purple-900 text-purple-200' : 'bg-gray-800 text-gray-300'}`}>
                                                                {member.role === 'owner' ? 'Owner' : 'Admin'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                            {member.role !== 'owner' && !isCurrentUser(member) && (
                                                                <button onClick={() => handleDeleteMember(member)} className="text-gray-400 hover:text-red-500 transition-colors" aria-label="Remove Member">
                                                                    <Trash2 size={18} />
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'hubs' && (
                                <div>
                                    <div className="flex justify-start items-center mb-6">
                                        <button onClick={() => setIsCreateHubDialogOpen(true)} className="px-6 py-3 bg-white text-black text-sm font-medium rounded-full hover:opacity-90 transition-opacity flex items-center">
                                            <Plus size={16} className="mr-2" /> Create Hub
                                        </button>
                                    </div>
                                    {isLoadingHubs ? (
                                        <div className="flex justify-center items-center py-12"><div className="w-10 h-10 border-t-2 border-b-2 border-white rounded-full animate-spin"></div></div>
                                    ) : hubsError ? (
                                        <p className="text-center text-red-500">{hubsError}</p>
                                    ) : hubs.length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {hubs.map(hub => (
                                                <HubCard key={hub.id} hub={hub} schoolId={id} isAdmin={true} onDelete={() => setHubToDelete(hub.id)} />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-20">
                                            <h2 className="text-4xl font-light mb-4">Create a hub to build your community</h2>
                                            <p className="text-gray-400 mb-8">Hubs are discussion forums for your school members</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </main>
                </div>
            </div>

            {/* Dialogs and Toasts */}
            <CreateHubDialog open={isCreateHubDialogOpen} onClose={() => setIsCreateHubDialogOpen(false)} schoolId={id} onHubCreated={handleHubCreated} />
            <InviteMembersDialog open={isInviteDialogOpen} onClose={() => setIsInviteDialogOpen(false)} onInvite={handleInviteMembers} />
            
            <ConfirmationDialog
                show={isDeleteConfirmOpen}
                title={memberToDelete || selectedMembers.length === 1 ? "Remove member" : "Remove selected members"}
                message={memberToDelete
                    ? `Are you sure you want to remove ${memberToDelete.email} from this organization?`
                    : `Are you sure you want to remove ${selectedMembers.length} ${selectedMembers.length === 1 ? 'member' : 'members'} from this organization?`
                }
                confirmButtonText="Remove"
                onConfirm={confirmDeleteMember}
                onCancel={() => setIsDeleteConfirmOpen(false)}
                type="delete"
            />

            <ConfirmationDialog
                show={hubToDelete !== null}
                title="Delete Hub"
                message="Are you sure you want to delete this hub? All of its posts and comments will be permanently removed. This action cannot be undone."
                confirmButtonText="Delete"
                onConfirm={handleHubDelete}
                onCancel={() => setHubToDelete(null)}
                type="delete"
            />

            <Toast
                show={showToast}
                title={toastMessage.title}
                description={toastMessage.description}
                emoji={toastMessage.emoji}
                onClose={() => setShowToast(false)}
            />
        </>
    );
}