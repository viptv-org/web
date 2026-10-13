// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {describe, it, expect, vi} from 'vitest';
import {LinkTv} from './LinkTv';
describe('TV code entry', () => {
  it('shows the current numeric example and preserves leading zeroes on submit', () => {
    const onCode = vi.fn(); render(<LinkTv onCode={onCode}/>);
    const input = screen.getByLabelText('Code'); expect(input).toHaveAttribute('placeholder', '00123456'); expect(input).toHaveAttribute('maxLength', '10');
    fireEvent.change(input, {target: {value: '00123456'}}); fireEvent.click(screen.getByRole('button', {name: 'Link TV'}));
    expect(onCode).toHaveBeenCalledWith('00123456'); expect(input).toHaveValue('00123456');
  });
  it('accepts a ten-character legacy hexadecimal code and normalizes its case', () => {
    const onCode = vi.fn(); render(<LinkTv onCode={onCode}/>);
    fireEvent.change(screen.getByLabelText('Code'), {target: {value: '00ab12cd3f'}}); fireEvent.click(screen.getByRole('button', {name: 'Link TV'}));
    expect(onCode).toHaveBeenCalledWith('00AB12CD3F');
  });
  it('rejects the retired alphanumeric example rather than silently changing the code', () => {
    const onCode = vi.fn(); render(<LinkTv onCode={onCode}/>);
    for (const value of ['ABCD1234', 'G012345678', '0012!3456']) {
      fireEvent.change(screen.getByLabelText('Code'), {target: {value}}); fireEvent.click(screen.getByRole('button', {name: 'Link TV'}));
      expect(screen.getByRole('alert')).toHaveTextContent('Enter 8 digits, or a 10-character code using 0–9 and A–F.');
    }
    expect(onCode).not.toHaveBeenCalled();
  });
});
