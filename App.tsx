/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { 
  User, MessageCircle, ShieldCheck, Shield, Search, 
  Briefcase, HardHat, AlertCircle, ShoppingBag, Image as ImageIcon, Star
} from 'lucide-react';

// Firebase Imports
import { 
  signInWithCustomToken, 
  onAuthStateChanged
} from 'firebase/auth';
import { 
  collection, 
  collectionGroup,
  doc, 
  getDoc,
  getDocs,
  onSnapshot,
  updateDoc, 
  serverTimestamp,
  query,
  where,
  orderBy,
  limit
} from 'firebase/firestore';

// Local imports
import { initializeFirebase, getAppId, auth, db } from './config/firebase';
import { ADMIN_EMAIL } from './constants';
import { injectCustomAnimations, getDefaultCoverPhoto } from './utils';
import { Shop, PostJobAdvert, JobRequestForm, JobManager, MessagesModal, ChatRoom, UserProfile } from './views/core-pages';
import { SettingsScreen, PaymentsCredits, SafetyCentre, WorkCalendar, AdminPanel } from './views/admin-settings';
import { LandingPage, Onboarding, Feed, SocialProfileModal, Toast } from './views/home';
import { Avatar, Button } from './components/ui';

// Initialize animations
injectCustomAnimations();

// --- MAIN APP COMPONENT ---
export default function App() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [view, setView] = useState('landing'); 
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dating');
  const [selectedProfile, setSelectedProfile] = useState(null); 
  const [feedFilter, setFeedFilter] = useState(null); 
  const [acceptedTradieIds, setAcceptedTradieIds] = useState(new Set()); 
  const [chatBackView, setChatBackView] = useState('feed'); // Track where to go back from chat (default to feed)
  const [profilePictureRequests, setProfilePictureRequests] = useState([]); // Profile picture verification requests
  const [showSocialModal, setShowSocialModal] = useState(false); // Controls SocialProfileModal visibility
  const [chatMode, setChatMode] = useState(false); // If true, modal opens in chat mode
  const [showMessagesModal, setShowMessagesModal] = useState(false); // Controls MessagesModal visibility
  
  // Notification dots state (true = show red dot, false = hidden)
  const [hasJobsNotification, setHasJobsNotification] = useState(false);
  const [hasDiscoverNotification, setHasDiscoverNotification] = useState(false);
  const [hasProfileNotification, setHasProfileNotification] = useState(false);
  const [hasShopNotification, setHasShopNotification] = useState(false);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [unreadMessagesPerUser, setUnreadMessagesPerUser] = useState({}); // Track unread messages by sender
  const [lastReadMap, setLastReadMap] = useState({}); // conversationId -> { lastReadAt, muteUntil }
  const lastReadRef = useRef({});
  const messagesCacheRef = useRef({});
  const conversationUnsubsRef = useRef({});
  
  // Toast State
  const [toast, setToast] = useState(null);
  const [publicProfileUser, setPublicProfileUser] = useState<string | null>(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
  };

  const openPublicProfile = (username: string) => {
    setPublicProfileUser(username);
    setView('publicProfile');
  };

  const generateUsername = async (seed) => {
    const base = (seed || 'user').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 12) || 'user';
    let candidate = base;
    let suffix = 1;
    while (true) {
      const snap = await getDocs(
        query(
          collection(db, 'artifacts', getAppId(), 'public', 'data', 'profiles'),
          where('usernameLower', '==', candidate),
          limit(1)
        )
      );
      if (snap.empty) return candidate;
      candidate = `${base}${suffix}`;
      suffix += 1;
    }
  };

  const ensureUsername = async (u) => {
    if (!db || !u) return;
    try {
      const profileRef = doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', u.uid);
      const snap = await getDoc(profileRef);
      const data = snap.data();
      if (snap.exists() && data?.username) return;
      const seed = data?.name || u.displayName || u.email?.split('@')[0] || u.uid.slice(0, 6);
      const username = await generateUsername(seed);
      await updateDoc(profileRef, {
        username,
        usernameLower: username.toLowerCase(),
        usernameChanges: data?.usernameChanges ?? 0
      });
    } catch (err) {
      console.error('Failed to ensure username', err);
    }
  };

  // Initialize Firebase on component mount
  useEffect(() => {
    initializeFirebase();
  }, []);

  // Auth Init
  useEffect(() => {
    if (!auth) {
        setLoading(false);
        // Firebase not configured - this is expected on first setup
        // Don't log error to avoid confusion
        return;
    }
    const initAuth = async () => {
      try {
        if (typeof window.__initial_auth_token !== 'undefined' && window.__initial_auth_token) {
          await signInWithCustomToken(auth, window.__initial_auth_token);
        } else {
          console.log("No custom token found. User needs to sign up or login.");
          // Don't auto-sign in - let user explicitly sign up or login
        }
      } catch (error) {
        console.error("Authentication error:", error);
        showToast(`Authentication failed: ${error.message}. Check Firebase Console settings.`, "error");
        setLoading(false); // Stop loading on error
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      console.log("Auth state changed:", u ? `User ${u.uid}` : "No user");
      setUser(u);
      setLoading(false); // Auth completed - stop loading whether user exists or not
      if (u) {
        ensureUsername(u);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const customHandler = (e: CustomEvent) => {
      if (e.detail?.username) {
        setPublicProfileUser(e.detail.username);
        setView('publicProfile');
      }
    };
    window.addEventListener('open-public-profile', customHandler as EventListener);
    return () => {
      window.removeEventListener('open-public-profile', customHandler as EventListener);
    };
  }, []);

  // GPS watch ID for continuous tracking
  const watchIdRef = useRef(null);

  // UPDATED: Function to manually trigger GPS update with continuous watching
  const updateLocation = () => {
      if (!navigator.geolocation || !user || !db) {
          showToast("Geolocation not supported", "error");
          return;
      }
      
      // Clear any existing watch
      if (watchIdRef.current !== null && typeof watchIdRef.current === 'number') {
          navigator.geolocation.clearWatch(watchIdRef.current);
      }
      
      showToast("Requesting GPS...", "info");
      
      const updatePosition = async (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          try {
              const userRef = doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', user.uid);
              await updateDoc(userRef, { 
                  latitude, 
                  longitude,
                  locationAccuracy: accuracy,
                  locationUpdatedAt: serverTimestamp()
              });
              showToast("Location updated!", "success");
          } catch (e) {
              console.error("Error updating location:", e);
              showToast("Database error", "error");
          }
      };
      
      const handleError = (error) => {
          console.warn("GPS Error:", error);
          let errorMsg = "Location access denied or failed";
          switch(error.code) {
              case error.PERMISSION_DENIED:
                  errorMsg = "Please allow location access in your browser";
                  break;
              case error.POSITION_UNAVAILABLE:
                  errorMsg = "Location information unavailable";
                  break;
              case error.TIMEOUT:
                  errorMsg = "Location request timed out";
                  break;
          }
          showToast(errorMsg, "error");
      };
      
      // Start continuous position watching
      watchIdRef.current = navigator.geolocation.watchPosition(
          updatePosition,
          handleError,
          { 
              enableHighAccuracy: true, 
              maximumAge: 30000, // Cache for 30 seconds
              timeout: 27000 
          }
      );
  };

  // Try to get real location on load with user interaction check
  useEffect(() => {
      if (user && db && navigator.geolocation) {
          // Try to get location once on load
          navigator.geolocation.getCurrentPosition(
              async (position) => {
                  const { latitude, longitude, accuracy } = position.coords;
                  try {
                      const userRef = doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', user.uid);
                      await updateDoc(userRef, { 
                          latitude, 
                          longitude,
                          locationAccuracy: accuracy,
                          locationUpdatedAt: serverTimestamp()
                      });
                  } catch (e) {
                      console.error("Error updating initial location:", e);
                  }
              },
              (error) => {
                  console.log("Initial GPS request blocked, waiting for user interaction:", error.message);
              },
              { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
          );
      }
      
      // Cleanup watch on unmount
      return () => {
          if (watchIdRef.current !== null && typeof watchIdRef.current === 'number') {
              navigator.geolocation.clearWatch(watchIdRef.current);
          }
      };
  }, [user]);

  // Fetch Current User Profile
  useEffect(() => {
    if (!user || !db) return;
    const unsub = onSnapshot(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', user.uid), async (docSnap) => {
        if (docSnap.exists()) {
        const profileData = docSnap.data();
        setUserProfile(profileData);
        
        // Auto-fix: Add email to profile if missing (for existing users)
        if (user.email && (!profileData.email || profileData.email.trim() === '')) {
          try {
            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', user.uid), {
              email: user.email
            });
            console.log('Auto-fixed: Added email to profile');
          } catch (error) {
            console.error('Error adding email to profile:', error);
          }
        }

        // Auto-sync emailVerified flag from Auth -> Profile
        if (user.emailVerified && profileData.emailVerified !== true) {
          try {
            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', user.uid), {
              emailVerified: true,
              emailValidationStatus: 'validated',
              emailValidatedAt: serverTimestamp()
            });
            console.log('Auto-synced emailVerified to profile');
          } catch (error) {
            console.error('Error syncing emailVerified to profile:', error);
          }
        } else if (!user.emailVerified && profileData.emailVerifiedOverride !== true && profileData.emailVerified !== false) {
          try {
            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', user.uid), {
              emailVerified: false,
              emailValidationStatus: 'pending'
            });
            console.log('Flagged profile as unverified to match auth state');
          } catch (error) {
            console.error('Error syncing unverified email state to profile:', error);
          }
        }
        
        // Only redirect to feed if we're on landing page AND profile just got created
        // This prevents navigation when updating profile from other views
        if (view === 'landing') setView('feed');
      } else {
        // Profile doesn't exist - go to onboarding (unless already on landing)
        if (view !== 'landing') setView('onboarding');
      }
      setLoading(false);
    }, (err) => console.error(err));
    return () => unsub();
  }, [user, view]); // Added view as dependency

  // Listen for per-conversation lastRead timestamps (members subcollection)
  useEffect(() => {
    if (!user || !db) return;
    const memberQ = query(
      collectionGroup(db, 'members'),
      where('memberId', '==', user.uid)
    );
    const unsub = onSnapshot(memberQ, (snap) => {
      const map = {};
      snap.forEach(d => {
        const convId = d.ref.parent.parent?.id;
        if (!convId) return;
        const data = d.data();
        map[convId] = {
          lastReadAt: data.lastReadAt,
          muteUntil: data.muteUntil
        };
      });
      lastReadRef.current = map;
      setLastReadMap(map);
      // Recalculate unread with cached messages
      const flattenedBySender = {};
      let total = 0;
      Object.entries(messagesCacheRef.current || {}).forEach(([convId, msgs]) => {
        const entry = map[convId] || {};
        if ((entry.muteUntil?.toMillis?.() || 0) > Date.now()) return;
        const lastReadMs = entry.lastReadAt?.toMillis?.() || 0;
        (msgs || []).forEach(msg => {
          const created = msg.createdAt?.toMillis?.() || 0;
          if (created > lastReadMs) {
            total++;
            if (msg.senderId) flattenedBySender[msg.senderId] = (flattenedBySender[msg.senderId] || 0) + 1;
          }
        });
      });
      setUnreadMessagesCount(total);
      setUnreadMessagesPerUser(flattenedBySender);
    });
    return () => unsub();
  }, [user]);

  // Clear caches on logout
  useEffect(() => {
    if (!user) {
      lastReadRef.current = {};
      messagesCacheRef.current = {};
      Object.values(conversationUnsubsRef.current || {}).forEach(unsub => unsub && unsub());
      conversationUnsubsRef.current = {};
      setUnreadMessagesCount(0);
      setUnreadMessagesPerUser({});
    }
  }, [user]);

  // Listen to conversations for unread per conversation (no global cap)
  useEffect(() => {
    if (!user || !db) return;
    // Clean up any existing listeners
    Object.values(conversationUnsubsRef.current || {}).forEach(unsub => unsub && unsub());
    conversationUnsubsRef.current = {};

    const convsUnsub = onSnapshot(
      query(
        collection(db, 'artifacts', getAppId(), 'public', 'data', 'conversations'),
        where('participantIds', 'array-contains', user.uid)
      ),
      (convSnap) => {
        const unsubs = {};
        convSnap.docs.forEach(convDoc => {
          const convId = convDoc.id;
          const msgsQ = query(
            collection(db, 'artifacts', getAppId(), 'public', 'data', 'messages'),
            where('conversationId', '==', convId),
            orderBy('createdAt', 'desc'),
            limit(200)
          );
          const unsubMsg = onSnapshot(msgsQ, snap => {
            const map = lastReadRef.current || {};
            const msgs = snap.docs.map(d => d.data());
            messagesCacheRef.current = { ...messagesCacheRef.current, [convId]: msgs };

            // Recompute aggregate unread across all conversations
            const flattened = {};
            let totalUnread = 0;
            Object.entries(messagesCacheRef.current || {}).forEach(([cid, list]) => {
              const meta = map[cid] || {};
              const mute = meta.muteUntil?.toMillis?.() || 0;
              if (mute > Date.now()) return;
              const lastRead = meta.lastReadAt?.toMillis?.() || 0;
              (list || []).forEach(msg => {
                const created = msg.createdAt?.toMillis?.() || 0;
                if (created > lastRead) {
                  totalUnread++;
                  if (msg.senderId) flattened[msg.senderId] = (flattened[msg.senderId] || 0) + 1;
                }
              });
            });
            setUnreadMessagesPerUser(flattened);
            setUnreadMessagesCount(totalUnread);
          });
          unsubs[convId] = unsubMsg;
        });
        conversationUnsubsRef.current = unsubs;
        // Remove caches for conversations that no longer exist
        const ids = new Set(convSnap.docs.map(d => d.id));
        Object.keys(messagesCacheRef.current || {}).forEach(cid => {
          if (!ids.has(cid)) {
            delete messagesCacheRef.current[cid];
          }
        });
      }
    );

    return () => {
      convsUnsub();
      Object.values(conversationUnsubsRef.current || {}).forEach(unsub => unsub && unsub());
      conversationUnsubsRef.current = {};
    };
  }, [user, lastReadMap]);

  // Fetch Accepted Jobs (for Unblur Logic)
  useEffect(() => {
    if (!user || !db) return;
    const q = query(
        collection(db, 'artifacts', getAppId(), 'public', 'data', 'jobs'), 
        where('clientUid', '==', user.uid),
        where('status', '==', 'Accepted')
    );
    const unsub = onSnapshot(q, (snapshot) => {
        const trustedIds = new Set();
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.tradieUid) trustedIds.add(data.tradieUid);
        });
        setAcceptedTradieIds(trustedIds);
    });
    return () => unsub();
  }, [user]);

  // Fetch Profile Picture Verification Requests (for blur detection)
  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, 'artifacts', getAppId(), 'public', 'data', 'profile_picture_requests'));
    const unsub = onSnapshot(q, (snapshot) => {
      const requests = [];
      snapshot.forEach(doc => {
        requests.push({ id: doc.id, ...doc.data() });
      });
      setProfilePictureRequests(requests);
    });
    return () => unsub();
  }, []);

  // Set Profile notification if email not verified
  useEffect(() => {
    if (user && !user.emailVerified) {
      setHasProfileNotification(true);
    } else {
      setHasProfileNotification(false);
    }
  }, [user]);

  // View Routing
  const renderView = () => {
    if (loading) return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-orange-50/20 to-slate-50 animate-fade-in">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-orange-500 shadow-lg"></div>
          <div className="absolute inset-0 animate-ping rounded-full h-16 w-16 border-2 border-orange-300 opacity-20"></div>
        </div>
      </div>
    );

    // Check if Firebase is configured
    if (!auth || !db) {
      return (
        <div className="h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="max-w-lg bg-white rounded-lg shadow-lg p-8 border-l-4 border-orange-500">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="text-orange-500" size={32} />
              <h2 className="text-2xl font-bold text-slate-900">Firebase Configuration Required</h2>
            </div>
            <div className="space-y-4 text-slate-700">
              <p>The app is running, but Firebase hasn't been configured yet.</p>
              <div className="bg-slate-50 p-4 rounded-md">
                <p className="font-semibold mb-2">To set up Firebase:</p>
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  <li>Go to <a href="https://console.firebase.google.com/" target="_blank" className="text-orange-600 hover:underline">Firebase Console</a></li>
                  <li>Create a new project (or use existing)</li>
                  <li>Enable <strong>Authentication</strong> â†’ Anonymous provider</li>
                  <li>Enable <strong>Firestore Database</strong> (test mode)</li>
                  <li>Copy your Firebase config to <code className="bg-slate-200 px-1 rounded">src/main.tsx</code></li>
                </ol>
              </div>
              <p className="text-sm text-slate-600">
                See <strong>LOCAL_SETUP.md</strong> in the repository for detailed instructions.
              </p>
            </div>
          </div>
        </div>
      );
    }

    switch (view) {
      case 'landing': return <LandingPage onLogin={() => setView('onboarding')} />;
      case 'onboarding': return <Onboarding user={user} onComplete={() => setView('feed')} />;
      case 'feed': return <Feed user={user} userProfile={userProfile} activeTab={activeTab} setActiveTab={setActiveTab} filter={feedFilter} clearFilter={() => setFeedFilter(null)} onMessage={(p) => { setSelectedProfile(p); setChatMode(true); setShowSocialModal(true); setChatBackView('feed'); }} onRequestJob={(p) => { setSelectedProfile(p); setView('requestJob'); }} acceptedTradieIds={acceptedTradieIds} onEnableLocation={updateLocation} showToast={showToast} profilePictureRequests={profilePictureRequests} unreadMessagesPerUser={unreadMessagesPerUser} onOpenPublicProfile={openPublicProfile} />;
      case 'postJobAdvert': return <PostJobAdvert user={user} onCancel={() => setView('feed')} onSuccess={() => { setView('jobs'); showToast("Advert Posted!", "success"); }} />;
      case 'messages': return <Feed user={user} userProfile={userProfile} activeTab={activeTab} setActiveTab={setActiveTab} filter={feedFilter} clearFilter={() => setFeedFilter(null)} onMessage={(p) => { setSelectedProfile(p); setChatBackView('feed'); setView('chat'); }} onRequestJob={(p) => { setSelectedProfile(p); setView('requestJob'); }} acceptedTradieIds={acceptedTradieIds} onEnableLocation={updateLocation} showToast={showToast} profilePictureRequests={profilePictureRequests} unreadMessagesPerUser={unreadMessagesPerUser} onOpenPublicProfile={openPublicProfile} />;
      case 'chat': return <ChatRoom user={user} userProfile={userProfile} partner={selectedProfile} onBack={() => setView(chatBackView)} />;
      case 'requestJob': return <JobRequestForm user={user} userProfile={userProfile} tradie={selectedProfile} onCancel={() => setView('feed')} onSuccess={() => { setView('jobs'); showToast("Request Sent!", "success"); }} />;
      case 'jobs': return <JobManager user={user} userProfile={userProfile} showToast={showToast} onPendingCountChange={(count) => { setHasJobsNotification(count > 0); }} />;
      case 'shop': return <Shop user={user} showToast={showToast} onCartChange={(count) => setHasShopNotification(count > 0)} />;
      case 'profile': return <UserProfile user={user} profile={userProfile} onLogout={async () => { 
        try {
          await auth.signOut();
          setView('landing');
          setUserProfile(null);
          showToast("Signed out successfully", "success");
        } catch (error) {
          console.error("Sign out error:", error);
          showToast("Failed to sign out", "error");
        }
      }} showToast={showToast} onEnableLocation={updateLocation} onNavigate={setView} profilePictureRequests={profilePictureRequests} />;
      case 'settings': return <SettingsScreen user={user} profile={userProfile} onBack={() => setView('profile')} showToast={showToast} />;
      case 'workCalendar': return <WorkCalendar user={user} profile={userProfile} onBack={() => setView('profile')} showToast={showToast} />;
      case 'paymentsCredits': return <PaymentsCredits user={user} profile={userProfile} onBack={() => setView('profile')} showToast={showToast} />;
      case 'safety': return <SafetyCentre user={user} onBack={() => setView('profile')} showToast={showToast} />;
      case 'admin': return <AdminPanel user={user} onBack={() => setView('profile')} showToast={showToast} />;
      default: return <Feed user={user} activeTab={activeTab} setActiveTab={setActiveTab} onOpenPublicProfile={openPublicProfile} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 max-w-md mx-auto shadow-2xl overflow-hidden relative border-x border-slate-200 flex flex-col">
      {/* Notifications */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      {/* Social Profile Modal - Opened from Messages tab */}
      {showSocialModal && selectedProfile && (
        <SocialProfileModal
          profile={selectedProfile}
          onClose={() => {
            setShowSocialModal(false);
            setSelectedProfile(null);
            setChatMode(false);
          }}
          onOpenPublicProfile={openPublicProfile}
          hideDistance={true}
          profilePictureRequests={profilePictureRequests}
          onWinkSent={(msg, type) => showToast(msg, type)}
         initialChatMode={chatMode}
        />
      )}
      
      {/* Messages Modal - Opened from header Messages button */}
      {showMessagesModal && (
        <MessagesModal
          user={user}
          onSelectProfile={(profile) => { 
            setShowMessagesModal(false);
            setSelectedProfile(profile); 
            setChatMode(false);
            setShowSocialModal(true); 
          }} 
          onSelectChat={(profile) => { 
            setShowMessagesModal(false);
            setSelectedProfile(profile); 
            setChatMode(true);
            setShowSocialModal(true);
          }} 
          onClose={() => setShowMessagesModal(false)} 
        />
      )}

      {/* Header - Fixed at top */}
      {view !== 'landing' && view !== 'onboarding' && (
        <header className="fixed top-0 left-0 right-0 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-4 z-50 flex justify-between items-center shadow-lg shadow-slate-900/50 h-16 max-w-md mx-auto">
          <div className="flex items-center gap-2 cursor-pointer group" onClick={() => setView('feed')}>
            <HardHat className="text-orange-500 fill-orange-500 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" size={24} />
            <h1 className="font-bold text-xl tracking-tight">
              <span className="bg-gradient-to-r from-white via-slate-100 to-white bg-clip-text text-transparent">Gay</span>
              <span className="bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600 bg-clip-text text-transparent font-extrabold">Tradies</span>
            </h1>
            <span className="relative ml-2 px-2 py-0.5 text-[10px] font-black uppercase tracking-tight rounded-full bg-orange-500/20 text-orange-200 border border-orange-400/60 shadow-sm shadow-orange-900/40 overflow-visible">
              Beta
              <span className="absolute -top-3 -right-2 w-4 h-4 rotate-12">
                <span className="absolute inset-0 bg-red-500 rounded-t-sm rounded-tr-lg [clip-path:polygon(0_100%,100%_100%,65%_0)] shadow-sm"></span>
                <span className="absolute -bottom-1 left-0 right-0 h-1.5 bg-white rounded-full shadow-sm"></span>
                <span className="absolute -bottom-1.5 -right-0.5 w-1.5 h-1.5 bg-white rounded-full shadow-sm"></span>
              </span>
            </span>
          </div>
          <div className="flex gap-3">
             {/* Admin shield only visible to admin user */}
             {user?.email === ADMIN_EMAIL && (
               <button onClick={() => setView('admin')} className="p-1 hover:bg-slate-700 rounded text-slate-400">
                 <ShieldCheck size={18} />
               </button>
             )}
             <button className="relative p-1 hover:bg-slate-700 rounded transition-colors" onClick={() => setShowMessagesModal(true)}>
               <MessageCircle size={24} />
               {unreadMessagesCount > 0 && (
                 <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                   <span className="text-white text-xs font-bold">{unreadMessagesCount > 9 ? '9+' : unreadMessagesCount}</span>
                 </div>
               )}
             </button>
          </div>
        </header>
      )}

      {/* Main Content - with padding for fixed header */}
      <main className="flex-1 overflow-y-auto pb-20 scrollbar-hide animate-fade-in" style={{ paddingTop: view !== 'landing' && view !== 'onboarding' ? '64px' : '0' }}>
        {view === 'publicProfile' && publicProfileUser ? (
          <PublicProfile
            username={publicProfileUser}
            onBack={() => {
              setPublicProfileUser(null);
              setView('feed');
            }}
          />
        ) : renderView()}
      </main>

      {/* Nav */}
      {view !== 'landing' && view !== 'onboarding' && view !== 'chat' && (
        <nav className="fixed bottom-0 w-full max-w-md bg-gradient-to-t from-white to-slate-50 border-t-2 border-slate-200 flex justify-around p-2 pb-5 z-40 text-xs font-medium text-slate-500 shadow-[0_-8px_15px_rgba(0,0,0,0.08)] backdrop-blur-lg">
          <NavButton 
            icon={Search} 
            label="Discover" 
            active={view === 'feed'} 
            onClick={() => { setView('feed'); setHasDiscoverNotification(false); }} 
            hasNotification={hasDiscoverNotification}
          />
          <NavButton 
            icon={Briefcase} 
            label="Jobs" 
            active={view === 'jobs'} 
            onClick={() => { setView('jobs'); setHasJobsNotification(false); }} 
            hasNotification={hasJobsNotification}
          />
          <NavButton 
            icon={ShoppingBag} 
            label="Shop" 
            active={view === 'shop'} 
            onClick={() => { setView('shop'); setHasShopNotification(false); }} 
            hasNotification={hasShopNotification}
          />
          <NavButton 
            icon={User} 
            label="Profile" 
            active={view === 'profile'} 
            onClick={() => { setPublicProfileUser(null); setView('profile'); setHasProfileNotification(false); }} 
            hasNotification={hasProfileNotification}
          />
        </nav>
      )}
    </div>
  );
}

// --- PUBLIC PROFILE PAGE ---
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const PublicProfile = ({ username, onBack }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!db || !username) return;
    const fetchProfile = async () => {
      try {
        const snap = await getDocs(query(
          collection(db, 'artifacts', getAppId(), 'public', 'data', 'profiles'),
          where('usernameLower', '==', username.toLowerCase()),
          limit(1)
        ));
        if (snap.empty) {
          setError('Profile not found.');
        } else {
          setProfile({ id: snap.docs[0].id, ...snap.docs[0].data() });
        }
      } catch (err) {
        console.error('Failed to load profile', err);
        setError('Unable to load profile right now.');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [username]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-500 text-sm font-semibold">Loading profile...</div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <p className="text-slate-600 font-semibold mb-4">{error || 'Profile not available.'}</p>
        <Button variant="secondary" onClick={onBack}>Back</Button>
      </div>
    );
  }

  const isTradie = profile.role === 'tradie';

  return (
    <div className="min-h-screen max-h-screen bg-gradient-to-b from-white via-slate-50 to-white text-slate-900 px-4 pt-4 overflow-hidden flex flex-col" style={{ overscrollBehavior: 'contain' }}>
      <div className="bg-white text-slate-900 rounded-3xl shadow-xl border border-slate-200 overflow-hidden pb-12 pt-8 flex flex-col flex-1">
        <div className="relative px-6 pt-6 pb-4">
          <div className="absolute inset-x-4 top-2 h-20 bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 opacity-10 blur-2xl rounded-3xl" />
          <div className="relative flex gap-4 items-center">
            <Avatar profile={profile} size="xl" className="w-20 h-20 shadow-lg border-4 border-white -mt-10 bg-white rounded-full" />
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-black text-slate-900">{profile.name || profile.username}</h1>
                {profile.email === ADMIN_EMAIL ? (
                  <span className="p-1.5 rounded-full bg-gradient-to-br from-purple-500 via-purple-600 to-purple-700 border border-white/60 shadow-lg shadow-purple-300/60">
                    <Shield size={16} className="text-white fill-white drop-shadow" />
                  </span>
                ) : (
                  profile.verified && <ShieldCheck size={18} className="text-blue-500 fill-blue-100" />
                )}
              </div>
              {profile.username && (
                <p className="text-xs font-bold text-orange-600 mt-1">@{profile.username}</p>
              )}
              <p className="text-sm text-slate-600 mt-1 capitalize">{profile.role || 'member'}{profile.location ? ' - ' + profile.location : ''}</p>
              {isTradie && profile.rate && (
                <p className="text-sm font-semibold text-slate-800 mt-1">GBP {profile.rate}/hr</p>
              )}
            </div>
          </div>
        </div>

        {profile.bio && (
          <div className="px-6 pt-2 pb-5">
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 shadow-inner">
              <h4 className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">About</h4>
              <p className="text-sm text-slate-700 leading-relaxed">{profile.bio}</p>
            </div>
          </div>
        )}

        <div className="px-6 pt-6 pb-6 mt-auto">
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" className="w-full flex items-center justify-center gap-2 shadow-md">
              <MessageCircle size={16} /> Send Message
            </Button>
            <Button variant="ghost" className="w-full flex items-center justify-center gap-2 border border-slate-200 shadow-sm">
              <ImageIcon size={16} /> Gallery
            </Button>
            {isTradie && (
              <>
                <Button variant="ghost" className="w-full flex items-center justify-center gap-2 border border-slate-200 shadow-sm">
                  <Star size={16} /> Reviews
                </Button>
                <Button variant="secondary" className="w-full flex items-center justify-center gap-2 shadow-md">
                  <HardHat size={16} /> Hire Me
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const NavButton = ({ icon: Icon, label, active, onClick, hasNotification }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center gap-1 transition-all duration-300 relative ${active ? 'text-orange-600 scale-110' : 'hover:text-slate-800 active:scale-95'}`}
  >
    <div className={`relative p-2 rounded-xl transition-all duration-300 ${active ? 'bg-gradient-to-br from-orange-100 to-orange-50 shadow-lg shadow-orange-200/50 animate-bounce-subtle' : 'hover:bg-slate-100'}`}>
      <Icon size={22} strokeWidth={active ? 2.5 : 2} className="transition-transform duration-300" />
      {hasNotification && (
        <span className="absolute -top-0.5 -right-0.5 bg-gradient-to-br from-red-500 to-red-600 rounded-full w-2.5 h-2.5 border-2 border-white shadow-lg animate-pulse"></span>
      )}
    </div>
    <span className={`${active ? 'font-bold' : ''} text-[10px] transition-all duration-200`}>{label}</span>
  </button>
);












