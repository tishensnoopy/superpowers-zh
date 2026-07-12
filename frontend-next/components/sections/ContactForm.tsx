'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar } from 'lucide-react';
import type { Section } from '@/lib/api';
import { createAppointment } from '@/lib/api';

const LOG_PREFIX = '[ContactForm]';
const CAMPUSES = [
  { value: 'chaoyang', label: '朝阳校区' },
  { value: 'haidian', label: '海淀校区' },
  { value: 'xicheng', label: '西城校区' },
  { value: 'fengtai', label: '丰台校区' },
];

const COURSES = [
  { value: 'language', label: '语言启蒙' },
  { value: 'math', label: '数学思维' },
  { value: 'english', label: '英语口语' },
  { value: 'comprehensive', label: '综合素养' },
];

const TIME_SLOTS = [
  { value: 'morning', label: '上午' },
  { value: 'afternoon', label: '下午' },
  { value: 'evening', label: '晚上' },
];

function log(stage: string, message: string, data?: unknown) {
  const timestamp = new Date().toISOString();
  if (data !== undefined) {
    console.log(`${LOG_PREFIX} [${stage}] ${timestamp} ${message}`, data);
  } else {
    console.log(`${LOG_PREFIX} [${stage}] ${timestamp} ${message}`);
  }
}

function logError(stage: string, message: string, error?: unknown) {
  const timestamp = new Date().toISOString();
  if (error !== undefined) {
    console.error(`${LOG_PREFIX} [${stage}] ${timestamp} ${message}`, error);
  } else {
    console.error(`${LOG_PREFIX} [${stage}] ${timestamp} ${message}`);
  }
}

function classifyError(err: unknown): { type: string; userMessage: string; statusCode?: number } {
  if (!(err instanceof Error)) {
    return { type: 'unknown', userMessage: '提交失败，请稍后重试' };
  }

  const msg = err.message;

  if (msg.includes('429')) {
    return { type: 'rate_limit', userMessage: '提交过于频繁，请稍后再试', statusCode: 429 };
  }
  if (msg.includes('Network') || msg.includes('Failed to fetch') || msg.includes('network')) {
    return { type: 'network', userMessage: '网络连接失败，请检查网络后重试' };
  }
  if (msg.includes('400')) {
    return { type: 'bad_request', userMessage: '提交信息有误，请检查后重试', statusCode: 400 };
  }
  if (msg.includes('401') || msg.includes('403')) {
    return { type: 'auth', userMessage: '没有提交权限，请刷新页面后重试', statusCode: 401 };
  }
  if (msg.includes('500') || msg.includes('502') || msg.includes('503')) {
    return { type: 'server', userMessage: '服务器暂时不可用，请稍后重试', statusCode: 500 };
  }

  return { type: 'unknown', userMessage: '提交失败，请稍后重试' };
}

export default function ContactForm({ section }: { section: Section }) {
  const { title, description, submitText } = section;
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const handleFieldChange = (name: string, value: string) => {
    log('input', `字段变更: ${name}, 值长度: ${value.length}`);
    setValues(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => { const next = { ...prev }; delete next[name]; return next; });
    }
  };

  const validate = (): boolean => {
    log('validate', '开始表单校验', { name: !!values.name, phone: !!values.phone, campus: !!values.campus });

    const newErrors: Record<string, string> = {};
    let valid = true;

    if (!values.name) {
      newErrors.name = '请输入预约姓名';
      log('validate', '校验失败: name 为空');
      valid = false;
    }

    if (!values.phone) {
      newErrors.phone = '请输入预约电话';
      log('validate', '校验失败: phone 为空');
      valid = false;
    } else if (!/^1[3-9]\d{9}$/.test(values.phone)) {
      newErrors.phone = '手机号格式不正确';
      log('validate', `校验失败: phone 格式错误 (长度: ${values.phone.length})`);
      valid = false;
    }

    if (!values.campus) {
      newErrors.campus = '请选择校区';
      log('validate', '校验失败: campus 未选择');
      valid = false;
    }

    setErrors(newErrors);
    log('validate', `校验结束, 结果: ${valid ? '通过' : '失败'}, 错误数: ${Object.keys(newErrors).length}`, valid ? undefined : newErrors);
    return valid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    log('submit', '用户点击提交按钮');

    if (!validate()) {
      log('submit', '校验未通过，终止提交');
      return;
    }

    setSubmitting(true);
    log('submit', '校验通过，准备提交');

    const submitData = {
      name: values.name || '',
      phone: values.phone || '',
      campus: values.campus || '',
      age: values.age || undefined,
      course: values.course || undefined,
      preferredTimeSlot: values.preferredTimeSlot || undefined,
      message: values.message || undefined,
    };

    const payloadSize = JSON.stringify(submitData).length;
    log('submit', `提交数据准备完成, payload 大小: ${payloadSize} bytes`, submitData);

    const startTime = performance.now();
    log('api', '开始调用 createAppointment API...');

    try {
      const result = await createAppointment(submitData);
      const duration = Math.round(performance.now() - startTime);

      log('api', `API 调用成功, 耗时: ${duration}ms`, result);
      log('navigation', '准备跳转到成功页, state keys:', Object.keys(submitData));

      router.push('/appointment-success');

      log('submit', '✅ 提交流程完成 (成功)');
    } catch (err) {
      const duration = Math.round(performance.now() - startTime);
      const classified = classifyError(err);

      logError('api', `API 调用失败, 耗时: ${duration}ms, 错误类型: ${classified.type}, 状态码: ${classified.statusCode || 'N/A'}`);
      logError('api', '错误详情:', err);
      logError('submit', `提交失败数据: ${JSON.stringify(submitData)}`);

      if (err instanceof Error) {
        logError('api', `错误消息: ${err.message}`);
        logError('api', `错误堆栈: ${err.stack}`);
      }

      setErrors({ submit: classified.userMessage });
      log('submit', `❌ 提交流程完成 (失败), 展示给用户的错误: ${classified.userMessage}`);
    } finally {
      log('submit', '清理提交状态, submitting -> false');
      setSubmitting(false);
    }
  };

  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-[#1C2B3A]">
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(135deg, rgba(28,43,58,0.96) 0%, rgba(245,133,31,0.3) 100%)' }}
        />
      </div>
      <div className="relative max-w-[1000px] mx-auto px-8">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-white/80 text-sm mb-6">
            <Calendar size={14} />
            预约试听
          </div>
          <h2
            className="text-white mb-4"
            style={{ fontFamily: "'Nunito', 'Noto Sans SC', sans-serif", fontSize: '2.25rem', fontWeight: 800 }}
          >
            {title || '预约免费试听'}
          </h2>
          <p className="text-white/70 text-base">{description || '填写下方表单，我们将尽快联系您'}</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="lg:w-[33.33%] bg-gradient-to-br from-[#F5851F] via-[#FF6B35] to-[#FF8C42] rounded-2xl p-8 text-white relative overflow-hidden">
            <div className="absolute -top-20 -right-20 w-48 h-48 bg-white/10 rounded-full" />
            <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-white/8 rounded-full" />

            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">🎓</span>
                </div>
                <div>
                  <h4 className="text-xl font-bold">启航幼小教育</h4>
                  <p className="text-sm opacity-80">专注幼小衔接8年</p>
                </div>
              </div>

              <h5 className="text-lg font-bold mb-4">为什么选择我们？</h5>
              <div className="space-y-4 mb-6">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-sm">👨‍🏫</span>
                  </div>
                  <div>
                    <p className="font-bold text-sm">专业师资团队</p>
                    <p className="text-xs opacity-80">8年教学经验，持证上岗</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-sm">🏠</span>
                  </div>
                  <div>
                    <p className="font-bold text-sm">安全舒适环境</p>
                    <p className="text-xs opacity-80">监控全覆盖，营养配餐</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-sm">📚</span>
                  </div>
                  <div>
                    <p className="font-bold text-sm">个性化课程定制</p>
                    <p className="text-xs opacity-80">根据孩子特点定制方案</p>
                  </div>
                </div>
              </div>

              <div className="bg-white/15 rounded-xl p-4 mb-6">
                <div className="flex justify-between text-center">
                  <div>
                    <div className="text-2xl font-bold">3000+</div>
                    <div className="text-xs opacity-80">服务家庭</div>
                  </div>
                  <div className="w-px bg-white/30" />
                  <div>
                    <div className="text-2xl font-bold">98%</div>
                    <div className="text-xs opacity-80">满意度</div>
                  </div>
                  <div className="w-px bg-white/30" />
                  <div>
                    <div className="text-2xl font-bold">4</div>
                    <div className="text-xs opacity-80">校区</div>
                  </div>
                </div>
              </div>

              <div className="bg-white/20 rounded-lg p-3 border-l-4 border-white">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🎉</span>
                  <div>
                    <p className="font-bold text-sm">本月报名享9折</p>
                    <p className="text-xs opacity-90">名额有限，先到先得！</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:w-[66.67%] bg-white rounded-2xl p-8 shadow-xl">
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="name" className="block text-gray-800 text-sm font-semibold mb-2">
                    预约姓名 <span className="text-[#F5851F] ml-1">*</span>
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={values.name || ''}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                    placeholder="请输入预约姓名"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-[#F5851F] transition-colors"
                    style={{ borderColor: errors.name ? '#DC2626' : 'rgba(0,0,0,0.1)' }}
                  />
                  {errors.name && <p className="text-[#DC2626] text-xs mt-1">{errors.name}</p>}
                </div>

                <div>
                  <label htmlFor="phone" className="block text-gray-800 text-sm font-semibold mb-2">
                    预约电话 <span className="text-[#F5851F] ml-1">*</span>
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    value={values.phone || ''}
                    onChange={(e) => handleFieldChange('phone', e.target.value)}
                    placeholder="请输入手机号码"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-[#F5851F] transition-colors"
                    style={{ borderColor: errors.phone ? '#DC2626' : 'rgba(0,0,0,0.1)' }}
                  />
                  {errors.phone && <p className="text-[#DC2626] text-xs mt-1">{errors.phone}</p>}
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="campus" className="block text-gray-800 text-sm font-semibold mb-2">
                    选择校区 <span className="text-[#F5851F] ml-1">*</span>
                  </label>
                  <select
                    id="campus"
                    value={values.campus || ''}
                    onChange={(e) => handleFieldChange('campus', e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-[#F5851F] transition-colors"
                    style={{ borderColor: errors.campus ? '#DC2626' : 'rgba(0,0,0,0.1)' }}
                  >
                    <option value="">请选择校区</option>
                    {CAMPUSES.map((campus) => (
                      <option key={campus.value} value={campus.value}>{campus.label}</option>
                    ))}
                  </select>
                  {errors.campus && <p className="text-[#DC2626] text-xs mt-1">{errors.campus}</p>}
                </div>

                <div>
                  <label htmlFor="age" className="block text-gray-800 text-sm font-semibold mb-2">
                    孩子年龄
                  </label>
                  <input
                    id="age"
                    type="number"
                    min="3"
                    max="12"
                    value={values.age || ''}
                    onChange={(e) => handleFieldChange('age', e.target.value)}
                    placeholder="选填"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-[#F5851F] transition-colors"
                    style={{ borderColor: 'rgba(0,0,0,0.1)' }}
                  />
                </div>

                <div>
                  <label htmlFor="course" className="block text-gray-800 text-sm font-semibold mb-2">
                    意向课程
                  </label>
                  <select
                    id="course"
                    value={values.course || ''}
                    onChange={(e) => handleFieldChange('course', e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-[#F5851F] transition-colors"
                    style={{ borderColor: 'rgba(0,0,0,0.1)' }}
                  >
                    <option value="">选填</option>
                    {COURSES.map((course) => (
                      <option key={course.value} value={course.value}>{course.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="preferredTimeSlot" className="block text-gray-800 text-sm font-semibold mb-2">
                    期望时段
                  </label>
                  <select
                    id="preferredTimeSlot"
                    value={values.preferredTimeSlot || ''}
                    onChange={(e) => handleFieldChange('preferredTimeSlot', e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-[#F5851F] transition-colors"
                    style={{ borderColor: 'rgba(0,0,0,0.1)' }}
                  >
                    <option value="">选填</option>
                    {TIME_SLOTS.map((slot) => (
                      <option key={slot.value} value={slot.value}>{slot.label}</option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="message" className="block text-gray-800 text-sm font-semibold mb-2">
                    备注
                  </label>
                  <textarea
                    id="message"
                    value={values.message || ''}
                    onChange={(e) => handleFieldChange('message', e.target.value)}
                    placeholder="选填，如有特殊需求请在此说明"
                    rows={2}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-[#F5851F] transition-colors"
                    style={{ borderColor: 'rgba(0,0,0,0.1)' }}
                  />
                </div>
              </div>

              {errors.submit && <p className="text-[#DC2626] text-sm mt-4 text-center">{errors.submit}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-6 py-4 rounded-xl text-white font-bold text-base shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #F5851F, #FF6B35)' }}
              >
                {submitting ? '提交中...' : (submitText || '立即预约')}
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
