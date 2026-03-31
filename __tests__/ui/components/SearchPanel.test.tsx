import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect, vi } from 'vitest';
import { SearchPanel } from '../../../src/ui/components/SearchPanel';
import type { SearchMode, Lang } from '../../../src/shared/types';

const defaultProps = {
  query: '',
  mode: 'contains' as SearchMode,
  lang: 'ja' as Lang,
  onQueryChange: () => {},
  onModeChange: () => {},
  onLangChange: () => {},
};

describe('SearchPanel', () => {
  test('when rendered, should display search input', () => {
    render(<SearchPanel {...defaultProps} />);

    expect(screen.getByRole('searchbox')).toBeInTheDocument();
  });

  test('when user types in search input, should call onQueryChange with input value', () => {
    const onQueryChange = vi.fn();
    render(<SearchPanel {...defaultProps} onQueryChange={onQueryChange} />);

    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'test' } });

    expect(onQueryChange).toHaveBeenCalledWith('test');
  });

  test('when mode select is changed, should call onModeChange with new mode', async () => {
    const user = userEvent.setup();
    const onModeChange = vi.fn();
    render(<SearchPanel {...defaultProps} onModeChange={onModeChange} />);

    await user.selectOptions(screen.getByLabelText(/mode/i), 'prefix');

    expect(onModeChange).toHaveBeenCalledWith('prefix');
  });

  test('when lang select is changed, should call onLangChange with new lang', async () => {
    const user = userEvent.setup();
    const onLangChange = vi.fn();
    render(<SearchPanel {...defaultProps} onLangChange={onLangChange} />);

    await user.selectOptions(screen.getByLabelText(/lang/i), 'en');

    expect(onLangChange).toHaveBeenCalledWith('en');
  });

  test('when query prop is provided, should show it in input', () => {
    render(<SearchPanel {...defaultProps} query="hello" />);

    expect(screen.getByRole('searchbox')).toHaveValue('hello');
  });

  test('when mode is prefix, should reflect in select', () => {
    render(<SearchPanel {...defaultProps} mode="prefix" />);

    expect(screen.getByLabelText(/mode/i)).toHaveValue('prefix');
  });
});
