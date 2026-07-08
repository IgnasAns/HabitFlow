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
const SCHEMA_VERSION_KEY = '@schema_version';
const AUTO_BACKUP_KEY = '@auto_backup';
const AUTO_BACKUP_PREV_KEY = '@auto_backup_prev';
const LAST_BACKUP_AT_KEY = '@last_backup_at';

// Bump this whenever the shape of persisted habits/stats changes, and add a
// step to `runMigrations` below. Version 2 = frozenDates + freezeTokens.
export const SCHEMA_VERSION = 2;

const AUTO_BACKUP_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // weekly

export interface BackupSnapshot {
    savedAt: string; // ISO timestamp
    schemaVersion: number;
    habits: Habit[];
    userStats: UserStats;
}

// In-memory cache for initialization state to avoid redundant storage reads
let _isInitialized: boolean | null = null;
let _migrationsChecked = false;

/**
 * One-time, versioned migrations for persisted data. Runs before the first
 * read each app session; cheap no-op when the stored version is current.
 */
async function runMigrations(): Promise<void> {
    if (_migrationsChecked) return;
    _migrationsChecked = true;
    try {
        const stored = Number(await AsyncStorage.getItem(SCHEMA_VERSION_KEY)) || 1;
        if (stored >= SCHEMA_VERSION) return;

        // v1 -> v2: introduce habit.frozenDates and userStats.freezeTokens.
        // Both are optional-with-defaults, so normalising on read (below)
        // already covers them; we only need to record the new version.

        await AsyncStorage.setItem(SCHEMA_VERSION_KEY, String(SCHEMA_VERSION));
    } catch (error) {
        console.error('Error running storage migrations:', error);
    }
}

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
            await runMigrations();

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

            // Normalise older records to the current shape
            return habits.map(h => ({
                ...h,
                completions: h.completions || {},
                explicitFailures: h.explicitFailures || {},
                frozenDates: h.frozenDates || {},
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
            const stats: UserStats = data ? JSON.parse(data) : { totalXp: 0, achievements: [] };
            return { ...stats, freezeTokens: stats.freezeTokens ?? 0 };
        } catch (error) {
            console.error('Error loading user stats:', error);
            return { totalXp: 0, achievements: [], freezeTokens: 0 };
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
            // Snapshot first so an accidental reset is recoverable from
            // Settings -> Restore Auto-Backup.
            await this.createBackupNow();
            await AsyncStorage.multiRemove([HABITS_KEY, USER_STATS_KEY, INITIALIZED_KEY]);
            // Reset the cached initialization state
            _isInitialized = null;
        } catch (error) {
            console.error('Error resetting app:', error);
        }
    },

    // --- Auto-backup -------------------------------------------------------
    // Rolling two-slot snapshots kept under separate AsyncStorage keys.
    // They protect against the realistic on-device failure modes (bad import,
    // accidental reset, a bug corrupting the habits blob); the manual JSON
    // export remains the off-device backup.

    async createBackupNow(): Promise<void> {
        try {
            const data = await AsyncStorage.getItem(HABITS_KEY);
            if (!data) return; // nothing to back up
            const statsData = await AsyncStorage.getItem(USER_STATS_KEY);
            const snapshot: BackupSnapshot = {
                savedAt: new Date().toISOString(),
                schemaVersion: SCHEMA_VERSION,
                habits: JSON.parse(data),
                userStats: statsData ? JSON.parse(statsData) : { totalXp: 0, achievements: [] },
            };
            const current = await AsyncStorage.getItem(AUTO_BACKUP_KEY);
            if (current) {
                await AsyncStorage.setItem(AUTO_BACKUP_PREV_KEY, current);
            }
            await AsyncStorage.setItem(AUTO_BACKUP_KEY, JSON.stringify(snapshot));
            await AsyncStorage.setItem(LAST_BACKUP_AT_KEY, String(Date.now()));
        } catch (error) {
            console.error('Error creating backup:', error);
        }
    },

    /** Take a weekly snapshot if the last one is older than the interval. */
    async maybeAutoBackup(): Promise<void> {
        try {
            const last = Number(await AsyncStorage.getItem(LAST_BACKUP_AT_KEY)) || 0;
            if (Date.now() - last >= AUTO_BACKUP_INTERVAL_MS) {
                await this.createBackupNow();
            }
        } catch (error) {
            console.error('Error checking auto-backup:', error);
        }
    },

    async listBackups(): Promise<BackupSnapshot[]> {
        const backups: BackupSnapshot[] = [];
        try {
            for (const key of [AUTO_BACKUP_KEY, AUTO_BACKUP_PREV_KEY]) {
                const raw = await AsyncStorage.getItem(key);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (parsed && Array.isArray(parsed.habits)) backups.push(parsed);
                }
            }
        } catch (error) {
            console.error('Error listing backups:', error);
        }
        return backups;
    },

    /** Overwrite current data with a snapshot. Returns false on failure. */
    async restoreBackup(snapshot: BackupSnapshot): Promise<boolean> {
        try {
            if (!snapshot || !Array.isArray(snapshot.habits)) return false;
            await this.saveHabits(snapshot.habits);
            await this.saveUserStats(snapshot.userStats || { totalXp: 0, achievements: [] });
            await AsyncStorage.setItem(INITIALIZED_KEY, 'true');
            _isInitialized = true;
            return true;
        } catch (error) {
            console.error('Error restoring backup:', error);
            return false;
        }
    },
};

export default storage;
