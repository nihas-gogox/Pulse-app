import type { TextStyle } from 'react-native';

import Theme from '../constants/Theme';

/** Tabular figures for all currency and operational metrics. */
export const tabularNums: TextStyle = {
  fontVariant: ['tabular-nums'],
};

export const typography = {
  display: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.6,
    lineHeight: 38,
    color: Theme.textPrimaryDark,
    ...tabularNums,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.35,
    lineHeight: 28,
    color: Theme.textPrimaryDark,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
    lineHeight: 22,
    color: Theme.textPrimaryDark,
  },
  body: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 21,
    color: Theme.textBody,
  },
  bodyMedium: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 21,
    color: Theme.textBody,
  },
  caption: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    color: Theme.textSecondary,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    lineHeight: 14,
    color: Theme.textSecondary,
  },
  metric: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 32,
    color: Theme.textPrimaryDark,
    ...tabularNums,
  },
  metricSm: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    lineHeight: 24,
    color: Theme.textPrimaryDark,
    ...tabularNums,
  },
} as const satisfies Record<string, TextStyle>;

export default typography;
