import {
    getDateKey,
    parseDateKey,
    effectiveTargetFor,
    calculateStreak,
    xpForLevel,
    calculateLevel,
    calculateHabitTotalXp,
} from '../calculations';
import { Habit } from '../../types';

const dayKey = (offsetDays: number): string =>
    getDateKey(new Date(Date.now() + offsetDays * 86400000));

const makeHabit = (overrides: Partial<Habit> = {}): Habit => ({
    id: 'h1',
    name: 'Test',
    icon: '💪',
    colorIndex: 0,
    frequency: 'daily',
    dailyTarget: 1,
    createdAt: new Date(0).toISOString(),
    completions: {},
    explicitFailures: {},
    streak: 0,
    ...overrides,
});

describe('date helpers', () => {
    it('getDateKey ↔ parseDateKey round-trips a local date', () => {
        const key = '2026-03-05';
        const d = parseDateKey(key);
        expect(getDateKey(d)).toBe(key);
        expect(d.getMonth()).toBe(2); // March, 0-indexed
    });
});

describe('effectiveTargetFor', () => {
    it('is 1 for weekly habits regardless of dailyTarget', () => {
        expect(effectiveTargetFor({ frequency: 'weekly', dailyTarget: 8 })).toBe(1);
    });
    it('uses dailyTarget for daily habits', () => {
        expect(effectiveTargetFor({ frequency: 'daily', dailyTarget: 8 })).toBe(8);
    });
    it('falls back to 1 when dailyTarget is missing/zero', () => {
        expect(effectiveTargetFor({ frequency: 'daily', dailyTarget: 0 })).toBe(1);
    });
});

describe('xpForLevel / calculateLevel', () => {
    it('grows geometrically (×1.5 per level)', () => {
        expect(xpForLevel(1)).toBe(100);
        expect(xpForLevel(2)).toBe(150);
        expect(xpForLevel(3)).toBe(225);
    });

    it('maps total XP to level + remainder', () => {
        expect(calculateLevel(0)).toEqual({ level: 1, currentXp: 0, xpNeeded: 100 });
        expect(calculateLevel(100)).toEqual({ level: 2, currentXp: 0, xpNeeded: 150 });
        // 100 (L1) + 150 (L2) = 250 reaches level 3
        expect(calculateLevel(250)).toEqual({ level: 3, currentXp: 0, xpNeeded: 225 });
        expect(calculateLevel(120)).toEqual({ level: 2, currentXp: 20, xpNeeded: 150 });
    });
});

describe('calculateStreak', () => {
    it('counts consecutive days ending today', () => {
        const completions = { [dayKey(0)]: 1, [dayKey(-1)]: 1, [dayKey(-2)]: 1 };
        expect(calculateStreak(completions, 1, 'daily')).toBe(3);
    });

    it('still counts when the streak ends yesterday (grace day)', () => {
        const completions = { [dayKey(-1)]: 1, [dayKey(-2)]: 1 };
        expect(calculateStreak(completions, 1, 'daily')).toBe(2);
    });

    it('is 0 when the most recent completion is older than yesterday', () => {
        const completions = { [dayKey(-3)]: 1, [dayKey(-4)]: 1 };
        expect(calculateStreak(completions, 1, 'daily')).toBe(0);
    });

    it('breaks on a gap', () => {
        const completions = { [dayKey(0)]: 1, [dayKey(-2)]: 1 };
        expect(calculateStreak(completions, 1, 'daily')).toBe(1);
    });

    it('requires meeting the daily target', () => {
        const completions = { [dayKey(0)]: 2 };
        expect(calculateStreak(completions, 3, 'daily')).toBe(0);
        expect(calculateStreak({ [dayKey(0)]: 3 }, 3, 'daily')).toBe(1);
    });

    it('treats weekly habits as binary (target 1)', () => {
        const completions = { [dayKey(0)]: 1, [dayKey(-1)]: 1 };
        expect(calculateStreak(completions, 8, 'weekly')).toBe(2);
    });
});

describe('calculateHabitTotalXp', () => {
    it('is 0 with no completions', () => {
        expect(calculateHabitTotalXp(makeHabit())).toBe(0);
    });

    it('awards 25 base XP for a single completed day', () => {
        const habit = makeHabit({ completions: { '2026-01-01': 1 } });
        expect(calculateHabitTotalXp(habit)).toBe(25);
    });

    it('adds a streak bonus for consecutive days', () => {
        // day1: 25 (no bonus). day2 consecutive: 25 + min(2*5,50)=10 → 35. Total 60.
        const habit = makeHabit({ completions: { '2026-01-01': 1, '2026-01-02': 1 } });
        expect(calculateHabitTotalXp(habit)).toBe(60);
    });

    it('gives no streak bonus across a gap', () => {
        const habit = makeHabit({ completions: { '2026-01-01': 1, '2026-01-03': 1 } });
        expect(calculateHabitTotalXp(habit)).toBe(50);
    });

    it('caps the streak bonus at 50', () => {
        // 12 consecutive days; from day 11 the bonus is capped at 50.
        const completions: Record<string, number> = {};
        for (let d = 1; d <= 12; d++) {
            completions[`2026-01-${String(d).padStart(2, '0')}`] = 1;
        }
        const habit = makeHabit({ completions });
        // day1:25; days2..10 add 25 + 10..50; day11,12 add 25 + 50 each.
        let expected = 25;
        for (let streak = 2; streak <= 12; streak++) {
            expected += 25 + Math.min(streak * 5, 50);
        }
        expect(calculateHabitTotalXp(habit)).toBe(expected);
    });
});
