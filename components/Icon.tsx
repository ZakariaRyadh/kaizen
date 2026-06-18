import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

// Thin line-icon set, traced from the design's inline SVGs.
// stroke = currentColor equivalent (we pass `color`).

export type IconName =
  | 'home'
  | 'gym'
  | 'calendar'
  | 'notes'
  | 'settings'
  | 'plus'
  | 'search'
  | 'chevron'
  | 'flame'
  | 'play'
  | 'pause'
  | 'grip'
  | 'mail'
  | 'lock'
  | 'keypad'
  | 'back';

type Props = { name: IconName; size?: number; color?: string };

export function Icon({ name, size = 23, color = '#fff' }: Props) {
  const s = { width: size, height: size } as const;
  const stroke = {
    stroke: color,
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  switch (name) {
    case 'home':
      return (
        <Svg {...s} viewBox="0 0 24 24">
          <Path d="M3.5 11 12 4l8.5 7" {...stroke} />
          <Path d="M6 9.5V20h12V9.5" {...stroke} />
        </Svg>
      );
    case 'gym':
      return (
        <Svg {...s} viewBox="0 0 24 24">
          <Path d="M6.5 7v10M17.5 7v10M4 9.5v5M20 9.5v5M6.5 12h11" {...stroke} />
        </Svg>
      );
    case 'calendar':
      return (
        <Svg {...s} viewBox="0 0 24 24">
          <Rect x="3.5" y="5" width="16" height="14" rx="2.5" {...stroke} />
          <Path d="M3.5 9.5h16M8 3v3.5M15 3v3.5" {...stroke} />
        </Svg>
      );
    case 'notes':
      return (
        <Svg {...s} viewBox="0 0 24 24">
          <Path d="M6 3.5h9l3 3V20H6z" {...stroke} />
          <Path d="M14 3.5V7h3.5M9 12h6M9 15.5h4" {...stroke} />
        </Svg>
      );
    case 'settings':
      return (
        <Svg {...s} viewBox="0 0 24 24">
          <Circle cx="12" cy="12" r="3" {...stroke} />
          <Path
            d="M12 2.5v2M12 19.5v2M21.5 12h-2M4.5 12h-2M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4M18.7 18.7l-1.4-1.4M6.7 6.7 5.3 5.3"
            {...stroke}
          />
        </Svg>
      );
    case 'plus':
      return (
        <Svg {...s} viewBox="0 0 20 20">
          <Path d="M10 4v12M4 10h12" {...stroke} strokeWidth={2} />
        </Svg>
      );
    case 'search':
      return (
        <Svg {...s} viewBox="0 0 17 17">
          <Circle cx="7.5" cy="7.5" r="5.5" {...stroke} />
          <Path d="M11.5 11.5 16 16" {...stroke} />
        </Svg>
      );
    case 'chevron':
      return (
        <Svg {...s} viewBox="0 0 18 18">
          <Path d="M7 4l6 5-6 5" {...stroke} strokeWidth={2} />
        </Svg>
      );
    case 'flame':
      return (
        <Svg {...s} viewBox="0 0 20 20">
          <Path
            d="M10 2c1.6 2.6 3.6 3.6 3.6 6.4A3.6 3.6 0 0 1 6.4 8.4c0-.9.4-1.7.9-2.3C8.2 7.4 10 5.6 10 2z"
            fill={color}
          />
        </Svg>
      );
    case 'play':
      return (
        <Svg {...s} viewBox="0 0 16 16">
          <Path d="M4 2.5v11l9-5.5z" fill={color} />
        </Svg>
      );
    case 'pause':
      return (
        <Svg {...s} viewBox="0 0 16 16">
          <Rect x="3" y="2" width="3.5" height="12" rx="1" fill={color} />
          <Rect x="9.5" y="2" width="3.5" height="12" rx="1" fill={color} />
        </Svg>
      );
    case 'grip':
      return (
        <Svg {...s} viewBox="0 0 20 20">
          <Path d="M4 6h12M4 10h12M4 14h12" {...stroke} strokeWidth={1.8} />
        </Svg>
      );
    case 'mail':
      return (
        <Svg {...s} viewBox="0 0 20 20">
          <Rect x="2.5" y="4.5" width="15" height="11" rx="2.5" {...stroke} />
          <Path d="M3 6l7 5 7-5" {...stroke} />
        </Svg>
      );
    case 'lock':
      return (
        <Svg {...s} viewBox="0 0 20 20">
          <Rect x="4" y="9" width="12" height="8" rx="2" {...stroke} />
          <Path d="M6.5 9V6.5a3.5 3.5 0 0 1 7 0V9" {...stroke} />
        </Svg>
      );
    case 'keypad':
      return (
        <Svg {...s} viewBox="0 0 20 20">
          <Path d="M5 4h.01M10 4h.01M15 4h.01M5 9h.01M10 9h.01M15 9h.01M5 14h.01M10 14h.01M15 14h.01" {...stroke} strokeWidth={2.4} />
        </Svg>
      );
    case 'back':
      return (
        <Svg {...s} viewBox="0 0 20 20">
          <Path d="M12 4l-6 6 6 6" {...stroke} strokeWidth={2} />
        </Svg>
      );
    default:
      return null;
  }
}
