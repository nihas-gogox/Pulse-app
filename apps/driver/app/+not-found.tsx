// Unknown driver URL → dashboard (the gate sends signed-out users to sign-in).
import { Redirect, type Href } from 'expo-router';
import { DRIVER_ROUTES } from '../lib/routes';

export default function DriverNotFound() {
  return <Redirect href={DRIVER_ROUTES.HOME as Href} />;
}
