import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import Theme from '@pulse/core/constants/Theme';

import { DESKTOP_SIGNUP_SPLIT_PAD } from '@pulse/domain/features/auth/signup/signUpConstants';
import { PulseActivationMarketingPanel } from './PulseActivationMarketingPanel';

export type PulseActivationDesktopSplitProps = {
  children: ReactNode;
  brandWord?: string;
  marketingTag?: string;
  marketingTitle?: string;
  outcomeLines?: readonly string[];
};

/** Full-viewport desktop split — illustration left, activation flow right. */
export function PulseActivationDesktopSplit({
  children,
  brandWord,
  marketingTag,
  marketingTitle,
  outcomeLines,
}: PulseActivationDesktopSplitProps) {
  return (
    <View style={styles.shell}>
      <View style={styles.leftCol}>
        <PulseActivationMarketingPanel
          brandWord={brandWord}
          tag={marketingTag}
          title={marketingTitle}
          outcomeLines={outcomeLines}
        />
      </View>

      <View style={styles.divider} />

      <View style={styles.rightCol}>
        <View style={styles.flowPane}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Theme.screenBackground,
    minHeight: 0,
  },
  leftCol: {
    flex: 1,
    minWidth: 0,
    maxWidth: '50%',
    backgroundColor: Theme.screenBackground,
    minHeight: 0,
    overflow: 'hidden',
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(77, 54, 54, 0.1)',
    alignSelf: 'stretch',
    flexShrink: 0,
  },
  rightCol: {
    flex: 1,
    minWidth: 0,
    maxWidth: '50%',
    backgroundColor: Theme.screenBackground,
    minHeight: 0,
    overflow: 'hidden',
  },
  flowPane: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    paddingHorizontal: DESKTOP_SIGNUP_SPLIT_PAD,
    justifyContent: 'center',
  },
});
