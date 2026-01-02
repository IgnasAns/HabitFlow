import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Platform, Pressable } from 'react-native';
import Animated, {
    useAnimatedStyle,
    withSpring,
    withSequence,
    withTiming,
    useSharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { colors, spacing, borderRadius } from '../theme';
import StyledModal from './StyledModal';

interface LevelProgressProps {
    level: number;
    currentXp: number;
    xpNeeded: number;
    totalXp: number;
    onPress?: () => void;
}

const LevelProgress = React.memo(({
    level,
    currentXp,
    xpNeeded,
    totalXp,
    onPress
}: LevelProgressProps) => {
    const scaleAnim = useSharedValue(1);
    const progressWidth = useSharedValue(0);
    const lastLevel = useSharedValue(level);
    const [modalVisible, setModalVisible] = React.useState(false);

    // Ensure progress is clamped between 0 and 1 to prevent visual glitches
    const rawProgress = xpNeeded > 0 ? currentXp / xpNeeded : 0;
    const progress = Math.min(Math.max(rawProgress, 0), 1);

    useEffect(() => {
        // Use withTiming for smoother, predictable updates without spring momentum
        progressWidth.value = withTiming(progress, { duration: 400 });

        // Only animate scale on actual level up
        if (level > lastLevel.value) {
            scaleAnim.value = withSequence(
                withTiming(1.2, { duration: 150 }),
                withTiming(1, { duration: 200 })
            );
        }
        lastLevel.value = level;
    }, [level, progress]);

    // ... (existing animated styles)

    const levelStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scaleAnim.value }],
    }));

    const progressStyle = useAnimatedStyle(() => ({
        width: `${progressWidth.value * 100}%`,
    }));

    const handlePress = () => {
        Haptics.selectionAsync();
        if (onPress) {
            onPress();
        } else {
            setModalVisible(true);
        }
    };

    return (
        <>
            <Pressable
                style={({ pressed }) => [
                    styles.container,
                    pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] }
                ]}
                onPress={handlePress}
            >
                {/* ... existing header/progress bar content ... */}
                <View style={styles.header}>
                    <Animated.View style={levelStyle}>
                        <LinearGradient
                            colors={[...colors.gold]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.levelBadge}
                        >
                            <Text style={styles.levelText}>LVL</Text>
                            <Text style={styles.levelNumber}>{level}</Text>
                        </LinearGradient>
                    </Animated.View>

                    <View style={styles.xpInfo}>
                        <Text style={styles.xpText}>{currentXp} / {xpNeeded} XP</Text>
                        <Text style={styles.totalXp}>Total: {totalXp} XP</Text>
                    </View>
                </View>

                <View style={styles.progressBar}>
                    <Animated.View style={[styles.progressFill, progressStyle]}>
                        <LinearGradient
                            colors={[...colors.gold]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.progressGradient}
                        />
                    </Animated.View>
                </View>
            </Pressable>

            <StyledModal
                visible={modalVisible}
                title={`Level ${level}`}
                message={`You have earned ${totalXp} XP total!\n\nProgress to Level ${level + 1}: ${currentXp}/${xpNeeded} XP\n\nComplete habits daily to earn more XP. Streaks give bonus XP!`}
                emoji="⭐"
                onClose={() => setModalVisible(false)}
                buttonText="Keep Going! 💪"
            />
        </>
    );
});

export default LevelProgress;

const styles = StyleSheet.create({
    container: {
        padding: spacing.md,
        backgroundColor: colors.glass,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.glassBorder,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        marginBottom: spacing.sm,
    },
    levelBadge: {
        width: 56,
        height: 56,
        borderRadius: borderRadius.md,
        justifyContent: 'center',
        alignItems: 'center',
        ...Platform.select({
            ios: {
                shadowColor: colors.goldStart,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.5,
                shadowRadius: 10,
            },
            android: {
                elevation: 8,
            },
        }),
    },
    levelText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#1a1a2e',
        letterSpacing: 1,
    },
    levelNumber: {
        fontSize: 22,
        fontWeight: '800',
        color: '#1a1a2e',
        marginTop: -2,
    },
    xpInfo: {
        flex: 1,
    },
    xpText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textPrimary,
    },
    totalXp: {
        fontSize: 12,
        color: colors.textMuted,
        marginTop: 2,
    },
    progressBar: {
        height: 8,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressGradient: {
        flex: 1,
    },
});
