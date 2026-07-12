import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CourseObjectives from '../CourseObjectives';

const mockObjectives = [
  { id: 1, title: '掌握 500+ 词汇量', description: '通过绘本和游戏积累基础词汇' },
  { id: 2, title: '提升表达能力', description: '能完整叙述简单故事' },
  { id: 3, title: '培养阅读兴趣', description: '养成自主阅读习惯' },
];

describe('CourseObjectives 组件', () => {
  it('渲染区块标题', () => {
    render(<CourseObjectives objectives={mockObjectives} />);
    expect(screen.getByRole('heading', { name: '学习目标' })).toBeInTheDocument();
  });

  it('渲染所有目标项', () => {
    render(<CourseObjectives objectives={mockObjectives} />);
    expect(screen.getByText('掌握 500+ 词汇量')).toBeInTheDocument();
    expect(screen.getByText('提升表达能力')).toBeInTheDocument();
    expect(screen.getByText('培养阅读兴趣')).toBeInTheDocument();
  });

  it('渲染目标描述', () => {
    render(<CourseObjectives objectives={mockObjectives} />);
    expect(screen.getByText('通过绘本和游戏积累基础词汇')).toBeInTheDocument();
  });

  it('空数组时显示空状态占位符', () => {
    render(<CourseObjectives objectives={[]} />);
    expect(screen.getByText('学习目标内容更新中，敬请期待')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '学习目标' })).toBeInTheDocument();
  });

  it('objectives 为 undefined 时显示空状态占位符', () => {
    render(<CourseObjectives objectives={undefined as any} />);
    expect(screen.getByText('学习目标内容更新中，敬请期待')).toBeInTheDocument();
  });

  it('目标项无 description 时不崩溃', () => {
    const noDesc = [{ id: 1, title: '无描述目标' }];
    render(<CourseObjectives objectives={noDesc as any} />);
    expect(screen.getByText('无描述目标')).toBeInTheDocument();
  });
});
