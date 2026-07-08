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

// Calculate streak for a habit
export const calculateStreak = (completions: Record<string, number>, dailyTarget: number, frequency: Habit['frequency'] = 'daily'): number => {
    if (!completions) return 0;

    const effectiveTarget = frequency === 'weekly' ? 1 : dailyTarget;

    // Get all completed dates, filter by target, sort in reverse chronological order
    const completedDates = Object.keys(completions)
        .filter(k => completions[k] >= effectiveTarget)
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

// Calculate streak ending at a specific date
export const calculateStreakForDate = (completions: Record<string, number>, dailyTarget: number, endDate: Date, frequency: Habit['frequency'] = 'daily'): number => {
    if (!completions) return 0;

    const effectiveTarget = frequency === 'weekly' ? 1 : dailyTarget;

    // Create a temporary date object to traverse backwards
    let currentDate = new Date(endDate);
    let streak = 0;

    // Check backwards for 365 days max to prevent infinite loops (though unlikely)
    for (let i = 0; i < 365; i++) {
        const dateKey = getDateKey(currentDate);
        if ((completions[dateKey] || 0) >= effectiveTarget) {
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
