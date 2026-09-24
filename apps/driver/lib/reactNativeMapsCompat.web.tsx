import React from 'react';
import { View } from 'react-native';

type CompatProps = {
  children?: React.ReactNode;
  style?: object;
};

function NullMapPrimitive({ children, style }: CompatProps) {
  return <View style={style}>{children}</View>;
}

export const Callout = NullMapPrimitive;
export const Marker = NullMapPrimitive;
export const Polyline = NullMapPrimitive;
export const PROVIDER_GOOGLE = 'google';

export default NullMapPrimitive;
