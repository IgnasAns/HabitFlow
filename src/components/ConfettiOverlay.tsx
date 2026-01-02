import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withDelay,
    runOnJS,
    Easing,
} from 'react-native-reanimated';
import { colors } from '../theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Particle {
    id: number;
    x: number;
    delay: number;
    color: string;
    size: number;
    emoji?: string;
}

interface ConfettiOverlayProps {
    visible: boolean;
    onComplete?: () => void;
    type?: 'completion' | 'levelUp' | 'streak';
}

const PARTICLE_COUNT = 15;

const ParticleComponent = ({ particle, onComplete }: { particle: Particle; onComplete: () => void }) => {
    const translateY = useSharedValue(-50);
    const translateX = useSharedValue(0);
    const opacity = useSharedValue(1);
    const rotate = useSharedValue(0);
    const scale = useSharedValue(0);

    useEffect(() => {
        const xOffset = (Math.random() - 0.5) * 200;

        scale.value = withDelay(
            particle.delay,
            withTiming(1, { duration: 200, easing: Easing.out(Easing.back(2)) })
        );

        translateY.value = withDelay(
            particle.delay,
            withTiming(SCREEN_HEIGHT + 100, {
                duration: 2000 + Math.random() * 1000,
                easing: Easing.in(Easing.quad),
            }, (finished) => {
                if (finished) {
                    runOnJS(onComplete)();
                }
            })
        );

        translateX.value = withDelay(
            particle.delay,
            withTiming(xOffset, {
                duration: 2000,
                easing: Easing.inOut(Easing.sin),
            })
        );

        rotate.value = withDelay(
            particle.delay,
            withTiming(360 * (Math.random() > 0.5 ? 1 : -1), {
                duration: 2000,
            })
        );

        opacity.value = withDelay(
            particle.delay + 1500,
            withTiming(0, { duration: 500 })
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { rotate: `${rotate.value}deg` },
            { scale: scale.value },
        ],
        opacity: opacity.value,
    }));

    return (
        <Animated.View
            style={[
                styles.particle,
                {
                    left: particle.x,
                    width: particle.size,
                    height: particle.size,
                    backgroundColor: particle.emoji ? 'transparent' : particle.color,
                    borderRadius: particle.size / 2,
                },
                animatedStyle,
            ]}
        >
            {particle.emoji && (
                <Animated.Text style={{ fontSize: particle.size }}>{particle.emoji}</Animated.Text>
            )}
        </Animated.View>
    );
};

export default function ConfettiOverlay({
    visible,
    onComplete,
    type = 'completion',
}: ConfettiOverlayProps) {
    const [particles, setParticles] = useState<Particle[]>([]);
    const [completedCount, setCompletedCount] = useState(0);

    const confettiColors = [
        colors.primaryStart,
        colors.successStart,
        colors.streakStart,
        colors.goldStart,
        '#FF6B6B',
        '#4ECDC4',
    ];

    const emojis: Record<string, string[]> = {
        completion: ['✨', '⭐', '🎉'],
        levelUp: ['🎊', '🏆', '⬆️', '✨'],
        streak: ['🔥', '💪', '⭐'],
    };

    useEffect(() => {
        if (visible) {
            const newParticles: Particle[] = [];
            const typeEmojis = emojis[type];

            for (let i = 0; i < PARTICLE_COUNT; i++) {
                const useEmoji = Math.random() > 0.6;
                newParticles.push({
                    id: i,
                    x: Math.random() * SCREEN_WIDTH,
                    delay: Math.random() * 300,
                    color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
                    size: useEmoji ? 24 : 8 + Math.random() * 8,
                    emoji: useEmoji ? typeEmojis[Math.floor(Math.random() * typeEmojis.length)] : undefined,
                });
            }
            setParticles(newParticles);
            setCompletedCount(0);
        } else {
            setParticles([]);
        }
    }, [visible, type]);

    useEffect(() => {
        if (completedCount >= PARTICLE_COUNT && particles.length > 0) {
            onComplete?.();
        }
    }, [completedCount, particles.length]);

    if (!visible || particles.length === 0) return null;

    return (
        <View style={styles.container} pointerEvents="none">
            {particles.map((particle) => (
                <ParticleComponent
                    key={particle.id}
                    particle={particle}
                    onComplete={() => setCompletedCount((c) => c + 1)}
                />
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 1000,
    },
    particle: {
        position: 'absolute',
        top: 0,
    },
});
