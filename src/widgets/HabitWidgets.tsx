'use no memo';
/**
 * Android Widget Components for HabitFlow
 *
 * Design goal: mirror the in-app HabitListItem (weekly/monthly) and HabitCard (github)
 * exactly, adapted to the FlexWidget/TextWidget primitives used by react-native-android-widget.
 *
 * All colors must be #RRGGBB or #AARRGGBB — no rgba(), no 'transparent'.
 * All grid cells are rendered as SQUARES (same width and height).
 */

import React from 'react';
import { FlexWidget, TextWidget, ColorProp } from 'react-native-android-widget';

// ─── Color Constants (matching theme.ts) ──────────────────────────
const BG_CARD: ColorProp = '#121926';
const TEXT_PRIMARY: ColorProp = '#FFFFFF';
const TEXT_SECONDARY: ColorProp = '#94A3B8';
const STREAK_COLOR: ColorProp = '#F59E0B';
const DANGER_COLOR: ColorProp = '#EF4444';
const EMPTY_CELL: ColorProp = '#252B37';     // solid dark gray — matches in-app
const EMPTY_CELL_DIM: ColorProp = '#1C2130';  // dimmer gray (inactive/before creation)
const TRANSPARENT: ColorProp = '#00000000';
const TODAY_BORDER: ColorProp = '#F59E0B';

const HABIT_COLORS: string[] = [
    '#06B6D4', '#10B981', '#F59E0B', '#3B82F6',
    '#EC4899', '#F97316', '#84CC16', '#0EA5E9',
];

// ─── Types ──────────────────────────────────────────────────────
interface GridCellData {
    isCompleted?: boolean;
    isMissed?: boolean;
    isExplicitlyFailed?: boolean;
    isInactive?: boolean;
    progress?: number;
    dailyTarget?: number;
    isToday?: boolean;
}

interface WidgetProps {
    habitName?: string;
    habitIcon?: string;
    habitColorIndex?: number;
    gridData?: GridCellData[];
    streak?: number;
    todayProgress?: number;
    dailyTarget?: number;
    isCompletedToday?: boolean;
    isExplicitlyFailedToday?: boolean;
    theme?: 'dark' | 'light';
    widgetId?: number;
    widgetWidth?: number;
    widgetHeight?: number;
}

// ─── Helpers ────────────────────────────────────────────────────
function getHabitColor(index: number): string {
    return HABIT_COLORS[index % HABIT_COLORS.length];
}

function colorWithAlpha(hex: string, fraction: number): ColorProp {
    const c = hex.startsWith('#') ? hex.substring(1) : hex;
    const a = Math.round(Math.min(1, Math.max(0, fraction)) * 255).toString(16).padStart(2, '0').toUpperCase();
    return `#${a}${c}` as ColorProp;
}

/**
 * Cell color — precisely matching in-app HabitListItem (lines 288-294)
 * 
 * In-app uses separate bgColor + opacity. Widgets can't do that, so we
 * pre-bake the opacity into the ARGB color.
 */
function getCellColor(cell: GridCellData | undefined, habitColor: string): ColorProp {
    if (!cell) return EMPTY_CELL;

    const progress = cell.progress ?? 0;
    const target = cell.dailyTarget ?? 1;
    const isCompleted = progress >= target && !cell.isExplicitlyFailed;

    // 1. Explicitly failed → solid red
    if (cell.isExplicitlyFailed) return DANGER_COLOR;

    // 2. Inactive (before habit creation) → dimmed empty
    if (cell.isInactive) return EMPTY_CELL_DIM;

    // 3. Completed → full habit color
    if (isCompleted) return habitColor as ColorProp;

    // 4. Missed (past day, no progress, after creation) → very faint red (20%)
    //    In-app: rgba(239, 68, 68, 0.2)
    if (cell.isMissed) return colorWithAlpha('#EF4444', 0.2);

    // 5. Has some progress but not completed → habit color at partial opacity
    //    In-app: opacity = 0.4 + (progress/target * 0.6)
    if (progress > 0) {
        const ratio = Math.min(1, progress / target);
        const opacity = 0.4 + ratio * 0.6;
        return colorWithAlpha(habitColor, opacity);
    }

    // 6. Today with no progress → transparent (border shows it's today)
    if (cell.isToday) return TRANSPARENT;

    // 7. Empty cell → subtle gray
    return EMPTY_CELL;
}

function prepareGridData(gridData: GridCellData[], count: number): GridCellData[] {
    const data = [...gridData].slice(-count);
    while (data.length < count) data.unshift({});
    return data;
}

/**
 * Build current-week data (Mon→Sun) matching in-app HabitListItem logic.
 * - Mon through today  = actual data from gridData
 * - After today through Sun = null (empty/gray)
 */
function prepareCurrentWeekData(gridData: GridCellData[]): (GridCellData | null)[] {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sun..6=Sat
    const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Mon=0..Sun=6
    // Take grid entries for Mon → today (offset+1 days)
    const history = gridData.slice(-(offset + 1));
    // Pad from the left if not enough data
    while (history.length < offset + 1) history.unshift({} as GridCellData);
    // Pad future days until Sunday (total 7)
    const result: (GridCellData | null)[] = [...history];
    for (let i = history.length; i < 7; i++) result.push(null);
    return result;
}

/**
 * Build GitHub grid columns aligned to day-of-week.
 * Row 0=Sun, 1=Mon, ..., 6=Sat — matching in-app HabitCard.
 * The last column is a partial week ending at today.
 */
function buildGitHubGrid(gridData: GridCellData[], cols: number): (GridCellData | null)[][] {
    const today = new Date();
    const todayDow = today.getDay(); // 0=Sun..6=Sat
    // We need (cols-1) full weeks + partial current week (Sun..today)
    const totalDays = (cols - 1) * 7 + todayDow + 1;
    const sliced = [...gridData].slice(-totalDays);
    // Pad front if not enough data
    while (sliced.length < totalDays) sliced.unshift({} as GridCellData);

    const columns: (GridCellData | null)[][] = [];
    for (let c = 0; c < cols; c++) {
        const col: (GridCellData | null)[] = [];
        for (let r = 0; r < 7; r++) {
            if (c === cols - 1 && r > todayDow) {
                col.push(null); // future day in current week
            } else {
                const idx = c * 7 + r;
                col.push(idx < sliced.length ? sliced[idx] : null);
            }
        }
        columns.push(col);
    }
    return columns;
}

/** Cell inner text (checkmark/cross) */
function cellText(cell: GridCellData | undefined): string {
    if (!cell) return '';
    if (cell.isExplicitlyFailed) return '✕';
    const p = cell.progress ?? 0, t = cell.dailyTarget ?? 1;
    if (p >= t && !cell.isMissed) return '✓';
    return '';
}

/** Cell border props */
function cellBorder(cell: GridCellData | undefined): { bw: number; bc: ColorProp } {
    if (cell?.isExplicitlyFailed) return { bw: 2, bc: DANGER_COLOR };
    if (cell?.isToday) return { bw: 2, bc: TODAY_BORDER };
    return { bw: 0, bc: TRANSPARENT };
}

/**
 * Compute the SQUARE cell size that fits both directions.
 * Returns the side length in dp so that cols × size + gaps ≤ width AND 7 × size + gaps ≤ height.
 */
function squareCellSize(
    availW: number, availH: number,
    cols: number, rows: number, gap: number,
): number {
    const fromW = Math.floor((availW - (cols - 1) * gap) / cols);
    const fromH = Math.floor((availH - (rows - 1) * gap) / rows);
    return Math.max(4, Math.min(fromW, fromH));
}

// ─── Labels ─────────────────────────────────────────────────────
const DAY_LABELS_MON = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_LABELS_SUN = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ─── Reusable square cell ────────────────────────────────────────
function SquareCell({ cell, size, habitColor, gap, isLast }: {
    cell: GridCellData | undefined; size: number; habitColor: string;
    gap: number; isLast: boolean;
}) {
    const { bw, bc } = cellBorder(cell);
    const txt = cellText(cell);
    return (
        <FlexWidget style={{
            width: size, height: size,
            borderRadius: Math.max(2, size * 0.25),
            backgroundColor: getCellColor(cell, habitColor),
            borderWidth: bw, borderColor: bc,
            marginBottom: isLast ? 0 : gap,
            alignItems: 'center', justifyContent: 'center',
        }}>
            {txt ? <TextWidget text={txt} style={{ fontSize: Math.max(6, size * 0.5), color: TEXT_PRIMARY, fontWeight: '800' }} /> : null}
        </FlexWidget>
    );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SHARED HEADER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function WidgetHeader({
    habitIcon, habitName, habitColor, streak,
    todayProgress, dailyTarget,
    isCompletedToday, isExplicitlyFailedToday,
    widgetId, compact = false,
}: {
    habitIcon: string; habitName: string; habitColor: string;
    streak: number; todayProgress: number; dailyTarget: number;
    isCompletedToday: boolean; isExplicitlyFailedToday: boolean;
    widgetId: number; compact?: boolean;
}) {
    const iconSz = compact ? 28 : 36;
    const iconR = compact ? 8 : 10;
    const iconF = compact ? 14 : 18;
    const nameF = compact ? 12 : 14;
    const subF = compact ? 10 : 11;
    const btnSz = compact ? 28 : 30;
    const btnR = compact ? 14 : 15;
    const checkF = compact ? 12 : 14;

    let btnBg: ColorProp, btnText: string, bw: number, bc: ColorProp;
    if (isCompletedToday) { btnBg = habitColor as ColorProp; btnText = '✓'; bw = 2; bc = habitColor as ColorProp; }
    else if (isExplicitlyFailedToday) { btnBg = DANGER_COLOR; btnText = '✕'; bw = 2; bc = DANGER_COLOR; }
    else { btnBg = colorWithAlpha(habitColor, 0.08); btnText = '+'; bw = 2; bc = habitColor as ColorProp; }

    return (
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', width: 'match_parent' }}>
            <FlexWidget style={{ width: iconSz, height: iconSz, borderRadius: iconR, backgroundColor: colorWithAlpha(habitColor, 0.12), alignItems: 'center', justifyContent: 'center' }}>
                <TextWidget text={habitIcon} style={{ fontSize: iconF }} />
            </FlexWidget>
            <FlexWidget style={{ width: compact ? 6 : 10 }} />
            <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
                <TextWidget text={habitName} style={{ fontSize: nameF, color: TEXT_PRIMARY, fontWeight: '600' }} maxLines={1} />
                <TextWidget text={`${todayProgress}/${dailyTarget} today · ${streak}🔥`} style={{ fontSize: subF, color: TEXT_SECONDARY }} maxLines={1} />
            </FlexWidget>
            <FlexWidget
                style={{ width: btnSz, height: btnSz, borderRadius: btnR, backgroundColor: btnBg, alignItems: 'center', justifyContent: 'center', borderWidth: bw, borderColor: bc }}
                clickAction="TOGGLE_HABIT"
                clickActionData={{ widgetId: String(widgetId), action: 'toggle' }}
            >
                <TextWidget text={btnText} style={{ fontSize: checkF, color: TEXT_PRIMARY, fontWeight: '800' }} />
            </FlexWidget>
        </FlexWidget>
    );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WEEKLY WIDGET — Mon→Sun of current week (matches in-app HabitListItem)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function WeeklyHabitWidget({
    habitName = 'Habit', habitIcon = '✨', habitColorIndex = 0,
    gridData = [], streak = 0, todayProgress = 0, dailyTarget = 1,
    isCompletedToday = false, isExplicitlyFailedToday = false,
    widgetId = 0, widgetWidth, widgetHeight,
}: WidgetProps) {
    const hc = getHabitColor(habitColorIndex ?? 0);
    // Current week Mon→Sun — future days are null (gray)
    const weekData = prepareCurrentWeekData(gridData);
    const pad = 10, headerH = 36, dayLabelH = 14, gap = 6;
    const w = (widgetWidth && widgetWidth > 0) ? widgetWidth : 180;
    const h = (widgetHeight && widgetHeight > 0) ? widgetHeight : 70;
    const availW = w - 2 * pad;
    const availH = h - 2 * pad - headerH - 10 - dayLabelH;
    const cellSz = Math.max(10, Math.min(
        Math.floor((availW - 6 * gap) / 7),
        Math.floor(availH)
    ));

    // Fixed Mon→Sun labels
    const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

    return (
        <FlexWidget style={{ height: 'match_parent', width: 'match_parent', backgroundColor: BG_CARD, borderRadius: 14, padding: pad, flexDirection: 'column' }} clickAction="OPEN_APP">
            <WidgetHeader habitIcon={habitIcon} habitName={habitName} habitColor={hc} streak={streak ?? 0} todayProgress={todayProgress ?? 0} dailyTarget={dailyTarget ?? 1} isCompletedToday={isCompletedToday} isExplicitlyFailedToday={isExplicitlyFailedToday} widgetId={widgetId ?? 0} />
            <FlexWidget style={{ height: 10 }} />
            <FlexWidget style={{ flex: 1, width: 'match_parent', flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
                {weekData.map((cell, i) => {
                    const cellData = cell ?? undefined;
                    const { bw, bc } = cellBorder(cellData);
                    const txt = cellText(cellData);
                    return (
                        <FlexWidget key={`w${i}`} style={{ flexDirection: 'column', alignItems: 'center', marginRight: i < 6 ? gap : 0 }}>
                            <FlexWidget style={{
                                width: cellSz, height: cellSz, borderRadius: Math.max(2, cellSz * 0.25),
                                backgroundColor: cell === null ? EMPTY_CELL : getCellColor(cellData, hc), borderWidth: bw, borderColor: bc,
                                alignItems: 'center', justifyContent: 'center',
                            }}>
                                {txt ? <TextWidget text={txt} style={{ fontSize: Math.max(8, cellSz * 0.5), color: TEXT_PRIMARY, fontWeight: '800' }} /> : null}
                            </FlexWidget>
                            <TextWidget text={dayLabels[i]} style={{ fontSize: 10, color: TEXT_SECONDARY, fontWeight: '500', marginTop: 2 }} />
                        </FlexWidget>
                    );
                })}
            </FlexWidget>
        </FlexWidget>
    );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MONTHLY WIDGET — calendar grid of SQUARE cells
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function MonthlyHabitWidget({
    habitName = 'Habit', habitIcon = '✨', habitColorIndex = 0,
    gridData = [], streak = 0, todayProgress = 0, dailyTarget = 1,
    isCompletedToday = false, isExplicitlyFailedToday = false,
    widgetId = 0, widgetWidth, widgetHeight,
}: WidgetProps) {
    const hc = getHabitColor(habitColorIndex ?? 0);
    const today = new Date();
    const year = today.getFullYear(), month = today.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDow = new Date(year, month, 1).getDay();
    const todayKey = getTodayKey(today);

    // Build month cells: null = leading spacer (before day 1), 'future' marker = gray square
    const monthCells: (GridCellData | null | 'future')[] = [];
    for (let i = 0; i < firstDow; i++) monthCells.push(null); // invisible leading spacers
    for (let d = 1; d <= daysInMonth; d++) {
        const dateObj = new Date(year, month, d);
        const dk = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const diffDays = Math.floor((today.getTime() - dateObj.getTime()) / 86400000);
        const idx = (gridData?.length ?? 0) - 1 - diffDays;
        if (dateObj > today && dk !== todayKey) { monthCells.push('future'); continue; }
        monthCells.push(idx >= 0 && idx < (gridData?.length ?? 0) ? gridData![idx] : {});
    }
    const totalRows = Math.ceil(monthCells.length / 7);
    const rows: (GridCellData | null | 'future')[][] = [];
    for (let r = 0; r < totalRows; r++) {
        const row: (GridCellData | null | 'future')[] = [];
        for (let c = 0; c < 7; c++) { const idx = r * 7 + c; row.push(idx < monthCells.length ? monthCells[idx] : null); }
        rows.push(row);
    }

    const pad = 12, headerH = 46, monthLblH = 14, dayLblH = 16, gap = 3;
    const w = (widgetWidth && widgetWidth > 0) ? widgetWidth : 180;
    const h = (widgetHeight && widgetHeight > 0) ? widgetHeight : 180;
    const availW = w - 2 * pad;
    const availH = h - 2 * pad - headerH - monthLblH - dayLblH - 8;
    const cellSz = squareCellSize(availW, availH, 7, totalRows, gap);

    return (
        <FlexWidget style={{ height: 'match_parent', width: 'match_parent', backgroundColor: BG_CARD, borderRadius: 20, padding: pad, flexDirection: 'column' }} clickAction="OPEN_APP">
            <WidgetHeader habitIcon={habitIcon} habitName={habitName} habitColor={hc} streak={streak ?? 0} todayProgress={todayProgress ?? 0} dailyTarget={dailyTarget ?? 1} isCompletedToday={isCompletedToday} isExplicitlyFailedToday={isExplicitlyFailedToday} widgetId={widgetId ?? 0} />
            <FlexWidget style={{ height: 6 }} />
            <TextWidget text={MONTH_NAMES[month]} style={{ fontSize: 10, color: TEXT_SECONDARY, fontWeight: '600', marginBottom: 4 }} />
            {/* Day headers */}
            <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', marginBottom: 4 }}>
                {DAY_LABELS_SUN.map((l, i) => (
                    <FlexWidget key={`dl${i}`} style={{ width: cellSz, marginRight: i < 6 ? gap : 0, alignItems: 'center' }}>
                        <TextWidget text={l} style={{ fontSize: 10, color: TEXT_SECONDARY, fontWeight: '700' }} />
                    </FlexWidget>
                ))}
            </FlexWidget>
            {/* Calendar grid */}
            <FlexWidget style={{ flex: 1, flexDirection: 'column', alignItems: 'flex-start' }}>
                {rows.map((row, ri) => (
                    <FlexWidget key={`r${ri}`} style={{ flexDirection: 'row', marginBottom: ri < rows.length - 1 ? gap : 0 }}>
                        {row.map((cell, ci) => {
                            // null = leading spacer (invisible), 'future' = gray square
                            if (cell === null) return <FlexWidget key={`e${ri}-${ci}`} style={{ width: cellSz, height: cellSz, marginRight: ci < 6 ? gap : 0 }} />;
                            if (cell === 'future') return <FlexWidget key={`f${ri}-${ci}`} style={{ width: cellSz, height: cellSz, borderRadius: Math.max(2, cellSz * 0.22), backgroundColor: EMPTY_CELL, marginRight: ci < 6 ? gap : 0 }} />;
                            const { bw, bc } = cellBorder(cell);
                            const txt = cellText(cell);
                            return (
                                <FlexWidget key={`c${ri}-${ci}`} style={{
                                    width: cellSz, height: cellSz, borderRadius: Math.max(2, cellSz * 0.22),
                                    backgroundColor: getCellColor(cell, hc), borderWidth: bw, borderColor: bc,
                                    marginRight: ci < 6 ? gap : 0, alignItems: 'center', justifyContent: 'center',
                                }}>
                                    {txt ? <TextWidget text={txt} style={{ fontSize: Math.max(7, cellSz * 0.5), color: TEXT_PRIMARY, fontWeight: '800' }} /> : null}
                                </FlexWidget>
                            );
                        })}
                    </FlexWidget>
                ))}
            </FlexWidget>
            <TextWidget text="HabitFlow" style={{ fontSize: 8, color: colorWithAlpha(hc, 0.45), fontWeight: '500', marginTop: 2 }} />
        </FlexWidget>
    );
}

function getTodayKey(today: Date): string {
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GITHUB GRID WIDGET — 13×7 SQUARE cells
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function GitHubHabitWidget({
    habitName = 'Habit', habitIcon = '✨', habitColorIndex = 0,
    gridData = [], streak = 0, todayProgress = 0, dailyTarget = 1,
    isCompletedToday = false, isExplicitlyFailedToday = false,
    widgetId = 0, widgetWidth, widgetHeight,
}: WidgetProps) {
    const hc = getHabitColor(habitColorIndex ?? 0);
    const COLS = 13, ROWS = 7;
    const columns = buildGitHubGrid(gridData, COLS);

    const pad = 10, headerH = 42, monthLblH = 14, dayLblW = 14, gap = 2;
    const w = (widgetWidth && widgetWidth > 0) ? widgetWidth : 350;
    const h = (widgetHeight && widgetHeight > 0) ? widgetHeight : 180;
    const gridW = w - 2 * pad - dayLblW - 4;
    const gridH = h - 2 * pad - headerH - monthLblH - 8;
    const cellSz = squareCellSize(gridW, gridH, COLS, ROWS, gap);

    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysBack = (COLS - 1) * 7 + dayOfWeek;

    return (
        <FlexWidget style={{ height: 'match_parent', width: 'match_parent', backgroundColor: BG_CARD, borderRadius: 20, padding: pad, flexDirection: 'column' }} clickAction="OPEN_APP">
            <WidgetHeader habitIcon={habitIcon} habitName={habitName} habitColor={hc} streak={streak ?? 0} todayProgress={todayProgress ?? 0} dailyTarget={dailyTarget ?? 1} isCompletedToday={isCompletedToday} isExplicitlyFailedToday={isExplicitlyFailedToday} widgetId={widgetId ?? 0} />
            {/* Month labels */}
            <FlexWidget style={{ flexDirection: 'row', marginLeft: dayLblW + 4, marginBottom: 4, marginTop: 4 }}>
                {Array.from({ length: COLS }).map((_, ci) => {
                    const ago = daysBack - ci * 7;
                    const d = new Date(today); d.setDate(today.getDate() - ago);
                    const prev = ci > 0 ? (() => { const p = new Date(today); p.setDate(today.getDate() - (daysBack - (ci - 1) * 7)); return p; })() : null;
                    let label = '';
                    if (!prev || d.getMonth() !== prev.getMonth()) { if (ci < COLS - 2) label = MONTH_NAMES[d.getMonth()]; }
                    return (
                        <FlexWidget key={`ml${ci}`} style={{ width: cellSz, marginRight: ci < COLS - 1 ? gap : 0 }}>
                            {label ? <TextWidget text={label} style={{ fontSize: 9, color: TEXT_SECONDARY }} /> : null}
                        </FlexWidget>
                    );
                })}
            </FlexWidget>
            {/* Day labels + grid */}
            <FlexWidget style={{ flexDirection: 'row' }}>
                <FlexWidget style={{ width: dayLblW, flexDirection: 'column', marginRight: 4 }}>
                    {DAY_LABELS_SUN.map((l, i) => (
                        <FlexWidget key={`dl${i}`} style={{ height: cellSz, justifyContent: 'center', marginBottom: i < 6 ? gap : 0 }}>
                            <TextWidget text={l} style={{ fontSize: 8, color: TEXT_SECONDARY }} />
                        </FlexWidget>
                    ))}
                </FlexWidget>
                {columns.map((col, ci) => (
                    <FlexWidget key={`gc${ci}`} style={{ flexDirection: 'column', marginRight: ci < COLS - 1 ? gap : 0 }}>
                        {col.map((cell, ri) => {
                            if (cell === null) {
                                return <FlexWidget key={`${ci}-${ri}`} style={{ width: cellSz, height: cellSz, borderRadius: Math.max(2, cellSz * 0.25), backgroundColor: EMPTY_CELL, marginBottom: ri === 6 ? 0 : gap }} />;
                            }
                            return <SquareCell key={`${ci}-${ri}`} cell={cell} size={cellSz} habitColor={hc} gap={gap} isLast={ri === 6} />;
                        })}
                    </FlexWidget>
                ))}
            </FlexWidget>
        </FlexWidget>
    );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SMALL / DAY CHECK WIDGET — 1×1 checkmark
//
// Designed for minimum 1×1 (57dp). Shows icon + tap-to-toggle.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function SmallHabitWidget({
    habitName = 'Habit', habitIcon = '✨', habitColorIndex = 0,
    streak = 0, todayProgress = 0, dailyTarget = 1,
    isCompletedToday = false, isExplicitlyFailedToday = false,
    widgetId = 0,
}: WidgetProps) {
    const hc = getHabitColor(habitColorIndex ?? 0);

    let bg: ColorProp, txt: string, bw: number, bc: ColorProp;
    if (isCompletedToday) { bg = hc as ColorProp; txt = '✓'; bw = 0; bc = hc as ColorProp; }
    else if (isExplicitlyFailedToday) { bg = DANGER_COLOR; txt = '✕'; bw = 0; bc = DANGER_COLOR; }
    else { bg = colorWithAlpha(hc, 0.08); txt = '+'; bw = 2; bc = hc as ColorProp; }

    return (
        <FlexWidget
            style={{
                height: 'match_parent', width: 'match_parent',
                backgroundColor: BG_CARD, borderRadius: 16,
                padding: 6, flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
            }}
        >
            {/* Icon + streak on top */}
            <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <TextWidget text={habitIcon} style={{ fontSize: 14 }} />
                {(streak ?? 0) > 0 ? <TextWidget text={` ${streak}🔥`} style={{ fontSize: 9, color: STREAK_COLOR }} /> : null}
            </FlexWidget>
            {/* Large toggle check — fills most of the widget */}
            <FlexWidget
                style={{
                    flex: 1, width: 'match_parent',
                    borderRadius: 12, backgroundColor: bg,
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: bw, borderColor: bc,
                }}
                clickAction="TOGGLE_HABIT"
                clickActionData={{ widgetId: String(widgetId), action: 'toggle' }}
            >
                <TextWidget text={txt} style={{ fontSize: 24, color: TEXT_PRIMARY, fontWeight: '900' }} />
            </FlexWidget>
        </FlexWidget>
    );
}
