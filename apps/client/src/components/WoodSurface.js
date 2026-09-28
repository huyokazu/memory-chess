import React, { memo, useId } from 'react';
import Svg, { Defs, LinearGradient, Stop, Rect, Path, G } from 'react-native-svg';

// Deterministic fine-grain marquetry; no image download or random render flicker.
function WoodSurface({ light = false, seed = 0, frame = false }) {
  const id = `wood${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const palette = frame ? ['#a77b50', '#785233', '#936641'] : light ? ['#d4c2a0', '#b3a081', '#ccb999'] : ['#806044', '#60442e', '#775437'];
  return <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" pointerEvents="none" accessible={false}>
    <Defs><LinearGradient id={id} x1="0" y1="0" x2="100%" y2="55%"><Stop offset="0" stopColor={palette[0]} /><Stop offset="0.6" stopColor={palette[1]} /><Stop offset="1" stopColor={palette[2]} /></LinearGradient></Defs>
    <Rect width="100" height="100" fill={`url(#${id})`} />
    <G rotation={seed % 2 ? 90 : 0} origin="50, 50">
      {Array.from({ length: 27 }, (_, i) => {
        const y = i * 4 - 4;
        const bend = Math.sin(i * 1.9 + seed * 3.2) * 4;
        return <Path key={i} d={`M-5 ${y} C18 ${y + bend} 29 ${y - bend} 49 ${y + 1} S83 ${y + bend} 105 ${y - 1}`} stroke={i % 3 === 0 ? '#f6deb3' : '#382110'} strokeOpacity={i % 3 === 0 ? 0.1 : 0.13} strokeWidth={i % 4 === 0 ? 0.7 : 0.3} fill="none" />;
      })}
      <Path d={`M-2 ${31 + seed % 20} Q33 ${22 + seed % 20} 48 ${35 + seed % 20} T102 ${39 + seed % 20}`} stroke="#352013" strokeOpacity="0.1" strokeWidth="1" fill="none" />
    </G>
    <Path d="M0 100 V0 H100" stroke="#fff5da" strokeOpacity="0.1" strokeWidth="0.8" fill="none" />
  </Svg>;
}
export default memo(WoodSurface);
