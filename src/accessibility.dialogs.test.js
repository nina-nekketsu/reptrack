import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Dialog from './components/ui/Dialog';

function DialogHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open confirm</button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Rotate coach link"
        description="The current coach link will stop working immediately."
      >
        <button type="button">Cancel</button>
        <button type="button">Rotate link</button>
      </Dialog>
    </>
  );
}

describe('shared dialog accessibility contract', () => {
  test('traps focus, closes with Escape, locks scroll and returns trigger focus', async () => {
    render(<DialogHarness />);
    const trigger = screen.getByRole('button', { name: /open confirm/i });

    await userEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: /rotate coach link/i });

    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(document.body.style.overflow).toBe('hidden');
    expect(screen.getByRole('button', { name: /cancel/i })).toHaveFocus();

    await userEvent.tab();
    expect(screen.getByRole('button', { name: /rotate link/i })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: /cancel/i })).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: /rotate coach link/i })).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('');
    expect(trigger).toHaveFocus();
  });
});
