import { render, screen } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import { Header } from './Header';

describe('Header', () => {
  test('when rendered, should display app title "Word Search"', () => {
    render(<Header dbStatus="idle" />);

    expect(screen.getByText('Word Search')).toBeInTheDocument();
  });

  test('when version is provided, should display dictionary version', () => {
    render(<Header dbStatus="ready" version="2024.1" />);

    expect(screen.getByText('v2024.1')).toBeInTheDocument();
  });

  test('when dbStatus is ready, should show ready status indicator', () => {
    render(<Header dbStatus="ready" />);

    const dot = screen.getByTestId('status-dot');
    expect(dot).toHaveClass('header__status-dot--ready');
  });

  test('when dbStatus is error, should show error status indicator', () => {
    render(<Header dbStatus="error" />);

    const dot = screen.getByTestId('status-dot');
    expect(dot).toHaveClass('header__status-dot--error');
  });

  test('when dbStatus is downloading, should show downloading status indicator', () => {
    render(<Header dbStatus="downloading" />);

    const dot = screen.getByTestId('status-dot');
    expect(dot).toHaveClass('header__status-dot--downloading');
  });
});
