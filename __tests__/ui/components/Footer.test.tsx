import { render, screen } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import { Footer } from '../../../src/ui/components/Footer';

describe('Footer', () => {
  test('when rendered, should display license link', () => {
    render(<Footer sources={[]} onNavigateToLicense={() => {}} />);

    expect(screen.getByRole('button', { name: /license/i })).toBeInTheDocument();
  });

  test('when license link is clicked, should call onNavigateToLicense', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    let called = false;
    render(<Footer sources={[]} onNavigateToLicense={() => { called = true; }} />);

    await user.click(screen.getByRole('button', { name: /license/i }));

    expect(called).toBe(true);
  });
});
