import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TeamFilter from '@/components/team/TeamFilter';

describe('TeamFilter 组件', () => {
  it('渲染校区筛选的"全部"选项', () => {
    render(
      <TeamFilter
        onCampusChange={() => {}}
        onSubjectChange={() => {}}
      />
    );
    expect(screen.getAllByText('全部').length).toBeGreaterThanOrEqual(2);
  });

  it('渲染 8 个校区选项', () => {
    render(
      <TeamFilter
        onCampusChange={() => {}}
        onSubjectChange={() => {}}
      />
    );
    expect(screen.getByText('朝阳')).toBeInTheDocument();
    expect(screen.getByText('海淀')).toBeInTheDocument();
    expect(screen.getByText('西城')).toBeInTheDocument();
    expect(screen.getByText('丰台')).toBeInTheDocument();
    expect(screen.getByText('东城')).toBeInTheDocument();
    expect(screen.getByText('石景山')).toBeInTheDocument();
    expect(screen.getByText('通州')).toBeInTheDocument();
    expect(screen.getByText('昌平')).toBeInTheDocument();
  });

  it('渲染 4 个科目选项', () => {
    render(
      <TeamFilter
        onCampusChange={() => {}}
        onSubjectChange={() => {}}
      />
    );
    expect(screen.getByText('拼音')).toBeInTheDocument();
    expect(screen.getByText('数学')).toBeInTheDocument();
    expect(screen.getByText('英语')).toBeInTheDocument();
    expect(screen.getByText('综合素养')).toBeInTheDocument();
  });

  it('点击校区选项触发 onCampusChange', () => {
    const onCampusChange = vi.fn();
    render(
      <TeamFilter
        onCampusChange={onCampusChange}
        onSubjectChange={() => {}}
      />
    );
    fireEvent.click(screen.getByText('海淀'));
    expect(onCampusChange).toHaveBeenCalledWith('haidian');
  });

  it('点击"全部"校区触发 onCampusChange(null)', () => {
    const onCampusChange = vi.fn();
    render(
      <TeamFilter
        campusSlug="chaoyang"
        onCampusChange={onCampusChange}
        onSubjectChange={() => {}}
      />
    );
    const allButtons = screen.getAllByText('全部');
    fireEvent.click(allButtons[0]);
    expect(onCampusChange).toHaveBeenCalledWith(null);
  });

  it('点击科目选项触发 onSubjectChange', () => {
    const onSubjectChange = vi.fn();
    render(
      <TeamFilter
        onCampusChange={() => {}}
        onSubjectChange={onSubjectChange}
      />
    );
    fireEvent.click(screen.getByText('数学'));
    expect(onSubjectChange).toHaveBeenCalledWith('math');
  });

  it('点击"全部"科目触发 onSubjectChange(null)', () => {
    const onSubjectChange = vi.fn();
    render(
      <TeamFilter
        subject="math"
        onCampusChange={() => {}}
        onSubjectChange={onSubjectChange}
      />
    );
    const allButtons = screen.getAllByText('全部');
    fireEvent.click(allButtons[1]);
    expect(onSubjectChange).toHaveBeenCalledWith(null);
  });

  it('选中校区有选中样式', () => {
    render(
      <TeamFilter
        campusSlug="chaoyang"
        onCampusChange={() => {}}
        onSubjectChange={() => {}}
      />
    );
    const chip = screen.getByText('朝阳');
    expect(chip).toHaveClass('bg-[#F5851F]');
    expect(chip).toHaveClass('text-white');
  });

  it('选中科目有选中样式', () => {
    render(
      <TeamFilter
        subject="english"
        onCampusChange={() => {}}
        onSubjectChange={() => {}}
      />
    );
    const chip = screen.getByText('英语');
    expect(chip).toHaveClass('bg-[#F5851F]');
    expect(chip).toHaveClass('text-white');
  });

  it('未选中的"全部"校区有默认样式', () => {
    render(
      <TeamFilter
        campusSlug="chaoyang"
        onCampusChange={() => {}}
        onSubjectChange={() => {}}
      />
    );
    const allChip = screen.getAllByText('全部')[0];
    expect(allChip).not.toHaveClass('bg-[#F5851F]');
  });

  it('默认选中校区"全部"', () => {
    render(
      <TeamFilter
        onCampusChange={() => {}}
        onSubjectChange={() => {}}
      />
    );
    const allChip = screen.getAllByText('全部')[0];
    expect(allChip).toHaveClass('bg-[#F5851F]');
  });

  it('默认选中科目"全部"', () => {
    render(
      <TeamFilter
        onCampusChange={() => {}}
        onSubjectChange={() => {}}
      />
    );
    const allChip = screen.getAllByText('全部')[1];
    expect(allChip).toHaveClass('bg-[#F5851F]');
  });
});
