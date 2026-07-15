import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders as render, screen, fireEvent } from '../../../test/test-utils';
import Pagination from '../Pagination';

describe('Pagination 组件', () => {
  it('pageCount <= 1 时不渲染', () => {
    const { container } = render(<Pagination page={1} pageCount={1} onChange={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('pageCount=0 时不渲染', () => {
    const { container } = render(<Pagination page={1} pageCount={0} onChange={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('渲染正确的页码按钮', () => {
    render(<Pagination page={1} pageCount={5} onChange={() => {}} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('当前页高亮', () => {
    render(<Pagination page={3} pageCount={5} onChange={() => {}} />);
    const page3 = screen.getByText('3');
    expect(page3).toHaveClass('text-white');
  });

  it('点击页码触发 onChange', () => {
    const onChange = vi.fn();
    render(<Pagination page={1} pageCount={5} onChange={onChange} />);
    fireEvent.click(screen.getByText('3'));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('上一页按钮在 page=1 时禁用', () => {
    render(<Pagination page={1} pageCount={5} onChange={() => {}} />);
    const prevButton = screen.getByRole('button', { name: /上一页/ });
    expect(prevButton).toBeDisabled();
  });

  it('下一页按钮在 page=pageCount 时禁用', () => {
    render(<Pagination page={5} pageCount={5} onChange={() => {}} />);
    const nextButton = screen.getByRole('button', { name: /下一页/ });
    expect(nextButton).toBeDisabled();
  });

  it('点击上一页触发 onChange', () => {
    const onChange = vi.fn();
    render(<Pagination page={3} pageCount={5} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /上一页/ }));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('点击下一页触发 onChange', () => {
    const onChange = vi.fn();
    render(<Pagination page={3} pageCount={5} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /下一页/ }));
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('页码超过 7 个时显示省略号和首尾页', () => {
    render(<Pagination page={10} pageCount={20} onChange={() => {}} />);
    // 首页
    expect(screen.getByText('1')).toBeInTheDocument();
    // 尾页
    expect(screen.getByText('20')).toBeInTheDocument();
    // 当前页 ± 1
    expect(screen.getByText('9')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('11')).toBeInTheDocument();
    // 省略号
    const ellipses = screen.getAllByText('...');
    expect(ellipses.length).toBeGreaterThanOrEqual(1);
  });

  it('当前页在首页附近时不显示左侧省略号', () => {
    render(<Pagination page={2} pageCount={20} onChange={() => {}} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    // 右侧省略号存在
    const ellipses = screen.getAllByText('...');
    expect(ellipses.length).toBeGreaterThanOrEqual(1);
  });
});
