import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CourseOutline from '../CourseOutline';

const mockOutline = [
  { id: 1, title: '第 1-12 课：基础词汇', description: '通过绘本认识基础汉字和词语', lessonCount: 12 },
  { id: 2, title: '第 13-24 课：句子表达', description: '学习完整句子的构造和表达', lessonCount: 12 },
  { id: 3, title: '第 25-36 课：故事阅读', description: '阅读简单故事并复述', lessonCount: 12 },
  { id: 4, title: '第 37-48 课：综合应用', description: '综合运用语言能力', lessonCount: 12 },
];

describe('CourseOutline 组件', () => {
  it('渲染区块标题', () => {
    render(<CourseOutline outline={mockOutline} />);
    expect(screen.getByRole('heading', { name: '课程大纲' })).toBeInTheDocument();
  });

  it('渲染所有大纲模块', () => {
    render(<CourseOutline outline={mockOutline} />);
    expect(screen.getByText('第 1-12 课：基础词汇')).toBeInTheDocument();
    expect(screen.getByText('第 13-24 课：句子表达')).toBeInTheDocument();
    expect(screen.getByText('第 25-36 课：故事阅读')).toBeInTheDocument();
    expect(screen.getByText('第 37-48 课：综合应用')).toBeInTheDocument();
  });

  it('渲染课时数', () => {
    render(<CourseOutline outline={mockOutline} />);
    expect(screen.getAllByText(/12 课时/)).toHaveLength(4);
  });

  it('渲染模块描述', () => {
    render(<CourseOutline outline={mockOutline} />);
    expect(screen.getByText('通过绘本认识基础汉字和词语')).toBeInTheDocument();
  });

  it('空数组时显示空状态占位符', () => {
    render(<CourseOutline outline={[]} />);
    expect(screen.getByText('课程大纲内容更新中，敬请期待')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '课程大纲' })).toBeInTheDocument();
  });

  it('outline 为 undefined 时显示空状态占位符', () => {
    render(<CourseOutline outline={undefined as any} />);
    expect(screen.getByText('课程大纲内容更新中，敬请期待')).toBeInTheDocument();
  });

  it('lessonCount 为 0 时不显示课时数', () => {
    const zeroCount = [{ id: 1, title: '测试模块', description: '描述', lessonCount: 0 }];
    render(<CourseOutline outline={zeroCount as any} />);
    expect(screen.getByText('测试模块')).toBeInTheDocument();
    expect(screen.queryByText(/课时/)).not.toBeInTheDocument();
  });
});
