import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { ZoomIn, FadeIn, FadeOut } from 'react-native-reanimated';
import { useTheme, ThemeColors } from '../context/ThemeContext';
import { spacing, borderRadius, typography } from '../theme';
import { triggerSelectionHaptic } from '../utils/feedback';

export type CelebrationType = 'milestone' | 'levelUp' | 'perfectDay';

interface CelebrationModalProps {
    visible: boolean;
    type: CelebrationType;
    title: string;
    subtitle: string;
    /** Optional extra badge line, e.g. "+1 Streak Saver earned". */
    badge?: string;
    shareLabel: string;
    dismissLabel: string;
    onShare: () => void;
    onDismiss: () => void;
}

const EMOJI: Record<CelebrationType, string> = {
    milestone: '🔥',
    levelUp: '🚀',
    perfectDay: '🏆',
};

/**
 * Full-screen celebration for streak milestones, level-ups and perfect days.
 * The primary action is sharing — these are the moments people screenshot.
 */
export default function CelebrationModal({
    visible,
    type,
    title,
    subtitle,
    badge,
    shareLabel,
    dismissLabel,
    onShare,
    onDismiss,
}: CelebrationModalProps) {
    const { colors } = useTheme();
    const styles = useMemo(() => getStyles(colors), [colors]);

    const accent: [string, string] = type === 'milestone'
        ? [colors.streakStart, colors.streakEnd]
        : type === 'perfectDay'
            ? [colors.successStart, colors.successEnd]
            : [colors.primaryStart, colors.primaryEnd];

    const handleDismiss = () => {
        triggerSelectionHaptic();
        onDismiss();
    };

    const handleShare = () => {
        triggerSelectionHaptic();
        onShare();
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
            <Pressable style={styles.overlay} onPress={handleDismiss} accessibilityLabel={dismissLabel}>
                <Animated.View
                    entering={FadeIn.duration(200)}
                    exiting={FadeOut.duration(150)}
                    style={styles.container}
                >
                    <Pressable onPress={(e) => e.stopPropagation()}>
                        <View style={styles.content}>
                            <LinearGradient
                                colors={accent}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.headerAccent}
                            />

                            <Animated.View entering={ZoomIn.springify().delay(120)} style={styles.emojiContainer}>
                                <Text style={styles.emoji}>{EMOJI[type]}</Text>
                            </Animated.View>

                            <Text style={styles.title} accessibilityRole="header">{title}</Text>
                            <Text style={styles.subtitle}>{subtitle}</Text>

                            {badge ? (
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>🧊 {badge}</Text>
                                </View>
                            ) : null}

                            <Pressable
                                style={({ pressed }) => [styles.shareButton, pressed && styles.pressed]}
                                onPress={handleShare}
                                accessibilityRole="button"
                                accessibilityLabel={shareLabel}
                            >
                                <LinearGradient colors={accent} style={styles.shareGradient}>
                                    <Text style={styles.shareText}>{shareLabel}  📤</Text>
                                </LinearGradient>
                            </Pressable>

                            <Pressable
                                style={({ pressed }) => [styles.dismissButton, pressed && styles.pressed]}
                                onPress={handleDismiss}
                                accessibilityRole="button"
                                accessibilityLabel={dismissLabel}
                            >
                                <Text style={styles.dismissText}>{dismissLabel}</Text>
                            </Pressable>
                        </View>
                    </Pressable>
                </Animated.View>
            </Pressable>
        </Modal>
    );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg,
    },
    container: {
        width: '100%',
        maxWidth: 340,
    },
    content: {
        backgroundColor: colors.bgCard,
        borderRadius: borderRadius.xl,
        padding: spacing.xl,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.glassBorder,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    headerAccent: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 4,
    },
    emojiContainer: {
        width: 84,
        height: 84,
        borderRadius: 42,
        backgroundColor: 'rgba(255,255,255,0.06)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.md,
        marginTop: spacing.sm,
    },
    emoji: {
        fontSize: 44,
    },
    title: {
        ...typography.h2,
        color: colors.textPrimary,
        textAlign: 'center',
        marginBottom: spacing.xs,
    },
    subtitle: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: spacing.md,
    },
    badge: {
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.md,
        backgroundColor: 'rgba(96, 165, 250, 0.12)',
        marginBottom: spacing.md,
    },
    badgeText: {
        ...typography.caption,
        color: colors.textPrimary,
        fontWeight: '700',
    },
    shareButton: {
        width: '100%',
        borderRadius: borderRadius.md,
        overflow: 'hidden',
        marginTop: spacing.sm,
    },
    shareGradient: {
        paddingVertical: spacing.md,
        alignItems: 'center',
    },
    shareText: {
        ...typography.bodyBold,
        color: colors.textPrimary,
    },
    dismissButton: {
        width: '100%',
        paddingVertical: spacing.md,
        alignItems: 'center',
        marginTop: spacing.xs,
    },
    dismissText: {
        ...typography.bodyBold,
        color: colors.textSecondary,
    },
    pressed: {
        opacity: 0.85,
        transform: [{ scale: 0.98 }],
    },
});
