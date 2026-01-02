import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, {
    useAnimatedProps,
    withSpring,
    useSharedValue,
} from 'react-native-reanimated';
import { colors } from '../theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface ProgressRingProps {
    progress?: number;
    size?: number;
    strokeWidth?: number;
    gradientColors?: readonly [string, string];
    showGlow?: boolean;
    children?: React.ReactNode;
}

export default function ProgressRing({
    progress = 0,
    size = 80,
    strokeWidth = 8,
    gradientColors = colors.primary,
    showGlow = true,
    children,
}: ProgressRingProps) {
    const animatedProgress = useSharedValue(0);

    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;

    useEffect(() => {
        animatedProgress.value = withSpring(Math.min(progress, 1), {
            damping: 15,
            stiffness: 100,
        });
    }, [progress]);

    const animatedProps = useAnimatedProps(() => ({
        strokeDashoffset: circumference * (1 - animatedProgress.value),
    }));

    const glowStyle: ViewStyle = {
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: gradientColors[0],
    };

    return (
        <View style={[styles.container, { width: size, height: size }]}>
            {showGlow && progress > 0 && (
                <View style={[styles.glow, glowStyle]} />
            )}
            <Svg width={size} height={size} style={styles.svg}>
                <Defs>
                    <LinearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <Stop offset="0%" stopColor={gradientColors[0]} />
                        <Stop offset="100%" stopColor={gradientColors[1]} />
                    </LinearGradient>
                </Defs>
                {/* Background circle */}
                <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth={strokeWidth}
                    fill="transparent"
                />
                {/* Progress circle */}
                <AnimatedCircle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="url(#progressGradient)"
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    strokeDasharray={circumference}
                    animatedProps={animatedProps}
                    strokeLinecap="round"
                    rotation={-90}
                    origin={`${size / 2}, ${size / 2}`}
                />
            </Svg>
            {children && (
                <View style={styles.content}>
                    {children}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    svg: {
        position: 'absolute',
    },
    glow: {
        position: 'absolute',
        opacity: 0.2,
    },
    content: {
        position: 'absolute',
        justifyContent: 'center',
        alignItems: 'center',
    },
});
