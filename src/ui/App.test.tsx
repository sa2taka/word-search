import { render, screen, fireEvent } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { App } from './App';

vi.mock('./hooks/useSearchWorker', () => ({
  useSearchWorker: () => mockHookReturn,
}));

let mockHookReturn: Record<string, unknown>;

describe('App', () => {
  beforeEach(() => {
    mockHookReturn = {
      dbStatus: 'ready',
      version: '2024.1',
      progress: undefined,
      items: [],
      totalApprox: 0,
      error: null,
      init: vi.fn(),
      search: vi.fn(),
      cancel: vi.fn(),
      checkUpdate: vi.fn(),
      updateDb: vi.fn(),
      resetDb: vi.fn(),
    };
  });
  test('when rendered, should display header with app title', () => {
    render(<App />);

    expect(screen.getByText('Word Search')).toBeInTheDocument();
  });

  test('when rendered, should display search panel', () => {
    render(<App />);

    expect(screen.getByRole('searchbox')).toBeInTheDocument();
  });

  test('when rendered, should display footer', () => {
    render(<App />);

    expect(screen.getByRole('button', { name: /license/i })).toBeInTheDocument();
  });

  test('when dbStatus is error, should display error recovery', () => {
    mockHookReturn = {
      ...mockHookReturn,
      dbStatus: 'error',
      error: { code: 'DB_DOWNLOAD_FAILED', message: 'Network error' },
    };

    render(<App />);

    expect(screen.getByText('Network error')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  test('when dbStatus is downloading, should display status with progress', () => {
    mockHookReturn = {
      ...mockHookReturn,
      dbStatus: 'downloading',
      progress: 60,
    };

    render(<App />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  test('when license link is clicked, should show license page', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /license/i }));

    expect(screen.getByText('Licenses')).toBeInTheDocument();
  });

  test('when on license page and back is clicked, should return to search', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /license/i }));
    fireEvent.click(screen.getByRole('button', { name: /back/i }));

    expect(screen.getByRole('searchbox')).toBeInTheDocument();
  });
});
