"use client";

import { useEffect, useState } from "react";
import { getFirestore, Timestamp } from "firebase/firestore";
import Link from "next/link";
import { getApps, getApp, initializeApp } from "firebase/app";
import { firebaseConfig } from "@/config/firebase";
import { setupFeedbackUpdates, FeedbackData, updateFeedbackStatus } from "@/utils/feedbackUtils";
import { useTestingMode } from "@/contexts/TestingModeContext";

// Initialize Firebase securely
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

export default function ReviewsPage() {
    const { isTestingMode } = useTestingMode();
    const [feedbacks, setFeedbacks] = useState<FeedbackData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    const [activeStatus, setActiveStatus] = useState<string>("pending");

    const handleStatusUpdate = async (id: string, newStatus: string) => {
        setUpdatingId(id);
        try {
            await updateFeedbackStatus(db, id, newStatus);
        } catch (error) {
            console.error("Failed to update status:", error);
        } finally {
            setUpdatingId(null);
        }
    };

    useEffect(() => {
        setIsLoading(true);
        const unsubscribe = setupFeedbackUpdates(db, (data) => {
            setFeedbacks(data);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [isTestingMode]);

    // Core statuses that stay visible, plus any dynamic ones found in data
    const coreOrder = ["pending", "resolved", "spam", "all"];
    const uniqueStatuses = Array.from(new Set(feedbacks.map(f => f.status.toLowerCase())));
    const statuses = [
        ...coreOrder,
        ...uniqueStatuses.filter(s => !coreOrder.includes(s))
    ];

    const filteredFeedbacks = activeStatus === "all"
        ? feedbacks
        : feedbacks.filter(f => f.status.toLowerCase() === activeStatus);

    const formatDate = (timestamp: Timestamp | string) => {
        if (!timestamp) return "Unknown Date";

        try {
            // Handle Firebase Timestamp
            if (typeof timestamp === "object" && "toDate" in timestamp) {
                return timestamp.toDate().toLocaleString("en-US", {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }

            // Handle string or numeric timestamp
            const date = new Date(timestamp as string);
            if (!isNaN(date.getTime())) {
                return date.toLocaleString("en-US", {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }
        } catch (e) {
            console.error("Error parsing date:", e);
        }

        // Default return if all parsing fails
        if (typeof timestamp === "string") return timestamp;
        return "Unknown Date";
    };

    const getStatusBadge = (status: string) => {
        switch (status.toLowerCase()) {
            case 'pending':
                return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 border border-yellow-200 uppercase tracking-wide">Pending</span>;
            case 'resolved':
            case 'done':
            case 'finished':
                return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200 uppercase tracking-wide">Resolved</span>;
            case 'rejected':
            case 'spam':
                return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200 uppercase tracking-wide">{status}</span>;
            default:
                return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200 uppercase tracking-wide">{status}</span>;
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 text-black p-4 sm:p-8">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 pb-6 border-b border-gray-300 gap-4">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/"
                            className="p-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-100 transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                        </Link>
                        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Customer Feedbacks</h1>
                    </div>

                    {!isLoading && feedbacks.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {statuses.map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setActiveStatus(status)}
                                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 border ${activeStatus === status
                                        ? "bg-indigo-600 text-white border-indigo-600 shadow-md transform scale-105"
                                        : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600"
                                        } capitalize`}
                                >
                                    {status} ({status === "all" ? feedbacks.length : feedbacks.filter(f => f.status.toLowerCase() === status).length})
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 animate-pulse h-48 flex flex-col justify-between">
                                <div>
                                    <div className="flex justify-between">
                                        <div className="h-5 w-1/3 bg-gray-200 rounded mb-2"></div>
                                        <div className="h-6 w-16 bg-gray-200 rounded-full"></div>
                                    </div>
                                    <div className="h-4 w-1/4 bg-gray-200 rounded mb-6"></div>

                                    <div className="space-y-2">
                                        <div className="h-4 w-full bg-gray-200 rounded"></div>
                                        <div className="h-4 w-4/5 bg-gray-200 rounded"></div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : feedbacks.length === 0 ? (
                    <div className="text-center py-24 bg-white rounded-2xl shadow-sm border border-gray-100 text-gray-500">
                        <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <p className="text-lg font-medium">No feedbacks found.</p>
                        <p className="text-sm mt-1">When customers submit feedback, it will appear here.</p>
                    </div>
                ) : filteredFeedbacks.length === 0 ? (
                    <div className="text-center py-24 bg-white rounded-2xl shadow-sm border border-gray-100 text-gray-500">
                        <p className="text-lg font-medium">No {activeStatus} feedbacks found.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredFeedbacks.map((feedback) => (
                            <div
                                key={feedback.id}
                                className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300 flex flex-col justify-between relative overflow-hidden group"
                            >
                                {/* Decorative background accent */}
                                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -z-10 opacity-50 transition-transform group-hover:scale-110"></div>

                                <div>
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="font-bold text-gray-900 text-lg leading-tight">{feedback.memberName}</h3>
                                            <p className="text-xs font-medium text-gray-400 mt-1 uppercase tracking-wider">{formatDate(feedback.timestamp)}</p>
                                        </div>
                                        <div>{getStatusBadge(feedback.status)}</div>
                                    </div>

                                    <div className="mt-4 bg-gray-50 p-4 rounded-xl relative">
                                        <svg className="absolute top-2 left-2 w-5 h-5 text-gray-300" fill="currentColor" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M10.023 15.642C10.023 12.607 12.272 10 15 10c2.727 0 5 2.607 5 5.642 0 3.036-2.273 5.642-5 5.642-2.728 0-5-2.606-5-5.642zm-8-3C2.023 9.607 4.272 7 7 7c2.727 0 5 2.607 5 5.642 0 3.036-2.273 5.642-5 5.642-2.728 0-5-2.606-5-5.642z" />
                                        </svg>
                                        <p className="text-gray-800 text-sm leading-relaxed relative z-10 pl-6 pr-2 pt-1 font-medium">
                                            {feedback.content}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-6 flex justify-between items-end">
                                    <p className="text-[10px] text-gray-400 font-mono bg-gray-50 px-2 py-1 rounded inline-block">
                                        ID: {feedback.memberId.split('_').pop() || feedback.memberId}
                                    </p>

                                    <div className="flex gap-2">
                                        {feedback.status.toLowerCase() !== 'resolved' && (
                                            <button
                                                disabled={updatingId === feedback.id}
                                                onClick={() => handleStatusUpdate(feedback.id, 'resolved')}
                                                className="p-2 bg-green-50 text-green-600 hover:bg-green-600 hover:text-white rounded-lg transition-all duration-200 shadow-sm border border-green-100 disabled:opacity-50"
                                                title="Mark as Resolved"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                            </button>
                                        )}
                                        {feedback.status.toLowerCase() !== 'spam' && (
                                            <button
                                                disabled={updatingId === feedback.id}
                                                onClick={() => handleStatusUpdate(feedback.id, 'spam')}
                                                className="p-2 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-lg transition-all duration-200 shadow-sm border border-red-100 disabled:opacity-50"
                                                title="Mark as Spam"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
