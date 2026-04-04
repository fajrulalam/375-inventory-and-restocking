import {
    collection,
    query,
    orderBy,
    onSnapshot,
    Firestore,
    Timestamp,
    doc,
    updateDoc,
} from "firebase/firestore";
import { getCollectionPath } from "./testingMode";

export interface FeedbackData {
    id: string;
    content: string;
    memberId: string;
    memberName: string;
    status: string;
    timestamp: Timestamp | string;
}

export const setupFeedbackUpdates = (
    db: Firestore,
    onFeedbacksUpdate: (feedbacks: FeedbackData[]) => void
) => {
    const feedbacksQuery = query(
        collection(db, getCollectionPath("feedbacks")),
        orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(
        feedbacksQuery,
        (snapshot) => {
            const feedbacks: FeedbackData[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                feedbacks.push({
                    id: doc.id,
                    content: data.content || "",
                    memberId: data.memberId || "",
                    memberName: data.memberName || "Unknown User",
                    status: data.status || "pending",
                    timestamp: data.timestamp,
                });
            });
            onFeedbacksUpdate(feedbacks);
        },
        (error) => {
            console.error("Error fetching feedbacks:", error);
        }
    );

    return unsubscribe;
};

export const updateFeedbackStatus = async (db: Firestore, id: string, status: string) => {
    const feedbackRef = doc(db, getCollectionPath("feedbacks"), id);
    await updateDoc(feedbackRef, { status });
};
