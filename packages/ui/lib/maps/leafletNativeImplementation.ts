/**
 * Environment-selected native LeafletMap implementation.
 *
 * The `require` calls here are deliberate and are the ONLY ones for map
 * selection in the codebase. They must stay lazy: a static `import` would
 * evaluate both modules, and each throws at import time in the environment it
 * does not belong to. `import()` is not usable either — it is async, and the
 * consumer resolves the component synchronously during render.
 */
import type React from "react";

import type {
  LeafletMapProps,
  LeafletMapRef,
} from "../../components/driver/LeafletMap.types";

import { createMapImplementationResolver } from "@pulse/core/lib/maps/mapImplementationRegistry";

export type NativeLeafletComponent = React.ForwardRefExoticComponent<
  LeafletMapProps & React.RefAttributes<LeafletMapRef>
>;

export const resolveNativeLeafletMap =
  createMapImplementationResolver<NativeLeafletComponent>({
    "expo-go": () =>
      require("../../components/driver/LeafletMap.rnmaps").LeafletMap,
    standalone: () =>
      require("../../components/driver/LeafletMap.maplibre").LeafletMapMapLibre,
  });
