/** Shared close behavior for add-driver modal: return to the opener, else Network. */
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ROUTES } from '@/lib/routes';
import { performSafeBack } from '@/lib/useSafeBack';

const FALLBACK_AFTER_ADD_DRIVER = ROUTES.TABS.NETWORK;

export function closeModal(
  router: ReturnType<typeof useRouter>,
  returnTo?: string,
) {
  performSafeBack(router, returnTo ?? FALLBACK_AFTER_ADD_DRIVER);
}

export default function AddDriverCloseModal() {
  const router = useRouter();
  useEffect(() => {
    closeModal(router);
  }, [router]);
  return null;
}
