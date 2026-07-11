import { useState } from 'react';
import { Calendar, Send } from 'lucide-react';
import type { Section } from '../../lib/api';
import { createAppointment } from '../../lib/api';

export default function ContactForm({ section }: { section: Section }) {
  const { title, description, submitText, successMessage, fields } = section;
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const fieldList = Array.isArray(fields) ? fields : (fields?.data || []);

  const handleFieldChange = (name: string, value: string) => {
    setValues(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => { const next = { ...prev }; delete next[name]; return next; });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    let valid = true;

    fieldList.forEach((field: any) => {
      const f = field.attributes || field;
      const value = values[f.name] || '';
      if (f.required && !value) {
        newErrors[f.name] = `请输入${f.label}`;
        valid = false;
      }
      if (f.type === 'phone' && value) {
        if (!/^1[3-9]\d{9}$/.test(value)) {
          newErrors[f.name] = '手机号格式不正确';
          valid = false;
        }
      }
    });

    setErrors(newErrors);
    return valid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setSuccess(false);
    try {
      await createAppointment({
        childName: values.childName || '',
        parentName: values.parentName || '',
        phone: values.phone || '',
        age: values.age,
        course: values.course || '',
        preferredTimeSlot: values.preferredTimeSlot,
        message: values.message,
      });
      setSuccess(true);
      setValues({});
    } catch (err) {
      setErrors({ submit: '提交失败，请稍后重试' });
    } finally {
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
      <div className="relative max-w-[800px] mx-auto px-8">
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

        {success ? (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 text-center border border-white/20">
            <div className="w-16 h-16 rounded-full bg-[#F5851F] flex items-center justify-center mx-auto mb-4">
              <Send size={28} className="text-white" />
            </div>
            <p className="text-white text-lg font-semibold">{successMessage || '预约成功！'}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {fieldList.map((field: any) => {
                const f = field.attributes || field;
                const error = errors[f.name];
                const options = f.options ? (typeof f.options === 'string' ? JSON.parse(f.options) : f.options) : [];

                return (
                  <div key={field.id} className={f.type === 'textarea' ? 'md:col-span-2' : ''}>
                    <label htmlFor={f.name} className="block text-white/80 text-sm mb-2">
                      {f.label}
                      {f.required && <span className="text-[#F5851F] ml-1">*</span>}
                    </label>
                    {f.type === 'select' ? (
                      <select
                        id={f.name}
                        value={values[f.name] || ''}
                        onChange={(e) => handleFieldChange(f.name, e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border bg-[#F8F9FF] text-sm focus:outline-none focus:border-[#F5851F] transition-colors"
                        style={{ borderColor: error ? '#DC2626' : 'rgba(255,255,255,0.2)' }}
                      >
                        <option value="">{f.placeholder || '请选择'}</option>
                        {Array.isArray(options) && options.map((opt: any, i: number) => {
                          const val = typeof opt === 'string' ? opt : opt.value;
                          const label = typeof opt === 'string' ? opt : opt.label;
                          return <option key={i} value={val}>{label}</option>;
                        })}
                      </select>
                    ) : f.type === 'textarea' ? (
                      <textarea
                        id={f.name}
                        value={values[f.name] || ''}
                        onChange={(e) => handleFieldChange(f.name, e.target.value)}
                        placeholder={f.placeholder}
                        rows={3}
                        className="w-full px-4 py-3 rounded-xl border bg-[#F8F9FF] text-sm focus:outline-none focus:border-[#F5851F] transition-colors"
                        style={{ borderColor: error ? '#DC2626' : 'rgba(255,255,255,0.2)' }}
                      />
                    ) : (
                      <input
                        id={f.name}
                        type={f.type === 'phone' ? 'tel' : 'text'}
                        value={values[f.name] || ''}
                        onChange={(e) => handleFieldChange(f.name, e.target.value)}
                        placeholder={f.placeholder}
                        className="w-full px-4 py-3 rounded-xl border bg-[#F8F9FF] text-sm focus:outline-none focus:border-[#F5851F] transition-colors"
                        style={{ borderColor: error ? '#DC2626' : 'rgba(255,255,255,0.2)' }}
                      />
                    )}
                    {error && <p className="text-[#FF6B6B] text-xs mt-1">{error}</p>}
                  </div>
                );
              })}
            </div>

            {errors.submit && <p className="text-[#FF6B6B] text-sm mt-4 text-center">{errors.submit}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-6 py-4 rounded-xl text-white font-bold text-base shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #F5851F, #FF6B35)' }}
            >
              {submitting ? '提交中...' : (submitText || '立即预约')}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
