import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders as render, screen, fireEvent } from '../../../test/test-utils';
import SearchBar from '../SearchBar';

describe('SearchBar 组件', () => {
  it('渲染输入框和搜索图标', () => {
    render(<SearchBar value="" onChange={() => {}} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    // 搜索图标存在（lucide-react Search icon 渲染为 svg）
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('显示传入的 value', () => {
    render(<SearchBar value="数学课程" onChange={() => {}} />);
    expect(screen.getByDisplayValue('数学课程')).toBeInTheDocument();
  });

  it('输入时触发 onChange', () => {
    const onChange = vi.fn();
    render(<SearchBar value="" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '拼音' } });
    expect(onChange).toHaveBeenCalledWith('拼音');
  });

  it('使用自定义 placeholder', () => {
    render(<SearchBar value="" onChange={() => {}} placeholder="输入课程名称" />);
    expect(screen.getByPlaceholderText('输入课程名称')).toBeInTheDocument();
  });

  it('未传 placeholder 时使用默认值', () => {
    render(<SearchBar value="" onChange={() => {}} />);
    expect(screen.getByPlaceholderText('搜索课程...')).toBeInTheDocument();
  });
});
