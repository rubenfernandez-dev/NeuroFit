import React from 'react';
import { View, ViewStyle } from 'react-native';

type HelpActionsGridProps = {
  children: React.ReactNode;
  style?: ViewStyle;
};

export default function HelpActionsGrid({ children, style }: HelpActionsGridProps) {
  const items = React.Children.toArray(children);

  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'nowrap',
        columnGap: 6,
        justifyContent: 'flex-start',
        alignItems: 'stretch',
        ...style,
      }}
    >
      {items.map((child, index) => (
        <View key={`help-action-${index}`} style={{ flex: 1, minWidth: 0 }}>
          {child}
        </View>
      ))}
    </View>
  );
}
