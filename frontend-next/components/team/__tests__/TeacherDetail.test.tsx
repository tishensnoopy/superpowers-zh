import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TeacherDetail from '@/components/team/TeacherDetail';

const mockTeacher = {
  id: 1,
  name: '张老师',
  slug: 'zhang-laoshi',
  title: '高级教师',
  subject: 'pinyin',
  teachingYears: 10,
  education: '华中师范大学教育学硕士',
  teachingFeatures: '擅长拼音启蒙，善于用游戏化教学激发孩子兴趣',
  achievements: ['武汉市优秀教师', '拼音教学大赛一等奖', '骨干教师称号'],
  campus: { id: 1, name: '百步亭校区', slug: 'yousen-baibuting' },
};

describe('TeacherDetail 组件', () => {
  it('渲染教师姓名', () => {
    render(<TeacherDetail teacher={mockTeacher as any} onClose={() => {}} />);
    expect(screen.getByText('张老师')).toBeInTheDocument();
  });

  it('渲染教师职称', () => {
    render(<TeacherDetail teacher={mockTeacher as any} onClose={() => {}} />);
    expect(screen.getByText('高级教师')).toBeInTheDocument();
  });

  it('渲染教育背景', () => {
    render(<TeacherDetail teacher={mockTeacher as any} onClose={() => {}} />);
    expect(screen.getByText(/华中师范大学教育学硕士/)).toBeInTheDocument();
  });

  it('渲染教学特色', () => {
    render(<TeacherDetail teacher={mockTeacher as any} onClose={() => {}} />);
    expect(screen.getByText(/擅长拼音启蒙/)).toBeInTheDocument();
  });

  it('渲染荣誉成就标签', () => {
    render(<TeacherDetail teacher={mockTeacher as any} onClose={() => {}} />);
    expect(screen.getByText('武汉市优秀教师')).toBeInTheDocument();
    expect(screen.getByText('拼音教学大赛一等奖')).toBeInTheDocument();
    expect(screen.getByText('骨干教师称号')).toBeInTheDocument();
  });

  it('无头像时显示姓名首字', () => {
    render(<TeacherDetail teacher={mockTeacher as any} onClose={() => {}} />);
    expect(screen.getByText('张')).toBeInTheDocument();
  });

  it('有头像时渲染大头像图片', () => {
    const withAvatar = {
      ...mockTeacher,
      avatar: { url: '/uploads/big-avatar.jpg' },
    };
    render(<TeacherDetail teacher={withAvatar as any} onClose={() => {}} />);
    const img = screen.getByRole('img', { name: '张老师' });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', expect.stringContaining('big-avatar.jpg'));
  });

  it('点击关闭按钮触发 onClose 回调', () => {
    const onClose = vi.fn();
    render(<TeacherDetail teacher={mockTeacher as any} onClose={onClose} />);
    const closeBtn = screen.getByRole('button', { name: /关闭|收起/ });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('渲染教育背景区块标题', () => {
    render(<TeacherDetail teacher={mockTeacher as any} onClose={() => {}} />);
    expect(screen.getByText('教育背景')).toBeInTheDocument();
  });

  it('渲染教学特色区块标题', () => {
    render(<TeacherDetail teacher={mockTeacher as any} onClose={() => {}} />);
    expect(screen.getByText('教学特色')).toBeInTheDocument();
  });

  it('渲染荣誉成就区块标题', () => {
    render(<TeacherDetail teacher={mockTeacher as any} onClose={() => {}} />);
    expect(screen.getByText(/荣誉成就|获得荣誉/)).toBeInTheDocument();
  });

  it('缺失教育背景时不崩溃', () => {
    const noEdu = {
      id: 3,
      name: '李老师',
      slug: 'li',
      title: '教师',
    };
    render(<TeacherDetail teacher={noEdu as any} onClose={() => {}} />);
    expect(screen.getByText('李老师')).toBeInTheDocument();
  });

  it('缺失教学特色时不崩溃', () => {
    const noFeatures = {
      id: 4,
      name: '王老师',
      slug: 'wang',
      title: '教师',
    };
    render(<TeacherDetail teacher={noFeatures as any} onClose={() => {}} />);
    expect(screen.getByText('王老师')).toBeInTheDocument();
  });

  it('缺失荣誉成就时不崩溃', () => {
    const noAch = {
      id: 5,
      name: '赵老师',
      slug: 'zhao',
      title: '教师',
    };
    render(<TeacherDetail teacher={noAch as any} onClose={() => {}} />);
    expect(screen.getByText('赵老师')).toBeInTheDocument();
  });

  it('空荣誉成就数组时不崩溃', () => {
    const emptyAch = {
      ...mockTeacher,
      achievements: [],
    };
    render(<TeacherDetail teacher={emptyAch as any} onClose={() => {}} />);
    expect(screen.getByText('张老师')).toBeInTheDocument();
  });

  it('非数组荣誉成就时不崩溃', () => {
    const weirdAch = {
      ...mockTeacher,
      achievements: '不是数组' as any,
    };
    render(<TeacherDetail teacher={weirdAch as any} onClose={() => {}} />);
    expect(screen.getByText('张老师')).toBeInTheDocument();
  });

  it('渲染教龄信息', () => {
    render(<TeacherDetail teacher={mockTeacher as any} onClose={() => {}} />);
    expect(screen.getByText(/10\s*年教龄/)).toBeInTheDocument();
  });
});
