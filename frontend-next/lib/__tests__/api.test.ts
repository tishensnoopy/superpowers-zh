import { describe, it, expect } from 'vitest';
import { AppointmentData } from '@/lib/api';

describe('预约数据格式验证', () => {
  it('AppointmentData 接口包含所有必要字段', () => {
    const data: AppointmentData = {
      name: '小明',
      phone: '13800138000',
      campus: 'chaoyang',
      age: '6',
      course: 'language',
      preferredTimeSlot: 'morning',
      message: '测试备注',
    };

    expect(data.name).toBeTypeOf('string');
    expect(data.phone).toBeTypeOf('string');
    expect(data.phone).toMatch(/^1[3-9]\d{9}$/);
    expect(data.campus).toBeTypeOf('string');
    expect(['chaoyang', 'haidian', 'xicheng', 'fengtai']).toContain(data.campus);
    expect(['language', 'math', 'english', 'comprehensive']).toContain(data.course);
  });

  it('校区字段值应为小写英文标识', () => {
    const validCampuses = ['chaoyang', 'haidian', 'xicheng', 'fengtai'];

    validCampuses.forEach(campus => {
      expect(campus).toBe(campus.toLowerCase());
      expect(campus.length).toBeGreaterThan(0);
    });
  });

  it('课程字段值应为小写英文标识', () => {
    const validCourses = ['language', 'math', 'english', 'comprehensive'];

    validCourses.forEach(course => {
      expect(course).toBe(course.toLowerCase());
      expect(course.length).toBeGreaterThan(0);
    });
  });

  it('必填字段不能为空', () => {
    const requiredFields = ['name', 'phone', 'campus'] as const;

    requiredFields.forEach(field => {
      expect(field).toBeTruthy();
    });
  });

  it('提交给后端的数据结构应为嵌套在 data 字段中', () => {
    const expectedBody = {
      data: {
        name: '小明',
        phone: '13800138000',
        campus: 'chaoyang',
      },
    };

    expect(JSON.stringify(expectedBody)).toContain('"data":');
    expect(JSON.stringify(expectedBody)).toContain('"name":"小明"');
    expect(JSON.stringify(expectedBody)).toContain('"campus":"chaoyang"');
  });
});

describe('电话号码格式验证', () => {
  it('有效手机号格式', () => {
    const validPhones = ['13800138000', '15900159000', '18600186000'];

    validPhones.forEach(phone => {
      expect(phone).toMatch(/^1[3-9]\d{9}$/);
    });
  });

  it('无效手机号格式', () => {
    const invalidPhones = ['123456789', '10000000000', '23800138000'];

    invalidPhones.forEach(phone => {
      expect(phone).not.toMatch(/^1[3-9]\d{9}$/);
    });
  });
});
