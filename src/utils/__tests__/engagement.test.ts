import {
    milestoneCrossed,
    isHabitDueOn,
    isPerfectDay,
    applyStreakSavers,
    biggestStreakAtRisk,
    computeInsights,
    MIN_STREAK_TO_SAVE,
} from '../engagement';
import { calculateStreak, getDateKey } from '../calculations';
import { Habit } from '../../types';

const dayKey = (offset: number, from: Date = new Date()): string => {
    const d = new Date(from);
    d.setDate(d.getDate() + offset);
    return getDateKey(d);
};

const makeHabit = (overrides: Partial<Habit> = {}): Habit => ({
    id: 'h1',
    name: 'Test habit',
    icon: '💧',
    colorIndex: 0,
    frequency: 'daily',
    dailyTarget: 1,
    createdAt: new Date(Date.now() - 90 * 86400000).toISOString(),
    completions: {},
    explicitFailures: {},
    streak: 0,
    ...overrides,
});

/** completions for the last `days` consecutive days ending at `endOffset`. */
const runOfDays = (days: number, endOffset: number): Record<string, number> => {
    const completions: Record<string, number> = {};
    for (let i = 0; i < days; i++) {
        completions[dayKey(endOffset - i)] = 1;
    }
    return completions;
};

describe('milestoneCrossed', () => {
    it('detects a simple crossing', () => {
        expect(milestoneCrossed(6, 7)).toBe(7);
    });

    it('returns highest milestone when several are crossed at once', () => {
        expect(milestoneCrossed(2, 15)).toBe(14);
    });

    it('returns null when no milestone is crossed', () => {
        expect(milestoneCrossed(7, 8)).toBeNull();
    });

    it('returns null when the streak shrinks or stays equal', () => {
        expect(milestoneCrossed(7, 7)).toBeNull();
        expect(milestoneCrossed(30, 3)).toBeNull();
    });
});

describe('isHabitDueOn', () => {
    it('daily habits are always due', () => {
        expect(isHabitDueOn(makeHabit())).toBe(true);
    });

    it('archived habits are never due', () => {
        expect(isHabitDueOn(makeHabit({ archived: true }))).toBe(false);
    });

    it('weekly habits respect targetDays', () => {
        const monday = new Date(2026, 6, 6); // Mon Jul 6 2026
        const habit = makeHabit({ frequency: 'weekly', targetDays: [1, 3] });
        expect(isHabitDueOn(habit, monday)).toBe(true);
        const tuesday = new Date(2026, 6, 7);
        expect(isHabitDueOn(habit, tuesday)).toBe(false);
    });
});

describe('isPerfectDay', () => {
    it('true when every due habit hit its target', () => {
        const habits = [
            makeHabit({ id: 'a', completions: { [dayKey(0)]: 1 } }),
            makeHabit({ id: 'b', dailyTarget: 3, completions: { [dayKey(0)]: 3 } }),
        ];
        expect(isPerfectDay(habits)).toBe(true);
    });

    it('false when one due habit is short of target', () => {
        const habits = [
            makeHabit({ id: 'a', completions: { [dayKey(0)]: 1 } }),
            makeHabit({ id: 'b', dailyTarget: 3, completions: { [dayKey(0)]: 2 } }),
        ];
        expect(isPerfectDay(habits)).toBe(false);
    });

    it('ignores archived habits and is false with no due habits', () => {
        const habits = [
            makeHabit({ id: 'a', completions: { [dayKey(0)]: 1 } }),
            makeHabit({ id: 'b', archived: true }),
        ];
        expect(isPerfectDay(habits)).toBe(true);
        expect(isPerfectDay([makeHabit({ archived: true })])).toBe(false);
        expect(isPerfectDay([])).toBe(false);
    });
});

describe('applyStreakSavers', () => {
    it('bridges yesterday for a missed habit with a streak', () => {
        // 5-day run ending the day before yesterday, yesterday missed
        const habit = makeHabit({ completions: runOfDays(5, -2) });
        const { habits, tokensLeft, saved } = applyStreakSavers([habit], 2);

        expect(saved).toHaveLength(1);
        expect(tokensLeft).toBe(1);
        expect(habits[0].frozenDates?.[dayKey(-1)]).toBe(true);
        // Streak survives the bridge: 5 completed days still count
        expect(habits[0].streak).toBe(5);
        // Original object untouched
        expect(habit.frozenDates).toBeUndefined();
    });

    it('does not spend tokens on streaks below the minimum', () => {
        const habit = makeHabit({ completions: runOfDays(MIN_STREAK_TO_SAVE - 1, -2) });
        const { tokensLeft, saved } = applyStreakSavers([habit], 2);
        expect(saved).toHaveLength(0);
        expect(tokensLeft).toBe(2);
    });

    it('skips habits completed yesterday, explicitly failed, or already frozen', () => {
        const completed = makeHabit({ id: 'a', completions: runOfDays(5, -1) });
        const failed = makeHabit({
            id: 'b',
            completions: runOfDays(5, -2),
            explicitFailures: { [dayKey(-1)]: true },
        });
        const { tokensLeft, saved } = applyStreakSavers([completed, failed], 3);
        expect(saved).toHaveLength(0);
        expect(tokensLeft).toBe(3);
    });

    it('protects the longest streak first when tokens run short', () => {
        const short = makeHabit({ id: 'short', completions: runOfDays(4, -2) });
        const long = makeHabit({ id: 'long', completions: runOfDays(20, -2) });
        const { saved, tokensLeft } = applyStreakSavers([short, long], 1);
        expect(saved).toHaveLength(1);
        expect(saved[0].habitId).toBe('long');
        expect(tokensLeft).toBe(0);
    });

    it('no-ops with zero tokens', () => {
        const habit = makeHabit({ completions: runOfDays(10, -2) });
        const result = applyStreakSavers([habit], 0);
        expect(result.habits).toBe(habit ? result.habits : result.habits);
        expect(result.saved).toHaveLength(0);
    });
});

describe('frozen dates in calculateStreak', () => {
    it('a frozen day bridges but does not count', () => {
        // done today, frozen yesterday, done 3 days before that
        const completions = { [dayKey(0)]: 1, ...runOfDays(3, -2) };
        const frozen = { [dayKey(-1)]: true };
        expect(calculateStreak(completions, 1, 'daily', frozen)).toBe(4);
        // Without the freeze the chain breaks at yesterday
        expect(calculateStreak(completions, 1, 'daily')).toBe(1);
    });
});

describe('biggestStreakAtRisk', () => {
    it('picks the due, incomplete habit with the longest streak', () => {
        const done = makeHabit({ id: 'done', streak: 50, completions: { [dayKey(0)]: 1 } });
        const risky = makeHabit({ id: 'risky', streak: 12 });
        const smaller = makeHabit({ id: 'small', streak: 4 });
        const atRisk = biggestStreakAtRisk([done, risky, smaller]);
        expect(atRisk?.habitId).toBe('risky');
        expect(atRisk?.streak).toBe(12);
    });

    it('returns null when everything due is handled', () => {
        const done = makeHabit({ id: 'done', streak: 5, completions: { [dayKey(0)]: 1 } });
        const noStreak = makeHabit({ id: 'zero', streak: 0 });
        expect(biggestStreakAtRisk([done, noStreak])).toBeNull();
    });
});

describe('computeInsights', () => {
    it('reports week-over-week trend', () => {
        // 3 completions this week (days -1..-3), 6 last week (days -7..-12)
        const completions: Record<string, number> = {};
        for (let i = 1; i <= 3; i++) completions[dayKey(-i)] = 1;
        for (let i = 7; i <= 12; i++) completions[dayKey(-i)] = 1;
        const insights = computeInsights([makeHabit({ completions })]);
        expect(insights.thisWeekCompletions).toBe(3);
        expect(insights.lastWeekCompletions).toBe(6);
        expect(insights.trendPercent).toBe(-50);
    });

    it('returns null trend and weekday with insufficient data', () => {
        const insights = computeInsights([makeHabit()]);
        expect(insights.trendPercent).toBeNull();
        expect(insights.bestWeekday).toBeNull();
    });

    it('finds the best weekday with enough data', () => {
        // Complete every day for 4 weeks -> ties; then add extra habit completions on Mondays
        const base = makeHabit({ completions: runOfDays(28, 0) });
        const mondayOnly: Record<string, number> = {};
        for (let i = 0; i < 56; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            if (d.getDay() === 1) mondayOnly[getDateKey(d)] = 1;
        }
        const monHabit = makeHabit({ id: 'mon', completions: mondayOnly });
        const insights = computeInsights([base, monHabit]);
        expect(insights.bestWeekday).toBe(1);
    });
});
