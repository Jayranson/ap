/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { Heart, User, MessageCircle, MapPin, ShieldCheck, Star, CheckCircle, Briefcase, ArrowRight, X, DollarSign, HardHat, Send, Edit2, AlertCircle, Camera, Navigation, Ban, Flag, Phone, Lock, Mail, Bell, Eye, EyeOff, Shield, UserX, Clock, Trash2, FileText, Info, AlertTriangle, Users, ExternalLink, ChevronRight, UserCheck, Calendar, ChevronLeft, ChevronRight as ChevronRightIcon } from 'lucide-react';
import { deleteUser } from 'firebase/auth';
import { collection, doc, setDoc, getDoc, getDocs, onSnapshot, addDoc, updateDoc, deleteDoc, deleteField, serverTimestamp, query, orderBy, limit, where, increment, arrayUnion, writeBatch } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { ref as storageRef, deleteObject } from 'firebase/storage';

import { getAppId, db, storage, functions } from '../config/firebase';
import { ADMIN_EMAIL } from '../constants';
import { formatDateKey } from '../utils';
import { Button, Input, Badge } from '../components/ui';

const ToggleSwitch = ({ label, description, value, onChange, icon: Icon, disabled = false, badge = null }) => (
    <div className={`flex items-start justify-between py-3 border-b border-slate-100 last:border-0 ${disabled ? 'opacity-50' : ''}`}>
        <div className="flex-1 pr-4">
            <div className="flex items-center gap-2">
                {Icon && <Icon size={18} className="text-orange-500" />}
                <div>
                    <p className="font-bold text-sm text-slate-900">{label}</p>
                    {description && <p className="text-xs text-slate-500">{description}</p>}
                </div>
                {badge && <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">{badge}</span>}
            </div>
        </div>
        <button
            onClick={() => !disabled && onChange(!value)}
            className={`w-12 h-7 rounded-full relative transition-all duration-300 ${value ? 'bg-orange-500' : 'bg-slate-300'} ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            disabled={disabled}
        >
            <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow transition-transform duration-300 ${value ? 'translate-x-5' : ''}`} />
        </button>
    </div>
);

const SafetyCard = ({ icon: Icon, title, description, action, actionLabel, variant = 'default' }) => (
    <div className={`bg-white rounded-xl shadow-sm border p-4 ${
        variant === 'danger' ? 'border-red-200 bg-red-50' : 'border-slate-100'
    }`}>
        <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${variant === 'danger' ? 'bg-red-100 text-red-700' : 'bg-orange-50 text-orange-700'}`}>
                <Icon size={20} />
            </div>
            <div className="flex-1">
                <h4 className="font-bold text-sm text-slate-900">{title}</h4>
                <p className="text-xs text-slate-600">{description}</p>
                {action && (
                    <button
                        onClick={action}
                        className={`mt-2 text-xs font-bold px-3 py-2 rounded-lg border transition-colors ${
                            variant === 'danger' ? 'border-red-200 text-red-700 hover:bg-red-100' : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                    >
                        {actionLabel}
                    </button>
                )}
            </div>
        </div>
    </div>
);

// --- SETTINGS SCREEN ---
const SettingsScreen = ({ user, profile, onBack, showToast }) => {
    // Detect if running on mobile app or web
    const isMobileApp = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) && 
                        (window.matchMedia('(display-mode: standalone)').matches || 
                         window.navigator.standalone === true);
    
    // Check if user is admin (admin can use premium features)
    const isAdmin = user?.email === ADMIN_EMAIL;
    const canUsePremium = isAdmin; // In future, also check for premium subscription
    
    const [settings, setSettings] = useState({
        // Location
        manualLocation: profile?.manualLocation || '',
        useManualLocation: profile?.useManualLocation || false,
        
        // Notifications
        notifyMessages: profile?.notifyMessages ?? true,
        notifyJobOffers: profile?.notifyJobOffers ?? true,
        notifyWinks: profile?.notifyWinks ?? true,
        
        // Privacy - Free
        hideDistance: profile?.hideDistance || false,
        hideAge: profile?.hideAge || false,
        jobOnlyVisibility: profile?.jobOnlyVisibility || false,
        
        // Privacy - Premium (GayTradies Elite)
        incognitoMode: profile?.incognitoMode || false,
        verifiedOnly: profile?.verifiedOnly || false,
        blurPhotos: profile?.blurPhotos || false,
        hideOnlineStatus: profile?.hideOnlineStatus || false,
        autoDeleteChats: profile?.autoDeleteChats || 'never',
        screenshotDetection: profile?.screenshotDetection || false,
        verifiedOnlyChats: profile?.verifiedOnlyChats || false,
    });

    const [blockedUsers, setBlockedUsers] = useState([]);
    const [activeSessions] = useState([
        { id: 'current', device: 'Current Device', location: 'Your Location', lastActive: 'Now', isCurrent: true },
    ]);
    const [showBlockedUsers, setShowBlockedUsers] = useState(false);
    const [showLoginHistory, setShowLoginHistory] = useState(false);

    // Load blocked users
    useEffect(() => {
        if (!user || !db) return;
        const unsub = onSnapshot(
            collection(db, 'artifacts', getAppId(), 'public', 'data', 'blocked_users'),
            (snapshot) => {
                const blocked = snapshot.docs
                    .filter(doc => doc.data().blockedBy === user.uid)
                    .map(doc => ({ id: doc.id, ...doc.data() }));
                setBlockedUsers(blocked);
            }
        );
        return () => unsub();
    }, [user]);

    // Auto-save settings whenever they change
    useEffect(() => {
        // Skip initial mount
        const saveSettings = async () => {
            if (!user || !db) return;
            
            try {
                await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', user.uid), {
                    ...settings,
                    settingsUpdatedAt: serverTimestamp()
                });
            } catch (error) {
                console.error("Error auto-saving settings:", error);
            }
        };
        
        // Debounce to avoid too many saves
        const timeoutId = setTimeout(() => {
            saveSettings();
        }, 500);
        
        return () => clearTimeout(timeoutId);
    }, [settings, user]);

    const handleUnblockUser = async (blockedUserId) => {
        try {
            await deleteDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'blocked_users', blockedUserId));
            showToast("User unblocked", "success");
        } catch (error) {
            console.error("Error unblocking user:", error);
            showToast("Failed to unblock user", "error");
        }
    };

    const handleLogoutSession = async (sessionId) => {
        // In production, this would invalidate the session
        showToast("Session logged out", "success");
        setActiveSessions(prev => prev.filter(s => s.id !== sessionId));
    };

    
    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-40">
                <div className="p-4 flex items-center gap-3">
                    <button onClick={onBack}><ArrowRight className="rotate-180 text-slate-600" size={20} /></button>
                    <h1 className="text-xl font-bold text-slate-900">Settings</h1>
                </div>
            </div>

            <div className="p-4 space-y-4">
                {/* Location Controls */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
                    <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                        <MapPin size={18} className="text-orange-500" /> Location Controls
                    </h3>
                    <ToggleSwitch
                        label="Use Manual Location"
                        description="Override GPS with a custom city/area"
                        value={settings.useManualLocation}
                        onChange={(val) => setSettings({ ...settings, useManualLocation: val })}
                        icon={Navigation}
                        disabled={true}
                        badge="Soon"
                    />
                    {settings.useManualLocation && (
                        <div className="mt-3">
                            <Input
                                label="Manual Location"
                                placeholder="e.g., Central London"
                                value={settings.manualLocation}
                                onChange={(e) => setSettings({ ...settings, manualLocation: e.target.value })}
                                disabled={true}
                            />
                        </div>
                    )}
                </div>

                {/* Notification Preferences */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
                    <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                        <Bell size={18} className="text-orange-500" /> Notification Preferences
                    </h3>
                    {!isMobileApp && (
                        <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-start gap-2">
                                <Info size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
                                <p className="text-xs text-blue-800 leading-relaxed">
                                    Notifications are only available on the mobile app. Download the Android app to enable push notifications.
                                </p>
                            </div>
                        </div>
                    )}
                    <ToggleSwitch
                        label="Message Notifications"
                        description="Get notified when you receive messages"
                        value={settings.notifyMessages}
                        onChange={(val) => setSettings({ ...settings, notifyMessages: val })}
                        icon={MessageCircle}
                        disabled={!isMobileApp}
                        badge={!isMobileApp ? "Android" : null}
                    />
                    <ToggleSwitch
                        label="Job Offer Notifications"
                        description="Get notified about new job offers"
                        value={settings.notifyJobOffers}
                        onChange={(val) => setSettings({ ...settings, notifyJobOffers: val })}
                        icon={Briefcase}
                        disabled={!isMobileApp}
                        badge={!isMobileApp ? "Android" : null}
                    />
                    <ToggleSwitch
                        label="Wink Notifications"
                        description="Get notified when someone winks at you"
                        value={settings.notifyWinks}
                        onChange={(val) => setSettings({ ...settings, notifyWinks: val })}
                        icon={Heart}
                        disabled={!isMobileApp}
                        badge={!isMobileApp ? "Android" : null}
                    />
                </div>

                {/* Privacy Controls - Free */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-slate-900 flex items-center gap-2">
                            <Lock size={18} className="text-orange-500" /> Privacy Controls
                        </h3>
                        <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-200">
                            FREE
                        </span>
                    </div>
                    <ToggleSwitch
                        label="Hide Distance"
                        description="Show region only instead of exact distance"
                        value={settings.hideDistance}
                        onChange={(val) => setSettings({ ...settings, hideDistance: val })}
                        icon={MapPin}
                    />
                    <ToggleSwitch
                        label="Hide Age"
                        description="Don't show your age on your profile"
                        value={settings.hideAge}
                        onChange={(val) => setSettings({ ...settings, hideAge: val })}
                        icon={User}
                    />
                    {profile?.role === 'tradie' && (
                        <ToggleSwitch
                            label="Job-Only Visibility"
                            description="Appear in Hire tab only, not Social feed"
                            value={settings.jobOnlyVisibility}
                            onChange={(val) => setSettings({ ...settings, jobOnlyVisibility: val })}
                            icon={Briefcase}
                        />
                    )}
                </div>

                {/* Premium Privacy Controls */}
                <div className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-xl shadow-sm border-2 border-orange-200 p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-slate-900 flex items-center gap-2">
                            <Shield size={18} className="text-orange-600" /> GayTradies Elite
                        </h3>
                        <span className="text-xs font-bold text-orange-700 bg-orange-200 px-2 py-1 rounded-full border border-orange-300 flex items-center gap-1">
                            <Star size={10} className="fill-orange-700" /> PREMIUM
                        </span>
                    </div>
                    <div className="mb-3 p-3 bg-white/60 backdrop-blur-sm rounded-lg border border-orange-200">
                        <p className="text-xs text-slate-700 leading-relaxed mb-2">
                            Unlock advanced privacy features with GayTradies Elite:
                        </p>
                        <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside">
                            <li>Browse anonymously with Incognito Mode</li>
                            <li>Control who can see your profile</li>
                            <li>Blur photos and hide online status</li>
                            <li>Screenshot detection & auto-delete chats</li>
                        </ul>
                    </div>
                    <ToggleSwitch
                        label="Incognito Mode"
                        description="Hide your profile while still browsing others"
                        value={settings.incognitoMode}
                        onChange={(val) => setSettings({ ...settings, incognitoMode: val })}
                        icon={EyeOff}
                        disabled={!canUsePremium}
                        badge={!canUsePremium ? "Soon" : null}
                    />
                    <ToggleSwitch
                        label="Verified Tradies Only"
                        description="Show your profile only to verified tradies"
                        value={settings.verifiedOnly}
                        onChange={(val) => setSettings({ ...settings, verifiedOnly: val })}
                        icon={ShieldCheck}
                        disabled={!canUsePremium}
                        badge={!canUsePremium ? "Soon" : null}
                    />
                    <ToggleSwitch
                        label="Photo Blur"
                        description="Blurs your profile picture in Social feed"
                        value={settings.blurPhotos}
                        onChange={(val) => setSettings({ ...settings, blurPhotos: val })}
                        icon={Eye}
                        disabled={!canUsePremium}
                        badge={!canUsePremium ? "Soon" : null}
                    />
                    <ToggleSwitch
                        label="Hide Online Status"
                        description="Don't show when you're active"
                        value={settings.hideOnlineStatus}
                        onChange={(val) => setSettings({ ...settings, hideOnlineStatus: val })}
                        icon={Clock}
                        disabled={!canUsePremium}
                        badge={!canUsePremium ? "Soon" : null}
                    />
                    
                    {/* Additional Premium Privacy Features */}
                    <div className="pt-3 mt-3 border-t border-orange-200">
                        <h4 className="font-bold text-sm text-slate-800 mb-3 flex items-center gap-2">
                            <Lock size={14} className="text-orange-600" /> Advanced Privacy
                        </h4>
                        
                        {/* Auto-delete chats */}
                        <div className="py-3 border-b border-orange-100">
                            <label className="block mb-2">
                                <div className="flex items-center gap-2 mb-1">
                                    <Trash2 size={16} className="text-slate-500" />
                                    <span className="font-bold text-sm text-slate-800">Auto-delete Chats</span>
                                    {!isMobileApp && (
                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700">
                                            Android Only
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-slate-500 mb-2">Automatically delete messages after</p>
                            </label>
                            <select
                                value={settings.autoDeleteChats}
                                onChange={(e) => setSettings({ ...settings, autoDeleteChats: e.target.value })}
                                className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                                disabled={!canUsePremium || !isMobileApp}
                            >
                                <option value="never">Never</option>
                                <option value="24h">24 hours</option>
                                <option value="48h">48 hours</option>
                                <option value="72h">72 hours</option>
                            </select>
                        </div>

                        <ToggleSwitch
                            label="Screenshot Detection"
                            description="Alert you when someone takes a screenshot"
                            value={settings.screenshotDetection}
                            onChange={(val) => setSettings({ ...settings, screenshotDetection: val })}
                            icon={Camera}
                            disabled={!canUsePremium || !isMobileApp}
                            badge={!isMobileApp ? "Android" : (!canUsePremium ? "Soon" : null)}
                        />
                        <ToggleSwitch
                            label="Verified-Only Chats"
                            description="Only receive messages from verified profiles"
                            value={settings.verifiedOnlyChats}
                            onChange={(val) => setSettings({ ...settings, verifiedOnlyChats: val })}
                            icon={UserCheck}
                            disabled={!canUsePremium}
                            badge={!canUsePremium ? "Soon" : null}
                        />
                    </div>
                    
                    {/* Login History */}
                    <div className="pt-3 mt-3 border-t border-orange-200">
                        <button
                            onClick={() => setShowLoginHistory(true)}
                            className="w-full flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <Shield size={16} className="text-slate-600" />
                                <span className="font-bold text-sm text-slate-800">Login History</span>
                            </div>
                            <ChevronRight size={16} className="text-slate-400" />
                        </button>
                    </div>
                </div>

                {/* Blocked Users */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
                    <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                        <Ban size={18} className="text-orange-500" /> Blocked Users
                    </h3>
                    <button
                        onClick={() => setShowBlockedUsers(true)}
                        className="w-full flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <UserX size={16} className="text-slate-600" />
                            <span className="font-bold text-sm text-slate-800">Manage Blocked Users</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-bold">
                                {blockedUsers.length}
                            </span>
                            <ChevronRight size={16} className="text-slate-400" />
                        </div>
                    </button>
                </div>

                {/* Danger Zone - Delete Account */}
                <div className="bg-red-50 rounded-xl border-2 border-red-200 p-4">
                    <h3 className="font-bold text-red-900 mb-2 flex items-center gap-2">
                        <AlertTriangle size={18} className="text-red-600" /> Danger Zone
                    </h3>
                    <p className="text-red-700 text-sm mb-3">
                        Permanently delete your account and all associated data. This action cannot be undone.
                    </p>
                    <Button 
                        variant="danger" 
                        className="w-full py-3"
                        onClick={async () => {
                            if (!confirm('Are you absolutely sure? This will permanently delete your account, profile, messages, and all data. This action CANNOT be undone!')) {
                                return;
                            }
                            
                            if (!confirm('Last chance! Type DELETE in the next prompt to confirm.')) {
                                return;
                            }
                            
                            const confirmation = prompt('Type DELETE to confirm account deletion:');
                            if (confirmation !== 'DELETE') {
                                showToast('Account deletion cancelled', 'info');
                                return;
                            }
                            
                            try {
                                showToast('Deleting account...', 'info');
                                
                                // Helper function to delete documents in batches (Firestore limit is 500 per batch)
                                const deleteInBatches = async (docsToDelete) => {
                                    const batchSize = 500;
                                    for (let i = 0; i < docsToDelete.length; i += batchSize) {
                                        const batch = writeBatch(db);
                                        const batchDocs = docsToDelete.slice(i, i + batchSize);
                                        batchDocs.forEach(docRef => batch.delete(docRef));
                                        await batch.commit();
                                    }
                                };
                                
                                try {
                                    // Delete all chats where user is a participant
                                    const chatsQuery = query(
                                        collection(db, 'artifacts', getAppId(), 'public', 'data', 'chats'),
                                        where('participants', 'array-contains', user.uid)
                                    );
                                    const chatsSnapshot = await getDocs(chatsQuery);
                                    const docsToDelete = [];
                                    
                                    for (const chatDoc of chatsSnapshot.docs) {
                                        // Collect all messages in the chat
                                        const messagesQuery = collection(db, 'artifacts', getAppId(), 'public', 'data', 'chats', chatDoc.id, 'messages');
                                        const messagesSnapshot = await getDocs(messagesQuery);
                                        messagesSnapshot.docs.forEach(msgDoc => docsToDelete.push(msgDoc.ref));
                                        // Add chat document itself
                                        docsToDelete.push(chatDoc.ref);
                                    }
                                    
                                    if (docsToDelete.length > 0) {
                                        await deleteInBatches(docsToDelete);
                                    }
                                } catch (error) {
                                    console.error('Error deleting chats:', error);
                                    // Continue with other deletions
                                }
                                
                                try {
                                    // Delete all jobs associated with user (as client or tradie)
                                    const jobsQuery1 = query(
                                        collection(db, 'artifacts', getAppId(), 'public', 'data', 'jobs'),
                                        where('clientId', '==', user.uid)
                                    );
                                    const jobsSnapshot1 = await getDocs(jobsQuery1);
                                    
                                    const jobsQuery2 = query(
                                        collection(db, 'artifacts', getAppId(), 'public', 'data', 'jobs'),
                                        where('tradieId', '==', user.uid)
                                    );
                                    const jobsSnapshot2 = await getDocs(jobsQuery2);
                                    
                                    const jobDocs = [...jobsSnapshot1.docs, ...jobsSnapshot2.docs].map(doc => doc.ref);
                                    if (jobDocs.length > 0) {
                                        await deleteInBatches(jobDocs);
                                    }
                                } catch (error) {
                                    console.error('Error deleting jobs:', error);
                                    // Continue with other deletions
                                }
                                
                                try {
                                    // Delete all transactions
                                    const transactionsQuery = query(
                                        collection(db, 'artifacts', getAppId(), 'public', 'data', 'transactions'),
                                        where('userId', '==', user.uid)
                                    );
                                    const transactionsSnapshot = await getDocs(transactionsQuery);
                                    const txDocs = transactionsSnapshot.docs.map(doc => doc.ref);
                                    if (txDocs.length > 0) {
                                        await deleteInBatches(txDocs);
                                    }
                                } catch (error) {
                                    console.error('Error deleting transactions:', error);
                                    // Continue with other deletions
                                }
                                
                                try {
                                    // Delete blocked users records
                                    const blockedQuery1 = query(
                                        collection(db, 'artifacts', getAppId(), 'public', 'data', 'blocked_users'),
                                        where('blockedBy', '==', user.uid)
                                    );
                                    const blockedSnapshot1 = await getDocs(blockedQuery1);
                                    
                                    const blockedQuery2 = query(
                                        collection(db, 'artifacts', getAppId(), 'public', 'data', 'blocked_users'),
                                        where('blockedUser', '==', user.uid)
                                    );
                                    const blockedSnapshot2 = await getDocs(blockedQuery2);
                                    
                                    const blockedDocs = [...blockedSnapshot1.docs, ...blockedSnapshot2.docs].map(doc => doc.ref);
                                    if (blockedDocs.length > 0) {
                                        await deleteInBatches(blockedDocs);
                                    }
                                } catch (error) {
                                    console.error('Error deleting blocked users:', error);
                                    // Continue with other deletions
                                }
                                
                                // Delete profile document
                                await deleteDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', user.uid));
                                
                                // Delete Firebase Auth account
                                await deleteUser(user);
                                
                                showToast('Account deleted successfully', 'success');
                                // User will be automatically signed out and redirected to landing
                            } catch (error) {
                                console.error('Error deleting account:', error);
                                if (error.code === 'auth/requires-recent-login') {
                                    alert('For security, please log out and log back in before deleting your account.');
                                } else {
                                    showToast('Failed to delete account: ' + error.message, 'error');
                                }
                            }
                        }}
                    >
                        <Trash2 size={16} className="inline mr-2" />
                        Delete My Account
                    </Button>
                </div>
            </div>

            {/* Blocked Users Modal */}
            {showBlockedUsers && (
                <div className="fixed inset-0 bg-black/80 z-[100] flex items-end sm:items-center justify-center">
                    <div className="bg-white w-full sm:w-[400px] h-[70vh] sm:h-auto sm:max-h-[70vh] sm:rounded-2xl rounded-t-2xl overflow-hidden shadow-2xl relative flex flex-col">
                        <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                            <h3 className="text-lg font-bold">Blocked Users</h3>
                            <button onClick={() => setShowBlockedUsers(false)}>
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            {blockedUsers.length === 0 ? (
                                <div className="text-center py-10 text-slate-400">
                                    <Ban size={48} className="mx-auto mb-2 opacity-50" />
                                    <p>No blocked users</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {blockedUsers.map((blocked) => (
                                        <div key={blocked.id} className="bg-slate-50 rounded-lg p-3 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                                                    <User size={20} className="text-slate-400" />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-sm">{blocked.blockedUserName || 'User'}</h4>
                                                    <p className="text-xs text-slate-500">
                                                        Blocked {blocked.blockedAt?.toDate ? blocked.blockedAt.toDate().toLocaleDateString() : 'recently'}
                                                    </p>
                                                </div>
                                            </div>
                                            <Button
                                                variant="outline"
                                                className="text-xs py-1 px-3"
                                                onClick={() => handleUnblockUser(blocked.id)}
                                            >
                                                Unblock
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Login History Modal */}
            {showLoginHistory && (
                <div className="fixed inset-0 bg-black/80 z-[100] flex items-end sm:items-center justify-center">
                    <div className="bg-white w-full sm:w-[400px] h-[70vh] sm:h-auto sm:max-h-[70vh] sm:rounded-2xl rounded-t-2xl overflow-hidden shadow-2xl relative flex flex-col">
                        <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                            <h3 className="text-lg font-bold">Active Sessions</h3>
                            <button onClick={() => setShowLoginHistory(false)}>
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            <div className="space-y-2">
                                {activeSessions.map((session) => (
                                    <div key={session.id} className="bg-slate-50 rounded-lg p-3">
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex-1">
                                                <h4 className="font-bold text-sm flex items-center gap-2">
                                                    {session.device}
                                                    {session.isCurrent && (
                                                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                                                            Current
                                                        </span>
                                                    )}
                                                </h4>
                                                <p className="text-xs text-slate-500">{session.location}</p>
                                                <p className="text-xs text-slate-400">Last active: {session.lastActive}</p>
                                            </div>
                                            {!session.isCurrent && (
                                                <Button
                                                    variant="danger"
                                                    className="text-xs py-1 px-3"
                                                    onClick={() => handleLogoutSession(session.id)}
                                                >
                                                    Logout
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- PAYMENTS & CREDITS ---
const PaymentsCredits = ({ user, profile, onBack, showToast }) => {
    const [transactions, setTransactions] = useState([]);
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);
    const [withdrawMethod, setWithdrawMethod] = useState('stripe'); // 'stripe', 'bank', or 'crypto'
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [stripeConnected, setStripeConnected] = useState(false);
    const [stripeAccountId, setStripeAccountId] = useState(null);
    const [showStripeOnboarding, setShowStripeOnboarding] = useState(false);
    const [ageVerified, setAgeVerified] = useState(false);
    const [showAgeVerification, setShowAgeVerification] = useState(false);
    
    // Financial stats
    const onHoldBalance = profile?.finances?.onHoldBalance || 0;
    const availableBalance = profile?.finances?.availableBalance || 0;
    const totalEarnings = profile?.finances?.totalEarnings || 0;
    const totalCommissionPaid = profile?.finances?.totalCommissionPaid || 0;
    
    // Check Stripe connection status
    useEffect(() => {
        if (!user || !db) return;
        
        const checkStripeStatus = async () => {
            try {
                const profileRef = doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', user.uid);
                const profileSnap = await getDoc(profileRef);
                
                if (profileSnap.exists()) {
                    const data = profileSnap.data();
                    setStripeConnected(data.stripeConnected || false);
                    setStripeAccountId(data.stripeAccountId || null);
                    setAgeVerified(data.ageVerified || false);
                }
            } catch (error) {
                console.error('Error checking Stripe status:', error);
            }
        };
        
        checkStripeStatus();
    }, [user]);
    
    // Load transactions
    useEffect(() => {
        if (!user) return;
        
        const q = query(
            collection(db, 'artifacts', getAppId(), 'public', 'data', 'transactions'),
            where('tradieUid', '==', user.uid),
            orderBy('createdAt', 'desc'),
            limit(50)
        );
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const txs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setTransactions(txs);
        });
        
        return () => unsubscribe();
    }, [user]);
    
    const handleStripeOnboarding = async () => {
        try {
            showToast("Initiating Stripe Connect onboarding...", "info");
            
            // This would call your backend to create a Stripe Connect account
            // For now, we'll simulate it and store in Firebase
            const accountId = `acct_${Date.now()}`;
            
            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', user.uid), {
                stripeAccountId: accountId,
                stripeConnected: true,
                stripeOnboardingCompleted: serverTimestamp()
            });
            
            setStripeConnected(true);
            setStripeAccountId(accountId);
            showToast("Stripe account connected successfully!", "success");
        } catch (error) {
            console.error("Error onboarding Stripe:", error);
            showToast("Failed to connect Stripe account", "error");
        }
    };
    
    const handleAgeVerification = async () => {
        try {
            showToast("Initiating age verification...", "info");
            
            // This would call Stripe Identity API
            // For now, we'll mark as verified in Firebase
            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', user.uid), {
                ageVerified: true,
                ageVerifiedAt: serverTimestamp()
            });
            
            setAgeVerified(true);
            setShowAgeVerification(false);
            showToast("Age verification completed!", "success");
        } catch (error) {
            console.error("Error verifying age:", error);
            showToast("Failed to verify age", "error");
        }
    };
    
    const handleWithdraw = async () => {
        if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
            showToast("Please enter a valid amount", "error");
            return;
        }
        
        const amount = parseFloat(withdrawAmount);
        if (amount > availableBalance) {
            showToast("Insufficient available balance", "error");
            return;
        }
        
        if (withdrawMethod === 'stripe' && !stripeConnected) {
            showToast("Please connect your Stripe account first", "error");
            return;
        }
        
        try {
            // Create withdrawal transaction
            await addDoc(collection(db, 'artifacts', getAppId(), 'public', 'data', 'transactions'), {
                tradieUid: user.uid,
                type: 'withdrawal',
                amount: -amount,
                method: withdrawMethod,
                status: 'pending',
                stripeAccountId: withdrawMethod === 'stripe' ? stripeAccountId : null,
                createdAt: serverTimestamp()
            });
            
            // Update user's available balance
            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', user.uid), {
                'finances.availableBalance': increment(-amount)
            });
            
            const methodName = withdrawMethod === 'stripe' ? 'Stripe' : withdrawMethod === 'bank' ? 'Bank Transfer' : 'Crypto Wallet';
            showToast(`Withdrawal of £${amount.toFixed(2)} initiated via ${methodName}`, "success");
            setShowWithdrawModal(false);
            setWithdrawAmount('');
        } catch (error) {
            console.error("Error processing withdrawal:", error);
            showToast("Failed to process withdrawal", "error");
        }
    };
    
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-500 via-orange-600 to-orange-500 text-white p-5 sticky top-0 z-10 shadow-xl">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2.5 hover:bg-white/20 rounded-xl transition-all duration-300 hover:scale-110">
                        <ChevronLeft size={24} />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">
                            <DollarSign size={24} />
                        </div>
                        <h1 className="text-2xl font-bold">Payments & Credits</h1>
                    </div>
                </div>
            </div>

            <div className="p-4 space-y-5">
                {/* Stripe Connect Status */}
                {!stripeConnected && (
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-5 text-white shadow-xl border-2 border-blue-400">
                        <div className="flex items-start gap-3 mb-3">
                            <div className="bg-white/20 p-2 rounded-lg">
                                <ShieldCheck size={24} />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-lg mb-1">Connect Stripe Account</h3>
                                <p className="text-sm opacity-90">Enable secure payments and instant payouts with Stripe Connect</p>
                            </div>
                        </div>
                        <button
                            onClick={handleStripeOnboarding}
                            className="w-full py-3 bg-white text-blue-600 rounded-xl font-bold shadow-lg hover:bg-blue-50 transition-all duration-300 hover:scale-105"
                        >
                            Connect Stripe Account
                        </button>
                    </div>
                )}
                
                {stripeConnected && (
                    <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-4 text-white shadow-xl border-2 border-green-400">
                        <div className="flex items-center gap-2">
                            <CheckCircle size={20} />
                            <p className="text-sm font-bold">Stripe Connected</p>
                        </div>
                    </div>
                )}
                
                {/* Age Verification Status */}
                {!ageVerified && (
                    <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-5 text-white shadow-xl border-2 border-purple-400">
                        <div className="flex items-start gap-3 mb-3">
                            <div className="bg-white/20 p-2 rounded-lg">
                                <Shield size={24} />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-lg mb-1">Verify Your Age</h3>
                                <p className="text-sm opacity-90">Complete age verification to unlock all features (18+ required)</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowAgeVerification(true)}
                            className="w-full py-3 bg-white text-purple-600 rounded-xl font-bold shadow-lg hover:bg-purple-50 transition-all duration-300 hover:scale-105"
                        >
                            Verify Age (18+)
                        </button>
                    </div>
                )}
                
                {ageVerified && (
                    <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-4 text-white shadow-xl border-2 border-emerald-400">
                        <div className="flex items-center gap-2">
                            <CheckCircle size={20} />
                            <p className="text-sm font-bold">Age Verified (18+)</p>
                        </div>
                    </div>
                )}
                
                {/* Balance Cards */}
                <div className="grid grid-cols-2 gap-4">
                    {/* On Hold */}
                    <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-5 text-white shadow-xl border-2 border-amber-400 transform hover:scale-105 transition-all duration-300">
                        <div className="flex items-center gap-2 mb-2">
                            <Clock size={20} />
                            <p className="text-xs font-bold opacity-90">On Hold</p>
                        </div>
                        <p className="text-3xl font-extrabold">£{onHoldBalance.toFixed(2)}</p>
                        <p className="text-xs opacity-80 mt-1">Pending completion</p>
                    </div>
                    
                    {/* Available */}
                    <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-5 text-white shadow-xl border-2 border-green-400 transform hover:scale-105 transition-all duration-300">
                        <div className="flex items-center gap-2 mb-2">
                            <CheckCircle size={20} />
                            <p className="text-xs font-bold opacity-90">Available</p>
                        </div>
                        <p className="text-3xl font-extrabold">£{availableBalance.toFixed(2)}</p>
                        <p className="text-xs opacity-80 mt-1">Ready to withdraw</p>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 gap-4">
                    {/* Total Earnings */}
                    <div className="bg-white rounded-2xl p-5 shadow-xl border-2 border-slate-200 hover:border-orange-400 transition-all duration-300">
                        <p className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1">Total Earnings</p>
                        <p className="text-2xl font-extrabold text-slate-900">£{totalEarnings.toFixed(2)}</p>
                    </div>
                    
                    {/* Commission Paid */}
                    <div className="bg-white rounded-2xl p-5 shadow-xl border-2 border-slate-200 hover:border-orange-400 transition-all duration-300">
                        <p className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1">Commission (15%)</p>
                        <p className="text-2xl font-extrabold text-slate-900">£{totalCommissionPaid.toFixed(2)}</p>
                    </div>
                </div>

                {/* Withdraw Button */}
                <button
                    onClick={() => setShowWithdrawModal(true)}
                    disabled={availableBalance <= 0}
                    className={`w-full py-4 rounded-2xl font-bold text-white shadow-xl transition-all duration-300 ${
                        availableBalance > 0
                            ? 'bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 hover:from-blue-600 hover:via-blue-700 hover:to-blue-800 hover:scale-105 hover:shadow-2xl'
                            : 'bg-gradient-to-r from-slate-300 to-slate-400 cursor-not-allowed'
                    }`}
                >
                    <div className="flex items-center justify-center gap-2">
                        <DollarSign size={22} />
                        <span>Withdraw Funds</span>
                    </div>
                </button>

                {/* Transactions History */}
                <div className="bg-white rounded-2xl shadow-xl border-2 border-slate-200">
                    <div className="p-4 border-b border-slate-100">
                        <h2 className="font-bold text-slate-900">Transaction History</h2>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {transactions.length === 0 ? (
                            <div className="p-8 text-center text-slate-400">
                                <DollarSign size={48} className="mx-auto mb-2 opacity-50" />
                                <p className="text-sm">No transactions yet</p>
                            </div>
                        ) : (
                            transactions.map(tx => (
                                <div key={tx.id} className="p-4 flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="text-sm font-bold text-slate-900 capitalize">{tx.type}</p>
                                            {tx.status === 'pending' && (
                                                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Pending</span>
                                            )}
                                            {tx.status === 'completed' && (
                                                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Completed</span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-500">
                                            {tx.jobTitle || (tx.method ? `Via ${tx.method === 'bank' ? 'Bank' : 'Crypto'}` : 'Payment')}
                                        </p>
                                        {tx.createdAt?.seconds && (
                                            <p className="text-xs text-slate-400 mt-1">
                                                {new Date(tx.createdAt.seconds * 1000).toLocaleDateString()}
                                            </p>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-lg font-bold ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {tx.amount >= 0 ? '+' : ''}£{Math.abs(tx.amount).toFixed(2)}
                                        </p>
                                        {tx.commission && (
                                            <p className="text-xs text-slate-500">-£{tx.commission.toFixed(2)} fee</p>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Withdraw Modal */}
            {showWithdrawModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full max-h-[75vh] overflow-y-auto">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-slate-900">Withdraw Funds</h2>
                            <button onClick={() => setShowWithdrawModal(false)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="p-6 space-y-4">
                            {/* Available Balance */}
                            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                                <p className="text-xs font-bold text-green-700 uppercase tracking-wider mb-1">Available Balance</p>
                                <p className="text-2xl font-bold text-green-900">£{availableBalance.toFixed(2)}</p>
                            </div>

                            {/* Withdrawal Method */}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-3">Withdrawal Method</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {stripeConnected && (
                                        <button
                                            onClick={() => setWithdrawMethod('stripe')}
                                            className={`p-3 rounded-xl border-2 transition-all duration-300 ${
                                                withdrawMethod === 'stripe'
                                                    ? 'border-orange-500 bg-orange-50 scale-105 shadow-lg'
                                                    : 'border-slate-200 bg-white hover:border-slate-300'
                                            }`}
                                        >
                                            <p className="text-sm font-bold text-slate-900">Stripe</p>
                                            <p className="text-xs text-slate-500">Instant</p>
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setWithdrawMethod('bank')}
                                        className={`p-3 rounded-xl border-2 transition-all duration-300 ${
                                            withdrawMethod === 'bank'
                                                ? 'border-orange-500 bg-orange-50 scale-105 shadow-lg'
                                                : 'border-slate-200 bg-white hover:border-slate-300'
                                        }`}
                                    >
                                        <p className="text-sm font-bold text-slate-900">Bank</p>
                                        <p className="text-xs text-slate-500">1-3 days</p>
                                    </button>
                                    <button
                                        onClick={() => setWithdrawMethod('crypto')}
                                        className={`p-3 rounded-xl border-2 transition-all duration-300 ${
                                            withdrawMethod === 'crypto'
                                                ? 'border-orange-500 bg-orange-50 scale-105 shadow-lg'
                                                : 'border-slate-200 bg-white hover:border-slate-300'
                                        }`}
                                    >
                                        <p className="text-sm font-bold text-slate-900">Crypto</p>
                                        <p className="text-xs text-slate-500">Fast</p>
                                    </button>
                                </div>
                            </div>

                            {/* Amount */}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Amount (£)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max={availableBalance}
                                    value={withdrawAmount}
                                    onChange={(e) => setWithdrawAmount(e.target.value)}
                                    placeholder="0.00"
                                    className="w-full p-4 border-2 border-slate-300 rounded-xl focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none text-lg font-bold shadow-md"
                                />
                                <button
                                    onClick={() => setWithdrawAmount(availableBalance.toString())}
                                    className="mt-2 text-sm text-orange-600 font-bold hover:text-orange-700 transition-colors"
                                >
                                    Withdraw All
                                </button>
                            </div>

                            {/* Info */}
                            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 shadow-sm">
                                <div className="flex items-start gap-2">
                                    <Info size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
                                    <p className="text-xs text-blue-800 leading-relaxed">
                                        {withdrawMethod === 'stripe'
                                            ? 'Stripe transfers are processed instantly to your connected account.'
                                            : withdrawMethod === 'bank'
                                            ? 'Bank transfers typically arrive within 1-3 business days.'
                                            : 'Crypto withdrawals are processed instantly to your wallet address.'}
                                    </p>
                                </div>
                            </div>

                            {/* Buttons */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setShowWithdrawModal(false)}
                                    className="flex-1 py-3 px-4 rounded-xl border-2 border-slate-300 font-bold text-slate-700 hover:bg-slate-50 transition-all duration-300 hover:scale-105"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleWithdraw}
                                    className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-green-500 via-green-600 to-green-700 text-white font-bold hover:from-green-600 hover:via-green-700 hover:to-green-800 transition-all shadow-xl hover:shadow-2xl hover:scale-105"
                                >
                                    Confirm Withdrawal
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Age Verification Modal */}
            {showAgeVerification && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border-2 border-purple-200">
                        <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-purple-50 to-purple-100">
                            <div className="flex items-center gap-3">
                                <div className="bg-purple-500 p-2 rounded-xl">
                                    <Shield size={24} className="text-white" />
                                </div>
                                <h2 className="text-xl font-bold text-slate-900">Age Verification</h2>
                            </div>
                            <button onClick={() => setShowAgeVerification(false)} className="p-2 hover:bg-purple-200 rounded-lg transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="p-6 space-y-4">
                            <div className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200 rounded-2xl p-5">
                                <h3 className="font-bold text-purple-900 mb-2">Why verify your age?</h3>
                                <ul className="space-y-2 text-sm text-purple-800">
                                    <li className="flex items-start gap-2">
                                        <CheckCircle size={16} className="flex-shrink-0 mt-0.5 text-purple-600" />
                                        <span>Access all platform features</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <CheckCircle size={16} className="flex-shrink-0 mt-0.5 text-purple-600" />
                                        <span>Build trust with verified age badge</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <CheckCircle size={16} className="flex-shrink-0 mt-0.5 text-purple-600" />
                                        <span>Secure verification via Stripe Identity</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <CheckCircle size={16} className="flex-shrink-0 mt-0.5 text-purple-600" />
                                        <span>Quick and easy process</span>
                                    </li>
                                </ul>
                            </div>
                            
                            <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4">
                                <div className="flex items-start gap-2">
                                    <AlertCircle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                                    <p className="text-sm text-amber-800">
                                        <strong>You must be 18+</strong> to use this service. Age verification is required by law and helps keep our community safe.
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setShowAgeVerification(false)}
                                    className="flex-1 py-3 px-4 rounded-xl border-2 border-slate-300 font-bold text-slate-700 hover:bg-slate-50 transition-all duration-300 hover:scale-105"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAgeVerification}
                                    className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-purple-500 via-purple-600 to-purple-700 text-white font-bold hover:from-purple-600 hover:via-purple-700 hover:to-purple-800 transition-all shadow-xl hover:shadow-2xl hover:scale-105"
                                >
                                    Verify Age
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- SAFETY CENTRE ---
const SafetyCentre = ({ user, onBack, showToast }) => {
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportType, setReportType] = useState('user');
    const [reportDetails, setReportDetails] = useState('');
    const [trustedContacts, setTrustedContacts] = useState([]);
    const [showTrustedContactsModal, setShowTrustedContactsModal] = useState(false);
    const [newContactName, setNewContactName] = useState('');
    const [newContactPhone, setNewContactPhone] = useState('');

    // Load trusted contacts
    useEffect(() => {
        if (!user || !db) return;
        const unsub = onSnapshot(
            doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', user.uid),
            (docSnap) => {
                if (docSnap.exists()) {
                    setTrustedContacts(docSnap.data().trustedContacts || []);
                }
            }
        );
        return () => unsub();
    }, [user]);

    const handleSubmitReport = async () => {
        if (!reportDetails.trim()) {
            showToast("Please provide details", "error");
            return;
        }

        try {
            await addDoc(collection(db, 'artifacts', getAppId(), 'public', 'data', 'reports'), {
                reportedBy: user.uid,
                reportType,
                details: reportDetails,
                createdAt: serverTimestamp(),
                status: 'pending'
            });
            showToast("Report submitted. We'll review this promptly.", "success");
            setShowReportModal(false);
            setReportDetails('');
        } catch (error) {
            console.error("Error submitting report:", error);
            showToast("Failed to submit report", "error");
        }
    };

    const handleAddTrustedContact = async () => {
        if (!newContactName.trim() || !newContactPhone.trim()) {
            showToast("Please fill all fields", "error");
            return;
        }

        try {
            const newContact = {
                id: Date.now().toString(),
                name: newContactName,
                phone: newContactPhone,
                addedAt: new Date().toISOString()
            };
            
            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', user.uid), {
                trustedContacts: arrayUnion(newContact)
            });
            
            showToast("Trusted contact added", "success");
            setNewContactName('');
            setNewContactPhone('');
        } catch (error) {
            console.error("Error adding trusted contact:", error);
            showToast("Failed to add contact", "error");
        }
    };

    const handleQuickExit = () => {
        // Redirect to a neutral site without leaving browser history trail
        window.location.replace('https://www.google.com');
    };

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white sticky top-0 z-40">
                <div className="p-4 flex items-center gap-3">
                    <button onClick={onBack}><ArrowRight className="rotate-180" size={20} /></button>
                    <div className="flex-1">
                        <h1 className="text-xl font-bold">Safety Centre</h1>
                        <p className="text-xs opacity-90">Your safety is our priority</p>
                    </div>
                    <Shield size={24} />
                </div>
            </div>

            {/* Quick Exit Button */}
            <div className="p-4 bg-red-50 border-b border-red-100">
                <Button
                    variant="danger"
                    className="w-full py-3 flex items-center justify-center gap-2"
                    onClick={handleQuickExit}
                >
                    <AlertTriangle size={18} />
                    Quick Exit / Panic Button
                </Button>
                <p className="text-xs text-red-700 text-center mt-2">
                    Instantly redirects to Google for your safety
                </p>
            </div>

            <div className="p-4 space-y-4">
                {/* Critical Actions */}
                <div className="space-y-3">
                    <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wide">Critical Actions</h3>
                    
                    <SafetyCard
                        icon={Flag}
                        title="Report User"
                        description="Report harassment, hate speech, or inappropriate behavior"
                        action={() => { setReportType('user'); setShowReportModal(true); }}
                        actionLabel="Report a User"
                        variant="danger"
                    />
                    
                    <SafetyCard
                        icon={AlertCircle}
                        title="Report Safety Concern"
                        description="Report a job-related safety issue or scam attempt"
                        action={() => { setReportType('safety'); setShowReportModal(true); }}
                        actionLabel="Report Concern"
                        variant="danger"
                    />
                    
                    <SafetyCard
                        icon={Phone}
                        title="Emergency Support"
                        description="Get immediate help from local emergency services"
                        action={() => window.location.href = 'tel:999'}
                        actionLabel="Call Emergency Services"
                        variant="danger"
                    />
                </div>

                {/* Educational Content */}
                <div className="space-y-3 mt-6">
                    <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wide">Safety Guides</h3>
                    
                    <SafetyCard
                        icon={ShieldCheck}
                        title="Verification Process"
                        description="Learn how our verification system protects you and ensures tradies are qualified"
                        action={() => showToast("Verification guide opened", "info")}
                        actionLabel="Learn More"
                    />
                    
                    <SafetyCard
                        icon={Briefcase}
                        title="Safe Hiring Guidelines"
                        description="Best practices for hiring tradies, including deposit warnings and contract tips"
                        action={() => showToast("Safe hiring guide opened", "info")}
                        actionLabel="Read Guidelines"
                    />
                    
                    <SafetyCard
                        icon={HardHat}
                        title="In-Home Conduct"
                        description="What to expect when tradies work in your home and how to stay safe"
                        action={() => showToast("Conduct guide opened", "info")}
                        actionLabel="View Guide"
                    />
                    
                    <SafetyCard
                        icon={Lock}
                        title="Privacy Protection"
                        description="How we protect against outing, doxxing, and unwanted exposure"
                        action={() => showToast("Privacy guide opened", "info")}
                        actionLabel="Learn More"
                    />
                    
                    <SafetyCard
                        icon={Ban}
                        title="Harassment Policy"
                        description="Our zero-tolerance policy for hate speech and harassment"
                        action={() => showToast("Policy opened", "info")}
                        actionLabel="Read Policy"
                    />
                    
                    <SafetyCard
                        icon={Heart}
                        title="Consent Guidelines"
                        description="Understanding consent in professional and personal interactions"
                        action={() => showToast("Consent guidelines opened", "info")}
                        actionLabel="View Guidelines"
                    />
                    
                    <SafetyCard
                        icon={AlertTriangle}
                        title="Scam Prevention"
                        description="How to spot and avoid scams, including deposit fraud and fake profiles"
                        action={() => showToast("Scam prevention guide opened", "info")}
                        actionLabel="Stay Safe"
                    />
                </div>

                {/* Advanced Safety Features */}
                <div className="space-y-3 mt-6">
                    <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wide">Advanced Safety</h3>
                    
                    <SafetyCard
                        icon={Users}
                        title="Trusted Contacts"
                        description="Add trusted people who can be notified about your job bookings"
                        action={() => setShowTrustedContactsModal(true)}
                        actionLabel="Manage Contacts"
                    />
                </div>

                {/* Resources */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-xl p-6 mt-6">
                    <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                        <Info size={20} />
                        Need Help?
                    </h3>
                    <p className="text-sm text-slate-300 mb-4">
                        If you're experiencing issues or need support, we're here to help 24/7.
                    </p>
                    <div className="space-y-2">
                        <a
                            href="https://www.galop.org.uk/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-3 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                        >
                            <span className="text-sm font-medium">Galop LGBT+ Hate Crime Support</span>
                            <ExternalLink size={16} />
                        </a>
                        <a
                            href="https://www.switchboard.lgbt/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-3 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                        >
                            <span className="text-sm font-medium">Switchboard LGBT+ Helpline</span>
                            <ExternalLink size={16} />
                        </a>
                    </div>
                </div>
            </div>

            {/* Report Modal */}
            {showReportModal && (
                <div className="fixed inset-0 bg-black/80 z-[100] flex items-end sm:items-center justify-center p-4">
                    <div className="bg-white w-full sm:w-[400px] sm:rounded-2xl rounded-t-2xl overflow-hidden shadow-2xl">
                        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-red-50">
                            <h3 className="text-lg font-bold text-red-900">Submit Report</h3>
                            <button onClick={() => setShowReportModal(false)}>
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        <div className="p-4">
                            <p className="text-sm text-slate-600 mb-4">
                                Your report will be reviewed by our safety team. All reports are taken seriously and handled confidentially.
                            </p>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-slate-700 mb-2">Report Type</label>
                                <select
                                    value={reportType}
                                    onChange={(e) => setReportType(e.target.value)}
                                    className="w-full p-3 border border-slate-300 rounded-lg"
                                >
                                    <option value="user">User Behavior</option>
                                    <option value="safety">Safety Concern</option>
                                    <option value="scam">Scam/Fraud</option>
                                    <option value="harassment">Harassment</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-slate-700 mb-2">Details</label>
                                <textarea
                                    value={reportDetails}
                                    onChange={(e) => setReportDetails(e.target.value)}
                                    placeholder="Please provide as much detail as possible..."
                                    rows={4}
                                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none"
                                />
                            </div>
                            <div className="flex gap-2">
                                <Button variant="ghost" className="flex-1" onClick={() => setShowReportModal(false)}>
                                    Cancel
                                </Button>
                                <Button variant="danger" className="flex-1" onClick={handleSubmitReport}>
                                    Submit Report
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Trusted Contacts Modal */}
            {showTrustedContactsModal && (
                <div className="fixed inset-0 bg-black/80 z-[100] flex items-end sm:items-center justify-center p-4">
                    <div className="bg-white w-full sm:w-[400px] h-[80vh] sm:h-auto sm:max-h-[80vh] sm:rounded-2xl rounded-t-2xl overflow-hidden shadow-2xl flex flex-col">
                        <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                            <h3 className="text-lg font-bold">Trusted Contacts</h3>
                            <button onClick={() => setShowTrustedContactsModal(false)}>
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            <p className="text-sm text-slate-600 mb-4">
                                Add trusted contacts who can be notified about your job bookings for added safety.
                            </p>
                            
                            {/* Add New Contact Form */}
                            <div className="bg-slate-50 rounded-lg p-4 mb-4">
                                <h4 className="font-bold text-sm mb-3">Add New Contact</h4>
                                <Input
                                    label="Name"
                                    placeholder="e.g., Sarah Smith"
                                    value={newContactName}
                                    onChange={(e) => setNewContactName(e.target.value)}
                                />
                                <Input
                                    label="Phone Number"
                                    placeholder="e.g., 07700 900000"
                                    value={newContactPhone}
                                    onChange={(e) => setNewContactPhone(e.target.value)}
                                />
                                <Button
                                    variant="secondary"
                                    className="w-full text-sm"
                                    onClick={handleAddTrustedContact}
                                >
                                    Add Contact
                                </Button>
                            </div>

                            {/* Existing Contacts List */}
                            {trustedContacts.length > 0 && (
                                <div>
                                    <h4 className="font-bold text-sm mb-2">Your Contacts</h4>
                                    <div className="space-y-2">
                                        {trustedContacts.map((contact) => (
                                            <div key={contact.id} className="bg-white border border-slate-200 rounded-lg p-3">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <h5 className="font-bold text-sm">{contact.name}</h5>
                                                        <p className="text-xs text-slate-500">{contact.phone}</p>
                                                    </div>
                                                    <Phone size={16} className="text-orange-500" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- WORK CALENDAR COMPONENT ---
const WorkCalendar = ({ user, onBack, showToast }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [unavailability, setUnavailability] = useState({});
    const [selectedDate, setSelectedDate] = useState(null);

    // Helper to get profile document reference
    const getProfileDocRef = useCallback(
        () => doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', user.uid),
        [user]
    );

    // Load unavailability data from Firebase
    useEffect(() => {
        if (!user || !db) return;
        const unsub = onSnapshot(
            getProfileDocRef(),
            (docSnap) => {
                if (docSnap.exists()) {
                    setUnavailability(docSnap.data().workCalendar || {});
                } else {
                    setUnavailability({});
                }
            }
        );
        return () => unsub();
    }, [user, getProfileDocRef]);

    // Calendar helper functions
    const getDaysInMonth = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();
        
        return { daysInMonth, startingDayOfWeek, year, month };
    };

    const navigateMonth = (direction) => {
        const newDate = new Date(currentDate);
        newDate.setMonth(currentDate.getMonth() + direction);
        setCurrentDate(newDate);
    };

    const toggleTimeSlot = async (dateKey, timeSlot) => {
        const newUnavailability = { ...unavailability };
        
        // Initialize date if it doesn't exist (use object format for new entries)
        if (!newUnavailability[dateKey]) {
            newUnavailability[dateKey] = {};
        }
        
        // Convert old array format to new object format if needed
        if (Array.isArray(newUnavailability[dateKey])) {
            const oldSlots = newUnavailability[dateKey];
            newUnavailability[dateKey] = {};
            oldSlots.forEach(slot => {
                newUnavailability[dateKey][slot] = { reason: 'manual' };
            });
        }
        
        const dateSlots = newUnavailability[dateKey];
        
        // Toggle the slot (only allow toggling manual slots, not job slots)
        if (dateSlots[timeSlot]) {
            // Only allow removing manual unavailability, not job-based
            if (dateSlots[timeSlot].reason === 'manual') {
                delete dateSlots[timeSlot];
            } else {
                showToast("Cannot remove job-booked time slots", "error");
                return;
            }
        } else {
            dateSlots[timeSlot] = { reason: 'manual' };
        }
        
        // Clean up empty date entries
        if (Object.keys(dateSlots).length === 0) {
            delete newUnavailability[dateKey];
        }
        
        try {
            // If workCalendar is now empty, remove the field entirely from Firebase
            if (Object.keys(newUnavailability).length === 0) {
                await updateDoc(getProfileDocRef(), {
                    workCalendar: deleteField()
                });
            } else {
                await updateDoc(getProfileDocRef(), {
                    workCalendar: newUnavailability
                });
            }
            setUnavailability(newUnavailability);
            showToast("Availability updated", "success");
        } catch (error) {
            console.error("Error updating availability:", error);
            showToast("Failed to update availability", "error");
        }
    };

    const blockEntireDay = async (dateKey) => {
        const newUnavailability = { ...unavailability };
        
        // Convert to object format if needed
        if (Array.isArray(newUnavailability[dateKey])) {
            const oldSlots = newUnavailability[dateKey];
            newUnavailability[dateKey] = {};
            oldSlots.forEach(slot => {
                newUnavailability[dateKey][slot] = { reason: 'manual' };
            });
        } else if (!newUnavailability[dateKey]) {
            newUnavailability[dateKey] = {};
        }
        
        // Block all time slots (preserve job slots)
        ['morning', 'afternoon', 'evening'].forEach(slot => {
            if (!newUnavailability[dateKey][slot] || newUnavailability[dateKey][slot].reason !== 'job') {
                newUnavailability[dateKey][slot] = { reason: 'manual' };
            }
        });
        
        try {
            await updateDoc(getProfileDocRef(), {
                workCalendar: newUnavailability
            });
            setUnavailability(newUnavailability);
            showToast("Entire day blocked", "success");
        } catch (error) {
            console.error("Error blocking day:", error);
            showToast("Failed to block day", "error");
        }
    };

    const blockEntireWeek = async (startDateKey) => {
        const newUnavailability = { ...unavailability };
        const startDate = new Date(startDateKey + 'T00:00:00');
        
        // Block 7 days starting from the selected date
        for (let i = 0; i < 7; i++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            const dateKey = formatDateKey(date);
            
            // Convert to object format if needed
            if (Array.isArray(newUnavailability[dateKey])) {
                const oldSlots = newUnavailability[dateKey];
                newUnavailability[dateKey] = {};
                oldSlots.forEach(slot => {
                    newUnavailability[dateKey][slot] = { reason: 'manual' };
                });
            } else if (!newUnavailability[dateKey]) {
                newUnavailability[dateKey] = {};
            }
            
            // Block all time slots (preserve job slots)
            ['morning', 'afternoon', 'evening'].forEach(slot => {
                if (!newUnavailability[dateKey][slot] || newUnavailability[dateKey][slot].reason !== 'job') {
                    newUnavailability[dateKey][slot] = { reason: 'manual' };
                }
            });
        }
        
        try {
            await updateDoc(getProfileDocRef(), {
                workCalendar: newUnavailability
            });
            setUnavailability(newUnavailability);
            showToast("Entire week blocked", "success");
        } catch (error) {
            console.error("Error blocking week:", error);
            showToast("Failed to block week", "error");
        }
    };

    const blockEntireMonth = async (dateKey) => {
        const newUnavailability = { ...unavailability };
        const [yearStr, monthStr] = dateKey.split('-');
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10) - 1;
        
        // Get the number of days in the month
        const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
        
        // Block all days in the month
        for (let day = 1; day <= lastDayOfMonth; day++) {
            const date = new Date(year, month, day);
            const key = formatDateKey(date);
            
            // Convert to object format if needed
            if (Array.isArray(newUnavailability[key])) {
                const oldSlots = newUnavailability[key];
                newUnavailability[key] = {};
                oldSlots.forEach(slot => {
                    newUnavailability[key][slot] = { reason: 'manual' };
                });
            } else if (!newUnavailability[key]) {
                newUnavailability[key] = {};
            }
            
            // Block all time slots (preserve job slots)
            ['morning', 'afternoon', 'evening'].forEach(slot => {
                if (!newUnavailability[key][slot] || newUnavailability[key][slot].reason !== 'job') {
                    newUnavailability[key][slot] = { reason: 'manual' };
                }
            });
        }
        
        try {
            await updateDoc(getProfileDocRef(), {
                workCalendar: newUnavailability
            });
            setUnavailability(newUnavailability);
            showToast("Entire month blocked", "success");
        } catch (error) {
            console.error("Error blocking month:", error);
            showToast("Failed to block month", "error");
        }
    };

    // Helper function to update work calendar and handle empty state
    const updateWorkCalendar = async (newUnavailability, successMessage) => {
        try {
            if (Object.keys(newUnavailability).length === 0) {
                await updateDoc(getProfileDocRef(), {
                    workCalendar: deleteField()
                });
            } else {
                await updateDoc(getProfileDocRef(), {
                    workCalendar: newUnavailability
                });
            }
            setUnavailability(newUnavailability);
            showToast(successMessage, "success");
        } catch (error) {
            console.error("Error updating work calendar:", error);
            showToast("Failed to update calendar", "error");
        }
    };

    const clearEntireDay = async (dateKey) => {
        const newUnavailability = { ...unavailability };
        const dateSlots = newUnavailability[dateKey];
        
        if (!dateSlots) {
            showToast("No unavailability to clear", "error");
            return;
        }
        
        // If it's old array format, just delete it (no job protection needed for old data)
        if (Array.isArray(dateSlots)) {
            delete newUnavailability[dateKey];
            await updateWorkCalendar(newUnavailability, "Day cleared");
            return;
        }
        
        // New object format - only remove manual slots, keep job slots
        const jobSlots = {};
        Object.keys(dateSlots).forEach(slot => {
            if (dateSlots[slot]?.reason === 'job') {
                jobSlots[slot] = dateSlots[slot];
            }
        });
        
        if (Object.keys(jobSlots).length > 0) {
            newUnavailability[dateKey] = jobSlots;
            await updateWorkCalendar(newUnavailability, "Day cleared (job-booked slots preserved)");
        } else {
            delete newUnavailability[dateKey];
            await updateWorkCalendar(newUnavailability, "Day cleared");
        }
    };

    const clearEntireWeek = async (startDateKey) => {
        const newUnavailability = { ...unavailability };
        const [year, month, day] = startDateKey.split('-').map(Number);
        const startDate = new Date(year, month - 1, day);
        
        let hasJobSlots = false;
        
        // Clear 7 days starting from the selected date
        for (let i = 0; i < 7; i++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            const dateKey = formatDateKey(date);
            const dateSlots = newUnavailability[dateKey];
            
            if (!dateSlots) continue;
            
            // If it's old array format, just delete it
            if (Array.isArray(dateSlots)) {
                delete newUnavailability[dateKey];
            } else {
                // New object format - only remove manual slots, keep job slots
                const jobSlots = {};
                Object.keys(dateSlots).forEach(slot => {
                    if (dateSlots[slot]?.reason === 'job') {
                        jobSlots[slot] = dateSlots[slot];
                        hasJobSlots = true;
                    }
                });
                
                if (Object.keys(jobSlots).length > 0) {
                    newUnavailability[dateKey] = jobSlots;
                } else {
                    delete newUnavailability[dateKey];
                }
            }
        }
        
        const message = hasJobSlots ? "Week cleared (job-booked slots preserved)" : "Week cleared";
        await updateWorkCalendar(newUnavailability, message);
    };

    const clearEntireMonth = async (dateKey) => {
        const newUnavailability = { ...unavailability };
        const [year, month] = dateKey.split('-').map(Number);
        
        // Get the number of days in the month
        const lastDayOfMonth = new Date(year, month, 0).getDate();
        
        let hasJobSlots = false;
        
        // Clear all days in the month
        for (let day = 1; day <= lastDayOfMonth; day++) {
            const date = new Date(year, month - 1, day);
            const key = formatDateKey(date);
            const dateSlots = newUnavailability[key];
            
            if (!dateSlots) continue;
            
            // If it's old array format, just delete it
            if (Array.isArray(dateSlots)) {
                delete newUnavailability[key];
            } else {
                // New object format - only remove manual slots, keep job slots
                const jobSlots = {};
                Object.keys(dateSlots).forEach(slot => {
                    if (dateSlots[slot]?.reason === 'job') {
                        jobSlots[slot] = dateSlots[slot];
                        hasJobSlots = true;
                    }
                });
                
                if (Object.keys(jobSlots).length > 0) {
                    newUnavailability[key] = jobSlots;
                } else {
                    delete newUnavailability[key];
                }
            }
        }
        
        const message = hasJobSlots ? "Month cleared (job-booked slots preserved)" : "Month cleared";
        await updateWorkCalendar(newUnavailability, message);
    };

    const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentDate);
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const today = new Date();
    const todayKey = formatDateKey(today);
    const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            {/* Header */}
            <div className="bg-orange-500 text-white sticky top-0 z-40">
                <div className="p-4 flex items-center gap-3">
                    <button onClick={onBack}><ArrowRight className="rotate-180" size={20} /></button>
                    <div className="flex-1">
                        <h1 className="text-xl font-bold">Work Calendar</h1>
                        <p className="text-xs opacity-90">Manage your availability</p>
                    </div>
                    <Calendar size={24} />
                </div>
            </div>

            <div className="p-4">
                {/* Info Banner */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                    <div className="flex items-start gap-3">
                        <Info size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <h3 className="font-bold text-sm text-blue-900 mb-1">How it works</h3>
                            <p className="text-xs text-blue-800 leading-relaxed">
                                Mark dates and times when you're <strong>not available</strong> for hire. 
                                Your profile will be hidden from the Hire tab during those times.
                            </p>
                        </div>
                    </div>
                </div>

                {/* QUICK OPTIONS - Always visible, placed ABOVE calendar */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mb-4">
                    <h4 className="font-bold text-xs text-slate-500 uppercase tracking-wider mb-3">Quick Options</h4>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                        <Button
                            variant="outline"
                            className="text-xs py-2 px-2"
                            onClick={() => selectedDate ? blockEntireDay(selectedDate) : showToast("Select a date first", "error")}
                        >
                            Block Day
                        </Button>
                        <Button
                            variant="outline"
                            className="text-xs py-2 px-2"
                            onClick={() => selectedDate ? blockEntireWeek(selectedDate) : showToast("Select a date first", "error")}
                        >
                            Block Week
                        </Button>
                        <Button
                            variant="outline"
                            className="text-xs py-2 px-2"
                            onClick={() => selectedDate ? blockEntireMonth(selectedDate) : showToast("Select a date first", "error")}
                        >
                            Block Month
                        </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <Button
                            variant="ghost"
                            className="text-xs py-2 px-2"
                            onClick={() => selectedDate ? clearEntireDay(selectedDate) : showToast("Select a date first", "error")}
                        >
                            Clear Day
                        </Button>
                        <Button
                            variant="ghost"
                            className="text-xs py-2 px-2"
                            onClick={() => selectedDate ? clearEntireWeek(selectedDate) : showToast("Select a date first", "error")}
                        >
                            Clear Week
                        </Button>
                        <Button
                            variant="ghost"
                            className="text-xs py-2 px-2"
                            onClick={() => selectedDate ? clearEntireMonth(selectedDate) : showToast("Select a date first", "error")}
                        >
                            Clear Month
                        </Button>
                    </div>
                </div>

                {/* Calendar Navigation */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mb-4">
                    <div className="flex items-center justify-between mb-4">
                        <button
                            onClick={() => navigateMonth(-1)}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            <ChevronLeft size={24} className="text-slate-600" />
                        </button>
                        <h2 className="text-lg font-bold text-slate-900">
                            {monthNames[month]} {year}
                        </h2>
                        <button
                            onClick={() => navigateMonth(1)}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            <ChevronRightIcon size={24} className="text-slate-600" />
                        </button>
                    </div>

                    {/* Day names */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                        {dayNames.map(day => (
                            <div key={day} className="text-center text-xs font-bold text-slate-500 py-1">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Calendar grid */}
                    <div className="grid grid-cols-7 gap-1">
                        {/* Empty cells for days before month starts */}
                        {Array.from({ length: startingDayOfWeek }).map((_, i) => (
                            <div key={`empty-${i}`} className="aspect-square" />
                        ))}
                        
                        {/* Days of the month */}
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                            const day = i + 1;
                            const date = new Date(year, month, day);
                            const dateKey = formatDateKey(date);
                            const isPast = date < todayDateOnly;
                            const isToday = dateKey === todayKey;
                            const isSelected = selectedDate === dateKey;
                            
                            // Check for unavailability (support both array and object formats)
                            const dateSlots = unavailability[dateKey];
                            let hasUnavailability = false;
                            if (dateSlots) {
                                if (Array.isArray(dateSlots)) {
                                    hasUnavailability = dateSlots.length > 0;
                                } else {
                                    hasUnavailability = Object.keys(dateSlots).length > 0;
                                }
                            }
                            
                            return (
                                <button
                                    key={day}
                                    onClick={() => !isPast && setSelectedDate(dateKey)}
                                    disabled={isPast}
                                    className={`aspect-square rounded-lg flex items-center justify-center text-sm font-bold transition-all ${
                                        isPast
                                            ? 'text-slate-300 cursor-not-allowed'
                                            : isSelected
                                            ? 'bg-orange-500 text-white shadow-md'
                                            : isToday
                                            ? 'bg-blue-100 text-blue-900 border-2 border-blue-500'
                                            : hasUnavailability
                                            ? 'bg-red-100 text-red-900 border border-red-300'
                                            : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                                    }`}
                                >
                                    {day}
                                </button>
                            );
                        })}
                    </div>

                    {/* Legend */}
                    <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-3 text-xs">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-blue-100 border-2 border-blue-500" />
                            <span className="text-slate-600">Today</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-red-100 border border-red-300" />
                            <span className="text-slate-600">Unavailable</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-slate-50 border border-slate-200" />
                            <span className="text-slate-600">Available</span>
                        </div>
                    </div>
                </div>

                {/* Time Slot Selection */}
                {selectedDate && (() => {
                    // Parse selectedDate string safely (YYYY-MM-DD format)
                    const [yearStr, monthStr, dayStr] = selectedDate.split('-');
                    const selectedDateObj = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1, parseInt(dayStr, 10));
                    
                    return (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 animate-in fade-in slide-in-from-bottom duration-300">
                        <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                            <Clock size={18} className="text-orange-500" />
                            {selectedDateObj.toLocaleDateString('en-GB', { 
                                weekday: 'long', 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                            })}
                        </h3>
                        <p className="text-xs text-slate-500 mb-4">
                            Select time slots when you are <strong>NOT available</strong>
                        </p>

                        <div className="space-y-3">
                            {/* Morning */}
                            {(() => {
                                const dateSlots = unavailability[selectedDate];
                                let isUnavailable = false;
                                let isJob = false;
                                
                                if (dateSlots) {
                                    if (Array.isArray(dateSlots)) {
                                        isUnavailable = dateSlots.includes('morning');
                                    } else {
                                        isUnavailable = !!dateSlots['morning'];
                                        isJob = dateSlots['morning']?.reason === 'job';
                                    }
                                }
                                
                                return (
                                    <button
                                        onClick={() => toggleTimeSlot(selectedDate, 'morning')}
                                        className={`w-full p-4 rounded-lg border-2 transition-all flex items-center justify-between ${
                                            isUnavailable
                                                ? isJob
                                                    ? 'bg-blue-50 border-blue-500 text-blue-900'
                                                    : 'bg-red-50 border-red-500 text-red-900'
                                                : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-orange-500'
                                        }`}
                                    >
                                        <div className="text-left">
                                            <div className="font-bold text-sm">Morning</div>
                                            <div className="text-xs opacity-75">
                                                8:00 AM - 12:00 PM
                                                {isJob && <span className="ml-2 font-bold">(Job Booked)</span>}
                                            </div>
                                        </div>
                                        {isUnavailable && (
                                            <Ban size={20} className={isJob ? 'text-blue-600' : 'text-red-600'} />
                                        )}
                                    </button>
                                );
                            })()}

                            {/* Afternoon */}
                            {(() => {
                                const dateSlots = unavailability[selectedDate];
                                let isUnavailable = false;
                                let isJob = false;
                                
                                if (dateSlots) {
                                    if (Array.isArray(dateSlots)) {
                                        isUnavailable = dateSlots.includes('afternoon');
                                    } else {
                                        isUnavailable = !!dateSlots['afternoon'];
                                        isJob = dateSlots['afternoon']?.reason === 'job';
                                    }
                                }
                                
                                return (
                                    <button
                                        onClick={() => toggleTimeSlot(selectedDate, 'afternoon')}
                                        className={`w-full p-4 rounded-lg border-2 transition-all flex items-center justify-between ${
                                            isUnavailable
                                                ? isJob
                                                    ? 'bg-blue-50 border-blue-500 text-blue-900'
                                                    : 'bg-red-50 border-red-500 text-red-900'
                                                : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-orange-500'
                                        }`}
                                    >
                                        <div className="text-left">
                                            <div className="font-bold text-sm">Afternoon</div>
                                            <div className="text-xs opacity-75">
                                                12:00 PM - 8:00 PM
                                                {isJob && <span className="ml-2 font-bold">(Job Booked)</span>}
                                            </div>
                                        </div>
                                        {isUnavailable && (
                                            <Ban size={20} className={isJob ? 'text-blue-600' : 'text-red-600'} />
                                        )}
                                    </button>
                                );
                            })()}

                            {/* Evening */}
                            {(() => {
                                const dateSlots = unavailability[selectedDate];
                                let isUnavailable = false;
                                let isJob = false;
                                
                                if (dateSlots) {
                                    if (Array.isArray(dateSlots)) {
                                        isUnavailable = dateSlots.includes('evening');
                                    } else {
                                        isUnavailable = !!dateSlots['evening'];
                                        isJob = dateSlots['evening']?.reason === 'job';
                                    }
                                }
                                
                                return (
                                    <button
                                        onClick={() => toggleTimeSlot(selectedDate, 'evening')}
                                        className={`w-full p-4 rounded-lg border-2 transition-all flex items-center justify-between ${
                                            isUnavailable
                                                ? isJob
                                                    ? 'bg-blue-50 border-blue-500 text-blue-900'
                                                    : 'bg-red-50 border-red-500 text-red-900'
                                                : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-orange-500'
                                        }`}
                                    >
                                        <div className="text-left">
                                            <div className="font-bold text-sm">Evening</div>
                                            <div className="text-xs opacity-75">
                                                8:00 PM - 11:00 PM
                                                {isJob && <span className="ml-2 font-bold">(Job Booked)</span>}
                                            </div>
                                        </div>
                                        {isUnavailable && (
                                            <Ban size={20} className={isJob ? 'text-blue-600' : 'text-red-600'} />
                                        )}
                                    </button>
                                );
                            })()}
                        </div>
                    </div>
                    );
                })()}
            </div>
        </div>
    );
};

const AdminPanel = ({ user, onBack, showToast }) => {
    const [activeSection, setActiveSection] = useState(null);
    const [activeTab, setActiveTab] = useState('tradieVerification');
    const [verificationRequests, setVerificationRequests] = useState([]);
    const [profilePictureRequests, setProfilePictureRequests] = useState([]);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
    const [selectedPicture, setSelectedPicture] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [requestToReject, setRequestToReject] = useState(null);
    const [showCropModal, setShowCropModal] = useState(false);
    const [cropData, setCropData] = useState({ x: 0, y: 0, width: 100, height: 100 });
    const [emailValidationEmail, setEmailValidationEmail] = useState('');
    const [emailValidationNote, setEmailValidationNote] = useState('');
    const [isValidatingEmail, setIsValidatingEmail] = useState(false);
    const [unverifiedProfiles, setUnverifiedProfiles] = useState([]);
    const [isLoadingUnverified, setIsLoadingUnverified] = useState(false);
    const [unverifiedError, setUnverifiedError] = useState('');

    // Admin cover message state
    const [adminMessageEmail, setAdminMessageEmail] = useState('');
    const [adminMessageUsername, setAdminMessageUsername] = useState('');
    const [adminMessageText, setAdminMessageText] = useState('');
    const [usernameChangeTarget, setUsernameChangeTarget] = useState('');
    const [usernameChangeNew, setUsernameChangeNew] = useState('');
    const [isSendingAdminMessage, setIsSendingAdminMessage] = useState(false);

    // Reports management state
    const [reports, setReports] = useState([]);
    const [reportFilter, setReportFilter] = useState('pending'); // pending, reviewed, dismissed, all
    const [selectedReport, setSelectedReport] = useState(null);
    const [reportedUserData, setReportedUserData] = useState(null);
    const [reportedOffenderData, setReportedOffenderData] = useState(null);
    const [reportParticipants, setReportParticipants] = useState({});
    const [blockedChats, setBlockedChats] = useState([]);
    const [suspendedUsers, setSuspendedUsers] = useState([]);
    
    // Profile viewer state

    // Check if user is admin
    const isAdmin = user?.email === ADMIN_EMAIL;

    // Fetch verification requests
    useEffect(() => {
        if (!user || !db || !isAdmin) return;

        const q = query(
            collection(db, 'artifacts', getAppId(), 'public', 'data', 'verification_requests'),
            where('status', '==', 'pending'),
            orderBy('createdAt', 'desc')
        );
        
        const unsub = onSnapshot(q, (snapshot) => {
            const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setVerificationRequests(requests);
        }, (error) => {
            console.error("Error fetching verification requests:", error);
            showToast("Failed to load verification requests. Check Firebase rules.", "error");
        }, (error) => {
            console.error("Error fetching verification requests:", error);
            showToast("Failed to load verification requests. Check Firebase rules.", "error");
        });

        return () => unsub();
    }, [user, isAdmin, showToast]);

    // Load all profiles that have not verified their email yet
    useEffect(() => {
        if (!user || !isAdmin) return;

        setIsLoadingUnverified(true);
        setUnverifiedError('');

        // Primary live query for users with explicit emailVerified === false
        const profilesCol = collection(db, 'artifacts', getAppId(), 'public', 'data', 'profiles');

        const loadFallbackUnverified = async () => {
            try {
                const allProfilesSnap = await getDocs(profilesCol);
                const fallbackProfiles = allProfilesSnap.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter(p => p.emailVerified !== true) // include missing or false
                    .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
                setUnverifiedProfiles(fallbackProfiles);
            } catch (fallbackErr) {
                console.error('Fallback unverified fetch failed:', fallbackErr);
                showToast('Failed to load unverified profiles', 'error');
            } finally {
                setIsLoadingUnverified(false);
            }
        };

        try {
            const unverifiedQuery = query(
                profilesCol,
                where('emailVerified', '==', false),
                orderBy('createdAt', 'desc')
            );

            const unsub = onSnapshot(unverifiedQuery, async (snapshot) => {
                const profiles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                // If live query returns nothing, fall back to include profiles missing the flag
                if (profiles.length === 0) {
                    await loadFallbackUnverified();
                    return;
                }

                setUnverifiedProfiles(profiles);
                setIsLoadingUnverified(false);
            }, async (error) => {
                console.error("Error fetching unverified profiles:", error);
                setUnverifiedError('Live list unavailable. Showing filtered fallback.');
                await loadFallbackUnverified();
            });

            return () => unsub();
        } catch (setupError) {
            console.error('Setup error for unverified profiles listener:', setupError);
            setUnverifiedError('Could not start live unverified list. Using fallback fetch.');
            loadFallbackUnverified();
        }
    }, [user, isAdmin, showToast]);

    const handleManualEmailValidation = async () => {
        const trimmedEmail = emailValidationEmail.trim().toLowerCase();
        if (!trimmedEmail) {
            showToast('Enter an email address to validate.', 'error');
            return;
        }

        setIsValidatingEmail(true);
        try {
            const profilesRef = collection(db, 'artifacts', getAppId(), 'public', 'data', 'profiles');
            const q = query(profilesRef, where('email', '==', trimmedEmail));
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                showToast('No profile found for that email address.', 'error');
                return;
            }

            const updatePromises = snapshot.docs.map(profileDoc =>
                updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', profileDoc.id), {
                    emailValidationStatus: 'validated',
                    emailValidationNote: emailValidationNote || 'Manually validated via admin panel',
                    emailValidatedAt: serverTimestamp()
                })
            );

            await Promise.all(updatePromises);
            setEmailValidationEmail('');
            setEmailValidationNote('');
            showToast('Email marked as validated.', 'success');
        } catch (error) {
            console.error('Error validating email:', error);
            showToast('Failed to validate email. Try again.', 'error');
        } finally {
            setIsValidatingEmail(false);
        }
    };

    const handleAdminMarkEmailVerified = async (profile) => {
        if (!profile?.id) return;
        setLoading(true);
        try {
            // Call Cloud Function to mark Auth + profile as verified
            const markFn = httpsCallable(functions, 'adminMarkEmailVerified');
            await markFn({ uid: profile.id });

            // Optimistically update local state/profile list
            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', profile.id), {
                emailVerified: true,
                emailValidationStatus: 'validated',
                emailVerifiedOverride: true,
                emailValidatedAt: serverTimestamp()
            });
            // Optimistically remove from unverified list
            setUnverifiedProfiles((prev) => prev.filter((p) => p.id !== profile.id));
            showToast(`Marked ${profile.email || 'user'} as verified`, 'success');
        } catch (error) {
            console.error('Error validating email:', error);
            showToast('Failed to validate email. Try again.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleAdminResendVerification = async (profile) => {
        if (!profile?.id || !profile?.email) return;
        setLoading(true);
        try {
            await addDoc(collection(db, 'artifacts', getAppId(), 'public', 'data', 'email_resend_requests'), {
                userId: profile.id,
                email: profile.email,
                requestedAt: serverTimestamp(),
                requestedBy: user.uid,
                requestedByEmail: user.email
            });
            showToast('Resend queued for this user', 'success');
        } catch (error) {
            console.error('Error queuing resend:', error);
            showToast('Failed to queue resend email.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleManualTradieApprove = async (tradieUid, requestId = null) => {
        if (!tradieUid) return;
        setLoading(true);
        try {
            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', tradieUid), {
                verified: true,
                verificationStatus: 'manually_verified',
                verifiedAt: serverTimestamp(),
                verificationMetadata: {
                    verificationMethod: 'Admin override',
                    verifiedBy: user.uid,
                    verifiedByEmail: user.email,
                    verifiedAt: serverTimestamp()
                },
                notifications: arrayUnion({
                    type: 'verification_approved',
                    title: 'Verification Approved!',
                    message: 'An admin confirmed your tradie account. You now have full access.',
                    timestamp: Date.now(),
                    read: false,
                    icon: 'check-circle'
                })
            });

            if (requestId) {
                await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'verification_requests', requestId), {
                    status: 'approved',
                    reviewedBy: user.uid,
                    reviewedAt: serverTimestamp(),
                    documentsDeleted: false,
                    adminOverride: true
                });
            }

            showToast('Tradie marked as verified.', 'success');
        } catch (error) {
            console.error('Error manually verifying tradie:', error);
            showToast('Failed to manually verify tradie', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleRequestMoreInfo = async (requestId, tradieUid) => {
        if (!requestId || !tradieUid) return;
        setLoading(true);
        try {
            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'verification_requests', requestId), {
                status: 'needs_info',
                reviewedBy: user.uid,
                reviewedAt: serverTimestamp(),
                requestMoreInfo: true
            });

            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', tradieUid), {
                notifications: arrayUnion({
                    type: 'verification_more_info',
                    title: 'More info needed',
                    message: 'We need more information to verify your tradie account. Please update your documents.',
                    timestamp: Date.now(),
                    read: false,
                    icon: 'info'
                }),
                verificationStatus: 'needs_info'
            });

            showToast('Requested more info from tradie.', 'success');
        } catch (error) {
            console.error('Error requesting more info:', error);
            showToast('Failed to request more info', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSendAdminMessage = async () => {
        const email = adminMessageEmail.trim().toLowerCase();
        const username = adminMessageUsername.trim().replace(/^@/, '').toLowerCase();
        if ((!email && !username) || !adminMessageText.trim()) {
            showToast('Enter an email or username and a message to send.', 'error');
            return;
        }

        setIsSendingAdminMessage(true);
        try {
            const profilesRef = collection(db, 'artifacts', getAppId(), 'public', 'data', 'profiles');
            let snapshot;
            if (username) {
                snapshot = await getDocs(query(profilesRef, where('usernameLower', '==', username), limit(1)));
            } else {
                snapshot = await getDocs(query(profilesRef, where('email', '==', email), limit(1)));
            }

            if (snapshot.empty) {
                showToast('No profile found for that user.', 'error');
                return;
            }

            const updates = snapshot.docs.map(profileDoc => updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', profileDoc.id), {
                adminCoverMessage: {
                    text: adminMessageText.trim(),
                    createdAt: serverTimestamp(),
                    from: user.email,
                    canDismiss: true,
                    read: false
                }
            }));

            await Promise.all(updates);
            showToast('Notification sent.', 'success');
            setAdminMessageEmail('');
            setAdminMessageUsername('');
            setAdminMessageText('');
        } catch (error) {
            console.error('Error sending admin message:', error);
            showToast('Failed to send message', 'error');
        } finally {
            setIsSendingAdminMessage(false);
        }
    };

    const handleAdminChangeUsername = async () => {
        const target = usernameChangeTarget.trim();
        const newUsername = usernameChangeNew.trim().replace(/^@/, '');
        if (!target || !newUsername) {
            showToast('Enter a user email/username and a new username.', 'error');
            return;
        }
        try {
            const profilesRef = collection(db, 'artifacts', getAppId(), 'public', 'data', 'profiles');
            const isEmail = target.includes('@');
            const lookup = isEmail
                ? query(profilesRef, where('email', '==', target.toLowerCase()), limit(1))
                : query(profilesRef, where('usernameLower', '==', target.toLowerCase()), limit(1));
            const userSnap = await getDocs(lookup);
            if (userSnap.empty) {
                showToast('User not found for that identifier.', 'error');
                return;
            }
            const userDoc = userSnap.docs[0];
            const newLower = newUsername.toLowerCase();
            const clash = await getDocs(query(profilesRef, where('usernameLower', '==', newLower), limit(1)));
            if (!clash.empty && clash.docs[0].id !== userDoc.id) {
                showToast('Username is already taken.', 'error');
                return;
            }
            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', userDoc.id), {
                username: newUsername,
                usernameLower: newLower,
                usernameChanges: 0
            });
            showToast('Username updated.', 'success');
            setUsernameChangeTarget('');
            setUsernameChangeNew('');
        } catch (error) {
            console.error('Failed to change username:', error);
            showToast('Could not change username.', 'error');
        }
    };

    const handleUnblockConversation = async (conversationId) => {
        try {
            await setDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'conversations', conversationId), {
                workPolicyBlocked: false,
                blockedBy: deleteField(),
                blockedReason: deleteField(),
                unblockedAt: serverTimestamp(),
                unblockedBy: user.uid
            }, { merge: true });
            showToast('Chat unblocked', 'success');
        } catch (error) {
            console.error('Failed to unblock chat:', error);
            showToast('Could not unblock chat', 'error');
        }
    };

    const handleToggleChatSuspension = async (uid, suspend = true) => {
        try {
            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', uid), suspend ? {
                chatSuspended: true,
                chatSuspendedReason: 'admin_manual',
                chatSuspendedBy: user.uid,
                chatSuspendedAt: serverTimestamp()
            } : {
                chatSuspended: false,
                chatSuspendedReason: deleteField(),
                chatSuspendedBy: deleteField(),
                chatSuspendedAt: deleteField()
            });
            showToast(suspend ? 'User chat access suspended' : 'User chat access restored', 'success');
        } catch (error) {
            console.error('Failed to toggle chat suspension:', error);
            showToast('Chat suspension update failed', 'error');
        }
    };

    // Fetch profile picture requests
    useEffect(() => {
        if (!user || !db || !isAdmin) return;
        
        const q = query(
            collection(db, 'artifacts', getAppId(), 'public', 'data', 'profile_picture_requests'),
            where('status', '==', 'pending'),
            orderBy('createdAt', 'desc')
        );
        
        const unsub = onSnapshot(q, (snapshot) => {
            const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setProfilePictureRequests(requests);
        }, (error) => {
            console.error("Error fetching profile picture requests:", error);
            showToast("Failed to load profile picture requests", "error");
        });
        
        return () => unsub();
    }, [user, isAdmin, showToast]);

    // Fetch reports
    useEffect(() => {
        if (!user || !db || !isAdmin) return;
        
        let q;
        if (reportFilter === 'all') {
            q = query(
                collection(db, 'artifacts', getAppId(), 'public', 'data', 'reports'),
                orderBy('createdAt', 'desc')
            );
        } else {
            q = query(
                collection(db, 'artifacts', getAppId(), 'public', 'data', 'reports'),
                where('status', '==', reportFilter),
                orderBy('createdAt', 'desc')
            );
        }
        
        const unsub = onSnapshot(q, (snapshot) => {
            const reportsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setReports(reportsData);
        }, (error) => {
            console.error("Error fetching reports:", error);
            showToast("Failed to load reports", "error");
        });
        
        return () => unsub();
    }, [user, isAdmin, reportFilter, showToast]);

    // Fetch blocked conversations that need admin review
    useEffect(() => {
        if (!user || !db || !isAdmin) return;
        const q = query(
            collection(db, 'artifacts', getAppId(), 'public', 'data', 'conversations'),
            where('workPolicyBlocked', '==', true)
        );
        const unsub = onSnapshot(q, (snapshot) => {
            const items = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .sort((a, b) => (b.blockedAt?.toMillis?.() || 0) - (a.blockedAt?.toMillis?.() || 0));
            setBlockedChats(items);
        }, (error) => {
            console.error('Error fetching blocked chats:', error);
            showToast('Failed to load blocked chats', 'error');
        });
        return () => unsub();
    }, [user, isAdmin, showToast]);

    // Fetch users with suspended chat privileges
    useEffect(() => {
        if (!user || !db || !isAdmin) return;
        const q = query(
            collection(db, 'artifacts', getAppId(), 'public', 'data', 'profiles'),
            where('chatSuspended', '==', true)
        );
        const unsub = onSnapshot(q, (snapshot) => {
            const suspended = snapshot.docs.map(doc => ({ id: doc.id, uid: doc.id, ...doc.data() }));
            setSuspendedUsers(suspended);
        }, (error) => {
            console.error('Error loading suspended users:', error);
            showToast('Failed to load suspended users', 'error');
        });
        return () => unsub();
    }, [user, isAdmin, showToast]);

    // Approve verification
    const handleApprove = async (requestId, tradieUid) => {
        setLoading(true);
        try {
            const request = verificationRequests.find(r => r.id === requestId);
            if (!request) {
                showToast("Request not found. Try refreshing.", "error");
                return;
            }
            if (!db) {
                showToast("Database not ready. Check Firebase config.", "error");
                return;
            }

            // Extract metadata from uploaded documents before deletion
            const safeParsePath = (url) => {
                if (!url) return null;
                try {
                    return new URL(url).pathname;
                } catch {
                    return null;
                }
            };
            const verificationMetadata = {
                documentType: 'CSCS/ECS Card',
                trade: request?.trade || 'Not specified',
                tradieName: request?.tradieName || 'Unknown',
                verifiedAt: new Date().toISOString(),
                verifiedBy: user.uid,
                verifiedByEmail: user.email,
                verificationMethod: 'Document Upload',
                submittedAt: request?.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
                // Store references to original upload locations (for audit trail)
                originalUploadPaths: {
                    front: safeParsePath(request?.cardImageUrl),
                    back: safeParsePath(request?.cardImageBackUrl)
                },
                notes: request?.notes || ''
            };

            // Update the verification request to approved
            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'verification_requests', requestId), {
                status: 'approved',
                reviewedBy: user.uid,
                reviewedAt: serverTimestamp(),
                documentsDeleted: true
            });

            // Update tradie profile with verification status and metadata
            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', tradieUid), {
                verified: true,
                verificationStatus: 'approved',
                verifiedAt: serverTimestamp(),
                verificationMetadata: verificationMetadata,
                // Add notification for the user
                notifications: arrayUnion({
                    type: 'verification_approved',
                    title: 'Verification Approved!',
                    message: 'Your tradie verification has been approved. You now have a verified badge on your profile.',
                    timestamp: Date.now(),
                    read: false,
                    icon: 'check-circle'
                })
            });

            // Delete uploaded images from Firebase Storage
            try {
                if (request?.cardImageUrl) {
                    if (!storage) throw new Error("Storage not initialized");
                    try {
                        const frontUrl = new URL(request.cardImageUrl);
                        const frontPath = decodeURIComponent(frontUrl.pathname.split('/o/')[1].split('?')[0]);
                        const frontRef = storageRef(storage, frontPath);
                        await deleteObject(frontRef);
                        console.log("Front card image deleted successfully");
                    } catch (frontError) {
                        console.error("Error deleting front card image:", frontError);
                    }
                }
                if (request?.cardImageBackUrl) {
                    if (!storage) throw new Error("Storage not initialized");
                    try {
                        const backUrl = new URL(request.cardImageBackUrl);
                        const backPath = decodeURIComponent(backUrl.pathname.split('/o/')[1].split('?')[0]);
                        const backRef = storageRef(storage, backPath);
                        await deleteObject(backRef);
                        console.log("Back card image deleted successfully");
                    } catch (backError) {
                        console.error("Error deleting back card image:", backError);
                    }
                }
                console.log("Verification documents processed");
            } catch (deleteError) {
                console.error("Error processing verification documents:", deleteError);
                // Continue even if deletion fails - verification is still approved
            }

            showToast("Tradie verified! Documents deleted, metadata stored.", "success");
            setSelectedRequest(null);
        } catch (error) {
            console.error("Error approving verification:", error);
            showToast("Failed to approve verification", "error");
        } finally {
            setLoading(false);
        }
    };

    // Reject verification
    const handleReject = async (requestId, reason = '') => {
        setLoading(true);
        try {
            const request = verificationRequests.find(r => r.id === requestId);
            if (!request) {
                showToast("Request not found. Try refreshing.", "error");
                return;
            }
            if (!db) {
                showToast("Database not ready. Check Firebase config.", "error");
                return;
            }
            
            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'verification_requests', requestId), {
                status: 'rejected',
                rejectionReason: reason,
                reviewedBy: user.uid,
                reviewedAt: serverTimestamp()
            });

            // Add rejection notification to user profile
            if (request?.tradieUid) {
                await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', request.tradieUid), {
                    verificationStatus: 'rejected',
                    notifications: arrayUnion({
                        type: 'verification_rejected',
                        title: 'Verification Rejected',
                        message: reason || 'Your verification was rejected. Please review and resubmit with correct documents.',
                        timestamp: Date.now(),
                        read: false,
                        icon: 'x-circle'
                    })
                });
            }

            showToast("Verification request rejected", "success");
            setSelectedRequest(null);
            setShowRejectModal(false);
            setRejectionReason('');
            setRequestToReject(null);
        } catch (error) {
            console.error("Error rejecting verification:", error);
            showToast("Failed to reject verification", "error");
        } finally {
            setLoading(false);
        }
    };
    
    // Open reject modal
    const openRejectModal = (request) => {
        setRequestToReject(request);
        setShowRejectModal(true);
    };
    
    // Confirm rejection
    const confirmReject = () => {
        if (!rejectionReason.trim()) {
            showToast("Please provide a reason for rejection", "error");
            return;
        }
        handleReject(requestToReject.id, rejectionReason);
    };

    // Approve profile picture
    const handleApproveProfilePicture = async (requestId, userId) => {
        setLoading(true);
        try {
            // Update the request status
            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profile_picture_requests', requestId), {
                status: 'approved',
                reviewedBy: user.uid,
                reviewedAt: serverTimestamp()
            });

            // Add approval notification to user's profile
            const userProfileRef = doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', userId);
            const userProfileSnap = await getDoc(userProfileRef);
            const existingNotifications = userProfileSnap.data()?.notifications || [];
            
            await updateDoc(userProfileRef, {
                notifications: [
                    {
                        type: 'profile_picture_approved',
                        message: 'Your profile picture has been approved!',
                        timestamp: new Date(),
                        read: false
                    },
                    ...existingNotifications
                ]
            });

            showToast("Profile picture approved", "success");
            setSelectedPicture(null);
        } catch (error) {
            console.error("Error approving profile picture:", error);
            showToast("Failed to approve profile picture", "error");
        } finally {
            setLoading(false);
        }
    };

    // Reject profile picture
    const handleRejectProfilePicture = async (requestId, userId, reason) => {
        setLoading(true);
        try {
            // Update request status
            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profile_picture_requests', requestId), {
                status: 'rejected',
                reviewedBy: user.uid,
                reviewedAt: serverTimestamp(),
                rejectionReason: reason
            });

            // Delete the profile picture from user's profile
            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', userId), {
                primaryPhoto: null
            });

            // Add rejection notification to user's profile
            const userProfileRef = doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', userId);
            const userProfileSnap = await getDoc(userProfileRef);
            const existingNotifications = userProfileSnap.data()?.notifications || [];
            
            await updateDoc(userProfileRef, {
                notifications: [
                    {
                        type: 'profile_picture_rejected',
                        message: 'Your profile picture was rejected',
                        reason: reason,
                        timestamp: new Date(),
                        read: false
                    },
                    ...existingNotifications
                ]
            });

            showToast("Profile picture rejected and deleted", "success");
            setSelectedPicture(null);
            setShowRejectModal(false);
            setRejectionReason('');
            setRequestToReject(null);
        } catch (error) {
            console.error("Error rejecting profile picture:", error);
            showToast("Failed to reject profile picture", "error");
        } finally {
            setLoading(false);
        }
    };

    // Open reject modal for profile pictures
    const openRejectModalProfilePicture = (request) => {
        setRequestToReject(request);
        setShowRejectModal(true);
    };

    // Confirm profile picture rejection
    const confirmRejectProfilePicture = () => {
        if (!rejectionReason.trim()) {
            showToast("Please provide a reason for rejection", "error");
            return;
        }
        handleRejectProfilePicture(requestToReject.id, requestToReject.userId, rejectionReason);
    };

    // Open crop modal for profile picture
    const openCropModal = (picture) => {
        setSelectedPicture(picture);
        setShowCropModal(true);
        // Reset crop data to center
        setCropData({ x: 10, y: 10, width: 80, height: 80 });
    };

    // Save cropped image
    const handleSaveCrop = async () => {
        if (!selectedPicture) return;
        
        setLoading(true);
        try {
            // Create canvas to crop the image
            const img = new Image();
            img.src = selectedPicture.photoData;
            
            await new Promise((resolve) => {
                img.onload = resolve;
            });

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Calculate actual pixel values from percentages
            const cropX = (cropData.x / 100) * img.width;
            const cropY = (cropData.y / 100) * img.height;
            const cropWidth = (cropData.width / 100) * img.width;
            const cropHeight = (cropData.height / 100) * img.height;
            
            canvas.width = cropWidth;
            canvas.height = cropHeight;
            
            // Draw cropped portion
            ctx.drawImage(
                img,
                cropX, cropY, cropWidth, cropHeight,
                0, 0, cropWidth, cropHeight
            );
            
            // Convert to base64 and compress to 30KB
            let croppedImage = canvas.toDataURL('image/jpeg', 0.8);
            
            // Use the same compression function
            const compressImage = (base64Image, targetSizeBytes) => {
                return new Promise((resolve) => {
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        let width = img.width;
                        let height = img.height;
                        
                        const BASE64_SIZE_RATIO = 0.75;
                        const currentSize = base64Image.length * BASE64_SIZE_RATIO;
                        
                        if (currentSize > targetSizeBytes) {
                            const scaleFactor = Math.sqrt(targetSizeBytes / currentSize) * 0.85;
                            width = Math.max(100, Math.floor(width * scaleFactor));
                            height = Math.max(100, Math.floor(height * scaleFactor));
                        }
                        
                        canvas.width = width;
                        canvas.height = height;
                        
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);
                        
                        let quality = 0.8;
                        let result = canvas.toDataURL('image/jpeg', quality);
                        
                        while (result.length * BASE64_SIZE_RATIO > targetSizeBytes && quality > 0.1) {
                            quality -= 0.05;
                            result = canvas.toDataURL('image/jpeg', quality);
                        }
                        
                        resolve(result);
                    };
                    img.src = base64Image;
                });
            };
            
            croppedImage = await compressImage(croppedImage, 30 * 1024);
            
            // Save cropped image to user's profile
            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', selectedPicture.userId), {
                primaryPhoto: croppedImage
            });
            
            // Approve the request
            await handleApproveProfilePicture(selectedPicture.id, selectedPicture.userId);
            
            setShowCropModal(false);
            setSelectedPicture(null);
            showToast("Image cropped and approved!", "success");
        } catch (error) {
            console.error("Error cropping image:", error);
            showToast("Failed to crop image", "error");
        } finally {
            setLoading(false);
        }
    };

    // Handle report actions
    const handleReportAction = async (reportId, action) => {
        setLoading(true);
        try {
            const updateData = {
                status: action, // 'reviewed' or 'dismissed'
                reviewedBy: user.uid,
                reviewedByEmail: user.email,
                reviewedAt: serverTimestamp()
            };

            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'reports', reportId), updateData);
            
            showToast(`Report ${action} successfully`, "success");
            setSelectedReport(null);
            setReportedUserData(null);
            setReportedOffenderData(null);
            setReportParticipants({});
        } catch (error) {
            console.error("Error updating report:", error);
            showToast("Failed to update report", "error");
        } finally {
            setLoading(false);
        }
    };

    const viewReportDetails = async (report) => {
        setSelectedReport(report);
        setReportedUserData(null);
        setReportedOffenderData(null);
        setReportParticipants({});

        const participantIds = Array.from(new Set([
            ...(report.participants || []),
            report.reportedBy,
            report.offenderUid
        ].filter(Boolean)));

        if (!participantIds.length) return;

        try {
            const profiles = await Promise.all(
                participantIds.map(async (uid) => {
                    const snap = await getDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', uid));
                    return snap.exists() ? { uid, data: snap.data() } : null;
                })
            );

            const map = {};
            profiles.filter(Boolean).forEach((entry) => {
                map[entry.uid] = entry.data;
            });

            setReportParticipants(map);
            if (report.reportedBy && map[report.reportedBy]) setReportedUserData(map[report.reportedBy]);
            if (report.offenderUid && map[report.offenderUid]) setReportedOffenderData(map[report.offenderUid]);
        } catch (error) {
            console.error("Error fetching report participants:", error);
        }
    };

    // Menu options
    const menuOptions = [
        {
            id: 'verification',
            title: 'Verification',
            icon: ShieldCheck,
            badge: (verificationRequests.length + profilePictureRequests.length) > 0 
                ? verificationRequests.length + profilePictureRequests.length 
                : null,
            description: 'Manage user verification requests'
        },
        {
            id: 'userManagement',
            title: 'User Management',
            icon: Users,
            badge: reports.filter(r => r.status === 'pending').length > 0 
                ? reports.filter(r => r.status === 'pending').length 
                : null,
            description: 'Manage reports and user accounts'
        },
        {
            id: 'chatModeration',
            title: 'Chat Moderation',
            icon: Shield,
            badge: (blockedChats.length + suspendedUsers.length) > 0
                ? blockedChats.length + suspendedUsers.length
            : null,
            description: 'Review blocked chats and suspensions'
        }
    ];

    // If not admin, show access denied
    if (!isAdmin) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
                    <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h2>
                    <p className="text-slate-600 mb-6">You don't have permission to access the admin panel.</p>
                    <Button onClick={onBack} variant="primary" className="w-full">
                        Go Back
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white sticky top-0 z-40 shadow-lg">
                <div className="p-4 flex items-center gap-3">
                    <button onClick={onBack} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
                        <ArrowRight className="rotate-180" size={20} />
                    </button>
                    <div className="flex-1">
                        <h1 className="text-xl font-bold">Admin Control Panel</h1>
                        <p className="text-xs opacity-90">System Administration</p>
                    </div>
                    <Shield size={24} className="text-orange-500" />
                </div>
            </div>

            <div className="p-4">
                {/* Menu Options (when no section is selected) */}
                {activeSection === null && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {menuOptions.map((option) => {
                                const Icon = option.icon;
                                return (
                                    <button
                                        key={option.id}
                                        onClick={() => setActiveSection(option.id)}
                                        className="group w-full bg-white rounded-2xl shadow-sm border border-slate-100 p-4 hover:border-orange-500 hover:shadow-lg transition-all text-left"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-orange-50 p-3 rounded-xl shadow-inner">
                                                    <Icon size={24} className="text-orange-600" />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-slate-900">{option.title}</h3>
                                                    <p className="text-xs text-slate-600">{option.description}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {option.badge !== null && (
                                                    <span className="bg-red-500 text-white px-2.5 py-1 rounded-full text-xs font-bold">
                                                        {option.badge}
                                                    </span>
                                                )}
                                                <ChevronRight size={20} className="text-slate-400 group-hover:text-orange-500 transition-colors" />
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                        {/* Admin username override */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 space-y-3">
                            <div className="flex items-start gap-3">
                                <UserCheck className="text-orange-500" size={18} />
                                <div>
                                    <p className="text-sm font-bold text-slate-900">Change username (admin)</p>
                                    <p className="text-xs text-slate-600">Find a user by email or @username and set a new username (overrides limits).</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <div>
                                    <label className="text-xs font-semibold text-slate-700 block mb-1">User email or @username</label>
                                    <input
                                        type="text"
                                        value={usernameChangeTarget}
                                        onChange={(e) => setUsernameChangeTarget(e.target.value)}
                                        placeholder="user@example.com or @user"
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-700 block mb-1">New username</label>
                                    <input
        type="text"
                                        value={usernameChangeNew}
                                        onChange={(e) => setUsernameChangeNew(e.target.value)}
                                        placeholder="newusername"
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    />
                                </div>
                            </div>
                            <Button
                                onClick={handleAdminChangeUsername}
                                variant="secondary"
                                className="w-full flex items-center justify-center gap-2"
                            >
                                <UserCheck size={14} />
                                Update username
                            </Button>
                        </div>
                        <div className="text-xs text-slate-500 px-1">Choose a module to manage verifications, reports, or chat moderation.</div>
                    </div>
                )}

                {/* Verification Section */}
                {activeSection === 'verification' && (
                    <div className="space-y-4">
                        <button 
                            onClick={() => setActiveSection(null)}
                            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors mb-2"
                        >
                            <ChevronLeft size={20} />
                            <span className="text-sm font-medium">Back to Menu</span>
                        </button>

                        <h2 className="text-2xl font-bold text-slate-900 mb-4">Verification</h2>

                        {/* Sub-tabs */}
                        <div className="flex gap-2 overflow-x-auto mb-4">
                            <button
                                onClick={() => setActiveTab('tradieVerification')}
                                className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${
                                    activeTab === 'tradieVerification'
                                        ? 'bg-orange-500 text-white'
                                        : 'bg-white text-slate-700 border border-slate-200 hover:border-orange-500'
                                }`}
                            >
                                Tradie Verification
                                {verificationRequests.length > 0 && (
                                    <span className="ml-2 bg-red-500 text-white px-2 py-0.5 rounded-full text-xs">
                                        {verificationRequests.length}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => setActiveTab('profilePictures')}
                                className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${
                                    activeTab === 'profilePictures'
                                        ? 'bg-orange-500 text-white'
                                        : 'bg-white text-slate-700 border border-slate-200 hover:border-orange-500'
                                }`}
                            >
                                Profile Pictures
                                {profilePictureRequests.length > 0 && (
                                    <span className="ml-2 bg-red-500 text-white px-2 py-0.5 rounded-full text-xs">
                                        {profilePictureRequests.length}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => setActiveTab('emailValidation')}
                                className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${
                                    activeTab === 'emailValidation'
                                        ? 'bg-orange-500 text-white'
                                        : 'bg-white text-slate-700 border border-slate-200 hover:border-orange-500'
                                }`}
                            >
                                Email Validation
                            </button>
                            <button
                                onClick={() => setActiveTab('unverifiedEmails')}
                                className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${
                                    activeTab === 'unverifiedEmails'
                                        ? 'bg-orange-500 text-white'
                                        : 'bg-white text-slate-700 border border-slate-200 hover:border-orange-500'
                                }`}
                            >
                                Unverified Profiles
                                {unverifiedProfiles.length > 0 && (
                                    <span className="ml-2 bg-red-500 text-white px-2 py-0.5 rounded-full text-xs">
                                        {unverifiedProfiles.length}
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* Tradie Verification Content */}
                        {activeTab === 'tradieVerification' && (
                            <div className="space-y-4">
                                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                                    <div className="flex items-start gap-3">
                                        <Info size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <h3 className="font-bold text-sm text-blue-900 mb-1">Tradie Verification</h3>
                                            <p className="text-xs text-blue-800 leading-relaxed">
                                                Review and approve tradie verification requests. Documents are encrypted and stored securely. After approval, metadata is saved to the user's profile.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {verificationRequests.length === 0 ? (
                                    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8 text-center">
                                        <UserCheck size={48} className="mx-auto text-slate-300 mb-3" />
                                        <h3 className="font-bold text-slate-900 mb-1">No Pending Requests</h3>
                                        <p className="text-sm text-slate-600">All verification requests have been processed.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {verificationRequests.map((request) => (
                                            <div key={request.id} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                                                <div className="p-4">
                                                    <div className="flex items-start justify-between mb-3">
                                                        <div>
                                                            <h3 className="font-bold text-slate-900">{request.tradieName}</h3>
                                                            <p className="text-sm text-slate-600">{request.trade}</p>
                                                            <p className="text-xs text-slate-400 mt-1">
                                                                Submitted: {request.createdAt?.toDate?.()?.toLocaleDateString() || 'Recently'}
                                                            </p>
                                                </div>
                                                <Badge type="pending" text="Pending" />
                                            </div>

                                            {/* Document Previews */}
                                            <div className="mb-3 bg-slate-50 rounded-lg p-2">
                                                <p className="text-xs font-bold text-slate-700 mb-2">Uploaded Documents:</p>
                                                <div className="grid grid-cols-3 gap-2">
                                                    {[
                                                        { label: 'Front', full: request.cardImageUrl, thumb: request.cardImageThumbUrl },
                                                        { label: 'Back', full: request.cardImageBackUrl, thumb: request.cardImageBackThumbUrl },
                                                        { label: 'Selfie', full: request.selfieUrl, thumb: request.selfieThumbUrl },
                                                    ].map((img) => (
                                                        img.full ? (
                                                            <div key={img.label} className="relative">
                                                                <img
                                                                    src={img.thumb || img.full}
                                                                    alt={`${img.label} document`}
                                                                    className="w-full aspect-[3/2] object-cover rounded border border-slate-200 cursor-pointer hover:opacity-90 transition"
                                                                    onClick={() => { setSelectedRequest(request); setSelectedImageUrl(img.full); }}
                                                                />
                                                                <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full">{img.label}</span>
                                                            </div>
                                                        ) : (
                                                            <div key={img.label} className="w-full aspect-[3/2] bg-slate-100 border border-dashed border-slate-200 rounded flex items-center justify-center text-[10px] text-slate-400">
                                                                {img.label} missing
                                                            </div>
                                                        )
                                                    ))}
                                                </div>
                                                <p className="text-xs text-slate-500 mt-1">Click a card to view full size</p>
                                            </div>

                                            {request.notes && (
                                                <div className="mb-3 bg-slate-50 rounded-lg p-3">
                                                    <p className="text-xs font-bold text-slate-700 mb-1">Notes:</p>
                                                    <p className="text-sm text-slate-600">{request.notes}</p>
                                                </div>
                                            )}

                                            <div className="flex flex-col gap-2">
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant="success"
                                                        className="flex-1 text-sm py-2"
                                                        onClick={() => handleApprove(request.id, request.tradieUid)}
                                                        disabled={loading}
                                                    >
                                                        <CheckCircle size={16} />
                                                        Approve
                                                    </Button>
                                                    <Button
                                                        variant="danger"
                                                        className="flex-1 text-sm py-2"
                                                        onClick={() => openRejectModal(request)}
                                                        disabled={loading}
                                                    >
                                                        <X size={16} />
                                                        Reject
                                                    </Button>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant="secondary"
                                                        className="flex-1 text-xs py-2"
                                                        onClick={() => handleManualTradieApprove(request.tradieUid, request.id)}
                                                        disabled={loading}
                                                    >
                                                        <ShieldCheck size={14} />
                                                        Manual approve
                                                    </Button>
                                                    <Button
                                                        variant="secondary"
                                                        className="flex-1 text-xs py-2 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
                                                        onClick={() => handleRequestMoreInfo(request.id, request.tradieUid)}
                                                        disabled={loading}
                                                    >
                                                        <AlertCircle size={14} />
                                                        Request more info
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Profile Pictures Tab */}
                {activeTab === 'profilePictures' && (
                    <div className="space-y-4">
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                            <div className="flex items-start gap-3">
                                <Info size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <h3 className="font-bold text-sm text-blue-900 mb-1">Profile Picture Review</h3>
                                    <p className="text-xs text-blue-800 leading-relaxed">
                                        Review user profile pictures. Approve appropriate photos or reject with a reason. Rejected photos are automatically deleted.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {profilePictureRequests.length === 0 ? (
                            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8 text-center">
                                <CheckCircle size={48} className="mx-auto text-slate-300 mb-3" />
                                <h3 className="font-bold text-slate-900 mb-1">No Pending Reviews</h3>
                                <p className="text-sm text-slate-600">
                                    All profile pictures have been reviewed.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {profilePictureRequests.map((request) => (
                                    <div key={request.id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
                                        <div className="flex gap-4">
                                            {/* Left Column: Profile Picture + Buttons */}
                                            <div className="flex flex-col gap-3" style={{width: '200px'}}>
                                                {/* Profile Picture */}
                                                <div 
                                                    className="w-full h-48 bg-slate-100 rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                                    onClick={() => setSelectedPicture(request)}
                                                >
                                                    <img
                                                        src={request.photoData}
                                                        alt={request.name}
                                                        className="w-full h-full object-cover rounded-lg"
                                                    />
                                                </div>
                                                
                                                {/* Action Buttons */}
                                                <div className="flex flex-row gap-2">
                                                    <Button
                                                        variant="success"
                                                        className="flex items-center justify-center gap-1 flex-1 py-2 text-xs"
                                                        onClick={() => handleApproveProfilePicture(request.id, request.userId)}
                                                        disabled={loading}
                                                    >
                                                        <CheckCircle size={14} />
                                                        Approve
                                                    </Button>
                                                    <Button
                                                        variant="primary"
                                                        className="flex items-center justify-center gap-1 flex-1 py-2 text-xs"
                                                        onClick={() => openCropModal(request)}
                                                        disabled={loading}
                                                    >
                                                        <Edit2 size={14} />
                                                        Crop
                                                    </Button>
                                                    <Button
                                                        variant="danger"
                                                        className="flex items-center justify-center gap-1 flex-1 py-2 text-xs"
                                                        onClick={() => openRejectModalProfilePicture(request)}
                                                        disabled={loading}
                                                    >
                                                        <X size={14} />
                                                        Reject
                                                    </Button>
                                                </div>
                                            </div>
                                            
                                            {/* Right Column: User Info */}
                                            <div className="flex-1">
                                                <h3 className="font-bold text-slate-900 text-lg mb-1">{request.name}</h3>
                                                <p className="text-sm text-slate-500">
                                                    @{request.username} • {request.createdAt?.toDate?.()?.toLocaleDateString() || 'Recently'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Email Validation Tab */}
                {activeTab === 'emailValidation' && (
                    <div className="space-y-4">
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                            <div className="flex items-start gap-3">
                                <Info size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <h3 className="font-bold text-sm text-blue-900 mb-1">Validate Email</h3>
                                    <p className="text-xs text-blue-800 leading-relaxed">
                                        Use this tool when a user cannot complete verification via their inbox. Mark the email as validated to unlock access while you troubleshoot deliverability.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 space-y-3">
                            <div>
                                <label className="text-xs font-semibold text-slate-700 block mb-1">User Email</label>
                                <input
                                    type="email"
                                    value={emailValidationEmail}
                                    onChange={(e) => setEmailValidationEmail(e.target.value)}
                                    placeholder="user@example.com"
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-700 block mb-1">Note (optional)</label>
                                <textarea
                                    value={emailValidationNote}
                                    onChange={(e) => setEmailValidationNote(e.target.value)}
                                    placeholder="Reason for manual validation"
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    rows={3}
                                />
                            </div>
                            <Button
                                onClick={handleManualEmailValidation}
                                variant="primary"
                                className="w-full flex items-center justify-center gap-2"
                                disabled={isValidatingEmail}
                            >
                                <ShieldCheck size={16} />
                                {isValidatingEmail ? 'Validating...' : 'Validate email'}
                            </Button>
                        </div>
                    </div>
                )}

                {activeTab === 'unverifiedEmails' && (
                    <div className="space-y-4">
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                            <AlertCircle size={20} className="text-amber-700" />
                            <div>
                                <h3 className="font-bold text-sm text-amber-900 mb-1">Unverified profiles</h3>
                                <p className="text-xs text-amber-800 leading-relaxed">Tap a profile to mark the email as verified or queue a resend so stuck users can regain access.</p>
                            </div>
                        </div>

                        {unverifiedError && (
                            <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-3 py-2 rounded-lg">
                                {unverifiedError}
                            </div>
                        )}

                        <div className="bg-white rounded-xl shadow-sm border border-slate-100 divide-y divide-slate-100">
                            {isLoadingUnverified && (
                                <div className="p-4 text-sm text-slate-500">Loading unverified profiles...</div>
                            )}

                            {!isLoadingUnverified && unverifiedProfiles.length === 0 && (
                                <div className="p-4 text-sm text-slate-500">All profiles are verified.</div>
                            )}

                            {!isLoadingUnverified && unverifiedProfiles.map((profile) => (
                                <div key={profile.id} className="p-4 flex items-start gap-3">
                                    <div className="bg-slate-100 rounded-full w-10 h-10 flex items-center justify-center font-bold text-slate-700 uppercase">
                                        {(profile.name || profile.username || '?').slice(0, 1)}
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <div>
                                                <p className="font-bold text-slate-900 text-sm">{profile.name || profile.username || 'Unknown user'}</p>
                                                <p className="text-xs text-slate-600">{profile.email || 'No email on file'}</p>
                                            </div>
                                            <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-orange-50 text-orange-700 border border-orange-100">Pending</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                                            <MapPin size={12} />
                                            <span className="truncate">{profile.location || 'No location provided'}</span>
                                        </div>
                                        <div className="flex gap-2 pt-2">
                                            <Button
                                                onClick={() => handleAdminMarkEmailVerified(profile)}
                                                variant="secondary"
                                                className="flex-1 text-xs"
                                                disabled={loading}
                                            >
                                                <CheckCircle size={14} />
                                                Mark verified
                                            </Button>
                                            <Button
                                                onClick={() => handleAdminResendVerification(profile)}
                                                variant="primary"
                                                className="flex-1 text-xs"
                                                disabled={loading}
                                            >
                                                <Mail size={14} />
                                                Resend email
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                    </div>
                )}

                {/* Chat Moderation Section */}
                {activeSection === 'chatModeration' && (
                    <div className="space-y-4">
                        <button
                            onClick={() => setActiveSection(null)}
                            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors mb-2"
                        >
                            <ChevronLeft size={20} />
                            <span className="text-sm font-medium">Back to Menu</span>
                        </button>

                        <h2 className="text-2xl font-bold text-slate-900 mb-4">Chat Moderation</h2>

                        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                            <div className="flex items-start gap-3">
                                <Shield size={20} className="text-orange-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <h3 className="font-bold text-sm text-orange-900 mb-1">Work-policy violations</h3>
                                    <p className="text-xs text-orange-800 leading-relaxed">
                                        Chats blocked by the automated work-policy guard appear here. Unblock conversations or suspend users from chatting platform-wide.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-slate-900">Blocked Chats</h3>
                                <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                                    {blockedChats.length}
                                </span>
                            </div>
                            {blockedChats.length === 0 ? (
                                <p className="text-sm text-slate-500">No chats are blocked for moderation.</p>
                            ) : (
                                <div className="space-y-3">
                                    {blockedChats.map((convo) => {
                                        const p1 = convo.participant1 || { uid: convo.participants?.[0] };
                                        const p2 = convo.participant2 || { uid: convo.participants?.[1] };
                                        const p1Suspended = suspendedUsers.some((u) => u.uid === p1?.uid);
                                        const p2Suspended = suspendedUsers.some((u) => u.uid === p2?.uid);
                                        return (
                                            <div key={convo.id} className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex-1">
                                                        <p className="text-sm font-bold text-slate-900">
                                                            {(p1?.name || p1?.username || p1?.uid || 'User')} ↔ {(p2?.name || p2?.username || p2?.uid || 'User')}
                                                        </p>
                                                        <p className="text-xs text-slate-500">
                                                            Violations: {convo.workPolicyViolations || 0} • Last: {convo.lastViolationAt?.toDate?.()?.toLocaleString?.() || 'recently'}
                                                        </p>
                                                    </div>
                                                    <div className="flex flex-col gap-2">
                                                        <Button variant="secondary" onClick={() => handleUnblockConversation(convo.id)}>
                                                            Unblock chat
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap gap-2 mt-3">
                                                    {p1?.uid && (
                                                        <Button
                                                            variant={p1Suspended ? 'secondary' : 'danger'}
                                                            onClick={() => handleToggleChatSuspension(p1.uid, !p1Suspended)}
                                                            className="text-xs"
                                                        >
                                                            {p1Suspended ? 'Unsuspend' : 'Suspend'} {(p1?.name || p1?.username || 'User')}
                                                        </Button>
                                                    )}
                                                    {p2?.uid && (
                                                        <Button
                                                            variant={p2Suspended ? 'secondary' : 'danger'}
                                                            onClick={() => handleToggleChatSuspension(p2.uid, !p2Suspended)}
                                                            className="text-xs"
                                                        >
                                                            {p2Suspended ? 'Unsuspend' : 'Suspend'} {(p2?.name || p2?.username || 'User')}
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-slate-900">Suspended Users</h3>
                                <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                                    {suspendedUsers.length}
                                </span>
                            </div>
                            {suspendedUsers.length === 0 ? (
                                <p className="text-sm text-slate-500">No users are currently suspended from chatting.</p>
                            ) : (
                                <div className="space-y-2">
                                    {suspendedUsers.map((u) => (
                                        <div key={u.uid} className="flex items-center justify-between border border-slate-200 rounded-lg p-3 bg-slate-50">
                                            <div>
                                                <p className="font-bold text-sm text-slate-900">{u.name || u.username || 'User'}</p>
                                                <p className="text-xs text-slate-500">{u.email || 'No email on file'}</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button variant="secondary" onClick={() => handleToggleChatSuspension(u.uid, false)}>
                                                    Unsuspend
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* User Management Section */}
                {activeSection === 'userManagement' && (
                    <div className="space-y-4">
                        <button
                            onClick={() => setActiveSection(null)}
                            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors mb-2"
                        >
                            <ChevronLeft size={20} />
                            <span className="text-sm font-medium">Back to Menu</span>
                        </button>

                        <h2 className="text-2xl font-bold text-slate-900 mb-4">User Management - Reports</h2>

                        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 space-y-3">
                            <div className="flex items-start gap-3">
                                <Mail className="text-orange-500" size={18} />
                                <div>
                                    <p className="text-sm font-bold text-slate-900">Send user notification</p>
                                    <p className="text-xs text-slate-600">Deliver a custom in-app notification by email or @username.</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <div>
                                    <label className="text-xs font-semibold text-slate-700 block mb-1">User email</label>
                                    <input
                                        type="email"
                                        value={adminMessageEmail}
                                        onChange={(e) => setAdminMessageEmail(e.target.value)}
                                        placeholder="user@example.com"
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-700 block mb-1">Username</label>
                                    <input
                                        type="text"
                                        value={adminMessageUsername}
                                        onChange={(e) => setAdminMessageUsername(e.target.value)}
                                        placeholder="@username"
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-700 block mb-1">Message</label>
                                <textarea
                                    value={adminMessageText}
                                    onChange={(e) => setAdminMessageText(e.target.value)}
                                    placeholder="Enter the notification to send"
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    rows={2}
                                />
                            </div>
                            <Button
                                onClick={handleSendAdminMessage}
                                variant="secondary"
                                className="w-full flex items-center justify-center gap-2"
                                disabled={isSendingAdminMessage}
                            >
                                <Send size={14} />
                                {isSendingAdminMessage ? 'Sending...' : 'Send notification'}
                            </Button>
                        </div>

                        {/* Filter Tabs */}
                        <div className="flex gap-2 overflow-x-auto pb-2">
                            {[
                                { value: 'pending', label: 'Pending', count: reports.filter(r => r.status === 'pending').length },
                                { value: 'reviewed', label: 'Reviewed', count: reports.filter(r => r.status === 'reviewed').length },
                                { value: 'dismissed', label: 'Dismissed', count: reports.filter(r => r.status === 'dismissed').length },
                                { value: 'all', label: 'All Reports', count: reports.length }
                            ].map(filter => (
                                <button
                                    key={filter.value}
                                    onClick={() => setReportFilter(filter.value)}
                                    className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${
                                        reportFilter === filter.value
                                            ? 'bg-orange-500 text-white'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                    }`}
                                >
                                    {filter.label}
                                    {filter.count > 0 && (
                                        <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                                            reportFilter === filter.value
                                                ? 'bg-white text-orange-500'
                                                : 'bg-slate-300 text-slate-700'
                                        }`}>
                                            {filter.count}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Reports List */}
                        {reports.length === 0 ? (
                            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8 text-center">
                                <Flag size={48} className="mx-auto text-slate-300 mb-3" />
                                <h3 className="font-bold text-slate-900 mb-1">No Reports</h3>
                                <p className="text-sm text-slate-600">
                                    {reportFilter === 'pending' 
                                        ? 'No pending reports at this time.'
                                        : `No ${reportFilter} reports found.`
                                    }
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {reports.map(report => (
                                    <div
                                        key={report.id}
                                        onClick={() => viewReportDetails(report)}
                                        className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 hover:shadow-md transition-shadow cursor-pointer"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-start gap-3 flex-1">
                                                <div className={`p-2 rounded-lg ${
                                                    report.reportType === 'user' ? 'bg-red-100' :
                                                    report.reportType === 'safety' ? 'bg-orange-100' :
                                                    report.reportType === 'scam' ? 'bg-amber-100' :
                                                    report.reportType === 'harassment' ? 'bg-red-100' :
                                                    'bg-slate-100'
                                                }`}>
                                                    <Flag size={20} className={
                                                        report.reportType === 'user' ? 'text-red-600' :
                                                        report.reportType === 'safety' ? 'text-orange-600' :
                                                        report.reportType === 'scam' ? 'text-amber-600' :
                                                        report.reportType === 'harassment' ? 'text-red-600' :
                                                        'text-slate-600'
                                                    } />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-bold text-slate-900 capitalize">{report.reportType || 'General'}</span>
                                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                                            report.status === 'pending' ? 'bg-orange-100 text-orange-700' :
                                                            report.status === 'reviewed' ? 'bg-green-100 text-green-700' :
                                                            'bg-slate-100 text-slate-700'
                                                        }`}>
                                                            {report.status}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-slate-600 line-clamp-2 mb-2">
                                                        {report.details}
                                                    </p>
                                                    <p className="text-xs text-slate-400">
                                                        Reported {report.createdAt?.toDate?.()?.toLocaleDateString() || 'recently'} at {report.createdAt?.toDate?.()?.toLocaleTimeString() || ''}
                                                    </p>
                                                </div>
                                            </div>
                                            <ChevronRight size={20} className="text-slate-400 flex-shrink-0" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Full Image Modal */}
            {selectedRequest && (
                <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4" onClick={() => { setSelectedRequest(null); setSelectedImageUrl(null); }}>
                    <div className="relative max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
                        <button
                            onClick={() => { setSelectedRequest(null); setSelectedImageUrl(null); }}
                            className="absolute -top-12 right-0 bg-white/10 hover:bg-white/20 text-white p-2 rounded-lg transition-colors"
                        >
                            <X size={24} />
                        </button>
                        <img
                            src={selectedImageUrl || selectedRequest.cardImageUrl || selectedRequest.cardImageBackUrl || selectedRequest.selfieUrl}
                            alt="Verification document full size"
                            className="w-full rounded-lg"
                        />
                        <div className="bg-white rounded-lg p-4 mt-4">
                            <h3 className="font-bold text-slate-900 mb-2">{selectedRequest.tradieName}</h3>
                            <p className="text-sm text-slate-600 mb-3">{selectedRequest.trade}</p>
                            <div className="flex gap-2">
                                <Button
                                    variant="success"
                                    className="flex-1"
                                    onClick={() => handleApprove(selectedRequest.id, selectedRequest.tradieUid)}
                                    disabled={loading}
                                >
                                    <CheckCircle size={18} />
                                    Approve Verification
                                </Button>
                                <Button
                                    variant="danger"
                                    className="flex-1"
                                    onClick={() => openRejectModal(selectedRequest)}
                                    disabled={loading}
                                >
                                    <X size={18} />
                                    Reject
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Profile Picture Full View Modal */}
            {selectedPicture && (
                <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4" onClick={() => setSelectedPicture(null)}>
                    <div className="relative max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
                        <button
                            onClick={() => setSelectedPicture(null)}
                            className="absolute -top-12 right-0 bg-white/10 hover:bg-white/20 text-white p-2 rounded-lg transition-colors"
                        >
                            <X size={24} />
                        </button>
                        <img
                            src={selectedPicture.photoData}
                            alt={selectedPicture.name}
                            className="w-full rounded-lg"
                        />
                        <div className="bg-white rounded-lg p-4 mt-4">
                            <h3 className="font-bold text-slate-900 mb-2">{selectedPicture.name}</h3>
                            <p className="text-sm text-slate-600 mb-3">@{selectedPicture.username}</p>
                            <div className="flex gap-2">
                                <Button
                                                    variant="success"
                                    className="flex-1"
                                    onClick={() => handleApproveProfilePicture(selectedPicture.id, selectedPicture.userId)}
                                    disabled={loading}
                                >
                                    <CheckCircle size={18} />
                                    Approve
                                </Button>
                                <Button
                                    variant="primary"
                                    className="flex-1"
                                    onClick={() => {
                                        setShowCropModal(true);
                                        setCropData({ x: 10, y: 10, width: 80, height: 80 });
                                    }}
                                    disabled={loading}
                                >
                                    <Edit2 size={18} />
                                    Crop
                                </Button>
                                <Button
                                    variant="danger"
                                    className="flex-1"
                                    onClick={() => openRejectModalProfilePicture(selectedPicture)}
                                    disabled={loading}
                                >
                                    <X size={18} />
                                    Reject
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Rejection Reason Modal */}
            {showRejectModal && requestToReject && (
                <div className="fixed inset-0 bg-black/80 z-[110] flex items-center justify-center p-4" onClick={() => setShowRejectModal(false)}>
                    <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-slate-900">
                                {requestToReject.photoData ? 'Reject Profile Picture' : 'Reject Verification'}
                            </h3>
                            <button onClick={() => setShowRejectModal(false)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                                <X size={20} className="text-slate-500" />
                            </button>
                        </div>
                        
                        <p className="text-sm text-slate-600 mb-4">
                            Please provide a reason for rejecting <strong>{requestToReject.name || requestToReject.tradieName}'s</strong> {requestToReject.photoData ? 'profile picture' : 'verification request'}.
                            {requestToReject.photoData && ' The photo will be automatically deleted.'}
                        </p>
                        
                        <div className="mb-4">
                            <label className="block text-sm font-bold text-slate-700 mb-2">Rejection Reason</label>
                            <textarea
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                placeholder={requestToReject.photoData 
                                    ? "e.g., Inappropriate content, not a clear face photo, contains other people..."
                                    : "e.g., Document is blurry, card expired, name doesn't match profile..."}
                                rows={4}
                                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none text-sm"
                            />
                        </div>
                        
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                            <div className="flex items-start gap-2">
                                <Info size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                                <p className="text-xs text-amber-800">
                                    {requestToReject.photoData 
                                        ? 'The user will receive a notification with your rejection reason. The photo will be deleted from their profile.'
                                        : 'The rejection reason will be sent to the user as a notification.'}
                                </p>
                            </div>
                        </div>
                        
                        <div className="flex gap-2">
                            <Button
                                variant="ghost"
                                className="flex-1"
                                onClick={() => {
                                    setShowRejectModal(false);
                                    setRejectionReason('');
                                    setRequestToReject(null);
                                }}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="danger"
                                className="flex-1"
                                onClick={requestToReject.photoData ? confirmRejectProfilePicture : confirmReject}
                                disabled={loading || !rejectionReason.trim()}
                            >
                                {requestToReject.photoData ? 'Reject & Delete' : 'Confirm Rejection'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Crop Modal */}
            {showCropModal && selectedPicture && (
                <div className="fixed inset-0 bg-black/90 z-[120] flex items-center justify-center p-4" onClick={() => setShowCropModal(false)}>
                    <div className="bg-white rounded-2xl max-w-md w-full p-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-base font-bold text-slate-900">Crop Profile Picture</h3>
                            <button onClick={() => setShowCropModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                                <X size={18} className="text-slate-500" />
                            </button>
                        </div>
                        
                        <p className="text-xs text-slate-600 mb-3">
                            Adjust the crop area to frame the image properly. The cropped image will be automatically approved.
                        </p>
                        
                        {/* Image Preview with Crop Overlay */}
                        <div className="relative bg-slate-100 rounded-lg overflow-hidden mb-3" style={{ height: '300px' }}>
                            <img
                                src={selectedPicture.photoData}
                                alt="Crop preview"
                                className="w-full h-full object-contain"
                            />
                            <div 
                                className="absolute border-2 border-orange-500 bg-orange-500/20"
                                style={{
                                    left: `${cropData.x}%`,
                                    top: `${cropData.y}%`,
                                    width: `${cropData.width}%`,
                                    height: `${cropData.height}%`,
                                    cursor: 'move'
                                }}
                            ></div>
                        </div>
                        
                        {/* Crop Controls */}
                        <div className="space-y-2 mb-3">
                            <div>
                                <label className="block text-xs font-medium text-slate-700 mb-1">Horizontal Position</label>
                                <input
                                    type="range"
                                    min="0"
                                    max={100 - cropData.width}
                                    value={cropData.x}
                                    onChange={(e) => setCropData(prev => ({ ...prev, x: parseInt(e.target.value) }))}
                                    className="w-full"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-700 mb-1">Vertical Position</label>
                                <input
                                    type="range"
                                    min="0"
                                    max={100 - cropData.height}
                                    value={cropData.y}
                                    onChange={(e) => setCropData(prev => ({ ...prev, y: parseInt(e.target.value) }))}
                                    className="w-full"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-700 mb-1">Crop Size (Width & Height)</label>
                                <input
                                    type="range"
                                    min="20"
                                    max="100"
                                    value={cropData.width}
                                    onChange={(e) => {
                                        const size = parseInt(e.target.value);
                                        setCropData(prev => ({ 
                                            ...prev, 
                                            width: size, 
                                            height: size,
                                            x: Math.min(prev.x, 100 - size),
                                            y: Math.min(prev.y, 100 - size)
                                        }));
                                    }}
                                    className="w-full"
                                />
                            </div>
                        </div>
                        
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-3">
                            <div className="flex items-start gap-2">
                                <Info size={14} className="text-blue-600 flex-shrink-0 mt-0.5" />
                                <p className="text-xs text-blue-800">
                                    The cropped image will be saved to the user's profile and automatically approved.
                                </p>
                            </div>
                        </div>
                        
                        <div className="flex gap-2">
                            <Button
                                variant="ghost"
                                className="flex-1 py-2"
                                onClick={() => {
                                    setShowCropModal(false);
                                    setCropData({ x: 10, y: 10, width: 80, height: 80 });
                                }}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="success"
                                className="flex-1"
                                onClick={handleSaveCrop}
                                disabled={loading}
                            >
                                <CheckCircle size={18} />
                                Save & Approve
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Report Details Modal */}
            {selectedReport && (
                <div className="fixed inset-0 bg-black/80 z-[100] flex items-end sm:items-center justify-center p-4">
                    <div className="bg-white w-full sm:w-[500px] sm:max-h-[75vh] sm:rounded-2xl rounded-t-2xl overflow-hidden shadow-2xl flex flex-col">
                        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                            <h3 className="text-lg font-bold text-slate-900">Report Details</h3>
                            <button onClick={() => {
                                setSelectedReport(null);
                                setReportedUserData(null);
                                setReportedOffenderData(null);
                                setReportParticipants({});
                            }}>
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {/* Report Info */}
                            <div className="bg-slate-50 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <Flag size={18} className="text-red-600" />
                                    <span className="font-bold text-slate-900">Report Information</span>
                                </div>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">Type:</span>
                                        <span className="font-medium text-slate-900 capitalize">{selectedReport.reportType || 'General'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">Status:</span>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                            selectedReport.status === 'pending' ? 'bg-orange-100 text-orange-700' :
                                            selectedReport.status === 'reviewed' ? 'bg-green-100 text-green-700' :
                                            'bg-slate-100 text-slate-700'
                                        }`}>
                                            {selectedReport.status}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">Submitted:</span>
                                        <span className="font-medium text-slate-900">
                                            {selectedReport.createdAt?.toDate?.()?.toLocaleDateString() || 'Unknown'}
                                        </span>
                                    </div>
                                    {selectedReport.reviewedAt && (
                                        <div className="flex justify-between">
                                            <span className="text-slate-600">Reviewed:</span>
                                            <span className="font-medium text-slate-900">
                                                {selectedReport.reviewedAt?.toDate?.()?.toLocaleDateString() || 'Unknown'}
                                            </span>
                                        </div>
                                    )}
                                    {selectedReport.reviewedByEmail && (
                                        <div className="flex justify-between">
                                            <span className="text-slate-600">Reviewed By:</span>
                                            <span className="font-medium text-slate-900 text-xs">
                                                {selectedReport.reviewedByEmail}
                                            </span>
                                        </div>
                                    )}
                            </div>
                        </div>

                        {/* Reporter Info */}
                        {reportedUserData && (
                            <div className="bg-blue-50 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <User size={18} className="text-blue-600" />
                                    <span className="font-bold text-slate-900">Reported By</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    {reportedUserData.primaryPhoto ? (
                                        <img
                                            src={reportedUserData.primaryPhoto}
                                            alt={reportedUserData.name}
                                            className="w-12 h-12 rounded-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center">
                                            <User size={24} className="text-slate-400" />
                                        </div>
                                    )}
                                    <div>
                                        <p className="font-medium text-slate-900">{reportedUserData.name || reportedUserData.username}</p>
                                        <p className="text-xs text-slate-600">@{reportedUserData.username || 'unknown'}</p>
                                        <p className="text-xs text-slate-500 capitalize">{reportedUserData.role || 'user'}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Reported User Info */}
                        {reportedOffenderData && (
                            <div className="bg-red-50 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <User size={18} className="text-red-600" />
                                    <span className="font-bold text-slate-900">Reported User</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    {reportedOffenderData.primaryPhoto ? (
                                        <img
                                            src={reportedOffenderData.primaryPhoto}
                                            alt={reportedOffenderData.name}
                                            className="w-12 h-12 rounded-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center">
                                            <User size={24} className="text-slate-400" />
                                        </div>
                                    )}
                                    <div>
                                        <p className="font-medium text-slate-900">{reportedOffenderData.name || reportedOffenderData.username}</p>
                                        <p className="text-xs text-slate-600">@{reportedOffenderData.username || 'unknown'}</p>
                                        <p className="text-xs text-slate-500 capitalize">{reportedOffenderData.role || 'user'}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Participants */}
                        {selectedReport.participants?.length > 0 && (
                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <Users size={18} className="text-slate-600" />
                                    <span className="font-bold text-slate-900">Conversation Participants</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {selectedReport.participants.map((uid) => {
                                        const profile = reportParticipants?.[uid];
                                        const label = profile?.name || profile?.username || uid;
                                        return (
                                            <span key={uid} className="px-3 py-1 rounded-full bg-white border border-slate-200 text-xs font-medium text-slate-700 shadow-sm">
                                                {label}
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Report Details */}
                        <div className="bg-white border border-slate-200 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <FileText size={18} className="text-slate-600" />
                                <span className="font-bold text-slate-900">Report Details</span>
                            </div>
                            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                                {selectedReport.details || 'No details provided.'}
                            </p>
                        </div>

                        {/* Recent Messages Snapshot */}
                        {selectedReport.messages?.length > 0 && (
                            <div className="bg-white border border-slate-200 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <MessageCircle size={18} className="text-slate-600" />
                                    <span className="font-bold text-slate-900">Last 10 Messages</span>
                                </div>
                                <div className="space-y-2">
                                    {selectedReport.messages.map((msg, idx) => {
                                        const senderProfile = msg.senderId ? reportParticipants?.[msg.senderId] : null;
                                        const senderLabel = senderProfile?.name || senderProfile?.username || msg.senderId || 'Unknown user';
                                        const timestamp = msg.createdAt
                                            ? new Date(msg.createdAt).toLocaleString()
                                            : 'Time unknown';
                                        return (
                                            <div key={`${msg.createdAt || idx}-${idx}`} className="p-3 rounded-lg border border-slate-100 bg-slate-50">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <p className="text-sm font-semibold text-slate-900">{senderLabel}</p>
                                                        <p className="text-[11px] text-slate-500">{timestamp}</p>
                                                    </div>
                                                    {msg.imageUrl && (
                                                        <a
                                                            href={msg.imageUrl}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="text-[11px] font-bold text-orange-600 underline"
                                                        >
                                                            View image
                                                        </a>
                                                    )}
                                                </div>
                                                {msg.text && (
                                                    <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{msg.text}</p>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    {selectedReport.status === 'pending' && (
                        <div className="p-4 border-t border-slate-200 bg-slate-50">
                                <div className="flex gap-2">
                                    <Button
                                        variant="ghost"
                                        className="flex-1"
                                        onClick={() => handleReportAction(selectedReport.id, 'dismissed')}
                                        disabled={loading}
                                    >
                                        <X size={18} />
                                        Dismiss
                                    </Button>
                                    <Button
                                        variant="success"
                                        className="flex-1"
                                        onClick={() => handleReportAction(selectedReport.id, 'reviewed')}
                                        disabled={loading}
                                    >
                                        <CheckCircle size={18} />
                                        Mark Reviewed
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export { SettingsScreen, PaymentsCredits, SafetyCentre, WorkCalendar, AdminPanel };
