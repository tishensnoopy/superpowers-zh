import { describe, it, expect } from 'vitest';
import { buildMigrationPlan } from '../migrate-to-manytomany';

// 模拟真实数据结构：teachers_campus_lnk 表的 join 结果
// 真实情况是 6 个教师 × 2 locale = 24 行，去重后应为 6 条唯一 junction 记录
const rawRows = [
  // 王老师 zh-CN → 百步亭
  { teacher_doc_id: 'b6qf0ps', teacher_name: '王老师', locale: 'zh-CN', campus_doc_id: 'ejrojq', campus_name: '百步亭校区' },
  // 王老师 en-US → Bai Buting（同一对，应去重）
  { teacher_doc_id: 'b6qf0ps', teacher_name: 'Teacher Wang', locale: 'en-US', campus_doc_id: 'ejrojq', campus_name: 'Bai Buting Campus' },
  // 李老师 zh-CN → 三阳路
  { teacher_doc_id: 'riacw7', teacher_name: '李老师', locale: 'zh-CN', campus_doc_id: 'xbz68g', campus_name: '三阳路校区' },
  // 李老师 en-US（同一对，应去重）
  { teacher_doc_id: 'riacw7', teacher_name: 'Teacher Li', locale: 'en-US', campus_doc_id: 'xbz68g', campus_name: 'Sanyang Road Campus' },
];

describe('buildMigrationPlan', () => {
  it('per-locale 重复行去重为唯一 junction 记录', () => {
    const plan = buildMigrationPlan(rawRows);

    // 4 行输入（2 教师 × 2 locale）→ 去重为 2 条唯一对
    expect(plan.stats.totalLnkRows).toBe(4);
    expect(plan.stats.uniquePairs).toBe(2);
    expect(plan.stats.dedupedLocales).toBe(2);
    expect(plan.campusTeacherLinks).toHaveLength(2);
  });

  it('按 (teacher.documentId, campus.documentId) 去重', () => {
    const plan = buildMigrationPlan(rawRows);
    const keys = plan.campusTeacherLinks.map(
      (l) => `${l.teacherDocumentId}::${l.campusDocumentId}`
    );
    // 不应有重复 key
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain('b6qf0ps::ejrojq');
    expect(keys).toContain('riacw7::xbz68g');
  });

  it('sortOrder 从 0 连续递增', () => {
    const plan = buildMigrationPlan(rawRows);
    const orders = plan.campusTeacherLinks.map((l) => l.sortOrder);
    expect(orders).toEqual([0, 1]);
  });

  it('status 全部为 active', () => {
    const plan = buildMigrationPlan(rawRows);
    for (const link of plan.campusTeacherLinks) {
      expect(link.status).toBe('active');
    }
  });

  it('空输入返回空计划', () => {
    const plan = buildMigrationPlan([]);
    expect(plan.campusTeacherLinks).toEqual([]);
    expect(plan.stats.totalLnkRows).toBe(0);
    expect(plan.stats.uniquePairs).toBe(0);
  });

  it('不同教师映射到同一校区时保留为独立记录', () => {
    const rows = [
      { teacher_doc_id: 't1', teacher_name: '教师A', locale: 'zh-CN', campus_doc_id: 'c1', campus_name: '校区X' },
      { teacher_doc_id: 't2', teacher_name: '教师B', locale: 'zh-CN', campus_doc_id: 'c1', campus_name: '校区X' },
    ];
    const plan = buildMigrationPlan(rows);
    expect(plan.campusTeacherLinks).toHaveLength(2);
    expect(plan.stats.uniquePairs).toBe(2);
  });

  it('同一教师映射到不同校区时保留为独立记录（多对多场景）', () => {
    const rows = [
      { teacher_doc_id: 't1', teacher_name: '教师A', locale: 'zh-CN', campus_doc_id: 'c1', campus_name: '校区X' },
      { teacher_doc_id: 't1', teacher_name: '教师A', locale: 'zh-CN', campus_doc_id: 'c2', campus_name: '校区Y' },
    ];
    const plan = buildMigrationPlan(rows);
    expect(plan.campusTeacherLinks).toHaveLength(2);
    expect(plan.stats.uniquePairs).toBe(2);
  });

  it('输出按 campus 名 + teacher 名排序（稳定可读）', () => {
    // 故意打乱输入顺序
    const shuffled = [
      { teacher_doc_id: 't2', teacher_name: '教师B', locale: 'zh-CN', campus_doc_id: 'c2', campus_name: '校区Z' },
      { teacher_doc_id: 't1', teacher_name: '教师A', locale: 'zh-CN', campus_doc_id: 'c1', campus_name: '校区A' },
    ];
    const plan = buildMigrationPlan(shuffled);
    expect(plan.campusTeacherLinks[0].campusName).toBe('校区A');
    expect(plan.campusTeacherLinks[1].campusName).toBe('校区Z');
  });
});
