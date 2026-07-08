// Pure engagement mechanics: streak milestones, Streak Saver tokens,
// perfect-day detection and stats insights. No React Native imports so the
// whole module is unit-testable in plain Node.
import { Habit } from '../types';
import {
    getTodayKey,
    getDateKey,
    effectiveTargetFor,
    calculateStreak,
    calculateStreakForDate,
} from './calculations';

// Streak lengths worth celebrating. Early ones are close together so new
// users hit a reward quickly; later ones stretch out.
export const STREAK_MILESTONES = [3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 365, 500, 730, 1000];

// Milestones from this value up also earn a Streak Saver token.
export const TOKEN_EARNING_MILESTONE = 7;

// Maximum Streak Saver tokens a user can hold.
export const MAX_FREEZE_TOKENS = 5;

// A streak must be at least this long before we'll spend a token on it.
export const MIN_STREAK_TO_SAVE = 3;

/**
 * Highest milestone crossed when a streak moves from `prevStreak` to
 * `newStreak`, or null if none was crossed (including when streak shrank).
 */
export function milestoneCrossed(prevStreak: number, newStreak: number): number | null {
    if (newStreak <= prevStreak) return null;
    let crossed: number | null = null;
    for (const m of STREAK_MILESTONES) {
        if (prevStreak < m && newStreak >= m) crossed = m;
    }
    return crossed;
}

/** Whether a habit is scheduled for the given date (defaults to today). */
export function isHabitDueOn(habit: Habit, date: Date = new Date()): boolean {
    if (habit.archived) return false;
    if (habit.frequency === 'weekly' && habit.targetDays && habit.targetDays.length > 0) {
        return habit.targetDays.includes(date.getDay());
    }
    return true;
}

/** True when every due, non-archived habit hit its target for the day. */
export function isPerfectDay(habits: Habit[], date: Date = new Date()): boolean {
    const dateKey = getDateKey(date);
    const due = habits.filter(h => isHabitDueOn(h, date));
    if (due.length === 0) return false;
    return due.every(h => (h.completions[dateKey] || 0) >= effectiveTargetFor(h));
}

export interface StreakSaverResult {
    habits: Habit[];
    tokensLeft: number;
    /** Habits whose yesterday was bridged, longest streak first. */
    saved: { habitId: string; habitName: string; streak: number }[];
}

/**
 * Spend Streak Saver tokens to bridge *yesterday* for habits that were due,
 * not completed, not explicitly failed, and had a streak worth saving.
 * Longest streaks are protected first. Returns new arrays/objects; inputs
 * are not mutated.
 */
export function applyStreakSavers(
    habits: Habit[],
    tokens: number,
    now: Date = new Date(),
): StreakSaverResult {
    const result: StreakSaverResult = { habits, tokensLeft: tokens, saved: [] };
    if (tokens <= 0) return result;

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = getDateKey(yesterday);
    const dayBefore = new Date(now);
    dayBefore.setDate(dayBefore.getDate() - 2);

    // Candidates: due yesterday, missed it (no completion, no explicit fail,
    // not already frozen), and with a streak ending the day before worth saving.
    const candidates = habits
        .map((habit, index) => {
            if (!isHabitDueOn(habit, yesterday)) return null;
            const target = effectiveTargetFor(habit);
            if ((habit.completions[yesterdayKey] || 0) >= target) return null;
            if (habit.explicitFailures?.[yesterdayKey]) return null;
            if (habit.frozenDates?.[yesterdayKey]) return null;
            const streakAtRisk = calculateStreakForDate(
                habit.completions, habit.dailyTarget || 1, dayBefore, habit.frequency, habit.frozenDates,
            );
            if (streakAtRisk < MIN_STREAK_TO_SAVE) return null;
            return { index, streakAtRisk };
        })
        .filter((c): c is { index: number; streakAtRisk: number } => c !== null)
        .sort((a, b) => b.streakAtRisk - a.streakAtRisk);

    if (candidates.length === 0) return result;

    const newHabits = [...habits];
    let tokensLeft = tokens;
    for (const { index, streakAtRisk } of candidates) {
        if (tokensLeft <= 0) break;
        const habit = newHabits[index];
        const frozenDates = { ...(habit.frozenDates || {}), [yesterdayKey]: true };
        const streak = calculateStreak(habit.completions, habit.dailyTarget || 1, habit.frequency, frozenDates);
        newHabits[index] = { ...habit, frozenDates, streak };
        tokensLeft--;
        result.saved.push({ habitId: habit.id, habitName: habit.name, streak: streakAtRisk });
    }

    return { habits: newHabits, tokensLeft, saved: result.saved };
}

export interface HabitAtRisk {
    habitId: string;
    habitName: string;
    streak: number;
}

/**
 * The habit with the longest streak that is due today but not yet completed
 * (and not explicitly failed). Used for the evening "streak at risk" nudge.
 */
export function biggestStreakAtRisk(habits: Habit[], now: Date = new Date()): HabitAtRisk | null {
    const todayKey = getDateKey(now);
    let best: HabitAtRisk | null = null;
    for (const habit of habits) {
        if (!isHabitDueOn(habit, now)) continue;
        if ((habit.completions[todayKey] || 0) >= effectiveTargetFor(habit)) continue;
        if (habit.explicitFailures?.[todayKey]) continue;
        if (habit.streak <= 0) continue;
        if (!best || habit.streak > best.streak) {
            best = { habitId: habit.id, habitName: habit.name, streak: habit.streak };
        }
    }
    return best;
}

export interface StatsInsights {
    /** 0=Sun..6=Sat, or null when there isn't enough data yet. */
    bestWeekday: number | null;
    thisWeekCompletions: number;
    lastWeekCompletions: number;
    /** Percent change vs last week, or null when last week had no data. */
    trendPercent: number | null;
}

/**
 * Lightweight insights for the Stats screen, computed over the last 8 weeks.
 */
export function computeInsights(habits: Habit[], now: Date = new Date()): StatsInsights {
    const active = habits.filter(h => !h.archived);
    const byWeekday = [0, 0, 0, 0, 0, 0, 0];
    let total = 0;
    let thisWeek = 0;
    let lastWeek = 0;

    for (let i = 0; i < 56; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const key = getDateKey(date);
        for (const habit of active) {
            if ((habit.completions[key] || 0) >= effectiveTargetFor(habit)) {
                byWeekday[date.getDay()]++;
                total++;
                if (i < 7) thisWeek++;
                else if (i < 14) lastWeek++;
            }
        }
    }

    let bestWeekday: number | null = null;
    if (total >= 10) {
        bestWeekday = byWeekday.indexOf(Math.max(...byWeekday));
    }

    const trendPercent = lastWeek > 0
        ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100)
        : null;

    return { bestWeekday, thisWeekCompletions: thisWeek, lastWeekCompletions: lastWeek, trendPercent };
}

/** Today's completion summary used by the perfect-day check and share nudges. */
export function dueTodaySummary(habits: Habit[], now: Date = new Date()): { done: number; due: number } {
    const todayKey = getTodayKey();
    const due = habits.filter(h => isHabitDueOn(h, now));
    const done = due.filter(h => (h.completions[todayKey] || 0) >= effectiveTargetFor(h)).length;
    return { done, due: due.length };
}
