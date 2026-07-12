import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TeacherCard from '../TeacherCard';

const mockTeacher = {
  id: 1,
  attributes: {
    name: '张老师',
    slug: 'zhang-laoshi',
    title: '高级教师',
    subject: 'pinyin',
    teachingYears: 10,
    campus: { data: { id: 1, attributes: { name: '朝阳校区', slug: 'chaoyang' } } },
  },
};

describe('TeacherCard 组件', () => {
  it('渲染教师姓名', () => {
    render(<TeacherCard teacher={mockTeacher as any} />);
    expect(screen.getByText('张老师')).toBeInTheDocument();
  });

  it('渲染教师职称', () => {
    render(<TeacherCard teacher={mockTeacher as any} />);
    expect(screen.getByText('高级教师')).toBeInTheDocument();
  });

  it('渲染科目中文标签', () => {
    render(<TeacherCard teacher={mockTeacher as any} />);
    expect(screen.getByText('拼音')).toBeInTheDocument();
  });

  it('渲染校区名称', () => {
    render(<TeacherCard teacher={mockTeacher as any} />);
    expect(screen.getByText('朝阳校区')).toBeInTheDocument();
  });

  it('渲染教龄', () => {
    render(<TeacherCard teacher={mockTeacher as any} />);
    expect(screen.getByText(/10\s*年教龄/)).toBeInTheDocument();
  });

  it('无头像时显示姓名首字', () => {
    render(<TeacherCard teacher={mockTeacher as any} />);
    expect(screen.getByText('张')).toBeInTheDocument();
  });

  it('有头像时渲染头像图片', () => {
    const withAvatar = {
      id: 2,
      attributes: {
        ...mockTeacher.attributes,
        avatar: { data: { attributes: { url: '/uploads/avatar.jpg' } } },
      },
    };
    render(<TeacherCard teacher={withAvatar as any} />);
    const img = screen.getByRole('img', { name: '张老师' });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', expect.stringContaining('avatar.jpg'));
  });

  it('数学科目映射为中文', () => {
    const mathTeacher = {
      id: 3,
      attributes: { ...mockTeacher.attributes, subject: 'math' },
    };
    render(<TeacherCard teacher={mathTeacher as any} />);
    expect(screen.getByText('数学')).toBeInTheDocument();
  });

  it('英语科目映射为中文', () => {
    const englishTeacher = {
      id: 4,
      attributes: { ...mockTeacher.attributes, subject: 'english' },
    };
    render(<TeacherCard teacher={englishTeacher as any} />);
    expect(screen.getByText('英语')).toBeInTheDocument();
  });

  it('综合素养科目映射为中文', () => {
    const compTeacher = {
      id: 5,
      attributes: { ...mockTeacher.attributes, subject: 'comprehensive' },
    };
    render(<TeacherCard teacher={compTeacher as any} />);
    expect(screen.getByText('综合素养')).toBeInTheDocument();
  });

  it('缺失校区数据时不崩溃', () => {
    const noCampus = {
      id: 6,
      attributes: { name: '李老师', slug: 'li', title: '教师', subject: 'math' },
    };
    render(<TeacherCard teacher={noCampus as any} />);
    expect(screen.getByText('李老师')).toBeInTheDocument();
  });

  it('缺失 teachingYears 时不崩溃', () => {
    const noYears = {
      id: 7,
      attributes: { name: '王老师', slug: 'wang', title: '教师', subject: 'english' },
    };
    render(<TeacherCard teacher={noYears as any} />);
    expect(screen.getByText('王老师')).toBeInTheDocument();
  });

  it('缺失 subject 时不渲染科目标签', () => {
    const noSubject = {
      id: 8,
      attributes: { name: '赵老师', slug: 'zhao', title: '教师' },
    };
    render(<TeacherCard teacher={noSubject as any} />);
    expect(screen.queryByText('拼音')).not.toBeInTheDocument();
    expect(screen.queryByText('数学')).not.toBeInTheDocument();
  });

  it('点击卡片触发 onSelect 回调', () => {
    const onSelect = vi.fn();
    render(<TeacherCard teacher={mockTeacher as any} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('张老师'));
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it('选中状态下有选中样式标识', () => {
    const { container } = render(
      <TeacherCard teacher={mockTeacher as any} isSelected onSelect={() => {}} />
    );
    expect(container.firstChild).toHaveClass('ring-2');
  });
});
