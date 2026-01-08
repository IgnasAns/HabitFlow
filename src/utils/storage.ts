import AsyncStorage from '@react-native-async-storage/async-storage';
import { Habit, UserStats, LevelInfo, ToggleResult, GridDay } from '../types';
import { getDefaultHabits } from './suggestedHabits';

const HABITS_KEY = '@habits';
const USER_STATS_KEY = '@user_stats';
const INITIALIZED_KEY = '@initialized';

// In-memory cache for initialization state to avoid redundant storage reads
let _isInitialized: boolean | null = null;

// Generate unique ID
export const generateId = (): string =>
    Date.now().toString(36) + Math.random().toString(36).substr(2);

// Get today's date string
export const getTodayKey = (): string => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};

// Parse date key safely using local time
export const parseDateKey = (key: string): Date => {
    const [year, month, day] = key.split('-').map(Number);
    return new Date(year, month - 1, day); // Month is 0-indexed
};

// Get date string for any date
export const getDateKey = (date: Date): string => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

// Calculate streak for a habit
export const calculateStreak = (completions: Record<string, number>, dailyTarget: number): number => {
    if (!completions) return 0;

    // Get all completed dates, filter by target, sort in reverse chronological order
    const completedDates = Object.keys(completions)
        .filter(k => completions[k] >= dailyTarget)
        .sort()
        .reverse();

    if (completedDates.length === 0) return 0;

    const today = getTodayKey();
    const yesterday = getDateKey(new Date(Date.now() - 86400000));

    // Streak can only start from today or yesterday
    if (completedDates[0] !== today && completedDates[0] !== yesterday) {
        return 0;
    }

    let streak = 1;

    let currentDate = parseDateKey(completedDates[0]);

    // Check for consecutive days going backwards
    for (let i = 1; i < completedDates.length; i++) {
        // Calculate what yesterday would be from the current date
        const expectedPrevDate = new Date(currentDate);
        expectedPrevDate.setDate(expectedPrevDate.getDate() - 1);
        const expectedPrevKey = getDateKey(expectedPrevDate);

        if (completedDates[i] === expectedPrevKey) {
            streak++;
            currentDate = expectedPrevDate;
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
// Calculate streak ending at a specific date
export const calculateStreakForDate = (completions: Record<string, number>, dailyTarget: number, endDate: Date): number => {
    if (!completions) return 0;

    // Create a temporary date object to traverse backwards
    let currentDate = new Date(endDate);
    let streak = 0;

    // Check backwards for 365 days max to prevent infinite loops (though unlikely)
    for (let i = 0; i < 365; i++) {
        const dateKey = getDateKey(currentDate);
        if ((completions[dateKey] || 0) >= dailyTarget) {
            streak++;
            currentDate.setDate(currentDate.getDate() - 1);
        } else {
            break;
        }
    }
    return streak;
};

// Calculate total XP for a habit based on its history
// This ensures that XP is always consistent with the current state of streaks and completions
// It fixes "phantom XP" bugs where adding/removing completions in the past would desync the total XP
export const calculateHabitTotalXp = (habit: Habit): number => {
    let xp = 0;
    const dailyTarget = habit.dailyTarget || 1;
    // Get all completed dates
    const completedDates = Object.keys(habit.completions)
        .filter(k => habit.completions[k] >= dailyTarget)
        .sort(); // YYYY-MM-DD sorts alphabetically correctly

    if (completedDates.length === 0) return 0;

    let currentStreak = 0;
    let prevDate: Date | null = null;

    for (const dateKey of completedDates) {
        // Parse date
        const [y, m, d] = dateKey.split('-').map(Number);
        const date = new Date(y, m - 1, d);

        // Check if consecutive
        let isConsecutive = false;
        if (prevDate) {
            const expected = new Date(prevDate);
            expected.setDate(expected.getDate() + 1);
            // Compare timestamps
            if (expected.getTime() === date.getTime()) {
                isConsecutive = true;
            }
        } else {
            // First date
            isConsecutive = true; // Start of streak
        }

        if (isConsecutive && prevDate) {
            currentStreak++;
        } else if (!prevDate) {
            currentStreak = 1;
        } else {
            // Gap found, reset streak
            currentStreak = 1;
        }

        xp += 25; // Base XP
        if (currentStreak > 1) {
            xp += Math.min(currentStreak * 5, 50);
        }

        prevDate = date;
    }
    return xp;
};

// Storage operations
export const storage = {
    // ... (rest of storage object up to toggleHabitCompletion) ...
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
            // Use cached initialization check to avoid redundant storage reads
            if (_isInitialized === null) {
                const initialized = await AsyncStorage.getItem(INITIALIZED_KEY);
                _isInitialized = !!initialized;
            }

            if (!_isInitialized) {
                await this.initializeDefaultHabits();
                _isInitialized = true;
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
        const oldXp = calculateHabitTotalXp(habit);

        const targetDateKey = dateKey || getTodayKey();
        const completions = { ...habit.completions };
        const explicitFailures = { ...(habit.explicitFailures || {}) };
        const dailyTarget = habit.dailyTarget || 1;

        const currentCount = completions[targetDateKey] || 0;
        const isExplicitlyFailed = explicitFailures[targetDateKey] || false;
        const isCompleted = currentCount >= dailyTarget;

        // Three-state cycle: empty → completed → explicitly failed → empty
        if (!isCompleted && !isExplicitlyFailed) {
            // State: empty → completed
            completions[targetDateKey] = dailyTarget;
            delete explicitFailures[targetDateKey];
        } else if (isCompleted && !isExplicitlyFailed) {
            // State: completed → explicitly failed
            completions[targetDateKey] = 0;
            explicitFailures[targetDateKey] = true;
        } else {
            // State: explicitly failed → empty
            completions[targetDateKey] = 0;
            delete explicitFailures[targetDateKey];
        }

        const streak = calculateStreak(completions, dailyTarget);

        const updatedHabit = {
            ...habit,
            completions,
            explicitFailures,
            streak,
        };

        habits[index] = updatedHabit;

        const newXp = calculateHabitTotalXp(updatedHabit);
        const xpGained = newXp - oldXp;

        let leveledUp = false;
        let newLevel: number | undefined;

        // Batch save habits and stats together to reduce storage operations
        if (xpGained !== 0) {
            const stats = await this.getUserStats();
            const oldLevel = calculateLevel(stats.totalXp).level;
            stats.totalXp = Math.max(0, stats.totalXp + xpGained);
            const newLevelValue = calculateLevel(stats.totalXp).level;
            leveledUp = newLevelValue > oldLevel;
            newLevel = leveledUp ? newLevelValue : undefined;

            // Batch both saves together
            await AsyncStorage.multiSet([
                [HABITS_KEY, JSON.stringify(habits)],
                [USER_STATS_KEY, JSON.stringify(stats)]
            ]);
        } else {
            await this.saveHabits(habits);
        }

        return {
            habit: updatedHabit,
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
        const oldXp = calculateHabitTotalXp(habit);

        const targetDateKey = dateKey || getTodayKey();
        const dailyTarget = habit.dailyTarget || 1;
        const completions = { ...habit.completions };

        const oldProgress = completions[targetDateKey] || 0;
        const newProgress = Math.min(dailyTarget, Math.max(0, oldProgress + amount));

        if (oldProgress >= dailyTarget && amount > 0) return null;

        completions[targetDateKey] = newProgress;

        // Automatically clear explicit failure if progress is made
        const explicitFailures = { ...(habit.explicitFailures || {}) };
        if (newProgress > 0 && explicitFailures[targetDateKey]) {
            delete explicitFailures[targetDateKey];
        }

        const streak = calculateStreak(completions, dailyTarget);

        const updatedHabit = {
            ...habit,
            completions,
            explicitFailures,
            streak,
        };

        habits[index] = updatedHabit;

        const newXp = calculateHabitTotalXp(updatedHabit);
        const xpGained = newXp - oldXp;

        let leveledUp = false;
        let newLevel: number | undefined;

        // Batch save habits and stats together
        if (xpGained !== 0) {
            const stats = await this.getUserStats();
            const oldLevel = calculateLevel(stats.totalXp).level;
            stats.totalXp = Math.max(0, stats.totalXp + xpGained);
            const newLevelValue = calculateLevel(stats.totalXp).level;
            leveledUp = newLevelValue > oldLevel;
            newLevel = leveledUp ? newLevelValue : undefined;

            await AsyncStorage.multiSet([
                [HABITS_KEY, JSON.stringify(habits)],
                [USER_STATS_KEY, JSON.stringify(stats)]
            ]);
        } else {
            await this.saveHabits(habits);
        }

        return {
            habit: updatedHabit,
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
            // Reset the cached initialization state
            _isInitialized = null;
        } catch (error) {
            console.error('Error resetting app:', error);
        }
    },
};

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

        // Inactive if: before createdDate AND no progress (handles backfilled data)
        const isInactive = date < createdDate && progress === 0;

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

// Generate data for a specific calendar month
export const generateCalendarMonthData = (habit: Habit, year: number, month: number): GridDay[] => {
    const gridData: GridDay[] = [];
    const todayKey = getTodayKey();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const createdDate = new Date(habit.createdAt);
    createdDate.setHours(0, 0, 0, 0);

    const explicitFailures = habit.explicitFailures || {};
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 1; i <= daysInMonth; i++) {
        const date = new Date(year, month, i);
        date.setHours(0, 0, 0, 0);
        const dateKey = getDateKey(date);

        const progress = habit.completions[dateKey] || 0;
        const dailyTarget = habit.dailyTarget || 1;
        const isCompleted = progress >= dailyTarget;
        const isToday = dateKey === todayKey;
        const isExplicitlyFailed = explicitFailures[dateKey] || false;

        // Future dates in the current month
        const isFuture = date > today;

        // Missed if: before today, after created, not completed, and NOT explicitly marked as failed
        const isMissed = !isCompleted && !isToday && !isExplicitlyFailed && !isFuture && date >= createdDate;

        // Inactive if: before createdDate AND no progress
        const isInactive = date < createdDate && progress === 0;

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
