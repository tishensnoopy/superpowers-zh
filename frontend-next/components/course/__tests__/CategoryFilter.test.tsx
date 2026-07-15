import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CategoryFilter from '@/components/course/CategoryFilter';

const mockCategories = [
  { id: 1, slug: 'pinyin', name: '拼音' },
  { id: 2, slug: 'math', name: '数学' },
  { id: 3, slug: 'english', name: '英语' },
];

describe('CategoryFilter 组件', () => {
  it('渲染"全部"按钮和 categories 按钮', () => {
    render(<CategoryFilter categories={mockCategories} selected={null} onChange={() => {}} />);
    expect(screen.getByText('全部')).toBeInTheDocument();
    expect(screen.getByText('拼音')).toBeInTheDocument();
    expect(screen.getByText('数学')).toBeInTheDocument();
    expect(screen.getByText('英语')).toBeInTheDocument();
  });

  it('selected=null 时"全部"按钮高亮', () => {
    render(<CategoryFilter categories={mockCategories} selected={null} onChange={() => {}} />);
    const allButton = screen.getByText('全部');
    expect(allButton).toHaveClass('text-white');
  });

  it('selected=slug 时对应按钮高亮', () => {
    render(<CategoryFilter categories={mockCategories} selected="math" onChange={() => {}} />);
    const mathButton = screen.getByText('数学');
    expect(mathButton).toHaveClass('text-white');
    // "全部"此时不高亮
    const allButton = screen.getByText('全部');
    expect(allButton).not.toHaveClass('text-white');
  });

  it('点击分类按钮触发 onChange', () => {
    const onChange = vi.fn();
    render(<CategoryFilter categories={mockCategories} selected={null} onChange={onChange} />);
    fireEvent.click(screen.getByText('数学'));
    expect(onChange).toHaveBeenCalledWith('math');
  });

  it('点击"全部"触发 onChange(null)', () => {
    const onChange = vi.fn();
    render(
      <CategoryFilter categories={mockCategories} selected="math" onChange={onChange} />
    );
    fireEvent.click(screen.getByText('全部'));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
