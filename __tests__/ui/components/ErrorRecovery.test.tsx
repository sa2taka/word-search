import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect, vi } from 'vitest';
import { ErrorRecovery } from '../../../src/ui/components/ErrorRecovery';

describe('ErrorRecovery', () => {
  test('when rendered, should display error message', () => {
    render(
      <ErrorRecovery
        message="Download failed"
        onRetry={() => {}}
        onReset={() => {}}
      />,
    );

    expect(screen.getByText('Download failed')).toBeInTheDocument();
  });

  test('when retry button is clicked, should call onRetry', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <ErrorRecovery message="Error" onRetry={onRetry} onReset={() => {}} />,
    );

    await user.click(screen.getByRole('button', { name: /retry/i }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  test('when reset button is clicked, should call onReset', async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    render(
      <ErrorRecovery message="Error" onRetry={() => {}} onReset={onReset} />,
    );

    await user.click(screen.getByRole('button', { name: /reset/i }));

    expect(onReset).toHaveBeenCalledOnce();
  });
});
