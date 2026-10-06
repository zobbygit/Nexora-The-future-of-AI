import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../src/components/ui/Button';
import { Pagination, Tabs, Switch, ConfirmModal } from '../src/components/ui/primitives';
import { toast, useUi } from '../src/store/ui';

describe('Button', () => {
  it('fires onClick and respects disabled/loading', async () => {
    const onClick = jest.fn();
    const { rerender } = render(<Button onClick={onClick}>Go</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(<Button onClick={onClick} loading>Go</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
    rerender(<Button onClick={onClick} disabled>Go</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('Pagination', () => {
  it('navigates with next/prev and numbered pages', async () => {
    const onChange = jest.fn();
    render(<Pagination page={2} pages={5} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onChange).toHaveBeenLastCalledWith(3);
    await userEvent.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(onChange).toHaveBeenLastCalledWith(1);
    await userEvent.click(screen.getByRole('button', { name: '5' }));
    expect(onChange).toHaveBeenLastCalledWith(5);
    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-current', 'page');
  });
  it('disables bounds and hides itself for a single page', () => {
    const { rerender, container } = render(<Pagination page={1} pages={3} onChange={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    rerender(<Pagination page={3} pages={3} onChange={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
    rerender(<Pagination page={1} pages={1} onChange={jest.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('Tabs & Switch', () => {
  it('switches tabs and reports selection', async () => {
    const onChange = jest.fn();
    render(<Tabs tabs={[{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta', count: 3 }]} value="a" onChange={onChange} />);
    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(screen.getByRole('tab', { name: /Beta/ }));
    expect(onChange).toHaveBeenCalledWith('b');
  });
  it('toggles a switch', async () => {
    const onChange = jest.fn();
    render(<Switch checked={false} onChange={onChange} label="Maintenance" />);
    await userEvent.click(screen.getByRole('switch', { name: 'Maintenance' }));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe('ConfirmModal', () => {
  it('confirms and cancels', async () => {
    const onConfirm = jest.fn(), onClose = jest.fn();
    render(<ConfirmModal open onClose={onClose} onConfirm={onConfirm} title="Delete?" body="Sure?" confirmLabel="Yes, delete" danger />);
    await userEvent.click(await screen.findByRole('button', { name: 'Yes, delete' }));
    expect(onConfirm).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('toast store', () => {
  it('queues toasts, caps the stack, and dismisses', () => {
    useUi.setState({ toasts: [] });
    for (let i = 0; i < 6; i++) toast.info(`t${i}`);
    expect(useUi.getState().toasts.length).toBeLessThanOrEqual(4);
    const id = useUi.getState().toasts[0].id;
    useUi.getState().dismiss(id);
    expect(useUi.getState().toasts.find((t) => t.id === id)).toBeUndefined();
  });
  it('persists sidebar collapse per area', () => {
    useUi.setState({ collapsed: { app: false, admin: false } });
    useUi.getState().toggleCollapsed('app');
    expect(useUi.getState().collapsed).toEqual({ app: true, admin: false });
  });
});
