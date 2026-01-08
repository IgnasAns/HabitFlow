import React, { createContext, useContext, useReducer, useEffect, ReactNode, useCallback, useMemo, useRef } from 'react';
import { storage, calculateLevel, calculateHabitTotalXp, getTodayKey, calculateStreak } from '../utils/storage';
import { Habit, UserStats, LevelInfo, ToggleResult } from '../types';

// Action types
type HabitAction =
    | { type: 'SET_HABITS'; payload: Habit[] }
    | { type: 'SET_USER_STATS'; payload: UserStats }
    | { type: 'ADD_HABIT'; payload: Habit }
    | { type: 'UPDATE_HABIT'; payload: Habit }
    | { type: 'DELETE_HABIT'; payload: string }
    | { type: 'TOGGLE_COMPLETE'; payload: ToggleResult }
    | { type: 'SET_LOADING'; payload: boolean }
    | { type: 'REORDER_HABITS'; payload: Habit[] }
    | { type: 'CLEAR_LAST_ACTION' };

interface LastAction {
    type: string;
    habit?: Habit;
    id?: string;
    xpGained?: number;
    leveledUp?: boolean;
    newLevel?: number;
}

interface HabitState {
    habits: Habit[];
    userStats: UserStats;
    levelInfo: LevelInfo;
    isLoading: boolean;
    lastAction: LastAction | null;
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
    refreshData: () => Promise<void>;
    resetApp: () => Promise<void>;
    importData: (data: any) => Promise<boolean>;
}

const HabitContext = createContext<HabitContextType | null>(null);

const initialState: HabitState = {
    habits: [],
    userStats: { totalXp: 0, achievements: [] },
    levelInfo: { level: 1, currentXp: 0, xpNeeded: 100 },
    isLoading: true,
    lastAction: null,
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
            return {
                ...state,
                habits: state.habits.map(h =>
                    h.id === action.payload.habit.id ? action.payload.habit : h
                ),
                userStats: {
                    ...state.userStats,
                    totalXp: newTotalXp
                },
                levelInfo: calculateLevel(newTotalXp),
                lastAction: {
                    type: 'TOGGLE_COMPLETE',
                    habit: action.payload.habit,
                    xpGained: action.payload.xpGained,
                    leveledUp: action.payload.leveledUp,
                    newLevel: action.payload.newLevel,
                },
            };

        case 'SET_LOADING':
            return { ...state, isLoading: action.payload };

        case 'REORDER_HABITS':
            return { ...state, habits: action.payload };

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

    // Use a ref to access latest state in callbacks without causing re-creation
    // This is critical for performance - callbacks stay stable while still reading fresh state
    const stateRef = useRef(state);
    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    // Load data on mount
    useEffect(() => {
        loadData();
    }, []);

    const loadData = useCallback(async (): Promise<void> => {
        dispatch({ type: 'SET_LOADING', payload: true });
        const habits = await storage.getHabits();
        let userStats = await storage.getUserStats();

        // Calculate total XP from all habits to ensure consistency (fix phantom XP)
        const realTotalXp = habits.reduce((total, habit) => {
            return total + calculateHabitTotalXp(habit);
        }, 0);

        // If stored XP mismatches (phantom XP or missing XP), correct it
        if (userStats.totalXp !== realTotalXp) {
            console.log(`Correcting XP mismatch: Stored ${userStats.totalXp}, Real ${realTotalXp}`);
            userStats = {
                ...userStats,
                totalXp: realTotalXp
            };
            // Save the corrected stats
            await storage.saveUserStats(userStats);
        }

        dispatch({ type: 'SET_HABITS', payload: habits });
        dispatch({ type: 'SET_USER_STATS', payload: userStats });
    }, []);

    // Debounced Auto-Save: Persist state changes to storage
    // This prevents UI lag and race conditions during rapid tapping
    useEffect(() => {
        if (state.isLoading) return;

        const timer = setTimeout(() => {
            storage.saveHabits(state.habits).catch(console.error);
            storage.saveUserStats(state.userStats).catch(console.error);
        }, 1000);

        return () => clearTimeout(timer);
    }, [state.habits, state.userStats]);

    const addHabit = useCallback(async (habitData: Omit<Habit, 'id' | 'createdAt' | 'completions' | 'streak' | 'explicitFailures'>): Promise<Habit> => {
        const newHabit = await storage.addHabit(habitData);
        dispatch({ type: 'ADD_HABIT', payload: newHabit });
        return newHabit;
    }, []);

    const updateHabit = useCallback(async (id: string, updates: Partial<Habit>): Promise<Habit | null> => {
        const updated = await storage.updateHabit(id, updates);
        if (updated) {
            dispatch({ type: 'UPDATE_HABIT', payload: updated });
        }
        return updated;
    }, []);

    const deleteHabit = useCallback(async (id: string): Promise<void> => {
        await storage.deleteHabit(id);
        dispatch({ type: 'DELETE_HABIT', payload: id });
    }, []);

    const toggleHabitCompletion = useCallback((id: string, dateKey?: string): ToggleResult | null => {
        // Access state via ref to avoid callback recreation on every state change
        const currentState = stateRef.current;

        // Find the habit in current state for optimistic update
        const habit = currentState.habits.find(h => h.id === id);
        if (!habit) return null;

        const targetDateKey = dateKey || getTodayKey();
        const completions = { ...habit.completions };
        const explicitFailures = { ...(habit.explicitFailures || {}) };
        const dailyTarget = habit.dailyTarget || 1;

        const currentCount = completions[targetDateKey] || 0;
        const isExplicitlyFailed = explicitFailures[targetDateKey] || false;
        const isCompleted = currentCount >= dailyTarget;

        // Three-state cycle: empty → completed → explicitly failed → empty
        if (!isCompleted && !isExplicitlyFailed) {
            completions[targetDateKey] = dailyTarget;
            delete explicitFailures[targetDateKey];
        } else if (isCompleted && !isExplicitlyFailed) {
            completions[targetDateKey] = 0;
            explicitFailures[targetDateKey] = true;
        } else {
            completions[targetDateKey] = 0;
            delete explicitFailures[targetDateKey];
        }

        const streak = calculateStreak(completions, dailyTarget);
        const oldXp = calculateHabitTotalXp(habit);

        const updatedHabit = {
            ...habit,
            completions,
            explicitFailures,
            streak,
        };

        const newXp = calculateHabitTotalXp(updatedHabit);
        const xpGained = newXp - oldXp;

        const currentLevel = calculateLevel(currentState.userStats.totalXp).level;
        const newTotalXp = Math.max(0, currentState.userStats.totalXp + xpGained);
        const newLevel = calculateLevel(newTotalXp).level;
        const leveledUp = newLevel > currentLevel;

        const result: ToggleResult = {
            habit: updatedHabit,
            xpGained,
            leveledUp,
            newLevel: leveledUp ? newLevel : undefined,
        };

        // OPTIMISTIC UPDATE: Dispatch immediately for instant UI feedback
        dispatch({ type: 'TOGGLE_COMPLETE', payload: result });

        // Persist via auto-save effect
        // storage.toggleHabitCompletion(id, dateKey).catch(console.error);

        return result;
    }, []); // Empty deps - uses stateRef for fresh state

    const incrementHabitProgress = useCallback((id: string, amount: number, dateKey?: string): void => {
        // Access state via ref to avoid callback recreation on every state change
        const currentState = stateRef.current;

        // Find the habit in current state for optimistic update
        const habit = currentState.habits.find(h => h.id === id);
        if (!habit) return;

        const targetDateKey = dateKey || getTodayKey();
        const dailyTarget = habit.dailyTarget || 1;
        const completions = { ...habit.completions };

        const oldProgress = completions[targetDateKey] || 0;
        if (oldProgress >= dailyTarget && amount > 0) return;

        const newProgress = Math.min(dailyTarget, Math.max(0, oldProgress + amount));
        completions[targetDateKey] = newProgress;

        const explicitFailures = { ...(habit.explicitFailures || {}) };
        if (newProgress > 0 && explicitFailures[targetDateKey]) {
            delete explicitFailures[targetDateKey];
        }

        const streak = calculateStreak(completions, dailyTarget);
        const oldXp = calculateHabitTotalXp(habit);

        const updatedHabit = {
            ...habit,
            completions,
            explicitFailures,
            streak,
        };

        const newXp = calculateHabitTotalXp(updatedHabit);
        const xpGained = newXp - oldXp;

        const currentLevel = calculateLevel(currentState.userStats.totalXp).level;
        const newTotalXp = Math.max(0, currentState.userStats.totalXp + xpGained);
        const newLevel = calculateLevel(newTotalXp).level;
        const leveledUp = newLevel > currentLevel;

        const result: ToggleResult = {
            habit: updatedHabit,
            xpGained,
            leveledUp,
            newLevel: leveledUp ? newLevel : undefined,
        };

        // OPTIMISTIC UPDATE: Dispatch immediately
        dispatch({ type: 'TOGGLE_COMPLETE', payload: result });

        // Persist via auto-save (debounced)
        // storage.incrementHabitProgress(id, amount, dateKey).catch(console.error);
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
        refreshData: loadData,
        resetApp,
        importData,
    }), [state, addHabit, updateHabit, deleteHabit, toggleHabitCompletion, incrementHabitProgress, moveHabit, reorderHabits, clearLastAction, loadData, resetApp, importData]);

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
