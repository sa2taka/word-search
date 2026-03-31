import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect, vi } from 'vitest';
import { ResultList } from '../../../src/ui/components/ResultList';
import type { EntryRow } from '../../../src/shared/types';

describe('ResultList', () => {
  test('when items is empty, should display empty message', () => {
    render(
      <ResultList
        items={[]}
        offset={0}
        totalApprox={0}
        pageSize={50}
        query="test"
        searching={false}
        onPageChange={() => {}}
      />,
    );

    expect(screen.getByText(/no results/i)).toBeInTheDocument();
  });

  test('when items are provided, should display each entry surface', () => {
    const items: EntryRow[] = [
      { id: 1, lang: 'ja', word: 'ねこ', pos: '名詞', sources: ['jmdict'] },
      { id: 2, lang: 'ja', word: 'いぬ', pos: '名詞', sources: ['jmdict'] },
    ];

    render(
      <ResultList
        items={items}
        offset={0}
        totalApprox={2}
        pageSize={50}
        query="test"
        searching={false}
        onPageChange={() => {}}
      />,
    );

    expect(screen.getByText('ねこ')).toBeInTheDocument();
    expect(screen.getByText('いぬ')).toBeInTheDocument();
  });

  test('when there are more results, should enable next button', () => {
    const items: EntryRow[] = [
      { id: 1, lang: 'ja', word: 'ねこ', sources: ['jmdict'] },
    ];

    render(
      <ResultList
        items={items}
        offset={0}
        totalApprox={100}
        pageSize={50}
        query="test"
        searching={false}
        onPageChange={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: /next/i })).not.toBeDisabled();
  });

  test('when on first page, should disable prev button', () => {
    const items: EntryRow[] = [
      { id: 1, lang: 'ja', word: 'ねこ', sources: ['jmdict'] },
    ];

    render(
      <ResultList
        items={items}
        offset={0}
        totalApprox={100}
        pageSize={50}
        query="test"
        searching={false}
        onPageChange={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: /prev/i })).toBeDisabled();
  });

  test('when next button is clicked, should call onPageChange with next offset', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    const items: EntryRow[] = [
      { id: 1, lang: 'ja', word: 'ねこ', sources: ['jmdict'] },
    ];

    render(
      <ResultList
        items={items}
        offset={0}
        totalApprox={100}
        pageSize={50}
        query="test"
        searching={false}
        onPageChange={onPageChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: /next/i }));

    expect(onPageChange).toHaveBeenCalledWith(50);
  });

  test('when prev button is clicked on second page, should call onPageChange with previous offset', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    const items: EntryRow[] = [
      { id: 1, lang: 'ja', word: 'ねこ', sources: ['jmdict'] },
    ];

    render(
      <ResultList
        items={items}
        offset={50}
        totalApprox={100}
        pageSize={50}
        query="test"
        searching={false}
        onPageChange={onPageChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: /prev/i }));

    expect(onPageChange).toHaveBeenCalledWith(0);
  });
});
