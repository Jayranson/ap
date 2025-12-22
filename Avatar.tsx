import React from 'react';
import { HardHat, User, Edit2 } from 'lucide-react';

type ProfileSummary = {
    uid?: string;
    role?: string;
    primaryPhoto?: string;
    photo?: string;
    name?: string;
};

type ProfilePictureRequest = {
    userId: string;
    status: string;
};

interface AvatarProps {
    profile: ProfileSummary;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
    blur?: boolean;
    showEditIcon?: boolean;
    profilePictureRequests?: ProfilePictureRequest[];
}

const sizeClasses: Record<NonNullable<AvatarProps['size']>, string> = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-24 h-24',
    xl: 'w-32 h-32'
};

const AvatarInner = ({
    profile,
    hasPhoto,
    blurClass,
    showEditIcon,
    isPending,
    size,
}: {
    profile: ProfileSummary;
    hasPhoto: boolean;
    blurClass: string;
    showEditIcon: boolean;
    isPending: boolean;
    size: NonNullable<AvatarProps['size']>;
}) => {
    const iconSize = size === 'lg' || size === 'xl' ? 40 : 20;
    const editIconSize = size === 'lg' || size === 'xl' ? 24 : 16;

    if (hasPhoto) {
        return (
            <>
                <img
                    src={profile.primaryPhoto || profile.photo}
                    alt={profile.name}
                    className={`w-full h-full object-cover ${blurClass}`}
                />
                {isPending && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-orange-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow-lg">
                            PENDING
                        </div>
                    </div>
                )}
            </>
        );
    }

    return (
        <div className={`w-full h-full flex items-center justify-center text-slate-400 bg-slate-200 ${blurClass} relative`}>
            {profile?.role === 'tradie' ? <HardHat size={iconSize} /> : <User size={iconSize} />}
            {showEditIcon && !hasPhoto && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <Edit2 size={editIconSize} className="text-white" />
                </div>
            )}
        </div>
    );
};

export const Avatar: React.FC<AvatarProps> = ({
    profile,
    size = 'md',
    className = '',
    blur = false,
    showEditIcon = false,
    profilePictureRequests = []
}) => {
    const isPending = profilePictureRequests.some(req =>
        req.userId === profile?.uid && req.status === 'pending'
    );

    const blurClass = (blur || isPending) ? 'blur-md scale-110' : '';
    const hasPhoto = Boolean(profile?.primaryPhoto || profile?.photo);

    return (
        <div className={`${sizeClasses[size]} rounded-full overflow-hidden border border-slate-100 ${className} relative`}>
            <AvatarInner
                profile={profile}
                hasPhoto={hasPhoto}
                blurClass={blurClass}
                showEditIcon={showEditIcon}
                isPending={isPending}
                size={size}
            />
        </div>
    );
};
