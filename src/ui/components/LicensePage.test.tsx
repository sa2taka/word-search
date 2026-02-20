import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect, vi } from 'vitest';
import { LicensePage } from './LicensePage';
import type { DictSource } from '../../shared/types';

describe('LicensePage', () => {
  test('when rendered, should display page title', () => {
    render(<LicensePage sources={[]} onBack={() => {}} />);

    expect(screen.getByText('Licenses')).toBeInTheDocument();
  });

  test('when sources are provided, should display each source name and license', () => {
    const sources: DictSource[] = [
      { name: 'JMdict', license: 'CC BY-SA 4.0', version: '2024.1' },
      { name: 'EDICT', license: 'CC BY-SA 3.0' },
    ];

    render(<LicensePage sources={sources} onBack={() => {}} />);

    expect(screen.getByText('JMdict')).toBeInTheDocument();
    expect(screen.getByText(/CC BY-SA 4.0/)).toBeInTheDocument();
    expect(screen.getByText('EDICT')).toBeInTheDocument();
    expect(screen.getByText(/CC BY-SA 3.0/)).toBeInTheDocument();
  });

  test('when source has attribution, should display it', () => {
    const sources: DictSource[] = [
      { name: 'JMdict', license: 'CC BY-SA 4.0', attribution: 'Jim Breen' },
    ];

    render(<LicensePage sources={sources} onBack={() => {}} />);

    expect(screen.getByText(/Jim Breen/)).toBeInTheDocument();
  });

  test('when back button is clicked, should call onBack', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(<LicensePage sources={[]} onBack={onBack} />);

    await user.click(screen.getByRole('button', { name: /back/i }));

    expect(onBack).toHaveBeenCalledOnce();
  });
});
