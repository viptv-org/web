// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { ItemReview, selectedCounts, type ReviewItem } from './StremioReview';
afterEach(cleanup);
const counts = { favorites_to_add: 1, progress_to_add: 0, progress_to_update: 0, existing_preserved: 0, already_imported: 0 };
const items: ReviewItem[] = Array.from({ length: 120 }, (_, i) => ({ item_id: `synthetic_review_${i.toString().padStart(8, '0')}`, name: `Movie ${i.toString().padStart(3, '0')}`, type: 'movie', favorite_action: 'add', progress_action: 'none', status: 'ready', counts, selectable: true }));
function Review({ disabled = false }: { disabled?: boolean }) {
  const [excluded, setExcluded] = useState(new Set<string>());
  return <ItemReview items={items} excluded={excluded} onChange={setExcluded} disabled={disabled}/>;
}
describe('named Stremio review', () => {
  it('pages large previews and searches across all rows, not only the rendered page', () => {
    render(<Review/>);
    expect(screen.getByRole('checkbox', { name: 'Include Movie 000' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Include Movie 050' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next items' }));
    expect(screen.getByRole('checkbox', { name: 'Include Movie 050' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Find a title'), { target: { value: '119' } });
    expect(screen.getByRole('checkbox', { name: 'Include Movie 119' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Include Movie 050' })).not.toBeInTheDocument();
  });
  it('limits bulk exclusion to matching rows and can restore them from the excluded filter', () => {
    render(<Review/>);
    fireEvent.change(screen.getByLabelText('Find a title'), { target: { value: 'Movie 11' } });
    fireEvent.click(screen.getByRole('button', { name: 'Exclude matching' }));
    expect(screen.getByRole('checkbox', { name: 'Include Movie 119' })).not.toBeChecked();
    fireEvent.change(screen.getByLabelText('Find a title'), { target: { value: '' } });
    expect(screen.getByRole('checkbox', { name: 'Include Movie 000' })).toBeChecked();
    fireEvent.change(screen.getByLabelText('Show items'), { target: { value: 'excluded' } });
    expect(screen.getAllByRole('checkbox')).toHaveLength(10);
    fireEvent.click(screen.getByRole('button', { name: 'Include matching' }));
    expect(screen.getByText('No items match this filter.')).toBeInTheDocument();
  });
  it('subtracts only excluded row effects, retaining source and review counts', () => {
    const summary = { source_items: 140, ...counts, favorites_to_add: 120, needs_review: 20, skipped_items: 0 };
    const result = selectedCounts(summary, items, new Set([items[0].item_id, items[119].item_id]));
    expect(result.favorites_to_add).toBe(118); expect(result.source_items).toBe(140); expect(result.needs_review).toBe(20);
    expect(summary.favorites_to_add).toBe(120);
  });
  it('prevents scope changes when confirmation is in progress or its outcome is unknown', () => {
    render(<Review disabled/>);
    expect(screen.getByLabelText('Find a title')).toBeDisabled();
    expect(screen.getByLabelText('Show items')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Exclude all' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Include Movie 000' })).toBeDisabled();
  });
});
