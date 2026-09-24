// Legacy dispatcher URL /driver/:id/analytics → /fleet-driver/:id/analytics (driver extraction Phase 4A: /driver/* belongs to the
// Pulse Driver web app). Only bookmarks/old links land here; internal links use /fleet-driver/:id/analytics.
import { Redirect, useLocalSearchParams, type Href } from 'expo-router';

export default function LegacyDriverAnalyticsRedirect() {
  const params = useLocalSearchParams();
  return <Redirect href={{ pathname: '/fleet-driver/[id]/analytics', params } as Href} />;
}
