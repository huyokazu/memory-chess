import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform } from 'react-native';

export default function FadeIn({ children, style, duration = 420 }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    opacity.setValue(0);
    const animation = Animated.timing(opacity, { toValue: 1, duration,
      easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web', isInteraction: false });
    animation.start();
    return () => animation.stop();
  }, [opacity, duration]);
  return <Animated.View testID="menu-fade" style={[style, { opacity }]}>{children}</Animated.View>;
}
