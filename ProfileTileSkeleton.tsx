import React from 'react';

export const ProfileTileSkeleton: React.FC = () => (
    <div className="w-full aspect-square relative overflow-hidden rounded-3xl shadow-xl border-2 border-slate-200 group">
        <div className="w-full h-full bg-gradient-to-br from-slate-300 via-slate-200 to-slate-300 animate-pulse relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/40 to-transparent animate-shimmer"></div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-3">
            <div className='flex items-end justify-between w-full gap-2'>
                <div className="h-4 bg-white/30 rounded-xl w-24 animate-pulse backdrop-blur-sm"></div>
                <div className="h-4 bg-white/30 rounded-full w-16 animate-pulse backdrop-blur-sm"></div>
            </div>
        </div>
    </div>
);
