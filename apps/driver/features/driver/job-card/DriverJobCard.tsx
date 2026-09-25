/**
 * Driver Job Card router.
 * Mode = SES stops or persisted trip.is_commerce / execution_plan_id.
 * Primitive A is not used to choose the card.
 */
import { DriverTripFlowCard, type DriverTripFlowCardProps } from '../components/DriverTripFlowCard';
import { useDriverStopExecution } from '../hooks/useDriverStopExecution';
import { DriverJobCardPending } from './DriverJobCardPending';
import { DriverMultiOrderJobCard } from './DriverMultiOrderJobCard';
import { resolveDriverJobExecutionMode } from './resolveDriverJobExecutionMode';

export function DriverJobCard(props: DriverTripFlowCardProps) {
  const stopExecution = useDriverStopExecution(props.trip.id);
  const isCommerceTrip = Boolean(
    props.trip.is_commerce || (props.trip.execution_plan_id ?? '').trim(),
  );

  if (!stopExecution.hydrated) {
    return (
      <DriverJobCardPending
        trip={props.trip}
        edgeToEdge={props.edgeToEdge}
        variant={props.variant}
      />
    );
  }

  const mode = resolveDriverJobExecutionMode(stopExecution.stops, { isCommerceTrip });

  if (mode === 'multi_order') {
    return <DriverMultiOrderJobCard {...props} stopExecution={stopExecution} />;
  }

  return <DriverTripFlowCard {...props} skipStopExecution />;
}
