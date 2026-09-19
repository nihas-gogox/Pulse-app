/**
 * Facepile / profile already use queryKeys.mutualConnections. The modal used
 * to call getMutualConnections again on open even when that cache was warm.
 */
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react-native";
import { MutualConnectionsModal } from "@/features/network/components/MutualConnectionsModal";
import { queryKeys } from "@/lib/queryKeys";
import * as mutualService from "@/features/network/services/mutual-connections.service";

jest.mock("react-native", () => jest.requireActual("react-native"));

jest.mock("@/components/PartyAvatar", () => ({
  PartyAvatar: () => null,
}));

jest.mock("lucide-react-native", () => ({
  X: () => null,
}));

jest.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@/features/network/services/mutual-connections.service", () => ({
  getMutualConnections: jest.fn(),
}));

const mockGetMutualConnections = mutualService.getMutualConnections as jest.Mock;

function renderModal(
  client: QueryClient,
  props: Partial<React.ComponentProps<typeof MutualConnectionsModal>> = {},
) {
  return render(
    <QueryClientProvider client={client}>
      <MutualConnectionsModal
        visible
        viewerOrgId="viewer"
        targetOrgId="target"
        onClose={() => {}}
        onOpenProfile={() => {}}
        {...props}
      />
    </QueryClientProvider>,
  );
}

describe("MutualConnectionsModal query cache", () => {
  beforeEach(() => {
    mockGetMutualConnections.mockReset();
    mockGetMutualConnections.mockResolvedValue({
      error: null,
      mutuals: [],
    });
  });

  it("does not refetch when mutuals are already in the shared query cache", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    client.setQueryData(queryKeys.mutualConnections("viewer", "target"), [
      {
        id: "org-a",
        name: "Alpha Logistics",
        avatar_url: null,
        avatar_seed: null,
      },
    ]);

    const { getByText, unmount } = renderModal(client);

    expect(getByText("Alpha Logistics")).toBeTruthy();
    expect(mockGetMutualConnections).not.toHaveBeenCalled();
    unmount();
    client.clear();
  });

  it("does not fetch while the modal is closed", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    const { unmount } = renderModal(client, {
      visible: false,
      targetOrgId: "target",
    });
    expect(mockGetMutualConnections).not.toHaveBeenCalled();
    unmount();
    client.clear();
  });
});
