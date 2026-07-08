// Pure habit state-transition logic shared by the context (and unit tests).
// Single source of truth for the three-state completion cycle, increments,
// and XP/level deltas — no React, no storage, no side effects.
import { Habit, ToggleResult } from '../types';
import {
    getTodayKey,
    calculateStreak,
    calculateHabitTotalXp,
    calculateLevel,
    effectiveTargetFor,
} from './calculations';

/**
 * Three-state completion cycle for a given day:
 *   empty → completed → explicitly failed → empty
 * Returns a new habit with updated completions, explicitFailures and streak.
 */
export function computeToggle(habit: Habit, dateKey?: string): Habit {
    const targetDateKey = dateKey || getTodayKey();
    const completions = { ...habit.completions };
    const explicitFailures = { ...(habit.explicitFailures || {}) };
    const effectiveTarget = effectiveTargetFor(habit);

    const currentCount = completions[targetDateKey] || 0;
    const isExplicitlyFailed = explicitFailures[targetDateKey] || false;
    const isCompleted = currentCount >= effectiveTarget;

    if (!isCompleted && !isExplicitlyFailed) {
        // empty → completed
        completions[targetDateKey] = effectiveTarget;
        delete explicitFailures[targetDateKey];
    } else if (isCompleted && !isExplicitlyFailed) {
        // completed → explicitly failed
        completions[targetDateKey] = 0;
        explicitFailures[targetDateKey] = true;
    } else {
        // explicitly failed → empty
        completions[targetDateKey] = 0;
        delete explicitFailures[targetDateKey];
    }

    const streak = calculateStreak(completions, habit.dailyTarget || 1, habit.frequency);
    return { ...habit, completions, explicitFailures, streak };
}

/**
 * Add `amount` to a day's progress (clamped to [0, target]).
 * Returns the updated habit, or null if the change is a no-op
 * (already at/above target while incrementing upward).
 */
export function computeIncrement(habit: Habit, amount: number, dateKey?: string): Habit | null {
    const targetDateKey = dateKey || getTodayKey();
    const effectiveTarget = effectiveTargetFor(habit);
    const completions = { ...habit.completions };

    const oldProgress = completions[targetDateKey] || 0;
    if (oldProgress >= effectiveTarget && amount > 0) return null;

    const newProgress = Math.min(effectiveTarget, Math.max(0, oldProgress + amount));
    completions[targetDateKey] = newProgress;

    const explicitFailures = { ...(habit.explicitFailures || {}) };
    if (newProgress > 0 && explicitFailures[targetDateKey]) {
        delete explicitFailures[targetDateKey];
    }

    const streak = calculateStreak(completions, habit.dailyTarget || 1, habit.frequency);
    return { ...habit, completions, explicitFailures, streak };
}

/**
 * Build the ToggleResult (xp delta + level-up info) for a transition from
 * `prevHabit` to `updatedHabit`, given the user's current total XP.
 */
export function buildToggleResult(prevHabit: Habit, updatedHabit: Habit, currentTotalXp: number): ToggleResult {
    const xpGained = calculateHabitTotalXp(updatedHabit) - calculateHabitTotalXp(prevHabit);

    const currentLevel = calculateLevel(currentTotalXp).level;
    const newTotalXp = Math.max(0, currentTotalXp + xpGained);
    const newLevel = calculateLevel(newTotalXp).level;
    const leveledUp = newLevel > currentLevel;

    return {
        habit: updatedHabit,
        xpGained,
        leveledUp,
        newLevel: leveledUp ? newLevel : undefined,
    };
}
