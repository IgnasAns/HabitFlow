import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
    useAnimatedStyle,
    withSpring,
    withSequence,
    useSharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, spacing } from '../theme';

type BadgeSize = 'small' | 'medium' | 'large';

interface StreakBadgeProps {
    streak?: number;
    size?: BadgeSize;
}

interface SizeConfig {
    fontSize: number;
    iconSize: number;
    padding: number;
}

const sizeConfigs: Record<BadgeSize, SizeConfig> = {
    small: { fontSize: 14, iconSize: 16, padding: 6 },
    medium: { fontSize: 18, iconSize: 22, padding: 10 },
    large: { fontSize: 24, iconSize: 28, padding: 14 },
};

export default function StreakBadge({ streak = 0, size = 'small' }: StreakBadgeProps) {
    const scale = useSharedValue(1);
    const lastStreak = useSharedValue(streak);

    const sizeConfig = sizeConfigs[size];

    useEffect(() => {
        if (streak > lastStreak.value) {
            scale.value = withSequence(
                withSpring(1.15, { damping: 12, stiffness: 200 }),
                withSpring(1, { damping: 15, stiffness: 150 })
            );
        }
        lastStreak.value = streak;
    }, [streak]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    return (
        <Animated.View style={animatedStyle}>
            <View
                style={[
                    styles.container,
                    { paddingVertical: 4, paddingHorizontal: 12 },
                    streak === 0 ? styles.inactive : styles.active,
                ]}
            >
                <Text style={[styles.icon, { fontSize: sizeConfig.fontSize }]}>🔥</Text>
                <Text style={[styles.text, streak === 0 && styles.inactiveText, { fontSize: sizeConfig.fontSize }]}>
                    {streak}
                </Text>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 99,
        gap: 6,
    },
    active: {
        backgroundColor: 'rgba(255, 120, 0, 0.15)',
    },
    inactive: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    icon: {
        fontSize: 14,
    },
    text: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
    inactiveText: {
        color: 'rgba(255, 255, 255, 0.4)',
    },
});
