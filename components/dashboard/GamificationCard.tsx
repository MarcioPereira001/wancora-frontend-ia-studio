import React from 'react';
import { Trophy, Medal, Crown } from 'lucide-react';
import { GamificationProfile } from '@/types';
import { formatCurrency, cn } from '@/lib/utils';

interface GamificationCardProps {
  user: GamificationProfile;
  isMe?: boolean;
}

export function GamificationCard({ user, isMe = false }: GamificationCardProps) {
  // Lógica de Nível: Cada 1000 XP sobe um nível
  const currentLevel = Math.floor(user.xp / 1000) + 1;
  const progressToNext = (user.xp % 1000) / 10; // % para barra (0-100)

  return (
    <div className={cn(
        "flex items-center gap-4 p-4 rounded-xl border transition-all relative overflow-hidden group",
        isMe 
          ? "bg-gradient-to-r from-primary/10 to-transparent border-primary/30 shadow-[0_0_15px_rgba(34,197,94,0.1)]" 
          : "bg-zinc-900/50 border-zinc-800 hover:border-zinc-700"
    )}>
        {/* Rank Badge */}
        <div className="relative shrink-0">
            <div className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold border-2 shadow-lg overflow-hidden",
                user.rank === 1 ? "border-yellow-500 text-yellow-500 bg-yellow-500/10" :
                user.rank === 2 ? "border-zinc-400 text-zinc-400 bg-zinc-400/10" :
                user.rank === 3 ? "border-orange-700 text-orange-700 bg-orange-700/10" :
                "border-zinc-700 text-zinc-500 bg-zinc-800"
            )}>
                {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.user_name} className="w-full h-full object-cover" />
                ) : user.rank === 1 ? <Crown className="w-6 h-6" /> : user.rank}
            </div>
            {user.rank <= 3 && (
                <div className="absolute -top-1 -right-1 bg-zinc-950 rounded-full p-0.5 border border-zinc-900">
                    <Medal className={cn("w-4 h-4", 
                        user.rank === 1 ? "text-yellow-500" : 
                        user.rank === 2 ? "text-zinc-400" : "text-orange-700"
                    )} />
                </div>
            )}
        </div>

        <div className="flex-1 min-w-0">
            <div className="flex justify-between items-center mb-1">
                <h4 className={cn("font-bold truncate text-sm", isMe ? "text-primary" : "text-zinc-100")}>
                    {user.user_name} {isMe && "(Você)"}
                </h4>
                <span className="text-xs font-mono text-purple-400 font-bold flex items-center gap-1">
                    {user.xp} XP
                </span>
            </div>
            
            {/* XP Bar */}
            <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                <div 
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-1000" 
                    style={{ width: `${progressToNext}%` }} 
                />
            </div>
            
            <div className="flex justify-between mt-1.5 text-[10px] text-zinc-500 uppercase font-medium tracking-wide">
                <span>Lvl {currentLevel}</span>
                <span className="text-zinc-400">{formatCurrency(user.total_sales)}</span>
            </div>
        </div>
    </div>
  );
}