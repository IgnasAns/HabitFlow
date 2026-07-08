// Pure habit calculations (dates, streaks, XP, grid generation).
// Intentionally free of React Native / AsyncStorage imports so this logic
// can be unit-tested in a plain Node environment and reused anywhere.
import { Habit, LevelInfo, GridDay } from '../types';

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

// The number of completions that count a day as "done".
// Weekly habits are binary per-day (1); daily habits use their dailyTarget.
export const effectiveTargetFor = (habit: Pick<Habit, 'frequency' | 'dailyTarget'>): number =>
    habit.frequency === 'weekly' ? 1 : (habit.dailyTarget || 1);

// Calculate streak for a habit.
// Walks backwards day by day from today. An unfinished today never breaks the
// chain (it is "pending"); a frozen day (Streak Saver) bridges the chain
// without adding to the count.
export const calculateStreak = (
    completions: Record<string, number>,
    dailyTarget: number,
    frequency: Habit['frequency'] = 'daily',
    frozenDates?: Record<string, boolean>,
): number => {
    if (!completions) return 0;

    const effectiveTarget = frequency === 'weekly' ? 1 : dailyTarget;
    const frozen = frozenDates || {};

    let streak = 0;
    const cursor = new Date();
    const todayKey = getTodayKey();
    if ((completions[todayKey] || 0) >= effectiveTarget) streak++;
    cursor.setDate(cursor.getDate() - 1);

    // 10-year cap to guarantee termination
    for (let i = 0; i < 3650; i++) {
        const key = getDateKey(cursor);
        if ((completions[key] || 0) >= effectiveTarget) {
            streak++;
        } else if (!frozen[key]) {
            break;
        }
        cursor.setDate(cursor.getDate() - 1);
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

// Calculate streak ending at a specific date
export const calculateStreakForDate = (
    completions: Record<string, number>,
    dailyTarget: number,
    endDate: Date,
    frequency: Habit['frequency'] = 'daily',
    frozenDates?: Record<string, boolean>,
): number => {
    if (!completions) return 0;

    const effectiveTarget = frequency === 'weekly' ? 1 : dailyTarget;
    const frozen = frozenDates || {};

    // Create a temporary date object to traverse backwards
    let currentDate = new Date(endDate);
    let streak = 0;

    // Check backwards for 365 days max to prevent infinite loops (though unlikely)
    for (let i = 0; i < 365; i++) {
        const dateKey = getDateKey(currentDate);
        if ((completions[dateKey] || 0) >= effectiveTarget) {
            streak++;
        } else if (!frozen[dateKey]) {
            break;
        }
        currentDate.setDate(currentDate.getDate() - 1);
    }
    return streak;
};

// Calculate total XP for a habit based on its history
// This ensures that XP is always consistent with the current state of streaks and completions
// It fixes "phantom XP" bugs where adding/removing completions in the past would desync the total XP
export const calculateHabitTotalXp = (habit: Habit): number => {
    let xp = 0;
    const effectiveTarget = effectiveTargetFor(habit);

    // Get all completed dates
    const completedDates = Object.keys(habit.completions)
        .filter(k => habit.completions[k] >= effectiveTarget)
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

// Generate data for the contribution grid
export const generateGridData = (habit: Habit, totalDays: number): GridDay[] => {
    const gridData: GridDay[] = [];
    const today = new Date();
    const todayKey = getTodayKey();
    const createdDate = new Date(habit.createdAt);
    createdDate.setHours(0, 0, 0, 0);
    const explicitFailures = habit.explicitFailures || {};
    const effectiveTarget = effectiveTargetFor(habit);

    for (let i = totalDays - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const dateKey = getDateKey(date);

        const progress = habit.completions[dateKey] || 0;
        const isCompleted = progress >= effectiveTarget;
        const isToday = dateKey === todayKey;
        const isExplicitlyFailed = explicitFailures[dateKey] || false;

        // Missed if: before today, after created, not completed, and NOT explicitly marked as failed
        const isMissed = !isCompleted && !isToday && !isExplicitlyFailed && date < today && date >= createdDate;

        // Inactive if: before createdDate AND no progress (handles backfilled data)
        const isInactive = date < createdDate && progress === 0;

        gridData.push({
            key: dateKey,
            progress,
            dailyTarget: effectiveTarget,
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
    const effectiveTarget = effectiveTargetFor(habit);

    const explicitFailures = habit.explicitFailures || {};
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 1; i <= daysInMonth; i++) {
        const date = new Date(year, month, i);
        date.setHours(0, 0, 0, 0);
        const dateKey = getDateKey(date);

        const progress = habit.completions[dateKey] || 0;
        const isCompleted = progress >= effectiveTarget;
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
            dailyTarget: effectiveTarget,
            isCompleted,
            isMissed,
            isInactive,
            isToday,
            isExplicitlyFailed,
        });
    }

    return gridData;
};
