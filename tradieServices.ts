import { addDoc, collection, getDocs, limit, orderBy, query, serverTimestamp, where } from 'firebase/firestore';
import { db, getAppId } from '../config/firebase';

/**
 * Fetch top tradies for a trade, prioritising verified profiles with highest rating.
 */
export const fetchTradiesByTrade = async (trade: string, maxResults = 6) => {
  if (!db || !trade) return [];

  try {
    const profilesRef = collection(db, 'artifacts', getAppId(), 'public', 'data', 'profiles');
    const q = query(
      profilesRef,
      where('role', '==', 'tradie'),
      where('trade', '==', trade),
      orderBy('verified', 'desc'),
      orderBy('rating', 'desc'),
      limit(maxResults)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  } catch (error) {
    console.error('Failed to fetch tradies by trade:', error);
    return [];
  }
};

/**
 * Log that a user is exploring a trade from the services page.
 */
export const logServiceIntent = async ({
  trade,
  userId,
  source = 'service_finder',
}: {
  trade: string;
  userId?: string | null;
  source?: string;
}) => {
  if (!db || !trade) return;

  try {
    await addDoc(collection(db, 'artifacts', getAppId(), 'public', 'data', 'service_intents'), {
      trade,
      userId: userId || null,
      source,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Failed to log service intent:', error);
  }
};
