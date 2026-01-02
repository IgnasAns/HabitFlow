import AsyncStorage from '@react-native-async-storage/async-storage';
import { Habit, UserStats, LevelInfo, ToggleResult, GridDay } from '../types';
import { getDefaultHabits } from './suggestedHabits';

const HABITS_KEY = '@habits';
const USER_STATS_KEY = '@user_stats';
const INITIALIZED_KEY = '@initialized';

// Generate unique ID
export const generateId = (): string =>
    Date.now().toString(36) + Math.random().toString(36).substr(2);

// Get today's date string
export const getTodayKey = (): string => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};

// Get date string for any date
export const getDateKey = (date: Date): string => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

// Calculate streak for a habit
export const calculateStreak = (completions: Record<string, number>, dailyTarget: number): number => {
    if (!completions) return 0;

    const dates = Object.keys(completions).filter(k => completions[k] >= dailyTarget).sort().reverse();
    if (dates.length === 0) return 0;

    const today = getTodayKey();
    const yesterday = getDateKey(new Date(Date.now() - 86400000));

    // Check if completed today or yesterday to continue streak
    if (dates[0] !== today && dates[0] !== yesterday) {
        return 0;
    }

    let streak = 1;
    let currentDate = new Date(dates[0]);

    for (let i = 1; i < dates.length; i++) {
        const prevDate = new Date(currentDate);
        prevDate.setDate(prevDate.getDate() - 1);
        const prevKey = getDateKey(prevDate);

        if (dates[i] === prevKey) {
            streak++;
            currentDate = prevDate;
        } else {
            break;
        }
    }

    return streak;
};

// Calculate XP needed for next level
export const xpForLevel = (level: number): number =>
    Math.floor(100 * Math.pow(1.5, level - 1));

// Calculate level from total XP
export const calculateLevel = (totalXp: number): LevelInfo => {
    let level = 1;
    let xpNeeded = xpForLevel(level);
    let remainingXp = totalXp;

    while (remainingXp >= xpNeeded) {
        remainingXp -= xpNeeded;
        level++;
        xpNeeded = xpForLevel(level);
    }

    return { level, currentXp: remainingXp, xpNeeded };
};

// Storage operations
export const storage = {
    // Initialize default habits for first-time users
    async initializeDefaultHabits(): Promise<boolean> {
        try {
            const initialized = await AsyncStorage.getItem(INITIALIZED_KEY);
            if (initialized) {
                return false; // Already initialized
            }

            const defaultHabits = getDefaultHabits();
            const habits: Habit[] = defaultHabits.map(h => ({
                id: generateId(),
                name: h.name,
                icon: h.icon,
                colorIndex: h.colorIndex,
                frequency: 'daily',
                createdAt: new Date().toISOString(),
                completions: {},
                explicitFailures: {},
                streak: 0,
                goal: h.goal,
                dailyTarget: h.dailyTarget || 1,
            }));

            await this.saveHabits(habits);
            await AsyncStorage.setItem(INITIALIZED_KEY, 'true');
            return true;
        } catch (error) {
            console.error('Error initializing default habits:', error);
            return false;
        }
    },

    // Habits CRUD
    async getHabits(): Promise<Habit[]> {
        try {
            // Check if first launch
            const initialized = await AsyncStorage.getItem(INITIALIZED_KEY);
            if (!initialized) {
                await this.initializeDefaultHabits();
            }

            const data = await AsyncStorage.getItem(HABITS_KEY);
            const habits: Habit[] = data ? JSON.parse(data) : [];

            // Migration for existing data if any
            return habits.map(h => ({
                ...h,
                completions: h.completions || {},
                explicitFailures: h.explicitFailures || {},
                dailyTarget: h.dailyTarget || 1,
                streak: h.streak || 0
            }));
        } catch (error) {
            console.error('Error loading habits:', error);
            return [];
        }
    },

    async saveHabits(habits: Habit[]): Promise<void> {
        try {
            await AsyncStorage.setItem(HABITS_KEY, JSON.stringify(habits));
        } catch (error) {
            console.error('Error saving habits:', error);
        }
    },

    async addHabit(habitData: Omit<Habit, 'id' | 'createdAt' | 'completions' | 'streak' | 'explicitFailures'>): Promise<Habit> {
        const habits = await this.getHabits();
        const newHabit: Habit = {
            id: generateId(),
            createdAt: new Date().toISOString(),
            completions: {},
            explicitFailures: {},
            streak: 0,
            ...habitData,
        };
        habits.push(newHabit);
        await this.saveHabits(habits);
        return newHabit;
    },

    async updateHabit(id: string, updates: Partial<Habit>): Promise<Habit | null> {
        const habits = await this.getHabits();
        const index = habits.findIndex(h => h.id === id);
        if (index !== -1) {
            habits[index] = { ...habits[index], ...updates };
            await this.saveHabits(habits);
            return habits[index];
        }
        return null;
    },

    async deleteHabit(id: string): Promise<void> {
        const habits = await this.getHabits();
        const filtered = habits.filter(h => h.id !== id);
        await this.saveHabits(filtered);
    },

    async toggleHabitCompletion(id: string, dateKey?: string): Promise<ToggleResult | null> {
        const habits = await this.getHabits();
        const index = habits.findIndex(h => h.id === id);
        if (index === -1) return null;

        const habit = habits[index];
        const targetDateKey = dateKey || getTodayKey();

        // Normalize createdAt to start of day for comparison
        const createdAtDate = new Date(habit.createdAt);
        createdAtDate.setHours(0, 0, 0, 0);
        const createdDateKey = getDateKey(createdAtDate);

        // Prevent toggling for days before the habit was created
        if (targetDateKey < createdDateKey) return null;

        const completions = { ...habit.completions };
        const explicitFailures = { ...(habit.explicitFailures || {}) };
        const dailyTarget = habit.dailyTarget || 1;

        const currentCount = completions[targetDateKey] || 0;
        const isExplicitlyFailed = explicitFailures[targetDateKey] || false;
        const isCompleted = currentCount >= dailyTarget;
        let xpGained = 0;

        // Three-state cycle: empty → completed → explicitly failed → empty
        if (!isCompleted && !isExplicitlyFailed) {
            // State: empty → completed
            completions[targetDateKey] = dailyTarget;
            delete explicitFailures[targetDateKey];
            xpGained = 25;
        } else if (isCompleted && !isExplicitlyFailed) {
            // State: completed → explicitly failed (mark as 'x')
            completions[targetDateKey] = 0;
            explicitFailures[targetDateKey] = true;
            xpGained = -25;
        } else {
            // State: explicitly failed → empty (reset to default)
            completions[targetDateKey] = 0;
            delete explicitFailures[targetDateKey];
            // No XP change since we're going from failed to empty
        }

        const streak = calculateStreak(completions, dailyTarget);

        // Bonus XP for streaks
        if (xpGained > 0 && streak > 1) {
            xpGained += Math.min(streak * 5, 50);
        }

        habits[index] = {
            ...habit,
            completions,
            explicitFailures,
            streak,
        };

        await this.saveHabits(habits);

        let leveledUp = false;
        let newLevel: number | undefined;

        if (xpGained !== 0) {
            const result = await this.addXp(xpGained);
            leveledUp = result.leveledUp;
            newLevel = result.newLevel;
        }

        return {
            habit: habits[index],
            xpGained,
            leveledUp,
            newLevel,
        };
    },

    async incrementHabitProgress(id: string, amount: number, dateKey?: string): Promise<ToggleResult | null> {
        const habits = await this.getHabits();
        const index = habits.findIndex(h => h.id === id);
        if (index === -1) return null;

        const habit = habits[index];
        const targetDateKey = dateKey || getTodayKey();

        // Normalize createdAt to start of day for comparison
        const createdAtDate = new Date(habit.createdAt);
        createdAtDate.setHours(0, 0, 0, 0);
        const createdDateKey = getDateKey(createdAtDate);

        // Prevent incrementing for days before the habit was created
        if (targetDateKey < createdDateKey) return null;

        const dailyTarget = habit.dailyTarget || 1;
        const completions = { ...habit.completions };

        const oldProgress = completions[targetDateKey] || 0;
        // Cap at daily target - can't exceed the goal
        const newProgress = Math.min(dailyTarget, Math.max(0, oldProgress + amount));

        // Don't update if already at max and trying to add more
        if (oldProgress >= dailyTarget && amount > 0) return null;

        completions[targetDateKey] = newProgress;

        let xpGained = 0;
        // Gaining XP when completing for the first time or reaching target
        if (oldProgress < dailyTarget && newProgress >= dailyTarget) {
            xpGained = 25;
        } else if (oldProgress >= dailyTarget && newProgress < dailyTarget) {
            xpGained = -25;
        }

        const streak = calculateStreak(completions, dailyTarget);

        habits[index] = {
            ...habit,
            completions,
            streak,
        };

        await this.saveHabits(habits);

        let leveledUp = false;
        let newLevel: number | undefined;

        if (xpGained !== 0) {
            const result = await this.addXp(xpGained);
            leveledUp = result.leveledUp;
            newLevel = result.newLevel;
        }

        return {
            habit: habits[index],
            xpGained,
            leveledUp,
            newLevel,
        };
    },


    // User stats
    async getUserStats(): Promise<UserStats> {
        try {
            const data = await AsyncStorage.getItem(USER_STATS_KEY);
            return data ? JSON.parse(data) : { totalXp: 0, achievements: [] };
        } catch (error) {
            console.error('Error loading user stats:', error);
            return { totalXp: 0, achievements: [] };
        }
    },

    async saveUserStats(stats: UserStats): Promise<void> {
        try {
            await AsyncStorage.setItem(USER_STATS_KEY, JSON.stringify(stats));
        } catch (error) {
            console.error('Error saving user stats:', error);
        }
    },

    async addXp(amount: number): Promise<UserStats & { leveledUp: boolean; newLevel?: number }> {
        const stats = await this.getUserStats();
        const oldLevel = calculateLevel(stats.totalXp).level;
        stats.totalXp = Math.max(0, stats.totalXp + amount);
        const newLevel = calculateLevel(stats.totalXp).level;
        await this.saveUserStats(stats);
        return {
            ...stats,
            leveledUp: newLevel > oldLevel,
            newLevel: newLevel > oldLevel ? newLevel : undefined
        };
    },

    async unlockAchievement(achievementId: string): Promise<UserStats> {
        const stats = await this.getUserStats();
        if (!stats.achievements.includes(achievementId)) {
            stats.achievements.push(achievementId);
            await this.saveUserStats(stats);
        }
        return stats;
    },

    async resetApp(): Promise<void> {
        try {
            await AsyncStorage.multiRemove([HABITS_KEY, USER_STATS_KEY, INITIALIZED_KEY]);
        } catch (error) {
            console.error('Error resetting app:', error);
        }
    },
};

// Generate data for the contribution grid
// Generate data for the contribution grid
export const generateGridData = (habit: Habit, totalDays: number): GridDay[] => {
    const gridData: GridDay[] = [];
    const today = new Date();
    const todayKey = getTodayKey();
    const createdDate = new Date(habit.createdAt);
    createdDate.setHours(0, 0, 0, 0);
    const explicitFailures = habit.explicitFailures || {};

    for (let i = totalDays - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const dateKey = getDateKey(date);

        const progress = habit.completions[dateKey] || 0;
        const dailyTarget = habit.dailyTarget || 1;
        const isCompleted = progress >= dailyTarget;
        const isToday = dateKey === todayKey;
        const isExplicitlyFailed = explicitFailures[dateKey] || false;

        // Missed if: before today, after created, not completed, and NOT explicitly marked as failed
        const isMissed = !isCompleted && !isToday && !isExplicitlyFailed && date < today && date >= createdDate;

        // Inactive if: before createdDate
        const isInactive = date < createdDate;

        gridData.push({
            key: dateKey,
            progress,
            dailyTarget,
            isCompleted,
            isMissed,
            isInactive,
            isToday,
            isExplicitlyFailed,
        });
    }

    return gridData;
};

export default storage;
