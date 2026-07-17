'use client';

import { useState, useEffect } from 'react';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { CheckCircle, Phone, Calendar, ArrowLeft, AlertCircle } from 'lucide-react';
import type { AppointmentData } from '@/lib/api';

const CAMPUS_LABELS: Record<string, string> = {
  'yousen-baibuting': 'campusBaibuting',
  'yousen-sanyanglu': 'campusSanyanglu',
  'yousen-dongwuyuan': 'campusDongwuyuan',
  'yousen-zhongjiacun': 'campusZhongjiacun',
  'yousen-sixin': 'campusSixin',
  'yousen-zhuankou': 'campusZhuankou',
};

const COURSE_LABELS: Record<string, string> = {
  'yousen-youxiao-xianjie': 'courseFullClass',
  'yousen-kehao-tuoguan': 'courseAfterSchool',
  'yousen-tuoban': 'courseFullTimeDaycare',
};

const TIME_SLOT_LABELS: Record<string, string> = {
  morning: 'morning',
  afternoon: 'afternoon',
  evening: 'evening',
};

export default function AppointmentSuccessPage() {
  const [appointment, setAppointment] = useState<AppointmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const t = useTranslations('appointment');
  const tCommon = useTranslations('common');
  const tContact = useTranslations('contact');

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('lastAppointment');
      if (raw) {
        const parsed = JSON.parse(raw) as AppointmentData;
        setAppointment(parsed);
        // 读取后立即清除，防止刷新重复展示
        sessionStorage.removeItem('lastAppointment');
      }
    } catch (err) {
      console.error('[AppointmentSuccess] 读取 sessionStorage 失败:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#F5851F] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">{t('verifying')}</p>
        </div>
      </div>
    );
  }

  // 没有预约数据，显示访问受限页面
  if (!appointment) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FFF3E5] to-[#FFFCF8] py-24">
        <div className="max-w-[600px] mx-auto px-8">
          <div className="bg-white rounded-3xl shadow-xl p-10 text-center">
            <div className="w-20 h-20 rounded-full bg-[#FEF2F2] flex items-center justify-center mx-auto mb-6">
              <AlertCircle size={40} className="text-[#DC2626]" />
            </div>
            <h1
              className="text-[#1C2B3A] mb-4"
              style={{ fontFamily: "'Nunito', 'Noto Sans SC', sans-serif", fontSize: '2rem', fontWeight: 800 }}
            >
              {t('accessRestricted')}
            </h1>
            <p className="text-muted-foreground text-lg mb-8">
              {t('accessRestrictedDesc')}
            </p>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-white font-semibold"
              style={{ background: 'linear-gradient(135deg, #F5851F, #FF6B35)' }}
            >
              {t('backToHomeToBook')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FFF3E5] to-[#FFFCF8] py-24">
      <div className="max-w-[600px] mx-auto px-8">
        <div className="bg-white rounded-3xl shadow-xl p-10 text-center">
          <div className="w-20 h-20 rounded-full bg-[#ECFDF5] flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={40} className="text-[#059669]" />
          </div>

          <h1
            className="text-[#1C2B3A] mb-4"
            style={{ fontFamily: "'Nunito', 'Noto Sans SC', sans-serif", fontSize: '2rem', fontWeight: 800 }}
          >
            {t('successTitle')}
          </h1>

          <p className="text-muted-foreground text-lg mb-8">
            {t('successMessage')}
          </p>

          <div className="bg-[#F8F9FF] rounded-2xl p-6 mb-8 text-left">
            <h3
              className="text-[#1C2B3A] mb-4 text-center"
              style={{ fontFamily: "'Nunito', 'Noto Sans SC', sans-serif", fontWeight: 700 }}
            >
              {t('appointmentInfo')}
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#EFF6FF] flex items-center justify-center">
                  <Calendar size={16} className="text-[#2563EB]" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('parentNameLabel')}</p>
                  <p className="font-semibold text-[#1C2B3A]">{appointment.parentName || appointment.name || tCommon('notFilled')}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#ECFDF5] flex items-center justify-center">
                  <Phone size={16} className="text-[#059669]" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('phoneLabel')}</p>
                  <p className="font-semibold text-[#1C2B3A]">{appointment.phone || tCommon('notFilled')}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#F5F3FF] flex items-center justify-center">
                  <span className="text-[#7C3AED] text-sm font-bold">🏢</span>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('campusLabel')}</p>
                  <p className="font-semibold text-[#1C2B3A]">
                    {CAMPUS_LABELS[appointment.campus] ? t(CAMPUS_LABELS[appointment.campus]) : (appointment.campus || tCommon('notFilled'))}
                  </p>
                </div>
              </div>
              {appointment.age && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#FEF3C7] flex items-center justify-center">
                    <span className="text-[#D97706] text-sm font-bold">📅</span>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t('ageLabel')}</p>
                    <p className="font-semibold text-[#1C2B3A]">{appointment.age} {t('yearsOld')}</p>
                  </div>
                </div>
              )}
              {appointment.course && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#FCE7F3] flex items-center justify-center">
                    <span className="text-[#DB2777] text-sm font-bold">📚</span>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t('courseLabel')}</p>
                    <p className="font-semibold text-[#1C2B3A]">
                      {COURSE_LABELS[appointment.course] ? t(COURSE_LABELS[appointment.course]) : appointment.course}
                    </p>
                  </div>
                </div>
              )}
              {appointment.preferredTimeSlot && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#E0F2FE] flex items-center justify-center">
                    <span className="text-[#0284C7] text-sm font-bold">⏰</span>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t('preferredTimeSlotLabel')}</p>
                    <p className="font-semibold text-[#1C2B3A]">
                      {TIME_SLOT_LABELS[appointment.preferredTimeSlot] ? t(TIME_SLOT_LABELS[appointment.preferredTimeSlot]) : appointment.preferredTimeSlot}
                    </p>
                  </div>
                </div>
              )}
              {appointment.message && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#F1F5F9] flex items-center justify-center flex-shrink-0">
                    <span className="text-[#475569] text-sm font-bold">📝</span>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t('messageLabel')}</p>
                    <p className="font-semibold text-[#1C2B3A]">{appointment.message}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-[#FFF3E5] rounded-xl p-4 mb-8">
            <p className="text-sm text-[#F5851F]">
              {t('hotlinePrompt')}<span className="font-bold">{tContact('hotlineValue')}</span>
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-white font-semibold"
              style={{ background: 'linear-gradient(135deg, #F5851F, #FF6B35)' }}
            >
              {tCommon('backToHome')}
            </Link>
            <Link
              href="/courses"
              className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-xl text-[#1C2B3A] font-semibold border border-border hover:bg-muted transition-colors"
            >
              <ArrowLeft size={16} />
              {t('continueBrowsingCourses')}
            </Link>
          </div>
        </div>

        <p className="text-center text-muted-foreground text-sm mt-8">
          {t('copyright')}
        </p>
      </div>
    </div>
  );
}
