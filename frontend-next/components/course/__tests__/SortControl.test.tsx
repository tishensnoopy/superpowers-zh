import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SortControl from '@/components/course/SortControl';

describe('SortControl 组件', () => {
  it('渲染 4 个选项', () => {
    render(<SortControl value={null} onChange={() => {}} />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.options).toHaveLength(4);
    expect(screen.getByText('默认排序')).toBeInTheDocument();
    expect(screen.getByText('名称 A-Z')).toBeInTheDocument();
    expect(screen.getByText('价格从低到高')).toBeInTheDocument();
    expect(screen.getByText('价格从高到低')).toBeInTheDocument();
  });

  it('value=null 时选中"默认排序"', () => {
    render(<SortControl value={null} onChange={() => {}} />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('');
  });

  it('value="price:asc" 时选中"价格从低到高"', () => {
    render(<SortControl value="price:asc" onChange={() => {}} />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('price:asc');
  });

  it('切换选项触发 onChange', () => {
    const onChange = vi.fn();
    render(<SortControl value={null} onChange={onChange} />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'price:desc' } });
    expect(onChange).toHaveBeenCalledWith('price:desc');
  });

  it('切换到"默认排序"触发 onChange(null)', () => {
    const onChange = vi.fn();
    render(<SortControl value="name:asc" onChange={onChange} />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
