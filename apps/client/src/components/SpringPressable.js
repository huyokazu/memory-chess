import React, { useCallback, useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable } from 'react-native';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
export default function SpringPressable({ style, disabled, pressedScale = 0.96, onPressIn, onPressOut, children, ...props }) {
  const scale = useRef(new Animated.Value(1)).current;
  const animation = useRef(null);
  const pressedAt = useRef(null);
  const animate = useCallback((pressed) => {
    // Continue from the current scale when presses arrive in quick succession.
    animation.current?.stop();
    const common = { useNativeDriver: Platform.OS !== 'web', isInteraction: false };
    const compress = (duration) => Animated.timing(scale, { ...common, toValue: pressedScale, duration, easing: Easing.out(Easing.cubic) });
    if (pressed) {
      pressedAt.current = Date.now();
      animation.current = compress(110);
    } else {
      const remaining = pressedAt.current === null ? 0 : Math.max(0, 110 - (Date.now() - pressedAt.current));
      pressedAt.current = null;
      const release = Animated.spring(scale, { ...common, toValue: 1, stiffness: 300, damping: 12, mass: 0.65 });
      // Even a very quick tap gets a visible compression before bouncing back.
      animation.current = remaining > 0 ? Animated.sequence([compress(remaining), release]) : release;
    }
    animation.current.start();
  }, [pressedScale, scale]);
  // A loading/disabled update during a press must also release the button.
  useEffect(() => { if (disabled) animate(false); }, [disabled, animate]);
  useEffect(() => () => animation.current?.stop(), []);
  return <AnimatedPressable {...props} disabled={disabled}
    onPressIn={(event) => { if (!disabled) animate(true); onPressIn?.(event); }}
    onPressOut={(event) => { animate(false); onPressOut?.(event); }}
    style={[style, { transform: [{ scale }] }]}>{children}</AnimatedPressable>;
}
