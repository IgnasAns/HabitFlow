import React, { createContext, useContext, useReducer, useEffect, ReactNode, useCallback, useMemo, useRef } from 'react';
import { AppState } from 'react-native';
import { storage, calculateLevel, calculateHabitTotalXp, calculateStreak } from '../utils/storage';
import { computeToggle, computeIncrement, buildToggleResult } from '../utils/habitLogic';
import {
    applyStreakSavers,
    biggestStreakAtRisk,
    isPerfectDay,
    MAX_FREEZE_TOKENS,
    TOKEN_EARNING_MILESTONE,
} from '../utils/engagement';
import type { BackupSnapshot } from '../utils/storage';
import {
    scheduleHabitReminder,
    cancelHabitReminder,
    scheduleStreakDangerNudge,
    cancelStreakDangerNudge,
} from '../utils/notifications';
import { useI18n, interpolate } from './I18nContext';
import { updateWidgetData } from '../utils/widgetData';
import { Habit, UserStats, LevelInfo, ToggleResult } from '../types';

// Action types
type HabitAction =
    | { type: 'SET_HABITS'; payload: Habit[] }
    | { type: 'SET_USER_STATS'; payload: UserStats }
    | { type: 'ADD_HABIT'; payload: Habit }
    | { type: 'UPDATE_HABIT'; payload: Habit }
    | { type: 'DELETE_HABIT'; payload: string }
    | { type: 'TOGGLE_COMPLETE'; payload: ToggleResult & { perfectDay?: boolean; tokenEarned?: boolean } }
    | { type: 'SET_LOADING'; payload: boolean }
    | { type: 'REORDER_HABITS'; payload: Habit[] }
    | { type: 'SET_SAVER_NOTICE'; payload: StreakSaverNotice[] | null }
    | { type: 'CLEAR_LAST_ACTION' };

interface LastAction {
    type: string;
    habit?: Habit;
    id?: string;
    xpGained?: number;
    leveledUp?: boolean;
    newLevel?: number;
    milestone?: number;
    perfectDay?: boolean;
    tokenEarned?: boolean;
}

export interface StreakSaverNotice {
    habitName: string;
    streak: number;
}

interface HabitState {
    habits: Habit[];
    userStats: UserStats;
    levelInfo: LevelInfo;
    isLoading: boolean;
    lastAction: LastAction | null;
    // Set once on load when Streak Saver tokens were spent overnight.
    streakSaverNotice: StreakSaverNotice[] | null;
}

interface HabitContextType extends HabitState {
    addHabit: (habitData: Omit<Habit, 'id' | 'createdAt' | 'completions' | 'streak' | 'explicitFailures'>) => Promise<Habit>;
    updateHabit: (id: string, updates: Partial<Habit>) => Promise<Habit | null>;
    deleteHabit: (id: string) => Promise<void>;
    toggleHabitCompletion: (id: string, dateKey?: string) => ToggleResult | null;
    incrementHabitProgress: (id: string, amount: number, dateKey?: string) => void;
    moveHabit: (fromIndex: number, toIndex: number) => Promise<void>;
    reorderHabits: (habits: Habit[]) => Promise<void>;
    clearLastAction: () => void;
    clearStreakSaverNotice: () => void;
    refreshData: () => Promise<void>;
    resetApp: () => Promise<void>;
    importData: (data: any) => Promise<boolean>;
    listBackups: () => Promise<BackupSnapshot[]>;
    restoreBackup: (snapshot: BackupSnapshot) => Promise<boolean>;
}

const HabitContext = createContext<HabitContextType | null>(null);

const initialState: HabitState = {
    habits: [],
    userStats: { totalXp: 0, achievements: [], freezeTokens: 0 },
    levelInfo: { level: 1, currentXp: 0, xpNeeded: 100 },
    isLoading: true,
    lastAction: null,
    streakSaverNotice: null,
};

function habitReducer(state: HabitState, action: HabitAction): HabitState {
    switch (action.type) {
        case 'SET_HABITS':
            return { ...state, habits: action.payload, isLoading: false };

        case 'SET_USER_STATS':
            return {
                ...state,
                userStats: action.payload,
                levelInfo: calculateLevel(action.payload.totalXp),
            };

        case 'ADD_HABIT':
            return {
                ...state,
                habits: [...state.habits, action.payload],
                lastAction: { type: 'ADD_HABIT', habit: action.payload },
            };

        case 'UPDATE_HABIT':
            return {
                ...state,
                habits: state.habits.map(h =>
                    h.id === action.payload.id ? action.payload : h
                ),
                lastAction: { type: 'UPDATE_HABIT', habit: action.payload },
            };

        case 'DELETE_HABIT':
            return {
                ...state,
                habits: state.habits.filter(h => h.id !== action.payload),
                lastAction: { type: 'DELETE_HABIT', id: action.payload },
            };

        case 'TOGGLE_COMPLETE':
            // The logic here is now mostly visual since XP is pre-calculated in storage,
            // but we use the delta passed back to update local state optimistically/correctly.
            const newTotalXp = Math.max(0, state.userStats.totalXp + action.payload.xpGained);
            const tokenEarned = !!action.payload.tokenEarned;
            const currentTokens = state.userStats.freezeTokens ?? 0;
            return {
                ...state,
                habits: state.habits.map(h =>
                    h.id === action.payload.habit.id ? action.payload.habit : h
                ),
                userStats: {
                    ...state.userStats,
                    totalXp: newTotalXp,
                    freezeTokens: tokenEarned
                        ? Math.min(MAX_FREEZE_TOKENS, currentTokens + 1)
                        : currentTokens,
                },
                levelInfo: calculateLevel(newTotalXp),
                lastAction: {
                    type: 'TOGGLE_COMPLETE',
                    habit: action.payload.habit,
                    xpGained: action.payload.xpGained,
                    leveledUp: action.payload.leveledUp,
                    newLevel: action.payload.newLevel,
                    milestone: action.payload.milestone,
                    perfectDay: action.payload.perfectDay,
                    tokenEarned,
                },
            };

        case 'SET_LOADING':
            return { ...state, isLoading: action.payload };

        case 'REORDER_HABITS':
            return { ...state, habits: action.payload };

        case 'SET_SAVER_NOTICE':
            return { ...state, streakSaverNotice: action.payload };

        case 'CLEAR_LAST_ACTION':
            return { ...state, lastAction: null };

        default:
            return state;
    }
}

interface HabitProviderProps {
    children: ReactNode;
}

export function HabitProvider({ children }: HabitProviderProps) {
    const [state, dispatch] = useReducer(habitReducer, initialState);
    const { t } = useI18n();

    // Use a ref to access latest state in callbacks without causing re-creation
    // This is critical for performance - callbacks stay stable while still reading fresh state
    const stateRef = useRef(state);
    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    // Keep the latest translations available to the AppState listener
    const tRef = useRef(t);
    useEffect(() => {
        tRef.current = t;
    }, [t]);

    // Streak-danger nudge: when the app goes to background with the day's
    // habits unfinished, schedule a one-shot evening reminder naming the
    // biggest streak at risk. Cancel it whenever the app comes back.
    useEffect(() => {
        const sub = AppState.addEventListener('change', (nextState) => {
            if (nextState === 'active') {
                cancelStreakDangerNudge().catch(console.error);
                return;
            }
            if (nextState !== 'background') return;
            const atRisk = biggestStreakAtRisk(stateRef.current.habits);
            if (!atRisk) {
                cancelStreakDangerNudge().catch(console.error);
                return;
            }
            const tr = tRef.current;
            scheduleStreakDangerNudge(
                interpolate(tr.engagement.nudgeTitle, { streak: atRisk.streak }),
                interpolate(tr.engagement.nudgeBody, { name: atRisk.habitName }),
            ).catch(console.error);
        });
        return () => sub.remove();
    }, []);

    // Load data on mount
    useEffect(() => {
        loadData();
    }, []);

    const loadData = useCallback(async (): Promise<void> => {
        dispatch({ type: 'SET_LOADING', payload: true });
        let habits = await storage.getHabits();
        let userStats = await storage.getUserStats();

        // Spend Streak Saver tokens to bridge yesterday for habits that
        // missed it but had a streak worth protecting.
        const saverResult = applyStreakSavers(habits, userStats.freezeTokens ?? 0);
        if (saverResult.saved.length > 0) {
            habits = saverResult.habits;
            userStats = { ...userStats, freezeTokens: saverResult.tokensLeft };
            dispatch({
                type: 'SET_SAVER_NOTICE',
                payload: saverResult.saved.map(s => ({ habitName: s.habitName, streak: s.streak })),
            });
        }

        // Stored streaks go stale when the app isn't opened for a day;
        // recompute them all on load.
        habits = habits.map(h => ({
            ...h,
            streak: calculateStreak(h.completions, h.dailyTarget || 1, h.frequency, h.frozenDates),
        }));

        // Calculate total XP from all habits to ensure consistency (fix phantom XP)
        const realTotalXp = habits.reduce((total, habit) => {
            return total + calculateHabitTotalXp(habit);
        }, 0);

        // If stored XP mismatches (phantom XP or missing XP), correct it
        if (userStats.totalXp !== realTotalXp) {
            userStats = {
                ...userStats,
                totalXp: realTotalXp
            };
        }
        // Persist any load-time corrections (savers, streaks, XP)
        await storage.saveHabits(habits);
        await storage.saveUserStats(userStats);

        dispatch({ type: 'SET_HABITS', payload: habits });
        dispatch({ type: 'SET_USER_STATS', payload: userStats });

        // Weekly safety snapshot (no-op if a recent one exists)
        storage.maybeAutoBackup().catch(console.error);
    }, []);

    // Debounced Auto-Save: Persist state changes to storage
    // This prevents UI lag and race conditions during rapid tapping
    useEffect(() => {
        if (state.isLoading) return;

        // Update widgets immediately so they reflect changes instantly
        updateWidgetData(state.habits).catch(console.error);

        // Debounce storage save (heavier I/O) to prevent lag
        const timer = setTimeout(() => {
            storage.saveHabits(state.habits).catch(console.error);
            storage.saveUserStats(state.userStats).catch(console.error);
        }, 1000);

        return () => clearTimeout(timer);
    }, [state.habits, state.userStats]);

    const addHabit = useCallback(async (habitData: Omit<Habit, 'id' | 'createdAt' | 'completions' | 'streak' | 'explicitFailures'>): Promise<Habit> => {
        const newHabit = await storage.addHabit(habitData);
        dispatch({ type: 'ADD_HABIT', payload: newHabit });

        // Schedule notification if timeslot reminder is enabled
        if (newHabit.timeSlot?.reminder) {
            const [h, m] = newHabit.timeSlot.start.split(':').map(Number);
            await scheduleHabitReminder(newHabit.id, newHabit.name, h, m).catch(console.error);
        }

        return newHabit;
    }, []);

    const updateHabit = useCallback(async (id: string, updates: Partial<Habit>): Promise<Habit | null> => {
        const updated = await storage.updateHabit(id, updates);
        if (updated) {
            dispatch({ type: 'UPDATE_HABIT', payload: updated });

            // Handle reminders
            if (updated.timeSlot?.reminder && !updated.archived) {
                const [h, m] = updated.timeSlot.start.split(':').map(Number);
                await scheduleHabitReminder(updated.id, updated.name, h, m).catch(console.error);
            } else {
                // If reminder disabled, or habit archived, or timeslot removed
                // The schedule function handles cancellation if rescheduling, but here we explicit cancel if turned off
                if (!updated.timeSlot?.reminder || updated.archived) {
                    await cancelHabitReminder(updated.id).catch(console.error);
                }
            }
        }
        return updated;
    }, []);

    const deleteHabit = useCallback(async (id: string): Promise<void> => {
        await cancelHabitReminder(id).catch(console.error);
        await storage.deleteHabit(id);
        dispatch({ type: 'DELETE_HABIT', payload: id });
    }, []);

    const toggleHabitCompletion = useCallback((id: string, dateKey?: string): ToggleResult | null => {
        // Access state via ref to avoid callback recreation on every state change
        const currentState = stateRef.current;

        // Find the habit in current state for optimistic update
        const habit = currentState.habits.find(h => h.id === id);
        if (!habit) return null;

        const updatedHabit = computeToggle(habit, dateKey);
        const result = buildToggleResult(habit, updatedHabit, currentState.userStats.totalXp);
        const updatedHabits = currentState.habits.map(h => h.id === id ? updatedHabit : h);

        // Perfect day: only celebrate the toggle that *makes* the day perfect
        const perfectDay = !isPerfectDay(currentState.habits) && isPerfectDay(updatedHabits);
        // Milestones from 7 days up also earn a Streak Saver token
        const tokenEarned = !!result.milestone && result.milestone >= TOKEN_EARNING_MILESTONE;

        // OPTIMISTIC UPDATE: Dispatch immediately for instant UI feedback
        dispatch({ type: 'TOGGLE_COMPLETE', payload: { ...result, perfectDay, tokenEarned } });

        // Update widgets immediately with the new habits array
        updateWidgetData(updatedHabits).catch(console.error);

        // Persistence happens via the debounced auto-save effect.
        return result;
    }, []); // Empty deps - uses stateRef for fresh state

    const incrementHabitProgress = useCallback((id: string, amount: number, dateKey?: string): void => {
        // Access state via ref to avoid callback recreation on every state change
        const currentState = stateRef.current;

        // Find the habit in current state for optimistic update
        const habit = currentState.habits.find(h => h.id === id);
        if (!habit) return;

        const updatedHabit = computeIncrement(habit, amount, dateKey);
        if (!updatedHabit) return; // No-op (already at target)

        const result = buildToggleResult(habit, updatedHabit, currentState.userStats.totalXp);
        const updatedHabits = currentState.habits.map(h => h.id === id ? updatedHabit : h);
        const perfectDay = !isPerfectDay(currentState.habits) && isPerfectDay(updatedHabits);
        const tokenEarned = !!result.milestone && result.milestone >= TOKEN_EARNING_MILESTONE;

        // OPTIMISTIC UPDATE: Dispatch immediately
        dispatch({ type: 'TOGGLE_COMPLETE', payload: { ...result, perfectDay, tokenEarned } });

        // Update widgets immediately with the new habits array
        updateWidgetData(updatedHabits).catch(console.error);

        // Persistence happens via the debounced auto-save effect.
    }, []); // Empty deps - uses stateRef for fresh state

    const moveHabit = useCallback(async (fromIndex: number, toIndex: number): Promise<void> => {
        const currentHabits = stateRef.current.habits;
        if (fromIndex < 0 || fromIndex >= currentHabits.length || toIndex < 0 || toIndex >= currentHabits.length) {
            return;
        }
        const newHabits = [...currentHabits];
        const [moved] = newHabits.splice(fromIndex, 1);
        newHabits.splice(toIndex, 0, moved);

        // Optimistic update
        dispatch({ type: 'REORDER_HABITS', payload: newHabits });

        // Persist
        await storage.saveHabits(newHabits);
    }, []);

    const reorderHabits = useCallback(async (habits: Habit[]): Promise<void> => {
        dispatch({ type: 'REORDER_HABITS', payload: habits });
        await storage.saveHabits(habits);
    }, []);

    const clearLastAction = useCallback((): void => {
        dispatch({ type: 'CLEAR_LAST_ACTION' });
    }, []);

    const clearStreakSaverNotice = useCallback((): void => {
        dispatch({ type: 'SET_SAVER_NOTICE', payload: null });
    }, []);

    const resetApp = useCallback(async (): Promise<void> => {
        await storage.resetApp();
        await loadData();
    }, []);

    const importData = useCallback(async (data: any): Promise<boolean> => {
        try {
            // Basic validation
            if (!data || !Array.isArray(data.habits) || !data.userStats) {
                return false;
            }

            // Snapshot current data first so a bad import is recoverable
            await storage.createBackupNow();

            // Save to storage
            await storage.saveHabits(data.habits);
            await storage.saveUserStats(data.userStats);

            // Reload
            await loadData();
            return true;
        } catch (e) {
            console.error('Import failed', e);
            return false;
        }
    }, [loadData]);

    const listBackups = useCallback(() => storage.listBackups(), []);

    const restoreBackup = useCallback(async (snapshot: BackupSnapshot): Promise<boolean> => {
        const ok = await storage.restoreBackup(snapshot);
        if (ok) await loadData();
        return ok;
    }, [loadData]);

    const value: HabitContextType = useMemo(() => ({
        ...state,
        addHabit,
        updateHabit,
        deleteHabit,
        toggleHabitCompletion,
        incrementHabitProgress,
        moveHabit,
        reorderHabits,
        clearLastAction,
        clearStreakSaverNotice,
        refreshData: loadData,
        resetApp,
        importData,
        listBackups,
        restoreBackup,
    }), [state, addHabit, updateHabit, deleteHabit, toggleHabitCompletion, incrementHabitProgress, moveHabit, reorderHabits, clearLastAction, clearStreakSaverNotice, loadData, resetApp, importData, listBackups, restoreBackup]);

    return (
        <HabitContext.Provider value={value}>
            {children}
        </HabitContext.Provider>
    );
}

export function useHabits(): HabitContextType {
    const context = useContext(HabitContext);
    if (!context) {
        throw new Error('useHabits must be used within a HabitProvider');
    }
    return context;
}

export default HabitContext;
