import { render, screen } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import { StatusDisplay } from '../../../src/ui/components/StatusDisplay';

describe('StatusDisplay', () => {
  test('when status is idle, should display idle message', () => {
    render(<StatusDisplay status="idle" message="Dictionary not downloaded" />);

    expect(screen.getByText('Dictionary not downloaded')).toBeInTheDocument();
    expect(screen.getByTestId('status-display')).toHaveClass('status-display--idle');
  });

  test('when status is downloading with progress, should display progress bar', () => {
    render(
      <StatusDisplay status="downloading" message="Downloading..." progress={45} />,
    );

    expect(screen.getByText('Downloading...')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '45');
  });

  test('when status is ready, should display ready message', () => {
    render(<StatusDisplay status="ready" message="Ready" />);

    expect(screen.getByTestId('status-display')).toHaveClass('status-display--ready');
  });

  test('when status is error, should display error message', () => {
    render(<StatusDisplay status="error" message="Download failed" />);

    expect(screen.getByText('Download failed')).toBeInTheDocument();
    expect(screen.getByTestId('status-display')).toHaveClass('status-display--error');
  });

  test('when status is updatable, should display updatable message', () => {
    render(<StatusDisplay status="updatable" message="Update available" />);

    expect(screen.getByText('Update available')).toBeInTheDocument();
    expect(screen.getByTestId('status-display')).toHaveClass('status-display--updatable');
  });

  test('when progress is undefined, should not display progress bar', () => {
    render(<StatusDisplay status="downloading" message="Downloading..." />);

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});
