import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  addDoc,
  collection,
  query,
  orderBy,
  increment,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";

function noteRef(noteId: string) {
  return doc(db, "notes", noteId);
}

export async function incrementViewCount(noteId: string): Promise<void> {
  await updateDoc(noteRef(noteId), { viewCount: increment(1) });
}

export async function incrementShareCount(noteId: string): Promise<void> {
  await updateDoc(noteRef(noteId), { shareCount: increment(1) });
}

export async function hasLiked(noteId: string, uid: string): Promise<boolean> {
  const snap = await getDoc(doc(db, "notes", noteId, "likes", uid));
  return snap.exists();
}

export async function toggleLike(
  noteId: string,
  uid: string
): Promise<boolean> {
  const likeRef = doc(db, "notes", noteId, "likes", uid);
  const existing = await getDoc(likeRef);
  const batch = writeBatch(db);
  if (existing.exists()) {
    batch.delete(likeRef);
    batch.update(noteRef(noteId), { likeCount: increment(-1) });
    await batch.commit();
    return false;
  } else {
    batch.set(likeRef, { likedAt: new Date().toISOString() });
    batch.update(noteRef(noteId), { likeCount: increment(1) });
    await batch.commit();
    return true;
  }
}

export type Comment = {
  id: string;
  authorUid: string;
  authorUsername: string;
  authorDisplayName: string;
  authorAvatar: string;
  content: string;
  createdAt: string;
  parentCommentId?: string | null;
  likeCount?: number;
};

export async function getComments(noteId: string): Promise<Comment[]> {
  const q = query(
    collection(db, "notes", noteId, "comments"),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Comment));
}

export async function addComment(
  noteId: string,
  noteSlug: string,
  noteTitle: string,
  author: {
    uid: string;
    username: string;
    displayName: string;
    avatar: string;
  },
  content: string,
  parentCommentId: string | null = null
): Promise<void> {
  await addDoc(collection(db, "notes", noteId, "comments"), {
    authorUid: author.uid,
    authorUsername: author.username,
    authorDisplayName: author.displayName,
    authorAvatar: author.avatar,
    content,
    createdAt: new Date().toISOString(),
    noteId,
    noteSlug,
    noteTitle,
    parentCommentId,
    likeCount: 0,
  });
}

export async function deleteComment(
  noteId: string,
  commentId: string
): Promise<void> {
  await deleteDoc(doc(db, "notes", noteId, "comments", commentId));
}

function commentLikeRef(noteId: string, commentId: string, uid: string) {
  return doc(db, "notes", noteId, "comments", commentId, "commentLikes", uid);
}

function commentRef(noteId: string, commentId: string) {
  return doc(db, "notes", noteId, "comments", commentId);
}

export async function hasLikedComment(
  noteId: string,
  commentId: string,
  uid: string
): Promise<boolean> {
  const snap = await getDoc(commentLikeRef(noteId, commentId, uid));
  return snap.exists();
}

export async function toggleCommentLike(
  noteId: string,
  commentId: string,
  uid: string
): Promise<boolean> {
  const ref = commentLikeRef(noteId, commentId, uid);
  const existing = await getDoc(ref);
  const batch = writeBatch(db);
  if (existing.exists()) {
    batch.delete(ref);
    batch.update(commentRef(noteId, commentId), { likeCount: increment(-1) });
    await batch.commit();
    return false;
  } else {
    batch.set(ref, { likedAt: new Date().toISOString() });
    batch.update(commentRef(noteId, commentId), { likeCount: increment(1) });
    await batch.commit();
    return true;
  }
}
