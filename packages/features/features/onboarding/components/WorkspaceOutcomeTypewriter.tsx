import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import Theme from '@pulse/core/constants/Theme';
import { WORKSPACE_SETUP_COPY } from '@pulse/domain/lib/onboarding/workspaceSetupContent';

import { ONBOARDING_BRAND } from '@pulse/domain/features/onboarding/components/onboardingPersonaAssets';

const CHAR_MS = 38;
const LINE_PAUSE_MS = 280;

export type WorkspaceOutcomeTypewriterProps = {
  lines?: readonly string[];
};

/** Types outcome lines sequentially — one line at a time. */
export function WorkspaceOutcomeTypewriter({
  lines = WORKSPACE_SETUP_COPY.outcomes,
}: WorkspaceOutcomeTypewriterProps) {
  const [lineIndex, setLineIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);

  useEffect(() => {
    setLineIndex(0);
    setCharIndex(0);
  }, [lines]);

  useEffect(() => {
    if (lineIndex >= lines.length) return;

    const current = lines[lineIndex] ?? '';

    if (charIndex < current.length) {
      const timer = setTimeout(() => setCharIndex((c) => c + 1), CHAR_MS);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(() => {
      setLineIndex((i) => i + 1);
      setCharIndex(0);
    }, LINE_PAUSE_MS);

    return () => clearTimeout(timer);
  }, [lineIndex, charIndex, lines]);

  const completedLines = lines.slice(0, lineIndex);
  const activeLine = lineIndex < lines.length ? lines[lineIndex] : null;
  const activeText = activeLine ? activeLine.slice(0, charIndex) : '';
  const typing = activeLine != null && charIndex < activeLine.length;

  return (
    <View style={styles.wrap} accessibilityLabel={lines.join(' ')}>
      {completedLines.map((line) => (
        <Text key={line} style={styles.line}>
          {line}
        </Text>
      ))}
      {activeLine != null ? (
        <Text style={styles.line}>
          {activeText}
          {typing ? <Text style={styles.cursor}>|</Text> : null}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 3,
    minHeight: 76,
    marginBottom: 6,
  },
  line: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    color: ONBOARDING_BRAND.ink,
    opacity: 0.82,
  },
  cursor: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '300',
    color: Theme.textMuted,
  },
});
