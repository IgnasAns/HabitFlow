import { computeToggle, computeIncrement, buildToggleResult } from '../habitLogic';
import { Habit } from '../../types';

const D = '2026-01-01';

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

describe('computeToggle (three-state cycle)', () => {
    it('empty → completed', () => {
        const next = computeToggle(makeHabit(), D);
        expect(next.completions[D]).toBe(1);
        expect(next.explicitFailures[D]).toBeUndefined();
    });

    it('completed → explicitly failed', () => {
        const completed = makeHabit({ completions: { [D]: 1 } });
        const next = computeToggle(completed, D);
        expect(next.completions[D]).toBe(0);
        expect(next.explicitFailures[D]).toBe(true);
    });

    it('explicitly failed → empty', () => {
        const failed = makeHabit({ completions: { [D]: 0 }, explicitFailures: { [D]: true } });
        const next = computeToggle(failed, D);
        expect(next.completions[D]).toBe(0);
        expect(next.explicitFailures[D]).toBeUndefined();
    });

    it('completing a multi-count daily habit fills to the full target', () => {
        const next = computeToggle(makeHabit({ dailyTarget: 8 }), D);
        expect(next.completions[D]).toBe(8);
    });

    it('does not mutate the input habit', () => {
        const habit = makeHabit();
        computeToggle(habit, D);
        expect(habit.completions[D]).toBeUndefined();
    });
});

describe('computeIncrement', () => {
    it('adds progress toward the target', () => {
        const next = computeIncrement(makeHabit({ dailyTarget: 8 }), 1, D);
        expect(next?.completions[D]).toBe(1);
    });

    it('returns null when already at target and incrementing up (no-op)', () => {
        const atTarget = makeHabit({ dailyTarget: 8, completions: { [D]: 8 } });
        expect(computeIncrement(atTarget, 1, D)).toBeNull();
    });

    it('clamps progress to the target', () => {
        const near = makeHabit({ dailyTarget: 8, completions: { [D]: 7 } });
        const next = computeIncrement(near, 5, D);
        expect(next?.completions[D]).toBe(8);
    });

    it('does not go below zero', () => {
        const next = computeIncrement(makeHabit({ dailyTarget: 8, completions: { [D]: 1 } }), -5, D);
        expect(next?.completions[D]).toBe(0);
    });

    it('clears an explicit failure once progress is made', () => {
        const failed = makeHabit({ dailyTarget: 8, explicitFailures: { [D]: true } });
        const next = computeIncrement(failed, 1, D);
        expect(next?.explicitFailures[D]).toBeUndefined();
    });
});

describe('buildToggleResult', () => {
    it('reports the XP gained by completing a fresh day', () => {
        const prev = makeHabit();
        const updated = computeToggle(prev, D);
        const result = buildToggleResult(prev, updated, 0);
        expect(result.xpGained).toBe(25);
        expect(result.habit).toBe(updated);
        expect(result.leveledUp).toBe(false);
    });

    it('flags a level-up when crossing the XP threshold', () => {
        // 90 XP + a 25 XP completion crosses the 100 XP level-1 boundary.
        const prev = makeHabit();
        const updated = computeToggle(prev, D);
        const result = buildToggleResult(prev, updated, 90);
        expect(result.leveledUp).toBe(true);
        expect(result.newLevel).toBe(2);
    });

    it('returns negative XP when un-completing a day', () => {
        const completed = makeHabit({ completions: { [D]: 1 } });
        const failed = computeToggle(completed, D); // completed → failed (0)
        const result = buildToggleResult(completed, failed, 25);
        expect(result.xpGained).toBe(-25);
    });
});
