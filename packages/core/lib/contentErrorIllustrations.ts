import type { ContentErrorVariant } from '@/components/ContentErrorState';
import type { ComponentType } from 'react';
import type { SvgProps } from 'react-native-svg';

import Illustration17 from '@/assets/illustrations/17.svg';
import Illustration19 from '@/assets/illustrations/19.svg';
import Illustration22 from '@/assets/illustrations/22.svg';
import Illustration28 from '@/assets/illustrations/28.svg';
import Illustration29 from '@/assets/illustrations/29.svg';
import Illustration31 from '@/assets/illustrations/31.svg';

export type ContentErrorIllustrationSpec = {
  Component: ComponentType<SvgProps>;
  width: number;
  height: number;
};

/** Metronic sketch illustrations keyed by error variant (see `assets/illustrations/`). */
export const CONTENT_ERROR_ILLUSTRATIONS: Record<
  ContentErrorVariant,
  ContentErrorIllustrationSpec
> = {
  network: { Component: Illustration17, width: 196, height: 156 },
  connection: { Component: Illustration17, width: 196, height: 156 },
  config: { Component: Illustration31, width: 168, height: 190 },
  update: { Component: Illustration19, width: 196, height: 158 },
  workspace: { Component: Illustration31, width: 168, height: 190 },
  workspaceMissing: { Component: Illustration22, width: 196, height: 176 },
  discover: { Component: Illustration29, width: 196, height: 168 },
  loads: { Component: Illustration28, width: 196, height: 184 },
  feed: { Component: Illustration22, width: 196, height: 176 },
  generic: { Component: Illustration17, width: 196, height: 156 },
};
