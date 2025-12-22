import { addDoc, collection, serverTimestamp, doc, setDoc, Timestamp } from 'firebase/firestore';
import { db, getAppId } from '../config/firebase';

const WORK_KEYWORD_PATTERNS = [
  /how much do you charge/i,
  /cash in hand/i,
  /cash job/i,
  /pay.*cash/i,
  /mates rates/i,
  /off the books/i,
  /discount.*cash/i,
  /work.*cheap/i,
];

export const detectWorkMessage = (text: string) => {
  if (!text) return null;
  const match = WORK_KEYWORD_PATTERNS.find((pattern) => pattern.test(text));
  return match ? { keyword: match.source } : null;
};

export const buildWorkWarning = (partnerIsTradie: boolean) => {
  const cta = partnerIsTradie
    ? 'Tap here to hire this tradie via our secure flow.'
    : 'Tap here to post a job with secure payments.';
  return `If you need work done, please use our secure and easy hiring feature. ${cta}`;
};

export const shouldBlockForWorkPolicy = (currentViolations: number) => currentViolations >= 2;

type ModerationReportInput = {
  conversationId: string;
  reporterUid?: string;
  reporterName?: string;
  offenderUid?: string;
  offenderName?: string;
  senderId?: string;
  participants?: string[];
  messageText: string;
  messages?: Array<{ text?: string; imageUrl?: string; senderId?: string; createdAt?: number | null }>;
  type?: string;
};

export const sendModerationReport = async (input: ModerationReportInput) => {
  if (!db) return;
  const {
    conversationId,
    reporterUid,
    reporterName,
    offenderUid,
    offenderName,
    senderId,
    participants = [],
    messageText,
    messages = [],
    type = 'user_report',
  } = input;

  const participantSet = new Set(participants);
  if (reporterUid) participantSet.add(reporterUid);
  if (offenderUid) participantSet.add(offenderUid);

  try {
    await addDoc(
      collection(db, 'artifacts', getAppId(), 'public', 'data', 'reports'),
      {
        conversationId,
        senderId: senderId || reporterUid || null,
        participants: Array.from(participantSet),
        reportedBy: reporterUid || null,
        reporterName: reporterName || null,
        offenderUid: offenderUid || null,
        offenderName: offenderName || null,
        details: messageText,
        messages,
        createdAt: serverTimestamp(),
        reportType: type,
        status: 'pending',
      }
    );
  } catch (error) {
    console.error('Failed to log moderation report:', error);
    throw error;
  }
};

// ---- Receipts helpers ----

type ReceiptTimestamp = Timestamp | Date | { toMillis?: () => number };
type ReceiptUpdate = {
  conversationId: string;
  uid: string;
  timestamp: ReceiptTimestamp;
};

const memberDocRef = (conversationId: string, uid: string) =>
  doc(db, 'artifacts', getAppId(), 'public', 'data', 'conversations', conversationId, 'members', uid);

export const updateDeliveryReceipts = async ({ conversationId, uid, timestamp }: ReceiptUpdate) => {
  if (!db || !conversationId || !uid || !timestamp) return;
  try {
    const ref = memberDocRef(conversationId, uid);
    await setDoc(
      ref,
      { memberId: uid, lastDeliveredAt: timestamp },
      { merge: true }
    );
  } catch (err) {
    console.error('Failed to update delivery receipt', err);
  }
};

export const updateReadReceipts = async ({ conversationId, uid, timestamp }: ReceiptUpdate) => {
  if (!db || !conversationId || !uid || !timestamp) return;
  try {
    const ref = memberDocRef(conversationId, uid);
    await setDoc(
      ref,
      { memberId: uid, lastReadAt: timestamp, lastDeliveredAt: timestamp },
      { merge: true }
    );
  } catch (err) {
    console.error('Failed to update read receipt', err);
  }
};
