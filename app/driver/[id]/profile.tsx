// Legacy dispatcher URL /driver/:id/profile → /fleet-driver/:id/profile (driver extraction Phase 4A: /driver/* belongs to the
// Pulse Driver web app). Only bookmarks/old links land here; internal links use /fleet-driver/:id/profile.
import { Redirect, useLocalSearchParams, type Href } from 'expo-router';

export default function LegacyDriverProfileRedirect() {
  const params = useLocalSearchParams();
  return <Redirect href={{ pathname: '/fleet-driver/[id]/profile', params } as Href} />;
}
