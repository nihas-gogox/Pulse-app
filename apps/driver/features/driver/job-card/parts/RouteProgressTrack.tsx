import { StyleSheet, View } from 'react-native';
import { getDriverThemeColors } from '@pulse/ui/contexts/DriverThemeContext';
import type { DriverStopExecutionStop } from '../../execution/driverStopExecution.types';

type Colors = ReturnType<typeof getDriverThemeColors>;

type Props = {
  colors: Colors;
  stops: readonly DriverStopExecutionStop[];
  currentStopId: string | null;
};

function isDone(status: string): boolean {
  return status === 'completed' || status === 'skipped';
}

export function RouteProgressTrack({ colors, stops, currentStopId }: Props) {
  const done = stops.filter((s) => isDone(s.status)).length;
  return (
    <View
      style={styles.wrap}
      accessibilityLabel={`${done} of ${stops.length} stops completed`}
      testID="multi-order-progress-track"
    >
      <View style={styles.row}>
        {stops.map((stop, index) => {
          const complete = isDone(stop.status);
          const current = stop.stopId === currentStopId;
          const prevDone = index > 0 && isDone(stops[index - 1]!.status);
          return (
            <View key={stop.stopId} style={styles.seg}>
              {index > 0 ? (
                <View
                  style={[
                    styles.line,
                    { backgroundColor: prevDone || complete || current ? colors.emerald : colors.border },
                  ]}
                />
              ) : null}
              <View
                style={[
                  current ? styles.dotCurrent : styles.dot,
                  {
                    backgroundColor: complete || current ? colors.emerald : colors.surfaceElevated,
                    borderColor: current ? colors.emerald : colors.border,
                  },
                ]}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seg: {
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    flexShrink: 1,
  },
  line: {
    flex: 1,
    height: 2,
    borderRadius: 1,
    marginHorizontal: 3,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    flexShrink: 0,
  },
  dotCurrent: {
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
    flexShrink: 0,
  },
});
