import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import OperacionTabsLayout from '../../../app/(operacion)/(tabs)/_layout';

jest.mock('expo-router/js-tabs', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text, View } = jest.requireActual<typeof import('react-native')>('react-native');
  const Screen = ({ name }: { name: string }) =>
    React.createElement(Text, { testID: `tab-${name}` }, name);
  const Tabs = ({ children }: { children?: ReactNode }) =>
    React.createElement(View, null, children);
  Tabs.Screen = Screen;
  return { Tabs };
});

describe('OperacionTabsLayout', () => {
  it('registra las pestañas inicio, ubicacion y perfil', async () => {
    await render(<OperacionTabsLayout />);
    expect(screen.getByTestId('tab-inicio')).toBeTruthy();
    expect(screen.getByTestId('tab-ubicacion')).toBeTruthy();
    expect(screen.getByTestId('tab-perfil')).toBeTruthy();
  });
});
