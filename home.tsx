/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import React, { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } from 'react';
import { Hammer, Heart, User, MessageCircle, MapPin, ShieldCheck, Star, CheckCircle, AlertCircle, X, HardHat, Send, Filter, Navigation, Ban, Lock, Shield, Info, MoreHorizontal, Image as ImageIcon } from 'lucide-react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification } from 'firebase/auth';
import { collection, doc, setDoc, getDoc, getDocs, onSnapshot, addDoc, updateDoc, serverTimestamp, query, orderBy , where, arrayUnion, Timestamp, limit } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

import { getAppId, auth, db, storage } from '../config/firebase';
import { TRADES, ADMIN_EMAIL } from '../constants';
import { getDistanceFromLatLonInKm, getCurrentTimeSlot, formatDateKey, getDefaultCoverPhoto, isCurrentlyUnavailable } from '../utils';
import { Button, Input, Badge, Avatar } from '../components/ui';
import { LazyImage, ProfileTileSkeleton } from '../components/shared';
import { detectWorkMessage, buildWorkWarning, sendModerationReport, updateDeliveryReceipts, updateReadReceipts, shouldBlockForWorkPolicy } from '../services/chatModeration';

const processImageToWebP = (file, { maxSizeBytes = 600 * 1024, maxWidth = 1280, thumbWidth = 320 } = {}) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = async () => {
                try {
                    const scale = Math.min(1, maxWidth / img.width);
                    const targetW = Math.round(img.width * scale);
                    const targetH = Math.round(img.height * scale);
                    const canvas = document.createElement('canvas');
                    canvas.width = targetW;
                    canvas.height = targetH;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, targetW, targetH);

                    let quality = 0.82;
                    let blob = await new Promise(res => canvas.toBlob(res, 'image/webp', quality));
                    while (blob && blob.size > maxSizeBytes && quality > 0.4) {
                        quality -= 0.08;
                        blob = await new Promise(res => canvas.toBlob(res, 'image/webp', quality));
                    }

                    const thumbScale = Math.min(1, thumbWidth / img.width);
                    const thumbW = Math.round(img.width * thumbScale);
                    const thumbH = Math.round(img.height * thumbScale);
                    const thumbCanvas = document.createElement('canvas');
                    thumbCanvas.width = thumbW;
                    thumbCanvas.height = thumbH;
                    const thumbCtx = thumbCanvas.getContext('2d');
                    thumbCtx.drawImage(img, 0, 0, thumbW, thumbH);
                    const thumbBlob = await new Promise(res => thumbCanvas.toBlob(res, 'image/webp', 0.7));

                    resolve({ blob, thumbBlob });
                } catch (err) {
                    reject(err);
                }
            };
            img.onerror = reject;
            img.src = reader.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};


const SOCIAL_GRID_BOTTOM_GAP = 104;
const SOCIAL_GRID_TOP_INSET = 6;

const ProfileTile = ({ profile, distanceKm, onOpenProfile, isCurrentUser, shouldBlur = false, hideDistance = false, profilePictureRequests = [], unreadCount = 0 }) => {
    const isTradie = profile.role === 'tradie';
    const isVerified = profile.verified;
    const placeholderColor = isTradie ? 'bg-slate-800' : 'bg-slate-400';
    const photoUrl = profile.primaryPhoto || profile.photo || `https://placehold.co/400x400/${placeholderColor.replace('bg-', '')}/ffffff?text=${(profile.name || profile.username || 'U').charAt(0)}`;

    // Check if this user's profile picture is pending review
    const isPending = profilePictureRequests && profilePictureRequests.some(req => 
        req.userId === profile?.uid && req.status === 'pending'
    );

    // Better distance display logic with privacy
    let distanceDisplay: string | null = null;
    if (isCurrentUser) {
        distanceDisplay = 'You';
    } else if (hideDistance && !isCurrentUser) {
        if (profile.location) {
            const parts = profile.location.split(',');
            distanceDisplay = parts[0].trim() || null;
        }
    } else if (distanceKm !== undefined && distanceKm < 9999) {
        if (distanceKm <= 0.1) {
            distanceDisplay = '<0.1 km';
        } else if (distanceKm < 1) {
            distanceDisplay = `${(distanceKm * 1000).toFixed(0)}m`;
        } else {
            distanceDisplay = `${distanceKm.toFixed(1)} km`;
        }
    }

    // Only blur if not viewing own profile or if pending
    const shouldApplyBlur = (shouldBlur && !isCurrentUser) || isPending;

    // Check if profile is admin - only check profile's email to show admin badge to all users
    const isAdmin = profile.email === ADMIN_EMAIL;
    
    // Determine border styling: purple for admin (priority), orange for unread messages, default otherwise
    const getBorderClasses = () => {
        // Admin border takes priority over everything
        if (isAdmin) {
            return 'border-purple-400 hover:border-purple-500 shadow-purple-300/50 hover:shadow-purple-400/60';
        }
        if (unreadCount > 0 && !isCurrentUser) {
            return 'border-orange-500 hover:border-orange-600 shadow-orange-300/50 hover:shadow-orange-400/60';
        }
        return 'border-slate-200 hover:border-orange-400';
    };
    
    return (
        <button
            onClick={() => onOpenProfile(profile)}
            className={`w-full aspect-square relative overflow-hidden rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-500 border-4 group transform hover:-translate-y-2 hover:scale-[1.02] active:scale-95 backdrop-blur-sm ${
                getBorderClasses()
            } ${isCurrentUser ? 'ring-4 ring-orange-500 ring-offset-4 ring-offset-orange-50' : ''}`}
        >
            <LazyImage
                src={photoUrl}
                alt={`${profile.name}'s profile`}
                className={`w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out ${shouldApplyBlur ? 'blur-md scale-110' : ''}`}
                onError={(e) => { e.target.onerror = null; e.target.src = photoUrl; }}
            />
            
            {/* Pending Review Indicator */}
            {isPending && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-orange-500 text-white text-[11px] font-bold px-3 py-1.5 rounded-full shadow-lg">
                        PENDING REVIEW
                    </div>
                </div>
            )}
            
            {/* Blur Indicator */}
            {shouldApplyBlur && !isPending && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-black/50 p-2 rounded-full text-white backdrop-blur-sm" title="Match to unblur">
                        <Lock size={20} />
                    </div>
                </div>
            )}
            
            {/* Unread Messages Count - Top Right (Smaller size with animation) */}
            {unreadCount > 0 && !isCurrentUser && (
                <div className="absolute top-2 right-2 z-10 w-6 h-6 bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 rounded-full flex items-center justify-center text-white text-[10px] font-extrabold shadow-xl border-2 border-white animate-bounce ring-2 ring-orange-300">
                    {unreadCount > 9 ? '9+' : unreadCount}
                </div>
            )}
            
            {/* Admin Badge - Top Left with Shield (Higher priority than busy badge) */}
            {isAdmin && (
                <div className="absolute top-2 left-2 z-20 bg-gradient-to-br from-purple-500 via-purple-600 to-purple-800 text-white p-2 rounded-full shadow-2xl border-2 border-white flex items-center justify-center animate-pulse ring-2 ring-purple-300" title="Platform Admin">
                    <Shield size={14} className="fill-white" />
                </div>
            )}
            
            {/* Busy/DND Badge for Unavailable Tradies (only show if not admin) */}
            {isTradie && !isAdmin && (() => {
                const currentlyUnavailable = isCurrentlyUnavailable(profile.workCalendar);
                if (currentlyUnavailable) {
                    return (
                        <div className="absolute top-1.5 left-1.5 z-10 bg-red-500 text-white p-1 rounded-full shadow-md border border-white" title="Currently Unavailable">
                            <Ban size={12} />
                        </div>
                    );
                }
                return null;
            })()}

            {/* Overlay for distance and name */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent flex flex-col justify-end p-3 group-hover:from-black/100 transition-all duration-500">
                <div className='flex items-end justify-between w-full transform group-hover:translate-y-0 transition-transform duration-300'>
                    <span className="text-white text-xs font-bold truncate text-left w-2/3 drop-shadow-2xl group-hover:text-orange-200 transition-colors duration-300">
                        {profile.name || profile.username}
                        {isCurrentUser && <span className='font-normal opacity-75 ml-1'>(You)</span>}
                    </span>
                <div className="flex items-center gap-1.5">
                    {/* Verified Tradie Badge - Inside distance field */}
                    {isTradie && isVerified && (
                        <div className="bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 rounded-full p-1 shadow-lg border-2 border-white flex items-center justify-center ring-1 ring-orange-300" title="Verified Tradie">
                            <HardHat className="w-3 h-3 text-white" />
                            </div>
                        )}
                        {distanceDisplay && (
                            <span className={`text-[9px] font-extrabold text-white px-2 py-1 rounded-full shadow-lg transition-all duration-300 max-w-[72px] text-center truncate ${isCurrentUser ? 'bg-gradient-to-r from-green-600 via-green-700 to-green-800' : 'bg-gradient-to-r from-orange-600 via-orange-700 to-orange-800'} group-hover:shadow-2xl group-hover:scale-110 border border-white/30`}>
                                {distanceDisplay}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </button>
    );
};

// --- SOCIAL PROFILE MODAL (FOR SOCIAL TAB ONLY) ---
const SocialProfileModal = ({ profile, distanceKm, onClose, hideDistance = false, profilePictureRequests = [], onWinkSent, initialChatMode = false, onAddActiveChat, onOpenPublicProfile }) => {
    const photoUrl = profile.primaryPhoto || profile.photo || `https://placehold.co/600x450/333333/ffffff?text=${(profile.name || 'User').charAt(0)}`;
    const [showBlockConfirm, setShowBlockConfirm] = useState(false);
    const [messageText, setMessageText] = useState('');
    const [sending, setSending] = useState(false);
    const [chatMode, setChatMode] = useState(initialChatMode);
    const [messages, setMessages] = useState([]);
    const [conversationMeta, setConversationMeta] = useState({ blocked: false, violations: 0 });
    const [otherReceipts, setOtherReceipts] = useState({ lastDeliveredAt: null, lastReadAt: null });
    const [showMenu, setShowMenu] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportType, setReportType] = useState('harassment');
    const [reportDetails, setReportDetails] = useState('');
    const [hasWinked, setHasWinked] = useState(profile?._winked || false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const scrollRef = useRef(null);
    const lastTapRef = useRef(0);
    const fileInputRef = useRef(null);
    const currentUser = auth?.currentUser;
    const conversationId = currentUser && profile?.uid ? [currentUser.uid, profile.uid].sort().join('_') : null;
    const receiptWriteRef = useRef({ delivered: 0, read: 0 });
    type ReceiptStamp = Timestamp | Date | { toMillis?: () => number };
    const writeReceipt = useCallback(
        async (type: 'delivered' | 'read', stamp: ReceiptStamp, stampMs?: number) => {
            if (!db || !conversationId || !currentUser || !stamp) return;
            const key = type === 'read' ? 'read' : 'delivered';
            const ms = stampMs || (stamp?.toMillis ? stamp.toMillis() : Date.now());
            if (ms && receiptWriteRef.current[key] && ms <= receiptWriteRef.current[key]) return;
            receiptWriteRef.current[key] = ms;
            const payload = { conversationId, uid: currentUser.uid, timestamp: stamp };
            if (type === 'read') {
                await updateReadReceipts(payload);
            } else {
                await updateDeliveryReceipts(payload);
            }
        },
        [conversationId, currentUser]
    );

    const handleReportSubmit = async () => {
        try {
            const recent = messages.slice(-10).map(m => ({
                text: m.text || '',
                imageUrl: m.imageUrl || '',
                senderId: m.senderId || '',
                createdAt: m.createdAt?.toMillis?.() || null
            }));
            await sendModerationReport({
                reporterUid: currentUser?.uid,
                reporterName: currentUser?.displayName || 'User',
                offenderUid: profile?.uid,
                offenderName: profile?.name || profile?.username || 'Unknown',
                conversationId,
                messageText: `${reportType}: ${reportDetails || 'No additional details'}`,
                senderId: currentUser?.uid,
                messages: recent,
                participants: [currentUser?.uid || '', profile?.uid || ''].filter(Boolean),
                type: reportType
            });
            setShowReportModal(false);
            setReportDetails('');
            setReportType('harassment');
            onWinkSent?.('Report sent to admin for review.', 'success');
        } catch (err) {
            console.error('Report failed', err);
            onWinkSent?.('Could not send report. Please try again.', 'error');
        }
    };

    // Check if this user's profile picture is pending review
    const isPending = profilePictureRequests && profilePictureRequests.some(req => 
        req.userId === profile?.uid && req.status === 'pending'
    );

    // Real-time message listener when in chat mode
    useEffect(() => {
        if (!chatMode || !db || !conversationId) return;
        
        const q = query(
            collection(db, 'artifacts', getAppId(), 'public', 'data', 'messages'),
            where('conversationId', '==', conversationId),
            orderBy('createdAt', 'asc')
        );
        
        const unsub = onSnapshot(q, (snap) => {
            const msgs = snap.docs.map(d => ({id: d.id, ...d.data(), _animate: true}));
            setMessages(msgs);
            setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 100);

            if (!snap.docs.length || !currentUser) return;
            const newest = snap.docs[snap.docs.length - 1].data()?.createdAt || serverTimestamp();
            const newestMs = snap.docs[snap.docs.length - 1].data()?.createdAt?.toMillis?.() || Date.now();
            writeReceipt('delivered', newest, newestMs);
            if (chatMode) {
                writeReceipt('read', newest, newestMs);
            }
        });
        
        return () => unsub();
    }, [chatMode, conversationId, currentUser, writeReceipt]);

    // Mark unread messages as read when chat is open
    useEffect(() => {
        if (chatMode && messages.length) {
            onAddActiveChat?.(profile?.uid);
            const latest = messages[messages.length - 1]?.createdAt || serverTimestamp();
            const latestMs = messages[messages.length - 1]?.createdAt?.toMillis?.() || Date.now();
            writeReceipt('read', latest, latestMs);
        }
    }, [chatMode, messages, writeReceipt]);

    // Listen for other participant receipts
    useEffect(() => {
        if (!chatMode || !db || !conversationId || !profile?.uid) return;
        const otherRef = doc(db, 'artifacts', getAppId(), 'public', 'data', 'conversations', conversationId, 'members', profile.uid);
        const unsub = onSnapshot(otherRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                setOtherReceipts({
                    lastDeliveredAt: data.lastDeliveredAt || null,
                    lastReadAt: data.lastReadAt || null
                });
            }
        });
        return () => unsub();
    }, [chatMode, conversationId, profile?.uid]);

    // Listen for conversation meta (blocked, violations)
    useEffect(() => {
        if (!chatMode || !db || !conversationId) return;
        const conversationRef = doc(db, 'artifacts', getAppId(), 'public', 'data', 'conversations', conversationId);
        const unsub = onSnapshot(conversationRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                setConversationMeta({
                    blocked: data.workPolicyBlocked === true,
                    violations: data.workPolicyViolations || 0
                });
            }
        });
        return () => unsub();
    }, [chatMode, conversationId]);

    const handleBlock = async () => {
        try {
            // Get current user from auth
            const currentUser = auth?.currentUser;
            if (!currentUser || !db) return;

            await addDoc(collection(db, 'artifacts', getAppId(), 'public', 'data', 'blocked_users'), {
                blockedBy: currentUser.uid,
                blockedUser: profile.uid,
                blockedUserName: profile.name || profile.username,
                blockedAt: serverTimestamp(),
                source: 'profile'
            });
            setShowBlockConfirm(false);
            onClose();
        } catch (error) {
            console.error("Error blocking user:", error);
        }
    };

    const handleSendMessage = async () => {
        if (!messageText.trim() || sending) return;
        if (conversationMeta.blocked) {
            alert('This chat is temporarily blocked due to work-policy violations.');
            return;
        }

        try {
            setSending(true);
            if (!currentUser || !db) return;

            onAddActiveChat?.(profile?.uid);

            // Get current user data
            const currentUserDoc = await getDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', currentUser.uid));
            const currentUserData = currentUserDoc.data();
            if (currentUserData?.chatSuspended) {
                alert('Your chat access is temporarily suspended by an admin.');
                return;
            }

            // Create conversation
            const conversationRef = doc(db, 'artifacts', getAppId(), 'public', 'data', 'conversations', conversationId);
            
            await setDoc(conversationRef, {
                participants: [currentUser.uid, profile.uid],
                participantIds: [currentUser.uid, profile.uid],
                participant1: {
                    uid: currentUser.uid,
                    name: currentUserData?.name || currentUserData?.username || 'User',
                    photo: currentUserData?.primaryPhoto || currentUserData?.photo || ''
                },
                participant2: {
                    uid: profile.uid,
                    name: profile.name || profile.username || 'User',
                    photo: profile.primaryPhoto || profile.photo || ''
                },
                lastMessage: messageText.trim(),
                lastMessageAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            }, { merge: true });

            const violation = detectWorkMessage(messageText.trim().toLowerCase());
            const nextViolations = (conversationMeta.violations || 0) + (violation ? 1 : 0);
            if (violation) {
                await setDoc(conversationRef, {
                    workPolicyViolations: nextViolations,
                    lastViolationAt: serverTimestamp()
                }, { merge: true });
                const warningText = buildWorkWarning(profile?.role === 'tradie');
                await addDoc(collection(db, 'artifacts', getAppId(), 'public', 'data', 'messages'), {
                    conversationId,
                    senderId: 'system',
                    recipientId: null,
                    text: warningText,
                    type: 'system',
                    createdAt: serverTimestamp(),
                    read: false
                });
                if (shouldBlockForWorkPolicy(nextViolations)) {
                    await setDoc(conversationRef, {
                        workPolicyBlocked: true,
                        blockedBy: 'system',
                        blockedReason: 'work_policy',
                        blockedAt: serverTimestamp()
                    }, { merge: true });
                    await sendModerationReport({
                        conversationId,
                        senderId: currentUser.uid,
                        participants: [currentUser.uid, profile.uid],
                        offenderUid: profile.uid,
                        offenderName: profile.name || profile.username || 'User',
                        reporterUid: currentUser.uid,
                        reporterName: currentUserData?.name || currentUserData?.username || 'User',
                        messageText: messageText.trim(),
                        type: 'work_policy'
                    });
                    await addDoc(collection(db, 'artifacts', getAppId(), 'public', 'data', 'messages'), {
                        conversationId,
                        senderId: 'system',
                        recipientId: null,
                        text: 'Chat temporarily blocked for work-policy violations. An admin has been notified.',
                        type: 'system',
                        createdAt: serverTimestamp(),
                        read: false
                    });
                    setSending(false);
                    return;
                }
            }

            // Send message
            await addDoc(collection(db, 'artifacts', getAppId(), 'public', 'data', 'messages'), {
                conversationId,
                senderId: currentUser.uid,
                senderName: currentUserData?.name || currentUserData?.username || 'User',
                senderPhoto: currentUserData?.primaryPhoto || currentUserData?.photo || '',
                recipientId: profile.uid,
                text: messageText.trim(),
                createdAt: serverTimestamp(),
                read: false,
                type: 'user'
            });

            // Send notification
            await addDoc(collection(db, 'artifacts', getAppId(), 'public', 'data', 'notifications'), {
                userId: profile.uid,
                type: 'message',
                from: currentUser.uid,
                fromName: currentUserData?.name || currentUserData?.username || 'Someone',
                fromPhoto: currentUserData?.primaryPhoto || currentUserData?.photo || '',
                message: messageText.trim(),
                read: false,
                createdAt: serverTimestamp()
            });

            setMessageText('');
            
            // Transition to chat mode if not already
            if (!chatMode) {
                setChatMode(true);
            }
        } catch (error) {
            console.error("Error sending message:", error);
            if (onWinkSent) onWinkSent('Failed to send message', 'error');
        } finally {
            setSending(false);
        }
    };

    useEffect(() => {
        setHasWinked(profile?._winked || false);
    }, [profile]);

    const handleSendWink = async () => {
        if (hasWinked) {
            if (onWinkSent) onWinkSent("You've already winked.", 'info');
            return;
        }
        try {
            const currentUser = auth?.currentUser;
            if (!currentUser || !db) return;

            // Get current user data
            const currentUserDoc = await getDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', currentUser.uid));
            const currentUserData = currentUserDoc.data();

            // Send wink notification
            await addDoc(collection(db, 'artifacts', getAppId(), 'public', 'data', 'notifications'), {
                userId: profile.uid,
                recipientId: profile.uid,
                type: 'wink',
                from: currentUser.uid,
                senderId: currentUser.uid,
                fromName: currentUserData?.name || currentUserData?.username || 'Someone',
                fromPhoto: currentUserData?.primaryPhoto || currentUserData?.photo || '',
                read: false,
                createdAt: serverTimestamp(),
                timestamp: serverTimestamp()
            });

            if (onWinkSent) onWinkSent('Wink sent! 😉', 'success');
            setHasWinked(true);
        } catch (error) {
            console.error("Error sending wink:", error);
            if (onWinkSent) onWinkSent('Failed to send wink', 'error');
        }
    };

    const handleChooseImage = () => {
        if (!fileInputRef.current || uploadingImage) return;
        fileInputRef.current.click();
    };

    const handleImageSelected = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !conversationId || !storage || uploadingImage) return;
        try {
            setUploadingImage(true);
            const currentUserDoc = await getDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', currentUser.uid));
            const currentUserData = currentUserDoc.data();
            const { blob, thumbBlob } = await processImageToWebP(file, { maxSizeBytes: 600 * 1024, maxWidth: 1280, thumbWidth: 320 });
            const basePath = `artifacts/${getAppId()}/messages/${conversationId}/${Date.now()}`;
            const refFull = storageRef(storage, `${basePath}_full.webp`);
            const refThumb = storageRef(storage, `${basePath}_thumb.webp`);
            const metadata = { contentType: 'image/webp', cacheControl: 'public,max-age=31536000' };
            await uploadBytes(refFull, blob, metadata);
            await uploadBytes(refThumb, thumbBlob, metadata);
            const [url, thumbUrl] = await Promise.all([getDownloadURL(refFull), getDownloadURL(refThumb)]);

            const conversationRef = doc(db, 'artifacts', getAppId(), 'public', 'data', 'conversations', conversationId);
            await setDoc(conversationRef, {
                participants: [currentUser.uid, profile.uid],
                participantIds: [currentUser.uid, profile.uid],
                lastMessage: 'Photo',
                lastMessageAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            }, { merge: true });

            await addDoc(collection(db, 'artifacts', getAppId(), 'public', 'data', 'messages'), {
                conversationId,
                senderId: currentUser.uid,
                senderName: currentUserData?.name || currentUserData?.username || currentUser?.displayName || 'User',
                senderPhoto: currentUserData?.primaryPhoto || currentUserData?.photo || '',
                recipientId: profile.uid,
                text: '',
                imageUrl: url,
                thumbUrl,
                type: 'image',
                createdAt: serverTimestamp(),
                read: false
            });

            await addDoc(collection(db, 'artifacts', getAppId(), 'public', 'data', 'notifications'), {
                userId: profile.uid,
                type: 'message',
                from: currentUser.uid,
                fromName: currentUserData?.name || currentUserData?.username || currentUser?.displayName || 'Someone',
                fromPhoto: currentUserData?.primaryPhoto || currentUserData?.photo || '',
                message: 'Photo',
                read: false,
                createdAt: serverTimestamp()
            });
        } catch (err) {
            console.error('Image send failed', err);
            if (onWinkSent) onWinkSent('Failed to send image', 'error');
        } finally {
            setUploadingImage(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // Display distance with privacy - safely handle location format
    let locationDisplay = profile.location || 'Near you';
    if (hideDistance && distanceKm !== undefined && distanceKm < 9999) {
        // Show region only - safely parse location
        if (profile.location) {
            const parts = profile.location.split(',');
            locationDisplay = parts[0].trim() || 'Near you';
        } else {
            locationDisplay = 'Near you';
        }
    } else if (distanceKm !== undefined && distanceKm < 9999) {
        locationDisplay = `${distanceKm.toFixed(1)} km away`;
    }

    // Only blur photos if not viewing own profile or if pending
    const shouldBlurPhoto = (profile.blurPhotos && auth?.currentUser?.uid !== profile.uid) || isPending;

    return (
        <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center animate-fade-in p-4"
            onClick={(e) => {
                // Close if clicking the backdrop
                if (e.target === e.currentTarget) {
                    onClose();
                }
            }}
        >
            <div className="bg-white w-full max-w-sm h-[70vh] rounded-3xl overflow-hidden shadow-2xl border-2 border-slate-200 relative flex flex-col animate-scale-in">
                
                {!chatMode ? (
                    // PROFILE VIEW - Full screen image with overlays
                    <>
                        {/* Full Screen Background Image */}
                        <div className="absolute inset-0">
                            <LazyImage
                                src={photoUrl}
                                alt="Profile"
                                className={`w-full h-full object-cover transition-transform duration-700 ${shouldBlurPhoto ? 'blur-md scale-110' : ''}`}
                            />
                            {/* Dark gradient overlay for readability */}
                            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/80"></div>
                        </div>

                        {/* Close Button */}
                        <button onClick={onClose} className="absolute top-4 right-4 z-20 bg-white/25 hover:bg-white/35 text-white p-3 rounded-2xl backdrop-blur-lg transition-all duration-300 shadow-xl hover:shadow-2xl active:scale-90 border border-white/30">
                            <X className="w-6 h-6" strokeWidth={2.5} />
                        </button>

                        {/* Block Button */}
                        <button
                            onClick={() => setShowBlockConfirm(true)}
                            className="absolute top-4 left-4 z-20 bg-white/25 hover:bg-white/35 text-white p-3 rounded-2xl backdrop-blur-lg transition-all duration-300 shadow-xl hover:shadow-2xl active:scale-90 border border-white/30"
                            title="Block user"
                        >
                            <Ban className="w-6 h-6" strokeWidth={2.5} />
                        </button>

                        {/* Pending/Lock Overlays */}
                        {isPending && (
                            <div className="absolute inset-0 flex items-center justify-center z-10 backdrop-blur-sm">
                                <div className="bg-gradient-to-r from-orange-500 via-orange-600 to-orange-700 text-white text-sm font-extrabold px-6 py-3 rounded-2xl shadow-2xl border-2 border-white/30 animate-pulse">
                                    PENDING REVIEW
                                </div>
                            </div>
                        )}
                        {shouldBlurPhoto && !isPending && (
                            <div className="absolute inset-0 flex items-center justify-center z-10 backdrop-blur-sm">
                                <div className="bg-black/60 p-4 rounded-2xl text-white backdrop-blur-md border-2 border-white/20 shadow-2xl">
                                    <Lock size={40} strokeWidth={2.5} />
                                </div>
                            </div>
                        )}

                        {/* Content Overlay - Scrollable */}
                        <div className="absolute inset-0 flex flex-col z-10">
                            {/* Top Section - Name and Location */}
                            <div className="p-6 pt-20">
                                <h3 className="text-4xl font-extrabold text-white leading-tight mb-3 drop-shadow-2xl flex items-center gap-2">
                                    <span>{profile.name || profile.username}{profile.hideAge ? '' : `, ${profile.age}`}</span>
                                    {profile.email === ADMIN_EMAIL ? (
                                        <span className="p-2 rounded-full bg-gradient-to-br from-purple-500 via-purple-600 to-purple-700 border-2 border-white/50 shadow-2xl animate-pulse">
                                            <Shield size={18} className="text-white fill-white drop-shadow-lg" />
                                        </span>
                                    ) : (
                                        profile.verified && <ShieldCheck size={24} className="text-blue-400 fill-white drop-shadow-2xl" />
                                    )}
                                </h3>
                                {profile.username && (
                                    <p className="text-sm font-bold text-orange-100 drop-shadow-xl mb-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (!profile.username) return;
                                                if (onOpenPublicProfile) {
                                                    onOpenPublicProfile(profile.username);
                                                } else {
                                                    window.dispatchEvent(new CustomEvent('open-public-profile', { detail: { username: profile.username } }));
                                                }
                                            }}
                                            className="px-3 py-1.5 bg-white/20 rounded-full border-2 border-white/30 backdrop-blur-md shadow-lg hover:bg-white/30 transition-all duration-300 hover:scale-105"
                                        >
                                            @{profile.username}
                                        </button>
                                    </p>
                                )}
                                <p className="text-base text-white/95 flex items-center font-semibold drop-shadow-lg">
                                    <MapPin className="w-5 h-5 mr-2 text-orange-400 drop-shadow" strokeWidth={2.5} />
                                    {locationDisplay}
                                </p>
                            </div>

                            {/* Middle Section - Scrollable Content */}
                            <div className="flex-1 overflow-y-auto px-6 pb-4">
                                {/* Badges */}
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {profile.sexuality && (
                                        <span className="bg-white/25 backdrop-blur-md text-white px-4 py-2 rounded-2xl text-xs font-extrabold border-2 border-white/40 shadow-xl">
                                            {profile.sexuality}
                                        </span>
                                    )}
                                    {profile.lookingFor && (
                                        <span className="bg-gradient-to-r from-green-500 to-green-600 backdrop-blur-md text-white px-4 py-2 rounded-2xl text-xs font-extrabold border-2 border-white/40 shadow-xl">
                                            Looking for: {profile.lookingFor}
                                        </span>
                                    )}
                                </div>

                                {/* Bio */}
                                {profile.bio && (
                                    <div className="bg-black/40 backdrop-blur-xl p-5 rounded-2xl mb-4 border-2 border-white/20 shadow-2xl">
                                        <h4 className="text-xs font-extrabold text-white/90 uppercase tracking-wider mb-3 flex items-center gap-2">
                                            <User size={14} className="text-orange-400" />
                                            About
                                        </h4>
                                        <p className="text-white text-sm leading-relaxed">{profile.bio}</p>
                                    </div>
                                )}
                            </div>

                            {/* Message Input - Enhanced */}
                            <div className="p-5 border-t-2 border-white/20 bg-gradient-to-t from-black/50 via-black/30 to-transparent backdrop-blur-xl">
                                <div className="flex gap-3 items-center">
                                    <input
                                        type="text"
                                        value={messageText}
                                        onChange={(e) => setMessageText(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                        placeholder="Type a message..."
                                        className="flex-1 px-5 py-3.5 border-2 border-white/30 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-orange-500/50 focus:border-orange-400 shadow-xl hover:border-white/50 transition-all backdrop-blur-xl bg-white/95 font-medium"
                                        disabled={sending}
                                    />
                                    <button
                                        onClick={handleSendWink}
                                        className="h-14 w-14 text-3xl rounded-2xl bg-white/95 border-2 border-yellow-300 shadow-xl hover:shadow-2xl hover:-translate-y-1 active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center backdrop-blur-xl hover:border-yellow-400"
                                        disabled={sending || hasWinked}
                                        title="Send Wink"
                                    >
                                        😉
                                    </button>
                                    <button
                                        onClick={handleSendMessage}
                                        disabled={!messageText.trim() || sending}
                                        className="p-4 bg-gradient-to-r from-orange-500 via-orange-600 to-orange-700 hover:from-orange-600 hover:via-orange-700 hover:to-orange-800 disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed text-white rounded-2xl transition-all shadow-2xl hover:shadow-orange-500/50 disabled:shadow-none flex-shrink-0 hover:scale-110 active:scale-95 border-2 border-white/20"
                                    >
                                    <Send size={22} strokeWidth={2.5} />
                                </button>
                            </div>
                            </div>
                        </div>

                        {/* Block Confirmation Modal */}
                        {showBlockConfirm && (
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                                <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border-2 border-slate-200">
                                    <h3 className="text-xl font-extrabold text-slate-900 mb-3">Block User?</h3>
                                    <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                                        You won't see this profile anymore and they won't be able to contact you.
                                    </p>
                                    <div className="flex gap-3">
                                        <Button variant="ghost" className="flex-1" onClick={() => setShowBlockConfirm(false)}>
                                            Cancel
                                        </Button>
                                        <Button variant="danger" className="flex-1" onClick={handleBlock}>
                                            Block
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    // CHAT VIEW
                    <>
                        {/* Chat Header */}
                        <div className="p-4 border-b border-slate-200 flex items-center gap-3 bg-white shadow-sm">
                            <button
                                onClick={() => setChatMode(false)}
                                className="flex items-center gap-2"
                                title="View profile"
                            >
                                <div className="flex-shrink-0">
                                    {photoUrl ? (
                                        <img 
                                            src={photoUrl} 
                                            alt={profile.name || profile.username} 
                                            className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-md"
                                        />
                                    ) : (
                                        <div className="w-10 h-10 flex items-center justify-center bg-gradient-to-br from-orange-400 to-orange-600 rounded-full border-2 border-white shadow-md">
                                            <User size={20} className="text-white"/>
                                        </div>
                                    )}
                                </div>
                                <span className="font-bold text-lg text-slate-900 truncate">{profile.name || profile.username || 'User'}</span>
                            </button>
                            <div className="ml-auto flex items-center gap-1">
                                <div className="relative">
                                    <button
                                        onClick={() => setShowBlockConfirm(false) || setShowMenu(prev => !prev)}
                                        className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                                        title="More"
                                    >
                                        <MoreHorizontal size={20} className="text-slate-600" />
                                    </button>
                                    {showMenu && (
                                        <div className="absolute right-0 mt-2 w-44 bg-white border border-slate-200 rounded-xl shadow-xl z-20 overflow-hidden">
                                            <div className="px-3 py-2 text-[10px] uppercase tracking-wide text-slate-500 bg-slate-50 border-b border-slate-200">
                                                Quick actions
                                            </div>
                                            <button
                                                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 border-b border-slate-100"
                                                onClick={() => { setShowMenu(false); setChatMode(false); }}
                                            >
                                                <User size={14} className="text-slate-600" /> Profile
                                            </button>
                                            <button
                                                className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 flex items-center gap-2 border-b border-slate-100"
                                                onClick={() => { setShowMenu(false); setShowBlockConfirm(true); }}
                                            >
                                                <Ban size={14} className="text-red-500" /> Block
                                            </button>
                                            <button
                                                className="w-full text-left px-3 py-2 text-sm hover:bg-amber-50 flex items-center gap-2 border-b border-slate-100"
                                                onClick={() => { setShowMenu(false); setShowReportModal(true); }}
                                            >
                                                <AlertCircle size={14} className="text-amber-500" /> Report
                                            </button>
                                            {profile.role === 'tradie' && (
                                                <button
                                                    className="w-full text-left px-3 py-2 text-sm hover:bg-green-50 flex items-center gap-2"
                                                    onClick={() => { setShowMenu(false); alert('Hire flow coming soon'); }}
                                                >
                                                    <HardHat size={14} className="text-green-600" /> Hire
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                                    title="Close"
                                >
                                    <X size={20} className="text-slate-600" />
                                </button>
                            </div>
            </div>

            {/* Report Modal */}
            {showReportModal && (
                <div className="fixed inset-0 bg-black/80 z-[120] flex items-end sm:items-center justify-center p-4">
                    <div className="bg-white w-full sm:w-[380px] sm:rounded-2xl rounded-t-2xl overflow-hidden shadow-2xl">
                        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-amber-50">
                            <h3 className="text-lg font-bold text-amber-900">Submit Report</h3>
                            <button onClick={() => setShowReportModal(false)} className="p-1 hover:bg-amber-100 rounded-full">
                                <X className="w-5 h-5 text-slate-600" />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            <p className="text-sm text-slate-600">
                                We’ll review the last 10 messages and your notes. Reports are confidential and reviewed by admin.
                            </p>
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-slate-700">Report Type</label>
                                <select
                                    value={reportType}
                                    onChange={(e) => setReportType(e.target.value)}
                                    className="w-full p-3 border border-slate-300 rounded-lg text-sm"
                                >
                                    <option value="harassment">Harassment</option>
                                    <option value="scam">Scam/Fraud</option>
                                    <option value="safety">Safety Concern</option>
                                    <option value="spam">Spam</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-slate-700">Details</label>
                                <textarea
                                    value={reportDetails}
                                    onChange={(e) => setReportDetails(e.target.value)}
                                    rows={4}
                                    placeholder="Describe what happened..."
                                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none text-sm"
                                />
                            </div>
                            <div className="flex gap-2">
                                <Button variant="ghost" className="flex-1" onClick={() => setShowReportModal(false)}>
                                    Cancel
                                </Button>
                                <Button variant="danger" className="flex-1" onClick={handleReportSubmit}>
                                    Submit Report
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-gradient-to-b from-slate-50 via-white to-slate-50">
                            {messages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center py-16">
                                    <div className="bg-gradient-to-br from-slate-100 to-slate-200 rounded-full p-6 mb-5 shadow-xl">
                                        <MessageCircle className="w-20 h-20 text-slate-400" strokeWidth={2} />
                                    </div>
                                    <p className="text-slate-600 text-base font-semibold">Start your conversation!</p>
                                    <p className="text-slate-400 text-sm mt-2">Send a message to connect</p>
                                </div>
                            ) : (
                                messages.map((msg) => {
                                    const isMe = msg.senderId === currentUser?.uid;
                                    const likes = msg.likes || [];
                                    const hasLiked = currentUser ? likes.includes(currentUser.uid) : false;

                                    const handleLike = async () => {
                                        if (!db || !msg?.id || !currentUser || hasLiked) return;
                                        try {
                                            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'messages', msg.id), {
                                                likes: arrayUnion(currentUser.uid)
                                            });
                                            setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, likes: Array.from(new Set([...(m.likes || []), currentUser.uid])) } : m));
                                        } catch (err) {
                                            console.error('Failed to like message', err);
                                        }
                                    };

                                    const handleTap = () => {
                                        const now = Date.now();
                                        if (now - lastTapRef.current < 300) {
                                            handleLike();
                                        }
                                        lastTapRef.current = now;
                                    };

                                    return (
                                        <div
                                            key={msg.id}
                                            className={`flex items-end gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'} ${msg._animate ? 'animate-popIn' : ''}`}
                                            onDoubleClick={handleLike}
                                            onTouchEnd={handleTap}
                                        >
                                            {!isMe && (
                                                <div className="flex-shrink-0">
                                                    {msg.senderPhoto || profile.primaryPhoto || profile.photo ? (
                                                        <img 
                                                            src={msg.senderPhoto || profile.primaryPhoto || profile.photo} 
                                                            alt={msg.senderName || profile.name || profile.username} 
                                                            className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-lg ring-2 ring-slate-200"
                                                        />
                                                    ) : (
                                                        <div className="w-10 h-10 flex items-center justify-center bg-gradient-to-br from-orange-400 via-orange-500 to-orange-600 rounded-full border-2 border-white shadow-lg ring-2 ring-slate-200">
                                                            <User size={16} className="text-white" strokeWidth={2.5} />
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                            <div className={`max-w-[75%] ${isMe ? '' : ''}`}>
                                <div className="space-y-2">
                                <div className={`px-5 py-3 rounded-2xl shadow-lg ${
                                    isMe 
                                        ? 'bg-gradient-to-r from-orange-500 via-orange-600 to-orange-700 text-white border-2 border-white/20' 
                                        : 'bg-white text-slate-800 border-2 border-slate-200'
                                }`}>
                                    {msg.imageUrl ? (
                                        <div onClick={() => window.open(msg.imageUrl, '_blank')} className="cursor-zoom-in">
                                            <LazyImage src={msg.thumbUrl || msg.imageUrl} alt="Sent image" className="max-h-64 rounded-xl shadow-md" />
                                        </div>
                                    ) : (
                                        <p className="text-sm break-words leading-relaxed font-medium">{msg.text}</p>
                                    )}
                                </div>
                                    {likes.length > 0 && (
                                        <div className={`flex items-center gap-1 text-xs font-bold mt-1 ${isMe ? 'justify-end' : ''}`}>
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-red-50 to-orange-50 text-orange-700 border-2 border-orange-200 shadow-md">
                                                ❤️ {likes.length}
                                            </span>
                                        </div>
                                    )}
                                    {isMe && (
                                        <div className="flex items-center justify-end gap-1.5 text-[10px] mt-1 text-slate-500 font-semibold">
                                            {(() => {
                                                const createdMs = msg.createdAt?.toMillis?.() || 0;
                                                const deliveredMs = otherReceipts?.lastDeliveredAt?.toMillis?.();
                                                const readMs = otherReceipts?.lastReadAt?.toMillis?.();
                                                const status = readMs && readMs >= createdMs
                                                    ? 'Read'
                                                    : deliveredMs && deliveredMs >= createdMs
                                                        ? 'Delivered'
                                                        : 'Sent';
                                                return (
                                                    <>
                                                        <CheckCircle size={12} className="text-slate-400" strokeWidth={2.5} />
                                                        <span>{status}</span>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })
            )}
                            <div ref={scrollRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-5 border-t-2 border-slate-200 bg-gradient-to-t from-slate-50 via-white to-white shadow-lg">
                            <div className="flex gap-3 items-center">
                                <input
                                    type="text"
                                    value={messageText}
                                    onChange={(e) => setMessageText(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                    placeholder="Type a message..."
                                    className="flex-1 px-5 py-3.5 border-2 border-slate-300 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-orange-500/30 focus:border-orange-500 shadow-lg hover:border-slate-400 transition-all font-medium"
                                    disabled={sending}
                                />
                                <input
                                    type="file"
                                    accept="image/*"
                                    ref={fileInputRef}
                                    className="hidden"
                                    onChange={handleImageSelected}
                                />
                                <button
                                    onClick={handleChooseImage}
                                    className="p-3.5 bg-gradient-to-br from-slate-100 to-slate-200 text-slate-700 rounded-2xl hover:from-slate-200 hover:to-slate-300 active:scale-95 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 border-2 border-slate-300"
                                    title="Send image"
                                    disabled={uploadingImage}
                                >
                                    <ImageIcon size={22} strokeWidth={2.5} />
                                </button>
                                <button
                                    onClick={handleSendMessage}
                                    disabled={!messageText.trim() || sending}
                                    className="p-4 bg-gradient-to-r from-orange-500 via-orange-600 to-orange-700 hover:from-orange-600 hover:via-orange-700 hover:to-orange-800 disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed text-white rounded-2xl transition-all shadow-2xl hover:shadow-orange-500/50 disabled:shadow-none hover:scale-110 active:scale-95 border-2 border-white/20"
                                >
                                    <Send size={22} strokeWidth={2.5} />
                                </button>
                            </div>
                        </div>

                        {/* Block Confirmation Modal */}
                        {showBlockConfirm && (
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                                <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border-2 border-slate-200">
                                    <h3 className="text-xl font-extrabold text-slate-900 mb-3">Block User?</h3>
                                    <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                                        You won't see this profile anymore and they won't be able to contact you.
                                    </p>
                                    <div className="flex gap-3">
                                        <Button variant="ghost" className="flex-1" onClick={() => setShowBlockConfirm(false)}>
                                            Cancel
                                        </Button>
                                        <Button variant="danger" className="flex-1" onClick={handleBlock}>
                                            Block
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

// --- TOAST NOTIFICATION COMPONENT ---
const Toast = ({ message, type, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 3200);
        return () => clearTimeout(timer);
    }, [onClose]);

    const palette =
        type === 'error'
            ? 'from-orange-600 via-orange-700 to-orange-800 border-orange-200/60'
            : 'from-orange-500 via-orange-600 to-orange-700 border-orange-200/60';

    const Icon = type === 'error' ? AlertCircle : type === 'success' ? CheckCircle : Info;

    return (
        <div className="fixed inset-x-0 top-3 flex justify-center z-[150] pointer-events-none">
            <div className={`pointer-events-auto relative flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl border text-white bg-gradient-to-r ${palette} backdrop-blur-md animate-slide-up`}>
                <div className="absolute inset-0 opacity-30 blur-xl bg-white/10 rounded-2xl animate-pulse-slow" />
                <Icon size={18} className="relative drop-shadow" />
                <div className="relative flex flex-col">
                    <span className="font-bold text-sm leading-tight">{message}</span>
                    {/* label removed per request */}
                </div>
                <button
                    onClick={onClose}
                    className="relative ml-1 rounded-full bg-white/15 hover:bg-white/25 text-white/90 p-1 transition"
                >
                    <X size={14} />
                </button>
                <div className="absolute bottom-0 left-0 h-1 w-full overflow-hidden rounded-b-2xl">
                    <div className="h-full bg-white/70 animate-[toast-bar_3.2s_linear_forwards]" />
                </div>
            </div>
        </div>
    );
};


// --- VIEW COMPONENTS ---

const LandingPage = ({ onLogin }) => {
  const [isSignUp, setIsSignUp] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [userType, setUserType] = useState('admirer');
  const [isOver18, setIsOver18] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [verificationNoticeEmail, setVerificationNoticeEmail] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [noticeLoading, setNoticeLoading] = useState(false);
  const openForgotPassword = () => {
    setSuccessMessage('');
    setResetEmail(email);
    setError('');
    setShowForgotPassword(true);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const incomingEmail = params.get('prefillEmail');
    const storedEmail = localStorage.getItem('gt_prefill_email');
    const emailToUse = incomingEmail || storedEmail || '';
    if (emailToUse) {
      setEmail(emailToUse);
    }

    const shouldShowNotice = params.get('verifyNotice') === '1' || localStorage.getItem('gt_verify_notice') === '1';
    if (shouldShowNotice && emailToUse) {
      setVerificationNoticeEmail(emailToUse);
      localStorage.removeItem('gt_verify_notice');
    }
  }, []);

  const getPasswordStrength = (pwd) => {
    if (!pwd) return { strength: 0, label: '', color: '' };
    let strength = 0;
    if (pwd.length >= 8) strength++;
    if (pwd.length >= 12) strength++;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) strength++;
    if (/\d/.test(pwd)) strength++;
    if (/[^A-Za-z0-9]/.test(pwd)) strength++;
    
    if (strength <= 2) return { strength, label: 'Weak', color: 'bg-red-500' };
    if (strength <= 3) return { strength, label: 'Fair', color: 'bg-yellow-500' };
    if (strength <= 4) return { strength, label: 'Good', color: 'bg-blue-500' };
    return { strength, label: 'Strong', color: 'bg-green-500' };
  };

  const handleSignUp = async () => {
    setError('');
    setSuccessMessage('');
    
    if (!email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    
    if (!isOver18) {
      setError('You must be 18+ to use this service');
      return;
    }
    
    if (!acceptTerms) {
      setError('You must accept Terms & Privacy Policy');
      return;
    }
    
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Send email verification
      await sendEmailVerification(userCredential.user);
      localStorage.setItem('gt_prefill_email', email);
      localStorage.setItem('gt_verify_notice', '1');
      setVerificationNoticeEmail(email);
      
      // Store user type for onboarding
      localStorage.setItem('pendingUserType', userType);
      
      onLogin();
    } catch (err) {
      console.error('Sign up error:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('Email already in use. Try logging in instead.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Invalid email address');
      } else if (err.code === 'auth/weak-password') {
        setError('Password is too weak');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    setError('');
    setSuccessMessage('');
    
    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }
    
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged will handle navigation
    } catch (err) {
      console.error('Login error:', err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        setError('Invalid email or password');
      } else if (err.code === 'auth/invalid-email') {
        setError('Invalid email address');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError('');
    setSuccessMessage('');
    
    if (!resetEmail) {
      setError('Please enter your email address');
      return;
    }
    
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setSuccessMessage('Password reset email sent! Check your inbox.');
      setResetEmail('');
    } catch (err) {
      console.error('Password reset error:', err);
      if (err.code === 'auth/user-not-found') {
        setError('No account found with this email');
      } else if (err.code === 'auth/invalid-email') {
        setError('Invalid email address');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = getPasswordStrength(password);

  const handleResendVerification = async () => {
    setError('');
    setSuccessMessage('');
    if (!auth?.currentUser) {
      setError('Log in to resend verification email.');
      return;
    }
    setNoticeLoading(true);
    try {
      await sendEmailVerification(auth.currentUser);
      setVerificationNoticeEmail(auth.currentUser.email || verificationNoticeEmail);
      setSuccessMessage('Verification email resent. Check your inbox.');
    } catch (err) {
      console.error('Resend verification error:', err);
      setError(err.message || 'Failed to resend verification email');
    } finally {
      setNoticeLoading(false);
    }
  };

  if (showForgotPassword) {
    return (
      <div className="h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-slate-800 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-2xl font-bold mb-2">Reset Password</h2>
          <p className="text-slate-400 text-sm mb-6">Enter your email to receive a password reset link.</p>
          
          <Input
            label="Email"
            type="email"
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
            placeholder="your@email.com"
          />
          
          {successMessage && <p className="text-green-300 text-sm mt-2">{successMessage}</p>}
          {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
          
          <div className="flex gap-2 mt-6">
            <Button 
              variant="ghost" 
              className="flex-1" 
              onClick={() => { setShowForgotPassword(false); setError(''); setSuccessMessage(''); }}
            >
              Back
            </Button>
            <Button 
              variant="secondary" 
              className="flex-1" 
              onClick={handleForgotPassword}
              disabled={loading}
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col items-center p-6 relative overflow-y-auto">
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #f97316 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
      <div className="absolute inset-0 bg-gradient-to-tr from-orange-500/5 via-transparent to-purple-500/5 animate-pulse"></div>
      
      <div className="z-10 w-full max-w-md py-8">
        {/* Logo */}
        <div className="flex flex-col items-center mb-6 animate-fade-in">
          <div className="bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 p-4 rounded-3xl mb-4 shadow-[0_0_60px_rgba(249,115,22,0.8)] animate-pulse-slow hover:scale-110 transition-transform duration-500 ring-4 ring-orange-400/30">
            <HardHat size={48} className="text-white fill-white animate-bounce-subtle" />
          </div>
          <h1 className="text-5xl font-extrabold mb-3 tracking-tight drop-shadow-2xl">
            <span className="bg-gradient-to-r from-white via-slate-100 to-white bg-clip-text text-transparent">Gay</span>
            <span className="bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600 bg-clip-text text-transparent">Tradies</span>
          </h1>
          <p className="text-slate-300 text-base font-semibold animate-slide-up drop-shadow-lg">Verified tradesmen & the men who want them.</p>
        </div>

        {/* Auth Form */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-8 shadow-2xl animate-slide-up backdrop-blur-xl border-2 border-slate-700 hover:border-orange-500/30 transition-all duration-500">
          {verificationNoticeEmail && (
            <div className="mb-4 rounded-xl border border-orange-400/50 bg-orange-500/10 text-orange-100 p-4 text-sm flex flex-col gap-2 shadow-inner">
              <div className="font-bold text-orange-100 text-base">Check your inbox</div>
              <div className="text-orange-50/80">
                A verification email has been sent to <span className="font-semibold text-orange-50">{verificationNoticeEmail}</span>. Please verify before logging in.
              </div>
              <div className="flex gap-2 flex-wrap">
                <a
                  className="px-3 py-2 bg-orange-500 text-slate-900 font-bold rounded-lg shadow hover:bg-orange-400 transition-colors"
                  href="https://mail.google.com"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open Gmail
                </a>
                <button
                  type="button"
                  className="px-3 py-2 bg-orange-500/20 text-orange-100 border border-orange-400/60 rounded-lg hover:bg-orange-500/30 transition-colors disabled:opacity-50"
                  onClick={handleResendVerification}
                  disabled={noticeLoading}
                >
                  {noticeLoading ? 'Sending...' : 'Resend email'}
                </button>
                <button
                  type="button"
                  className="px-3 py-2 bg-transparent text-orange-100 border border-orange-400/60 rounded-lg hover:bg-orange-500/20 transition-colors"
                  onClick={() => setVerificationNoticeEmail('')}
                >
                  Got it
                </button>
              </div>
            </div>
          )}
          <div className="flex bg-slate-700/80 rounded-xl p-1.5 mb-6 shadow-inner backdrop-blur-sm border border-slate-600">
            <button
            onClick={() => { setIsSignUp(true); setError(''); setSuccessMessage(''); }}
            className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all duration-300 ${
              isSignUp ? 'bg-gradient-to-r from-orange-500 via-orange-600 to-orange-700 text-white shadow-xl scale-105 ring-2 ring-orange-400/50' : 'text-slate-300 hover:text-white hover:bg-slate-600/50'
            }`}
          >
            Sign Up
          </button>
          <button
            onClick={() => { setIsSignUp(false); setError(''); setSuccessMessage(''); }}
            className={`flex-1 py-3 px-4 rounded-lg text-sm font-bold transition-all duration-300 ${
              !isSignUp ? 'bg-gradient-to-r from-orange-500 via-orange-600 to-orange-700 text-white shadow-xl scale-105 ring-2 ring-orange-400/50' : 'text-slate-300 hover:text-white hover:bg-slate-600/50'
            }`}
          >
              Login
            </button>
          </div>

          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
          />

          <div className="mb-4">
            <label className="block text-sm font-bold text-slate-700 mb-2 transition-colors duration-200">Password</label>
            <div className="relative">
              <input
                className="w-full p-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:outline-none text-slate-900 transition-all duration-300 shadow-sm hover:border-slate-300 hover:shadow-md focus:shadow-lg pr-20"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="********"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-3 text-sm font-bold text-orange-500 hover:text-orange-600"
                onClick={() => setShowPassword(v => !v)}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {isSignUp && (
            <>
              <div className="mb-4">
                <label className="block text-sm font-bold text-slate-700 mb-2 transition-colors duration-200">Confirm Password</label>
                <div className="relative">
                  <input
                    className="w-full p-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:outline-none text-slate-900 transition-all duration-300 shadow-sm hover:border-slate-300 hover:shadow-md focus:shadow-lg pr-20"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="********"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-3 text-sm font-bold text-orange-500 hover:text-orange-600"
                    onClick={() => setShowConfirmPassword(v => !v)}
                  >
                    {showConfirmPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              {password && (
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Password Strength</span>
                    <span className="font-bold">{passwordStrength.label}</span>
                  </div>
                  <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${passwordStrength.color}`}
                      style={{ width: `${(passwordStrength.strength / 5) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="mb-4 animate-slide-up">
                <label className="block text-sm font-bold text-slate-300 mb-2">I am a...</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setUserType('tradie')}
                    className={`flex-1 py-3 px-4 rounded-lg font-bold text-sm transition-all duration-300 transform hover:-translate-y-0.5 active:scale-95 ${
                      userType === 'tradie' 
                        ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/50 scale-105' 
                        : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:shadow-md'
                    }`}
                  >
                    Tradie
                  </button>
                  <button
                    onClick={() => setUserType('admirer')}
                    className={`flex-1 py-3 px-4 rounded-lg font-bold text-sm transition-all duration-300 transform hover:-translate-y-0.5 active:scale-95 ${
                      userType === 'admirer' 
                        ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/50 scale-105' 
                        : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:shadow-md'
                    }`}
                  >
                    Admirer
                  </button>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isOver18}
                    onChange={(e) => setIsOver18(e.target.checked)}
                    className="w-4 h-4 rounded accent-orange-500"
                  />
                  <span className="text-sm text-slate-300">I confirm I am 18+</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    className="w-4 h-4 rounded accent-orange-500"
                  />
                  <span className="text-sm text-slate-300">
                    I accept{' '}
                    <a className="text-orange-400 underline hover:text-orange-300" href="/terms" target="_blank" rel="noreferrer">
                      Terms
                    </a>{' '}
                    &{' '}
                    <a className="text-orange-400 underline hover:text-orange-300" href="/privacy" target="_blank" rel="noreferrer">
                      Privacy Policy
                    </a>
                  </span>
                </label>
              </div>
            </>
          )}

          {successMessage && (
            <div className="bg-green-500/10 border border-green-500 text-green-300 text-sm p-3 rounded-lg mb-4">
              {successMessage}
            </div>
          )}
          {error && (
            <div className="bg-red-500/10 border border-red-500 text-red-400 text-sm p-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          <Button
            variant="secondary"
            className="w-full text-lg py-4 mb-3"
            onClick={isSignUp ? handleSignUp : handleLogin}
            disabled={loading}
          >
            {loading ? 'Processing...' : isSignUp ? 'Create Account' : 'Login'}
          </Button>

          {!isSignUp && (
            <button
              onClick={openForgotPassword}
              className="w-full text-sm text-orange-400 hover:text-orange-300 transition-colors"
            >
              Forgot password?
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const Onboarding = ({ user, onComplete }) => {
  const [role, setRole] = useState(() => {
    // Get role from localStorage if available (set during signup)
    const pendingType = localStorage.getItem('pendingUserType');
    if (pendingType) {
      localStorage.removeItem('pendingUserType');
      return pendingType;
    }
    return 'admirer';
  });
  const [formData, setFormData] = useState({ name: '', age: '', location: '', trade: '', bio: '', rate: '', sexuality: 'Gay', lookingFor: 'All' });

  const generateUsername = async (seed: string) => {
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

  const sendWelcomeMessage = async (displayName, userRole, profession) => {
    if (!db || !user) return;
    try {
      const adminQuery = query(
        collection(db, 'artifacts', getAppId(), 'public', 'data', 'profiles'),
        where('email', '==', ADMIN_EMAIL)
      );
      const adminSnap = await getDocs(adminQuery);
      const adminDoc = adminSnap.docs[0];
      const adminUid = adminDoc ? adminDoc.id : 'admin_system';
      const adminProfile = adminDoc ? adminDoc.data() : { name: 'Admin', email: ADMIN_EMAIL };
      const adminPhoto = adminProfile?.primaryPhoto || adminProfile?.photo || getDefaultCoverPhoto(adminProfile?.email, adminProfile?.role);
            const profileRef = doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', user.uid);
            const existingProfile = await getDoc(profileRef);
            if (existingProfile?.data()?.welcomeSent) {
                return;
            }

            const conversationId = [adminUid, user.uid].sort().join('_');

      const fallbackName = displayName || 'there';
      const professionLabel = profession || 'Tradie';
      const welcomeText = userRole === 'tradie'
        ? `Hello ${professionLabel} ${fallbackName}! Welcome to GayTradies closed beta – congrats on being selected. Head over to your profile and upload a picture of yourself (torso shots are fine, just no nudity). You’ll also find your work calendar there to mark dates you’re unavailable. When chatting, keep it social/flirty and direct any work to the Hiring tab so everything stays secure via Stripe. To get fully verified and start taking jobs, upload the front and back of your ECS/CSCS (or equivalent) plus a selfie. If you prefer not to appear in Social, you can change that in Settings. We’re in beta, so if you spot bugs or have ideas, I’d love to hear them. Welcome aboard!`
        : `Hello ${fallbackName}! Welcome to GayTradies closed beta – congrats on being selected. Head to your profile and upload a picture of yourself (torso shots are fine, just no nudity). When messaging Tradies, keep things social/flirty and use the Hiring tab to book work securely. Payments are protected and only released when you mark the job as completed. We’re in beta, so if you see bugs or have ideas, please message me. Enjoy the app and happy GayTrading!`;

      await setDoc(
        doc(db, 'artifacts', getAppId(), 'public', 'data', 'conversations', conversationId),
        {
          participants: [adminUid, user.uid],
          participantIds: [adminUid, user.uid],
          lastMessage: welcomeText,
          lastMessageAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );

      await addDoc(collection(db, 'artifacts', getAppId(), 'public', 'data', 'messages'), {
        conversationId,
        senderId: adminUid,
        recipientId: user.uid,
        text: welcomeText,
        senderPhoto: adminPhoto || '',
        createdAt: serverTimestamp(),
        read: false
      });

      await addDoc(collection(db, 'artifacts', getAppId(), 'public', 'data', 'notifications'), {
        userId: user.uid,
        type: 'message',
        from: adminUid,
        fromName: adminProfile?.name || 'Admin',
        fromPhoto: adminPhoto || '',
        message: welcomeText,
        read: false,
        createdAt: serverTimestamp()
      });

      await setDoc(profileRef, { welcomeSent: true }, { merge: true });
    } catch (error) {
      console.error('Failed to send welcome message:', error);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name) {
      alert("Please enter your name");
      return;
    }
    
    if (!formData.age || formData.age === '' || parseInt(formData.age) < 18) {
      alert("Please enter your age (must be 18 or older)");
      return;
    }
    
    // Check if user is authenticated
    if (!user) {
      alert("Authentication Error:\n\nStill waiting for authentication to complete.\n\nIf this persists:\n1. Check your Firebase Console → Authentication → Sign-in method\n2. Verify 'Anonymous' provider is enabled\n3. Check browser console (F12) for error messages\n4. Try refreshing the page");
      console.error("User is not authenticated yet. user:", user);
      return;
    }
    
    if (!db) {
      alert("Database error: Firebase is not initialized. Check your Firebase configuration in src/main.tsx");
      return;
    }
    
    // Try to get GPS coordinates before creating profile
    let gpsCoords = { latitude: null, longitude: null };
    
    if (navigator.geolocation) {
      try {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
          });
        });
        gpsCoords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          locationAccuracy: position.coords.accuracy,
          locationUpdatedAt: serverTimestamp()
        };
      } catch (error) {
        console.log("GPS not available during onboarding:", error.message);
      }
    }
    
    try {
        const seed = formData.name || user.email?.split('@')[0] || 'user';
        const username = await generateUsername(seed);
        await setDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', user.uid), {
          ...formData,
          age: parseInt(formData.age), // Ensure age is stored as a number
          role,
          uid: user.uid,
          email: user.email, // Store email for admin badge detection
          username,
          usernameLower: username.toLowerCase(),
          usernameChanges: 0,
          verified: false,
          emailVerified: !!user.emailVerified,
          emailVerifiedOverride: user.emailVerified ? true : false,
          emailValidationStatus: user.emailVerified ? 'validated' : 'pending',
          emailValidatedAt: user.emailVerified ? serverTimestamp() : null,
          joinedAt: serverTimestamp(),
          reviews: 0,
          rating: 5.0,
          primaryPhoto: null,
          ...gpsCoords
        });
      await sendWelcomeMessage(formData.name, role, formData.trade);
      onComplete();
    } catch (error) {
      console.error("Error creating profile:", error);
      alert("Failed to create profile. Please check your Firebase configuration and try again.");
    }
  };

  return (
    <div className="p-6 pt-8">
      <h2 className="text-3xl font-black mb-2 text-slate-900">Welcome aboard.</h2>
      <p className="text-slate-500 mb-8 font-medium">Tell us who you are.</p>
      <div className="flex gap-4 mb-8">
        <button onClick={() => setRole('admirer')} className={`flex-1 p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${role === 'admirer' ? 'border-orange-500 bg-orange-50 text-orange-700 shadow-md' : 'border-slate-200 text-slate-400'}`}>
          <User size={32} /> <span className="font-bold">Client / Admirer</span>
        </button>
        <button onClick={() => setRole('tradie')} className={`flex-1 p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${role === 'tradie' ? 'border-orange-500 bg-orange-50 text-orange-700 shadow-md' : 'border-slate-200 text-slate-400'}`}>
          <HardHat size={32} /> <span className="font-bold">Tradie</span>
        </button>
      </div>
      <div className="space-y-4">
        <Input label="Display Name" placeholder="e.g. Dave" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
        <div className="flex gap-4">
          <Input label="Age" type="number" placeholder="25" className="w-full" value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} />
          <Input label="City" placeholder="London" className="w-full" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} />
        </div>
        {role === 'tradie' && (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Your Trade</label>
              <select className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500" value={formData.trade} onChange={e => setFormData({...formData, trade: e.target.value})}>
                <option value="">Select a trade...</option>
                {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <Input label="Hourly Rate (£)" type="number" placeholder="45" value={formData.rate} onChange={e => setFormData({...formData, rate: e.target.value})} />
          </>
        )}
        <Input label="Bio" textarea rows={3} placeholder={role === 'tradie' ? "Experienced with tools. Looking for jobs or fun." : "Looking for a reliable tradie for work..."} value={formData.bio} onChange={e => setFormData({...formData, bio: e.target.value})} />
        <Button onClick={handleSubmit} className="w-full py-4 mt-4" variant="secondary" disabled={!user}>
          {user ? 'Create Profile' : 'Waiting for authentication...'}
        </Button>
        {!user && (
          <p className="text-xs text-slate-500 text-center mt-2">
            Please wait a moment while we set up your session...
          </p>
        )}
      </div>
    </div>
  );
};

const Feed = ({ user, userProfile, activeTab, setActiveTab, onMessage, onRequestJob, filter, clearFilter, acceptedTradieIds, onEnableLocation, showToast, profilePictureRequests = [], unreadMessagesPerUser = {}, onOpenPublicProfile }) => {
  const [profiles, setProfiles] = useState([]);
  const [activeChatProfiles, setActiveChatProfiles] = useState(() => {
    if (typeof window === 'undefined') return {};
    try {
      const cached = JSON.parse(localStorage.getItem('activeChatProfiles') || '{}');
      return cached && typeof cached === 'object' ? cached : {};
    } catch {
      return {};
    }
  });
  const [blockedUserIds, setBlockedUserIds] = useState(new Set());
  const [isLoading, setIsLoading] = useState(true);
  
  // Pull-to-refresh state
  const [pullStartY, setPullStartY] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);
  const pullThreshold = 80;
  const socialFeedRef = useRef(null);
  const hiringFeedRef = useRef(null);
  const socialFiltersRef = useRef(null);
  const [socialGridOffset, setSocialGridOffset] = useState(210);
  
  // Logic from GT2: Social Filtering State
  const socialAgeFilter = useMemo(() => ({ minAge: 18, maxAge: 99 }), []);
  const [selectedSocialProfile, setSelectedSocialProfile] = useState(null);

  // Hiring Filter State (Existing GT1 Logic)
  const [hiringFilter, setHiringFilter] = useState({
    verified: false,
    trade: '',
    distance: 100
  });
  const [manualLocation, setManualLocation] = useState('');
  const [activeChatIds, setActiveChatIds] = useState(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const cachedIds = JSON.parse(localStorage.getItem('activeChatIds') || '[]');
      return new Set(Array.isArray(cachedIds) ? cachedIds.filter(Boolean) : []);
    } catch {
      return new Set();
    }
  });
  const activeChats = useMemo(() => {
      return Array.from(activeChatIds || []).map(uid => {
          if (uid === user?.uid) return null;
          const liveProfile = profiles.find(p => p.uid === uid);
          const cached = activeChatProfiles[uid];
          const profile = liveProfile || cached || { uid, name: 'Chat', primaryPhoto: '', photo: '' };
          return { ...profile, unread: unreadMessagesPerUser[uid] };
      }).filter(Boolean)
        .sort((a, b) => (b.unread || 0) - (a.unread || 0));
  }, [profiles, unreadMessagesPerUser, activeChatIds, activeChatProfiles, user?.uid]);
  const [editActiveChats, setEditActiveChats] = useState(false);
  const holdTimerRef = useRef(null);

  const handleHoldChatsStart = () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      holdTimerRef.current = setTimeout(() => setEditActiveChats(true), 350);
  };
  const handleHoldChatsEnd = () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
  };

  // Keep active chats cached even after unread is cleared
  useEffect(() => {
      const ids = Object.keys(unreadMessagesPerUser || {}).filter(id => id && id !== user?.uid);
      if (ids.length === 0) return;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveChatIds(prev => {
          const next = new Set(prev);
          ids.forEach(id => next.add(id));
          return next;
      });
      // Fetch missing profiles so chips have data even if not in current feed
      const missingIds = ids.filter(id => !activeChatProfiles[id]);
      if (missingIds.length && db) {
          (async () => {
              const updates = {};
              for (const uid of missingIds) {
                  try {
                      const snap = await getDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', uid));
                      if (snap.exists()) {
                          updates[uid] = { uid, ...snap.data() };
                      } else {
                          updates[uid] = { uid, name: 'New message', primaryPhoto: '', photo: '' };
                      }
                  } catch (err) {
                      console.error('Active chat profile fetch failed', uid, err);
                  }
              }
              if (Object.keys(updates).length) {
                  setActiveChatProfiles(prev => ({ ...prev, ...updates }));
              }
          })();
      }
  }, [unreadMessagesPerUser, db, activeChatProfiles]);

  const addActiveChat = (uid, profile) => {
      if (!uid) return;
      setEditActiveChats(false);
      if (profile) {
          setActiveChatProfiles(prev => ({ ...prev, [uid]: profile }));
      }
      setActiveChatIds(prev => {
          const next = new Set(prev);
          next.add(uid);
          return next;
      });
  };

  useEffect(() => {
      if (typeof window === 'undefined') return;
      const idsArray = Array.from(activeChatIds || []);
      try {
          localStorage.setItem('activeChatIds', JSON.stringify(idsArray.filter(id => id && id !== user?.uid)));
          localStorage.setItem('activeChatProfiles', JSON.stringify(activeChatProfiles || {}));
      } catch {
          // storage might be unavailable; ignore
      }
  }, [activeChatIds, activeChatProfiles, user?.uid]);

  // Measure the social filters bar so the grid starts beneath it
  const updateSocialGridOffset = useCallback(() => {
    if (!socialFiltersRef.current || typeof window === 'undefined') return;

    requestAnimationFrame(() => {
      if (!socialFiltersRef.current) return;
      const rect = socialFiltersRef.current.getBoundingClientRect();
      const offset = rect.bottom + 12;
      setSocialGridOffset(offset);
    });
  }, []);

  useLayoutEffect(() => {
    if (activeTab !== 'dating') return;
    updateSocialGridOffset();
  }, [activeTab, activeChats.length, updateSocialGridOffset]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => updateSocialGridOffset();

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [updateSocialGridOffset]);

  useEffect(() => {
    if (activeTab === 'dating') {
      updateSocialGridOffset();
    }
  }, [activeTab, updateSocialGridOffset, socialAgeFilter]);

  // Load blocked users
  useEffect(() => {
    if (!user || !db) return;
    const unsub = onSnapshot(
      collection(db, 'artifacts', getAppId(), 'public', 'data', 'blocked_users'),
      (snapshot) => {
        const blocked = new Set();
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          // Only add users I blocked (not users who blocked me)
          if (data.blockedBy === user.uid) {
            blocked.add(data.blockedUser);
          }
        });
        setBlockedUserIds(blocked);
      }
    );
    return () => unsub();
  }, [user]);

  // Combined Data Fetching (persist active chats across tabs)
  useEffect(() => {
    if (!db) return;
    const q = collection(db, 'artifacts', getAppId(), 'public', 'data', 'profiles');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let allProfiles = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
      
      // Filter out blocked users
      allProfiles = allProfiles.filter(p => !blockedUserIds.has(p.uid));
      
      // Apply incognito mode - hide profiles with incognito enabled
      // This hides the profile from all feeds including user's own feed
      allProfiles = allProfiles.filter(p => !p.incognitoMode);
      
      // Calculate distances for all profiles first
      if (userProfile?.latitude && userProfile?.longitude) {
          allProfiles = allProfiles.map(p => {
              const dist = getDistanceFromLatLonInKm(
                  userProfile.latitude, userProfile.longitude,
                  p.latitude, p.longitude
              );
              return { ...p, distanceKm: dist };
          });
      }

      setProfiles(allProfiles);
      // Cache profiles for active chats so they persist across tab filters
      setActiveChatProfiles(prev => {
        const next = { ...prev };
        allProfiles.forEach(p => { if (p.uid) next[p.uid] = p; });
        return next;
      });
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [userProfile, blockedUserIds, user]);

  // Reset pull state when switching tabs
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPullDistance(0);
    setPullStartY(0);
  }, [activeTab]);

  // Pull-to-refresh handlers
  const handleTouchStart = (e) => {
    const currentFeedRef = activeTab === 'dating' ? socialFeedRef : hiringFeedRef;
    if (currentFeedRef.current && currentFeedRef.current.scrollTop === 0) {
      setPullStartY(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e) => {
    const currentFeedRef = activeTab === 'dating' ? socialFeedRef : hiringFeedRef;
    if (pullStartY > 0 && currentFeedRef.current && currentFeedRef.current.scrollTop === 0) {
      const currentY = e.touches[0].clientY;
      const distance = Math.max(0, Math.min(currentY - pullStartY, pullThreshold * 1.5));
      setPullDistance(distance);
      
      // Prevent browser's native pull-to-refresh when we're handling the gesture
      if (distance > 0) {
        e.preventDefault();
      }
    }
  };

  const handleTouchEnd = () => {
    if (pullDistance >= pullThreshold) {
      // Capture current tab at the moment of refresh
      const currentTab = activeTab;
      
      // Show toast for current tab
      if (showToast) {
        showToast(`Refreshing ${currentTab === 'dating' ? 'Social' : 'Hire'} feed...`, 'info');
      }
      
      // Show brief loading animation for visual feedback
      // The onSnapshot listener already keeps data fresh, so we don't need to trigger a full reload
      setTimeout(() => {
        // Only update if we're still on the same tab
        if (activeTab === currentTab) {
              setPullDistance(0);
          setPullStartY(0);
          
          if (showToast) {
            showToast(`${currentTab === 'dating' ? 'Social' : 'Hire'} feed refreshed!`, 'success');
          }
        } else {
          // If tab changed, just reset states without showing success toast
              setPullDistance(0);
          setPullStartY(0);
        }
      }, 800);
    } else {
      setPullDistance(0);
      setPullStartY(0);
    }
  };


  // GT2 Logic: Memoized Filter & Sort for Social Tab
  const filteredSocialProfiles = useMemo(() => {
      return profiles
        // Only show profiles with valid uid and name (filters out deleted/orphaned accounts)
        .filter(p => p.uid && p.name && p.name.trim() !== '' && p.name !== '[Deleted User]')
        // Only show profiles with email (filters out orphaned anonymous accounts)
        .filter(p => p.email && p.email.trim() !== '')
        .filter(p => p.role !== 'admin') // Exclude admin role profiles from social feed
        .filter(p => {
            // Always show current user regardless of other filters
            if (p.uid === user?.uid) return true;
            
            // Exclude profiles with jobOnlyVisibility
            if (p.jobOnlyVisibility) return false;
            
            // Apply social filters for other users
            // Only apply age filter if age is a valid number (not null, not undefined, not empty string, not 0)
            const validAge = p.age && typeof p.age === 'number' && p.age > 0;
            if (validAge && (p.age < socialAgeFilter.minAge || p.age > socialAgeFilter.maxAge)) return false;
            
            // Apply user's "Verified Only" privacy setting
            if (userProfile?.verifiedOnly && !p.verified) return false;
            
            return true;
        })
        .sort((a, b) => {
            // Current user's profile always appears first
            if (a.uid === user?.uid) return -1;
            if (b.uid === user?.uid) return 1;
            // Then sort ASCENDING by distance so CLOSEST profiles appear at TOP
            const aDist = a.distanceKm || 99999;
            const bDist = b.distanceKm || 99999;
            return aDist - bDist; // Smaller distances first (top), larger distances last (bottom)
        });
  }, [profiles, socialAgeFilter, user, userProfile]);

  // Hiring Filter Logic (GT1) + filters
  const filteredHiringProfiles = useMemo(() => {
      let result = profiles
        .filter(p => p.uid && p.name && p.name.trim() !== '' && p.name !== '[Deleted User]')
        .filter(p => p.email && p.email.trim() !== '')
        .filter(p => p.role === 'tradie')
        .filter(p => p.uid !== user?.uid);
      const tradeFilter = hiringFilter.trade || filter;
      if (tradeFilter) result = result.filter(p => p.trade === tradeFilter);
      if (manualLocation.trim()) {
          const search = manualLocation.toLowerCase();
          result = result.filter(p => p.location?.toLowerCase().includes(search));
      }
      if (hiringFilter.verified) {
        result = result.filter(p => p.verified);
      }
      if (hiringFilter.distance && hiringFilter.distance > 0) {
        result = result.filter(p => p.distanceKm == null || isNaN(p.distanceKm) || p.distanceKm <= hiringFilter.distance);
      }
      const currentDateKey = formatDateKey(new Date());
      const currentTimeSlot = getCurrentTimeSlot();
      const effectiveTimeSlot = currentTimeSlot || 'morning';
      result = result.filter(p => {
          const workCalendar = p.workCalendar || {};
          const dateSlots = workCalendar[currentDateKey];
          if (!dateSlots) return true;
          if (Array.isArray(dateSlots)) {
              return !dateSlots.includes(effectiveTimeSlot);
          } else {
              return !dateSlots[effectiveTimeSlot];
          }
      });
      result.sort((a, b) => {
          if (a.verified !== b.verified) return b.verified ? 1 : -1;
          return (a.distanceKm || 9999) - (b.distanceKm || 9999);
      });
      return result;
  }, [profiles, user, hiringFilter, filter, manualLocation]);

  const handleHiringFilterChange = (e) => {
      const { name, value, type, checked } = e.target;
      setHiringFilter(prev => ({
          ...prev,
          [name]: type === 'checkbox' ? checked : value
      }));
  };

  const openChat = (p) => {
      setEditActiveChats(false);
      addActiveChat(p?.uid, p);
      if (onMessage) onMessage(p);
  };

  return (
    <div className="h-full">
      {/* Fixed Social/Hire Toggle - extended background to eliminate gaps */}
      <div className="fixed top-16 left-0 right-0 bg-slate-50 z-30 max-w-md mx-auto px-4 pt-2 pb-5">
        <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200">
          <button onClick={() => setActiveTab('dating')} className={`flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'dating' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
            <Heart size={16} className={activeTab === 'dating' ? 'text-red-400 fill-red-400' : ''} /> Social
          </button>
          <button onClick={() => setActiveTab('hiring')} className={`flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'hiring' ? 'bg-orange-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
            <Hammer size={16} className={activeTab === 'hiring' ? 'fill-orange-200' : ''} /> Hire
          </button>
        </div>
      </div>

      {/* --- SOCIAL TAB (GT2 LOGIC) --- */}
      {activeTab === 'dating' && (
        <div className="relative">
          {/* Top fade overlay */}
          <div className="fixed top-[9.5rem] left-0 right-0 h-8 bg-gradient-to-b from-slate-50 to-transparent z-20 max-w-md mx-auto pointer-events-none"></div>
          
          {/* Bottom fade overlay */}
          <div className="fixed bottom-20 left-0 right-0 h-16 bg-gradient-to-t from-slate-50 to-transparent z-20 max-w-md mx-auto pointer-events-none"></div>
          
          <div 
            ref={socialFeedRef}
            className="animate-in fade-in slide-in-from-bottom-2 duration-300 flex flex-col justify-start min-h-screen no-scrollbar" 
            style={{ touchAction: 'pan-y', overscrollBehavior: 'contain', scrollbarWidth: 'none' }}
            onTouchStart={handleTouchStart}
           onTouchMove={handleTouchMove}
           onTouchEnd={handleTouchEnd}
         >
            {/* Pull-to-Refresh Indicator */}
            {pullDistance > 0 && (
              <div 
                className="fixed top-16 left-0 right-0 flex justify-center z-40 transition-all"
                style={{ 
                   transform: `translateY(${Math.min(pullDistance, pullThreshold)}px)`,
                   opacity: pullDistance / pullThreshold 
                 }}
               >
                 <div className="bg-orange-500 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
                   <div className={`${pullDistance >= pullThreshold ? 'animate-spin' : ''}`}>
                     ↻
                   </div>
                   <span className="text-sm font-bold">
                     {pullDistance >= pullThreshold ? 'Release to refresh' : 'Pull to refresh'}
                   </span>
                 </div>
               </div>
             )}
             
            {/* Fixed Filters Bar (GT2 Style) - fixed so the grid scrolls underneath */}
            <div ref={socialFiltersRef} className="fixed top-[9.5rem] left-0 right-0 bg-slate-50 z-20 max-w-md mx-auto px-4 pb-2">
                <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                        <div className="text-[10px] font-bold text-slate-700 uppercase">Active Chats</div>
                        <div className="flex items-center gap-2">
                            {userProfile?.latitude ? (
                                <span className="text-[10px] text-green-600 font-bold flex items-center gap-1">
                                    <Navigation size={10} /> GPS Active
                                </span>
                            ) : (
                                <button onClick={onEnableLocation} className="text-[10px] bg-slate-900 text-white px-2 py-1 rounded-full flex items-center gap-1 font-bold animate-pulse">
                                    <Navigation size={10} /> Enable Location
                                </button>
                            )}
                        </div>
                    </div>
                    <div
                        className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar"
                        onClick={() => editActiveChats && setEditActiveChats(false)}
                        onMouseDown={handleHoldChatsStart}
                        onMouseUp={handleHoldChatsEnd}
                        onMouseLeave={handleHoldChatsEnd}
                        onTouchStart={handleHoldChatsStart}
                        onTouchEnd={handleHoldChatsEnd}
                        onContextMenu={(e) => {
                            e.preventDefault();
                            setEditActiveChats(true);
                        }}
                    >
                        {activeChats.slice(0, 8).map((p, idx) => (
                            <button
                              key={p.uid}
                              onClick={() => openChat(p)}
                              className={`relative w-14 h-14 rounded-full border-2 border-white shadow-md bg-slate-200 overflow-visible flex-shrink-0 ${idx === 0 ? 'mr-2' : 'mr-2 -ml-1'} animate-popIn ${editActiveChats ? 'animate-wiggle' : ''}`}
                              style={{ WebkitTouchCallout: 'none' }}
                              title={p.name || p.username}
                            >
                                      {p.primaryPhoto || p.photo ? (
                                        <img
                                            src={p.primaryPhoto || p.photo}
                                            alt={p.name || p.username || 'Profile'}
                                            className="w-full h-full object-cover rounded-full"
                                            draggable={false}
                                        />
                                      ) : (
                                        <div className="w-full h-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold rounded-full">
                                          {(p.name || p.username || 'T')[0]}
                                        </div>
                                      )}
                                      {!editActiveChats && p.unread > 0 && (
                                        <span className="absolute top-0.5 right-0.5 bg-orange-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center border border-white shadow">
                                          {p.unread > 9 ? '9+' : p.unread}
                                        </span>
                                      )}
                                      {editActiveChats && (
                                        <span
                                          onClick={(e) => {
                                              e.stopPropagation();
                                              setActiveChatIds(prev => {
                                                  const next = new Set(prev);
                                                  next.delete(p.uid);
                                                  return next;
                                              });
                                              setEditActiveChats(false);
                                          }}
                                          className="absolute top-0.5 left-0.5 bg-slate-900 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center border border-white shadow cursor-pointer"
                                        >
                                          <X size={10} />
                                        </span>
                                      )}
                            </button>
                        ))}
                        {activeChats.length === 0 && (
                            <span className="text-[11px] text-slate-400">No chats yet</span>
                        )}
                    </div>
                </div>
                <div className="h-3 bg-gradient-to-b from-slate-50 to-transparent"></div>
            </div>

            {/* Profile Grid (GT2 Style) */}
            <div
              className="fixed inset-x-0 z-10 max-w-md mx-auto"
              style={{ top: socialGridOffset, bottom: SOCIAL_GRID_BOTTOM_GAP }}
            >
              <div
              className="relative h-full overflow-y-auto px-4 pb-24 no-scrollbar"
              style={{
                paddingTop: SOCIAL_GRID_TOP_INSET,
                scrollbarWidth: 'none'
              }}
            >
              <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-6 scroll-hint"></div>
              <div className="grid grid-cols-3 gap-3 animate-stagger">
                {isLoading ? (
                    // Show loading skeletons
                    Array.from({ length: 9 }).map((_, index) => (
                        <ProfileTileSkeleton key={`skeleton-${index}`} />
                    ))
                ) : filteredSocialProfiles.length > 0 ? (
                    filteredSocialProfiles.map(profile => (
                        <ProfileTile
                              key={profile.uid}
                              profile={profile}
                              distanceKm={profile.distanceKm}
                              onOpenProfile={setSelectedSocialProfile}
                              isCurrentUser={profile.uid === user.uid}
                              shouldBlur={profile.blurPhotos && profile.uid !== user.uid}
                              hideDistance={profile.hideDistance}
                              profilePictureRequests={profilePictureRequests}
                              unreadCount={unreadMessagesPerUser[profile.uid] || 0}
                             
                          />
                      ))
                  ) : (
                      <div className={`col-span-full py-12 text-center animate-fade-in`}>
                          <div className="w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
                              <Filter className="text-slate-300" />
                          </div>
                          <p className={`text-slate-600 font-bold`}>No matches found.</p>
                          <p className="text-xs text-slate-400">Try adjusting your filters.</p>
                      </div>
                  )}
                </div>
              </div>
            </div>

            {/* Social Profile Modal (Social Tab Only) */}
            {selectedSocialProfile && (
                <SocialProfileModal
                    profile={selectedSocialProfile}
                    distanceKm={selectedSocialProfile.distanceKm}
                    onClose={() => setSelectedSocialProfile(null)}
                    hideDistance={selectedSocialProfile.hideDistance}
                    profilePictureRequests={profilePictureRequests}
                    onWinkSent={(message, type) => showToast(message, type)}
                    onOpenChat={(profile) => {
                        if (onMessage) openChat(profile);
                    }}
                    onAddActiveChat={(uid) => addActiveChat(uid, selectedSocialProfile)}
                    onOpenPublicProfile={onOpenPublicProfile}
                />
            )}
          </div>
        </div>
      )}

      {/* --- HIRING TAB (GT1 LOGIC + UI TWEAKS) --- */}
      {activeTab === 'hiring' && (
        <div className="relative">
          {/* Top fade overlay */}
          <div className="fixed top-[9.5rem] left-0 right-0 h-8 bg-gradient-to-b from-slate-50 to-transparent z-20 max-w-md mx-auto pointer-events-none"></div>
          
          {/* Bottom fade overlay */}
          <div className="fixed bottom-20 left-0 right-0 h-16 bg-gradient-to-t from-slate-50 to-transparent z-20 max-w-md mx-auto pointer-events-none"></div>
          
           <div 
            ref={hiringFeedRef}
            className="animate-in fade-in slide-in-from-bottom-2 duration-300 flex flex-col justify-start min-h-screen no-scrollbar" 
            style={{
              touchAction: 'pan-y',
              overscrollBehavior: 'contain',
              scrollbarWidth: 'none'
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
           {/* Pull-to-Refresh Indicator */}
           {pullDistance > 0 && (
             <div 
               className="fixed top-16 left-0 right-0 flex justify-center z-40 transition-all"
               style={{ 
                 transform: `translateY(${Math.min(pullDistance, pullThreshold)}px)`,
                 opacity: pullDistance / pullThreshold 
               }}
             >
               <div className="bg-orange-500 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
                 <div className={`${pullDistance >= pullThreshold ? 'animate-spin' : ''}`}>
                   ↻
                 </div>
                 <span className="text-sm font-bold">
                   {pullDistance >= pullThreshold ? 'Release to refresh' : 'Pull to refresh'}
                 </span>
               </div>
             </div>
           )}
           
           {/* Fixed Filter Controls - no gap above */}
           <div className="fixed top-[8.5rem] left-0 right-0 z-20 max-w-md mx-auto px-4 pt-2">
               <div className="bg-slate-50 pb-2 space-y-2">
                   <div className="flex gap-2">
                       <div className="relative flex-1">
                           <MapPin className="absolute left-3 top-2.5 text-slate-400" size={16} />
                           <input 
                              type="text" 
                              placeholder="Filter by City/Area..." 
                              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-orange-500 shadow-sm bg-white"
                              value={manualLocation}
                              onChange={(e) => setManualLocation(e.target.value)}
                           />
                       </div>
                       {filter && (
                            <button onClick={clearFilter} className="bg-orange-100 px-3 py-2 rounded-xl text-orange-900 text-[11px] font-bold border border-orange-200 flex items-center gap-1 shadow-sm">
                                 <X size={14}/> {filter}
                            </button>
                       )}
                   </div>
                   <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-2 space-y-3">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            name="verified"
                            checked={hiringFilter.verified}
                            onChange={handleHiringFilterChange}
                            className="h-4 w-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                          />
                          Verified only
                        </label>
                        {userProfile?.latitude ? (
                          <span className="text-[10px] text-green-600 font-bold flex items-center gap-1">
                            <Navigation size={10} /> GPS Active
                          </span>
                        ) : (
                          <button onClick={onEnableLocation} className="text-[10px] bg-slate-900 text-white px-2 py-1 rounded-full flex items-center gap-1 font-bold">
                            <Navigation size={10} /> Enable GPS
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3 items-end">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wide">Trade</label>
                          <select
                            name="trade"
                            value={hiringFilter.trade}
                            onChange={handleHiringFilterChange}
                            className="w-full p-2 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-700 focus:outline-none focus:border-orange-500"
                          >
                            <option value="">Any</option>
                            {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wide">Max Dist ({hiringFilter.distance} km)</label>
                          <input
                            type="range"
                            name="distance"
                            min="5"
                            max="200"
                            step="5"
                            value={hiringFilter.distance}
                            onChange={handleHiringFilterChange}
                            className="w-full accent-orange-500"
                          />
                        </div>
                      </div>
                   </div>
                   {/* Bottom fade gradient for smooth transition */}
                   <div className="h-4 bg-gradient-to-b from-slate-50 to-transparent"></div>
               </div>
           </div>

           {/* Tradie Cards */}
           <div className="relative space-y-4 px-4 pb-24 no-scrollbar" style={{ paddingTop: '16.5rem' }}>
              <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-6 scroll-hint"></div>
              {isLoading ? (
                  // Show loading skeletons
                  Array.from({ length: 5 }).map((_, index) => (
                      <div key={`skeleton-hiring-${index}`} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 mb-4 animate-pulse">
                          <div className="h-28 w-full bg-slate-200"></div>
                          <div className="p-4 flex items-start gap-4">
                              <div className="w-20 h-20 rounded-full bg-slate-200"></div>
                              <div className="flex-1">
                                  <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                                  <div className="h-3 bg-slate-200 rounded w-1/2 mb-3"></div>
                                  <div className="flex gap-2">
                                      <div className="h-6 bg-slate-200 rounded w-16"></div>
                                      <div className="h-6 bg-slate-200 rounded w-16"></div>
                                  </div>
                              </div>
                          </div>
                      </div>
                  ))
              ) : filteredHiringProfiles.length === 0 ? (
                 <div className="text-center py-10 text-slate-400">
                     <User size={48} className="mx-auto mb-3 opacity-20" />
                     {userProfile?.role === 'tradie' && !userProfile?.verified ? (
                         <div className="max-w-sm mx-auto">
                             <p className="font-bold text-slate-700 mb-2">Want to check out the competition?</p>
                             <p className="text-sm mb-4">Verify your profile to see other tradies in the Hire tab!</p>
                             <button
                                 onClick={() => {/* Navigate to verification - implement based on your app structure */}}
                                 className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
                             >
                                 Verify Now
                             </button>
                         </div>
                     ) : (
                         <p className="font-bold">No tradies found.</p>
                     )}
                 </div>
              ) : (
                 filteredHiringProfiles.map(p => {
                     const shouldUnblur = acceptedTradieIds.has(p.uid);
                     const isPending = profilePictureRequests.some(req => req.userId === p.uid && req.status === 'pending');
                     return (
                         <TradieCard 
                             key={p.uid} 
                             profile={p} 
                             mode={activeTab} 
                             isTrusted={shouldUnblur}
                             onMessage={() => openChat(p)} 
                             onRequestJob={() => onRequestJob(p)}
                             onOpenPublicProfile={onOpenPublicProfile}
                             isPending={isPending}
                         />
                     );
                 })
              )}
           </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Kept from GT1 for Hiring View
const TradieCard = ({ profile, mode, isTrusted, onRequestJob, onOpenPublicProfile = () => {}, isPending = false }) => {
  // Use default cover photo based on role and email
  const coverPhotoUrl = getDefaultCoverPhoto(profile.email, profile.role);
  // Check if profile is admin - only check profile's email to show badge to all users
  const isAdmin = profile.email === ADMIN_EMAIL;
  
  return (
    <div className={`bg-white rounded-2xl overflow-hidden shadow-sm mb-4 group hover:shadow-md transition-all ${
      isAdmin ? 'border-2 border-purple-400 shadow-purple-300/50 hover:shadow-purple-400/60' : 'border border-slate-100'
    }`}>
      {/* Cover Photo */}
      <div className="h-28 w-full bg-slate-200 relative overflow-hidden">
          <LazyImage src={coverPhotoUrl} alt="Cover" className="w-full h-full object-cover" />
          <div className="absolute top-2 right-2">
              {profile.verified && <Badge type="verified" text="Verified" />}
          </div>
          {/* Admin Badge */}
          {isAdmin && (
              <div className="absolute top-2 left-2 bg-gradient-to-br from-purple-500 via-purple-600 to-purple-700 text-white p-2 rounded-full shadow-xl border-2 border-white flex items-center justify-center animate-pulse-slow">
                  <Shield size={14} className="fill-white" />
              </div>
          )}
      </div>

    <div className="px-4 pb-4 relative">
        {/* Profile Picture Inset */}
        <div className="-mt-10 mb-3 flex justify-between items-end">
             <div className={`relative p-1 bg-white rounded-full ${profile.role === 'tradie' ? 'shadow-lg' : ''}`}>
                 <Avatar 
                    profile={profile} 
                    size="xl" 
                    className="w-20 h-20" 
                    blur={(profile.blurPhotos || isPending) && auth?.currentUser?.uid !== profile.uid} 
                 />
             </div>
             
             <div className="flex gap-2 mb-1">
                 <Button variant="secondary" className="py-2 px-4 text-xs h-9 shadow-sm" onClick={onRequestJob}>
                    Request Job
                 </Button>
                 <Button
                    variant="secondary"
                    className="py-2 px-4 text-xs h-9 shadow-sm"
                    onClick={() => {
                        if (profile.username) {
                            onOpenPublicProfile(profile.username);
                        }
                    }}
                 >
                    Profile
                 </Button>
             </div>
        </div>
        
        {/* Content */}
        <div>
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-lg font-bold flex items-center gap-1 text-slate-900">
                        {profile.name || profile.username}{profile.hideAge ? '' : `, ${profile.age}`}
                    </h3>
                    {profile.username && (
                        <button
                            onClick={() => onOpenPublicProfile(profile.username)}
                            className="text-xs font-bold text-orange-600 hover:text-orange-700 underline"
                        >
                            @{profile.username}
                        </button>
                    )}
                    <div className="flex items-center text-xs text-slate-500 gap-1 mb-1">
                        <MapPin size={10} /> 
                        {profile.location}
                        {profile.distanceKm !== undefined && profile.distanceKm < 9999 && (
                            <span className="text-slate-400">• {profile.distanceKm < 1 ? '<1km' : `${Math.round(profile.distanceKm)}km`} away</span>
                        )}
                    </div>
                </div>
                {profile.rate && (
                     <div className="text-right">
                         <span className="block font-mono font-bold text-slate-800">£{profile.rate}/hr</span>
                         <div className="flex items-center justify-end gap-0.5 text-xs text-orange-500">
                             <Star size={10} fill="currentColor"/> 
                             <span className="font-bold">{profile.rating?.toFixed(1) || '5.0'}</span>
                             <span className="text-slate-400 ml-1">({profile.reviews || 0})</span>
                         </div>
                     </div>
                )}
            </div>

            {profile.trade && (
                 <div className="mb-2 mt-1">
                    <Badge type="trade" text={profile.trade} />
                 </div>
            )}
        </div>
    </div>
  </div>
  );
};

export { LandingPage, Onboarding, Feed, SocialProfileModal, Toast };
