// Habit & User Stats Types
export interface Habit {
    id: string;
    name: string;
    icon: string;
    colorIndex: number;
    frequency: 'daily' | 'weekly' | 'custom';
    targetDays?: number[]; // For weekly: 0=Sun, 1=Mon, etc.
    goal?: number; // Optional total goal count (e.g., 50 over lifetime)
    dailyTarget: number; // Daily target count (e.g., 8 for water)
    description?: string; // Optional description
    createdAt: string;
    completions: Record<string, number>; // dateKey -> count
    explicitFailures: Record<string, boolean>; // dateKey -> true if explicitly marked as 'x'
    streak: number;
}

export interface UserStats {
    totalXp: number;
    achievements: string[];
}

export interface LevelInfo {
    level: number;
    currentXp: number;
    xpNeeded: number;
}

export interface ToggleResult {
    habit: Habit;
    xpGained: number;
    leveledUp?: boolean;
    newLevel?: number;
}
export interface GridDay {
    key: string;
    progress: number;
    dailyTarget: number;
    isCompleted: boolean;
    isMissed: boolean;
    isInactive: boolean;
    isToday: boolean;
    isExplicitlyFailed: boolean; // User marked as 'x' by tapping completed day
}
