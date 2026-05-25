import React from 'react';
import Svg, {
  Path,
  Line,
  Polyline,
  Rect,
  Circle,
  Polygon,
} from 'react-native-svg';

type IconName =
  | 'home'
  | 'calendar'
  | 'chat'
  | 'plus'
  | 'check'
  | 'chevronRight'
  | 'chevronLeft'
  | 'chevronDown'
  | 'clock'
  | 'send'
  | 'star'
  | 'bolt'
  | 'export'
  | 'refresh'
  | 'edit'
  | 'history'
  | 'ai'
  | 'x'
  | 'stats'
  | 'camera'
  | 'lock'
  | 'activity'
  | 'download'
  | 'shield'
  | 'logout'
  | 'trash'
  | 'heart'
  | 'watch'
  | 'person';

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
}

export default function Icon({ name, size = 20, color = 'currentColor' }: IconProps) {
  const props = { width: size, height: size, viewBox: '0 0 24 24' };
  const strokeProps = { stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };

  switch (name) {
    case 'home':
      return (
        <Svg {...props}>
          <Path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" {...strokeProps} />
          <Polyline points="9 22 9 12 15 12 15 22" {...strokeProps} />
        </Svg>
      );
    case 'calendar':
      return (
        <Svg {...props}>
          <Rect x="3" y="4" width="18" height="18" rx="2" {...strokeProps} />
          <Line x1="16" y1="2" x2="16" y2="6" {...strokeProps} />
          <Line x1="8" y1="2" x2="8" y2="6" {...strokeProps} />
          <Line x1="3" y1="10" x2="21" y2="10" {...strokeProps} />
        </Svg>
      );
    case 'chat':
      return (
        <Svg {...props}>
          <Path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" {...strokeProps} />
        </Svg>
      );
    case 'plus':
      return (
        <Svg {...props}>
          <Line x1="12" y1="5" x2="12" y2="19" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
          <Line x1="5" y1="12" x2="19" y2="12" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
        </Svg>
      );
    case 'check':
      return (
        <Svg {...props}>
          <Polyline points="20 6 9 17 4 12" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </Svg>
      );
    case 'chevronRight':
      return (
        <Svg {...props}>
          <Polyline points="9 18 15 12 9 6" {...strokeProps} />
        </Svg>
      );
    case 'chevronLeft':
      return (
        <Svg {...props}>
          <Polyline points="15 18 9 12 15 6" {...strokeProps} />
        </Svg>
      );
    case 'chevronDown':
      return (
        <Svg {...props}>
          <Polyline points="6 9 12 15 18 9" {...strokeProps} />
        </Svg>
      );
    case 'clock':
      return (
        <Svg {...props}>
          <Circle cx="12" cy="12" r="10" {...strokeProps} />
          <Polyline points="12 6 12 12 16 14" {...strokeProps} />
        </Svg>
      );
    case 'send':
      return (
        <Svg {...props}>
          <Line x1="22" y1="2" x2="11" y2="13" {...strokeProps} />
          <Polygon points="22 2 15 22 11 13 2 9 22 2" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill={color} />
        </Svg>
      );
    case 'bolt':
      return (
        <Svg {...props}>
          <Polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill={color} stroke="none" />
        </Svg>
      );
    case 'export':
      return (
        <Svg {...props}>
          <Path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" {...strokeProps} />
          <Polyline points="17 8 12 3 7 8" {...strokeProps} />
          <Line x1="12" y1="3" x2="12" y2="15" {...strokeProps} />
        </Svg>
      );
    case 'refresh':
      return (
        <Svg {...props}>
          <Polyline points="23 4 23 10 17 10" {...strokeProps} />
          <Path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" {...strokeProps} />
        </Svg>
      );
    case 'edit':
      return (
        <Svg {...props}>
          <Path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" {...strokeProps} />
          <Path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" {...strokeProps} />
        </Svg>
      );
    case 'history':
      return (
        <Svg {...props}>
          <Polyline points="1 4 1 10 7 10" {...strokeProps} />
          <Path d="M3.51 15a9 9 0 102.13-9.36L1 10" {...strokeProps} />
        </Svg>
      );
    case 'ai':
      return (
        <Svg {...props}>
          <Circle cx="12" cy="12" r="3" {...strokeProps} />
          <Path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" {...strokeProps} />
        </Svg>
      );
    case 'x':
      return (
        <Svg {...props}>
          <Line x1="18" y1="6" x2="6" y2="18" {...strokeProps} />
          <Line x1="6" y1="6" x2="18" y2="18" {...strokeProps} />
        </Svg>
      );
    case 'stats':
      return (
        <Svg {...props}>
          <Polyline points="22 12 18 12 15 20 9 4 6 12 2 12" {...strokeProps} />
        </Svg>
      );
    case 'camera':
      return (
        <Svg {...props}>
          <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" {...strokeProps} />
          <Circle cx="12" cy="13" r="4" {...strokeProps} />
        </Svg>
      );
    case 'lock':
      return (
        <Svg {...props}>
          <Rect x="3" y="11" width="18" height="11" rx="2" {...strokeProps} />
          <Path d="M7 11V7a5 5 0 0110 0v4" {...strokeProps} />
        </Svg>
      );
    case 'activity':
      return (
        <Svg {...props}>
          <Polyline points="22 12 18 12 15 20 9 4 6 12 2 12" {...strokeProps} />
        </Svg>
      );
    case 'download':
      return (
        <Svg {...props}>
          <Path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" {...strokeProps} />
          <Polyline points="7 10 12 15 17 10" {...strokeProps} />
          <Line x1="12" y1="15" x2="12" y2="3" {...strokeProps} />
        </Svg>
      );
    case 'shield':
      return (
        <Svg {...props}>
          <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" {...strokeProps} />
        </Svg>
      );
    case 'logout':
      return (
        <Svg {...props}>
          <Path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" {...strokeProps} />
          <Polyline points="16 17 21 12 16 7" {...strokeProps} />
          <Line x1="21" y1="12" x2="9" y2="12" {...strokeProps} />
        </Svg>
      );
    case 'trash':
      return (
        <Svg {...props}>
          <Polyline points="3 6 5 6 21 6" {...strokeProps} />
          <Path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" {...strokeProps} />
          <Path d="M10 11v6M14 11v6" {...strokeProps} />
          <Path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" {...strokeProps} />
        </Svg>
      );
    case 'heart':
      return (
        <Svg {...props}>
          <Path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" {...strokeProps} />
        </Svg>
      );
    case 'watch':
      return (
        <Svg {...props}>
          <Rect x="7" y="6" width="10" height="12" rx="3" {...strokeProps} />
          <Line x1="9" y1="6" x2="10" y2="2" {...strokeProps} />
          <Line x1="15" y1="6" x2="14" y2="2" {...strokeProps} />
          <Line x1="9" y1="18" x2="10" y2="22" {...strokeProps} />
          <Line x1="15" y1="18" x2="14" y2="22" {...strokeProps} />
          <Line x1="9.5" y1="12" x2="12" y2="12" {...strokeProps} />
          <Line x1="12" y1="10" x2="12" y2="12" {...strokeProps} />
        </Svg>
      );
    case 'person':
      return (
        <Svg {...props}>
          <Circle cx="12" cy="8" r="4" {...strokeProps} />
          <Path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" {...strokeProps} />
        </Svg>
      );
    case 'star':
      return (
        <Svg {...props}>
          <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" {...strokeProps} />
        </Svg>
      );
    default:
      return null;
  }
}
