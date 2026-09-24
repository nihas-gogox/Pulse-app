// Legacy dispatcher URL /driver/:id → /fleet-driver/:id (driver extraction Phase 4A: /driver/* belongs to the
// Pulse Driver web app). Only bookmarks/old links land here; internal links use /fleet-driver/:id.
import { Redirect, useLocalSearchParams, type Href } from 'expo-router';

export default function LegacyDriverDetailRedirect() {
  const params = useLocalSearchParams();
  return <Redirect href={{ pathname: '/fleet-driver/[id]', params } as Href} />;
}
