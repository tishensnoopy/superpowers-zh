import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import TeamPage from '../TeamPage';

vi.mock('../../../lib/api', () => ({
  getTeachers: vi.fn(),
}));

import { getTeachers } from '../../../lib/api';

const makeTeacher = (id: number, name: string) => ({
  id,
  attributes: {
    name,
    slug: `slug-${id}`,
    title: `${name}职称`,
    subject: 'pinyin',
    teachingYears: 10,
    education: `${name}的教育背景`,
    teachingFeatures: `${name}的教学特色`,
    achievements: [`${name}荣誉`],
    campus: { data: { id, attributes: { name: '朝阳校区', slug: 'chaoyang' } } },
  },
});

describe('TeamPage 页面', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('加载中显示 loading', () => {
    vi.mocked(getTeachers).mockReturnValue(new Promise(() => {}));
    render(<TeamPage />);
    expect(screen.getByText(/加载中/)).toBeInTheDocument();
  });

  it('加载成功后渲染标题"师资团队"', async () => {
    vi.mocked(getTeachers).mockResolvedValueOnce({
      data: [makeTeacher(1, '张老师')],
    } as any);
    render(<TeamPage />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '师资团队' })).toBeInTheDocument();
    });
  });

  it('加载成功后渲染教师卡片', async () => {
    vi.mocked(getTeachers).mockResolvedValueOnce({
      data: [makeTeacher(1, '张老师'), makeTeacher(2, '李老师')],
    } as any);
    render(<TeamPage />);
    await waitFor(() => {
      expect(screen.getByText('张老师')).toBeInTheDocument();
      expect(screen.getByText('李老师')).toBeInTheDocument();
    });
  });

  it('加载失败显示错误提示', async () => {
    vi.mocked(getTeachers).mockRejectedValueOnce(new Error('Network error'));
    render(<TeamPage />);
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: '加载失败' })
      ).toBeInTheDocument();
    });
  });

  it('渲染筛选器', async () => {
    vi.mocked(getTeachers).mockResolvedValueOnce({ data: [] } as any);
    render(<TeamPage />);
    await waitFor(() => {
      expect(screen.getByText('校区')).toBeInTheDocument();
      expect(screen.getByText('科目')).toBeInTheDocument();
    });
  });

  it('空数据不崩溃', async () => {
    vi.mocked(getTeachers).mockResolvedValueOnce({ data: [] } as any);
    render(<TeamPage />);
    await waitFor(() => {
      expect(screen.getByText(/暂无教师数据/)).toBeInTheDocument();
    });
  });

  it('切换校区筛选触发重新加载', async () => {
    vi.mocked(getTeachers).mockResolvedValueOnce({
      data: [makeTeacher(1, '张老师')],
    } as any);
    render(<TeamPage />);
    await waitFor(() => {
      expect(screen.getByText('张老师')).toBeInTheDocument();
    });

    vi.mocked(getTeachers).mockResolvedValueOnce({
      data: [makeTeacher(2, '李老师')],
    } as any);
    fireEvent.click(screen.getByText('海淀'));

    await waitFor(() => {
      expect(getTeachers).toHaveBeenLastCalledWith(
        expect.objectContaining({ campusSlug: 'haidian' })
      );
    });
  });

  it('切换科目筛选触发重新加载', async () => {
    vi.mocked(getTeachers).mockResolvedValueOnce({
      data: [makeTeacher(1, '张老师')],
    } as any);
    render(<TeamPage />);
    await waitFor(() => {
      expect(screen.getByText('张老师')).toBeInTheDocument();
    });

    vi.mocked(getTeachers).mockResolvedValueOnce({
      data: [makeTeacher(2, '王老师')],
    } as any);
    fireEvent.click(screen.getByText('数学'));

    await waitFor(() => {
      expect(getTeachers).toHaveBeenLastCalledWith(
        expect.objectContaining({ subject: 'math' })
      );
    });
  });

  it('点击教师卡片展开详情', async () => {
    vi.mocked(getTeachers).mockResolvedValueOnce({
      data: [makeTeacher(1, '张老师')],
    } as any);
    render(<TeamPage />);
    await waitFor(() => {
      expect(screen.getByText('张老师')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('张老师'));
    expect(screen.getByText('教育背景')).toBeInTheDocument();
    expect(screen.getByText(/张老师的教育背景/)).toBeInTheDocument();
  });

  it('渲染统计数据条', async () => {
    vi.mocked(getTeachers).mockResolvedValueOnce({ data: [] } as any);
    render(<TeamPage />);
    await waitFor(() => {
      expect(screen.getByText('50+ 专业教师')).toBeInTheDocument();
      expect(screen.getByText('8 校区覆盖')).toBeInTheDocument();
      expect(screen.getByText('10年+ 平均教龄')).toBeInTheDocument();
      expect(screen.getByText('98% 家长好评')).toBeInTheDocument();
    });
  });
});
