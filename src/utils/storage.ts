import AsyncStorage from '@react-native-async-storage/async-storage';
import { Habit, UserStats } from '../types';
import { getDefaultHabits } from './suggestedHabits';
import { calculateLevel } from './calculations';

// Re-export pure calculations so existing `from '../utils/storage'` imports keep working.
// The implementations live in ./calculations (RN-free, unit-testable).
export {
    getTodayKey,
    parseDateKey,
    getDateKey,
    effectiveTargetFor,
    calculateStreak,
    xpForLevel,
    calculateLevel,
    calculateStreakForDate,
    calculateHabitTotalXp,
    generateGridData,
    generateCalendarMonthData,
} from './calculations';

const HABITS_KEY = '@habits';
const USER_STATS_KEY = '@user_stats';
const INITIALIZED_KEY = '@initialized';

// In-memory cache for initialization state to avoid redundant storage reads
let _isInitialized: boolean | null = null;

// Generate unique ID
export const generateId = (): string =>
    Date.now().toString(36) + Math.random().toString(36).slice(2);

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

export default storage;
