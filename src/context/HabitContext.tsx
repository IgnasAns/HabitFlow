import React, { createContext, useContext, useReducer, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { storage, calculateLevel } from '../utils/storage';
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
    toggleHabitCompletion: (id: string, dateKey?: string) => Promise<ToggleResult | null>;
    incrementHabitProgress: (id: string, amount: number, dateKey?: string) => Promise<void>;
    clearLastAction: () => void;
    refreshData: () => Promise<void>;
    resetApp: () => Promise<void>;
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
            return {
                ...state,
                habits: state.habits.map(h =>
                    h.id === action.payload.habit.id ? action.payload.habit : h
                ),
                userStats: {
                    ...state.userStats,
                    totalXp: state.userStats.totalXp + action.payload.xpGained
                },
                levelInfo: calculateLevel(state.userStats.totalXp + action.payload.xpGained),
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

    // Load data on mount
    useEffect(() => {
        loadData();
    }, []);

    const loadData = useCallback(async (): Promise<void> => {
        dispatch({ type: 'SET_LOADING', payload: true });
        const habits = await storage.getHabits();
        const userStats = await storage.getUserStats();
        dispatch({ type: 'SET_HABITS', payload: habits });
        dispatch({ type: 'SET_USER_STATS', payload: userStats });
    }, []);

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

    const toggleHabitCompletion = useCallback(async (id: string, dateKey?: string): Promise<ToggleResult | null> => {
        const result = await storage.toggleHabitCompletion(id, dateKey);
        if (result) {
            dispatch({ type: 'TOGGLE_COMPLETE', payload: result });
        }
        return result;
    }, []);

    const incrementHabitProgress = useCallback(async (id: string, amount: number, dateKey?: string): Promise<void> => {
        const result = await storage.incrementHabitProgress(id, amount, dateKey);
        if (result) {
            dispatch({ type: 'TOGGLE_COMPLETE', payload: result });
        }
    }, []);

    const clearLastAction = useCallback((): void => {
        dispatch({ type: 'CLEAR_LAST_ACTION' });
    }, []);

    const resetApp = useCallback(async (): Promise<void> => {
        await storage.resetApp();
        await loadData();
    }, []);

    const value: HabitContextType = useMemo(() => ({
        ...state,
        addHabit,
        updateHabit,
        deleteHabit,
        toggleHabitCompletion,
        incrementHabitProgress,
        clearLastAction,
        refreshData: loadData,
        resetApp,
    }), [state, addHabit, updateHabit, deleteHabit, toggleHabitCompletion, incrementHabitProgress, clearLastAction, loadData, resetApp]);

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
