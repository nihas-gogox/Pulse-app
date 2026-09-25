import { Redirect } from 'expo-router';

/** Driver module — reuses established wizard until driver onboarding is split out. */
export default function OnboardingDriverRoute() {
  return <Redirect href="/driver-signup" />;
}
