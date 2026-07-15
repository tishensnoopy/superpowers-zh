import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TeamGrid from '@/components/team/TeamGrid';

const makeTeacher = (id: number, name: string, subject: string = 'pinyin') => ({
  id,
  name,
  slug: `slug-${id}`,
  title: `${name}职称`,
  subject,
  teachingYears: id + 5,
  education: `${name}的教育背景`,
  teachingFeatures: `${name}的教学特色`,
  achievements: [`${name}荣誉1`, `${name}荣誉2`],
  campus: { id, name: '百步亭校区', slug: 'yousen-baibuting' },
});

const mockTeachers = [
  makeTeacher(1, '张老师'),
  makeTeacher(2, '李老师', 'math'),
  makeTeacher(3, '王老师', 'english'),
  makeTeacher(4, '赵老师', 'comprehensive'),
];

describe('TeamGrid 组件', () => {
  it('渲染所有教师卡片', () => {
    render(<TeamGrid teachers={mockTeachers as any} onSelect={() => {}} />);
    expect(screen.getByText('张老师')).toBeInTheDocument();
    expect(screen.getByText('李老师')).toBeInTheDocument();
    expect(screen.getByText('王老师')).toBeInTheDocument();
    expect(screen.getByText('赵老师')).toBeInTheDocument();
  });

  it('空数组显示空状态提示', () => {
    render(<TeamGrid teachers={[]} onSelect={() => {}} />);
    expect(screen.getByText(/暂无教师数据/)).toBeInTheDocument();
  });

  it('teachers 为 undefined 时不崩溃且显示空状态', () => {
    render(<TeamGrid teachers={undefined as any} onSelect={() => {}} />);
    expect(screen.getByText(/暂无教师数据/)).toBeInTheDocument();
  });

  it('点击卡片触发 onSelect 回调', () => {
    const onSelect = vi.fn();
    render(<TeamGrid teachers={mockTeachers as any} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('张老师'));
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it('未选中任何教师时不渲染详情面板', () => {
    render(
      <TeamGrid teachers={mockTeachers as any} selectedId={null} onSelect={() => {}} onClose={() => {}} />
    );
    expect(screen.queryByText('教育背景')).not.toBeInTheDocument();
  });

  it('选中教师时渲染详情面板', () => {
    render(
      <TeamGrid
        teachers={mockTeachers as any}
        selectedId={1}
        onSelect={() => {}}
        onClose={() => {}}
      />
    );
    expect(screen.getByText('教育背景')).toBeInTheDocument();
    expect(screen.getByText(/张老师的教育背景/)).toBeInTheDocument();
  });

  it('详情面板的关闭按钮触发 onClose', () => {
    const onClose = vi.fn();
    render(
      <TeamGrid
        teachers={mockTeachers as any}
        selectedId={2}
        onSelect={() => {}}
        onClose={onClose}
      />
    );
    const closeBtn = screen.getByRole('button', { name: /关闭|收起/ });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('切换选中教师时详情面板内容更新', () => {
    const { rerender } = render(
      <TeamGrid
        teachers={mockTeachers as any}
        selectedId={1}
        onSelect={() => {}}
        onClose={() => {}}
      />
    );
    expect(screen.getByText(/张老师的教育背景/)).toBeInTheDocument();

    rerender(
      <TeamGrid
        teachers={mockTeachers as any}
        selectedId={3}
        onSelect={() => {}}
        onClose={() => {}}
      />
    );
    expect(screen.getByText(/王老师的教育背景/)).toBeInTheDocument();
  });

  it('selectedId 不匹配任何教师时不渲染详情面板', () => {
    render(
      <TeamGrid
        teachers={mockTeachers as any}
        selectedId={999}
        onSelect={() => {}}
        onClose={() => {}}
      />
    );
    expect(screen.queryByText('教育背景')).not.toBeInTheDocument();
  });

  it('单个教师也能正常渲染', () => {
    render(<TeamGrid teachers={[makeTeacher(1, '唯一老师')] as any} onSelect={() => {}} />);
    expect(screen.getByText('唯一老师')).toBeInTheDocument();
  });
});
