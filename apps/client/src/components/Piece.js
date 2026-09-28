import React, { memo, useId } from 'react';
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Ellipse, Path, G } from 'react-native-svg';

// Sculpted 2.5D surfaces and contact shadows, shared by all three platforms.
function Piece({ type, color, size = 44 }) {
  const id = `piece${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const pearl = color === 'w';
  const shades = pearl
    ? ['#a0927a', '#e4d8c0', '#fffdf1', '#f1e7d2', '#c6b89b', '#877b66']
    : ['#26282a', '#646567', '#d3d2ca', '#777979', '#3c3f41', '#181b1d'];
  const rim = pearl ? '#9e8e72' : '#303436';
  const glint = pearl ? '#ffffff' : '#f4f3e9';
  const metal = `url(#${id}body)`;
  const dome = `url(#${id}dome)`;
  const lip = `url(#${id}lip)`;
  const sphere = (cx, cy, rx, ry = rx) => <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={dome} stroke={rim} strokeWidth="0.55" />;
  const collar = (y, rx = 12) => <G>
    <Path d={`M${32 - rx} ${y} v3 C${32 - rx} ${y + 7} ${32 + rx} ${y + 7} ${32 + rx} ${y} v-0.5 Z`} fill={metal} stroke={rim} strokeWidth="0.55" />
    <Ellipse cx="32" cy={y} rx={rx} ry="3.2" fill={lip} stroke={rim} strokeWidth="0.5" />
    <Path d={`M${34 - rx} ${y + 1} Q28 ${y + 4} ${30 + rx} ${y + 1}`} fill="none" stroke={glint} strokeOpacity="0.65" strokeWidth="0.65" />
  </G>;
  return <Svg width={size} height={size} viewBox="0 0 64 80" accessible={false} pointerEvents="none">
    <Defs>
      <LinearGradient id={`${id}body`} x1="0%" y1="0%" x2="100%" y2="8%">
        {shades.map((shade, i) => <Stop key={i} offset={`${[0, 18, 34, 47, 72, 100][i]}%`} stopColor={shade} />)}
      </LinearGradient>
      <LinearGradient id={`${id}lip`} x1="0%" y1="0%" x2="10%" y2="100%">
        <Stop offset="0" stopColor={shades[2]} /><Stop offset="0.35" stopColor={shades[1]} /><Stop offset="0.72" stopColor={shades[4]} /><Stop offset="1" stopColor={shades[5]} />
      </LinearGradient>
      <RadialGradient id={`${id}dome`} cx="32%" cy="23%" rx="72%" ry="72%">
        <Stop offset="0" stopColor={glint} /><Stop offset="0.15" stopColor={shades[2]} /><Stop offset="0.42" stopColor={shades[3]} /><Stop offset="0.8" stopColor={shades[4]} /><Stop offset="1" stopColor={shades[5]} />
      </RadialGradient>
      <RadialGradient id={`${id}shadow`}><Stop offset="0" stopColor="#100a06" stopOpacity="0.55" /><Stop offset="0.65" stopColor="#100a06" stopOpacity="0.3" /><Stop offset="1" stopColor="#100a06" stopOpacity="0" /></RadialGradient>
    </Defs>
    <Ellipse cx="35" cy="72" rx="26" ry="7" fill={`url(#${id}shadow)`} />
    <G strokeLinejoin="round" strokeLinecap="round">
      <Path d="M12 64 L11 68 C11 78 53 78 53 68 L52 64 Z" fill={metal} stroke={rim} strokeWidth="0.7" />
      <Ellipse cx="32" cy="64" rx="20" ry="6.8" fill={lip} stroke={rim} strokeWidth="0.7" />
      <Path d="M15 69 C24 74 43 73 50 69" stroke={glint} strokeOpacity="0.65" strokeWidth="1" fill="none" />
      <Path d="M19 55 C19 60 15 61 15 64 C15 70 49 70 49 64 C49 61 45 60 45 55 Z" fill={metal} stroke={rim} strokeWidth="0.7" />
      <Ellipse cx="32" cy="55" rx="13" ry="4" fill={lip} stroke={rim} strokeWidth="0.5" />
      {type !== 'n' && <Path d={type === 'p' ? 'M27 36 C28 44 25 51 21 55 C21 61 43 61 43 55 C39 51 36 44 37 36 Z' : 'M26 28 C29 37 26 48 21 55 C21 61 43 61 43 55 C38 48 35 37 38 28 Z'} fill={metal} stroke={rim} strokeWidth="0.7" />}
      {type === 'p' && <>{collar(35, 10)}{sphere(32, 24, 10, 10.5)}<Ellipse cx="28" cy="19" rx="3.5" ry="1.8" fill={glint} opacity="0.7" /></>}
      {type === 'r' && <>
        {collar(31, 12)}
        <Path d="M20 13 H25 V19 H29 V12 H35 V19 H39 V13 H44 V26 C44 31 20 31 20 26 Z" fill={metal} stroke={rim} strokeWidth="0.8" />
        <Path d="M20 13 L24 11 H27 L25 13 M29 12 L32 10 H38 L35 12 M39 13 L42 11 H46 L44 13" fill={lip} stroke={shades[1]} strokeWidth="0.8" />
        <Path d="M23 24 C28 26 37 26 41 24" stroke={glint} strokeOpacity="0.6" fill="none" />
      </>}
      {type === 'b' && <>
        {collar(32, 12)}
        <Path d="M32 7 C28 12 20 18 21 24 C21 34 43 34 43 24 C44 18 36 12 32 7 Z" fill={dome} stroke={rim} strokeWidth="0.7" />
        <Path d="M34 12 L28 23" stroke={shades[5]} strokeWidth="2.2" /><Path d="M35.5 13 L29.5 24" stroke={glint} strokeOpacity="0.6" strokeWidth="0.75" />
        {sphere(32, 6, 2.6)}
      </>}
      {type === 'n' && <>
        <Path d="M20 54 C20 46 24 39 32 34 L24 34 L20 37 L13 32 L15 26 L22 17 L30 14 L32 7 L37 14 C51 22 47 41 44 55 C42 60 24 60 20 54 Z" fill={metal} stroke={rim} strokeWidth="0.8" />
        <Path d="M36 16 C45 23 43 39 38 47 M39 19 L44 21 M40 25 L46 27 M40 32 L45 34" fill="none" stroke={shades[5]} strokeWidth="1.5" />
        <Path d="M25 20 L19 29 L16 30 M29 36 Q24 44 24 51" fill="none" stroke={glint} strokeOpacity="0.75" strokeWidth="1.5" />
        <Ellipse cx="28" cy="23" rx="1.7" ry="1.4" fill={shades[5]} /><Ellipse cx="27.5" cy="22.5" rx="0.5" ry="0.4" fill={glint} />
        {collar(55, 13)}
      </>}
      {type === 'q' && <>
        {collar(31, 12)}
        <Path d="M23 28 L18 12 L26 18 L32 9 L38 18 L46 12 L41 28 C37 32 27 32 23 28 Z" fill={metal} stroke={rim} strokeWidth="0.8" />
        <Ellipse cx="32" cy="28" rx="9" ry="3" fill={lip} />
        {sphere(18, 11, 2.5)}{sphere(32, 8, 3)}{sphere(46, 11, 2.5)}
      </>}
      {type === 'k' && <>
        {collar(31, 12)}
        <Path d="M24 28 C20 23 19 18 24 16 Q28 14 32 19 Q36 14 40 16 C45 18 44 23 40 28 Z" fill={dome} stroke={rim} strokeWidth="0.7" />
        <Path d="M29 3 H35 V8 H40 V13 H35 V20 H29 V13 H24 V8 H29 Z" fill={metal} stroke={rim} strokeWidth="0.8" />
        <Path d="M30 4 V10 H25 M30 14 V18" stroke={glint} strokeOpacity="0.8" strokeWidth="1" fill="none" />
      </>}
      <Path d="M23 59 Q20 62 20 64" fill="none" stroke={glint} strokeWidth="1.3" strokeOpacity="0.65" />
    </G>
  </Svg>;
}
export default memo(Piece);
