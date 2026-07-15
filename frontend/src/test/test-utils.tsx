import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import type { ReactElement, ReactNode } from 'react';

function AllProviders({ children }: { children: ReactNode }) {
  return <HelmetProvider>{children}</HelmetProvider>;
}

export function renderWithProviders(
  ui: ReactElement,
  options?: RenderOptions
): RenderResult {
  return render(ui, { wrapper: AllProviders, ...options });
}

export { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
