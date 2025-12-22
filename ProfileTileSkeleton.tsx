import React from 'react';

export const ProfileTileSkeleton: React.FC = () => (
    <div className="w-full aspect-square relative overflow-hidden rounded-2xl shadow-sm border border-slate-200">
        <div className="w-full h-full bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 animate-shimmer"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-2">
            <div className='flex items-end justify-between w-full'>
                <div className="h-3 bg-slate-300 rounded w-20"></div>
                <div className="h-3 bg-slate-300 rounded-full w-12"></div>
            </div>
        </div>
    </div>
);
