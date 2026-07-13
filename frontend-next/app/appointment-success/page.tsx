'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { CheckCircle, Phone, Calendar, ArrowLeft, AlertCircle } from 'lucide-react';
import type { AppointmentData } from '@/lib/api';

const CAMPUS_LABELS: Record<string, string> = {
  'yousen-baibuting': '百步亭校区',
  'yousen-sanyanglu': '三阳路校区',
  'yousen-dongwuyuan': '动物园校区',
  'yousen-zhongjiacun': '钟家村校区',
  'yousen-sixin': '四新校区',
  'yousen-zhuankou': '沌口校区',
};

const COURSE_LABELS: Record<string, string> = {
  'yousen-youxiao-xianjie': '幼小衔接全能班',
  'yousen-kehao-tuoguan': '课后托管班',
  'yousen-tuoban': '全日制托班',
};

const TIME_SLOT_LABELS: Record<string, string> = {
  morning: '上午',
  afternoon: '下午',
  evening: '晚上',
};

export default function AppointmentSuccessPage() {
  const [appointment, setAppointment] = useState<AppointmentData | null>(null);
  const [loading, setLoading] = useState(true);

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
          <p className="text-muted-foreground">验证中...</p>
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
              访问受限
            </h1>
            <p className="text-muted-foreground text-lg mb-8">
              请通过预约表单提交预约信息，我们将为您安排试听课程。
            </p>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-white font-semibold"
              style={{ background: 'linear-gradient(135deg, #F5851F, #FF6B35)' }}
            >
              返回首页预约
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
            预约成功！
          </h1>

          <p className="text-muted-foreground text-lg mb-8">
            感谢您的信任！我们将在 <span className="font-semibold text-[#F5851F]">24 小时内</span> 联系您确认试听时间。
          </p>

          <div className="bg-[#F8F9FF] rounded-2xl p-6 mb-8 text-left">
            <h3
              className="text-[#1C2B3A] mb-4 text-center"
              style={{ fontFamily: "'Nunito', 'Noto Sans SC', sans-serif", fontWeight: 700 }}
            >
              预约信息
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#EFF6FF] flex items-center justify-center">
                  <Calendar size={16} className="text-[#2563EB]" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">预约姓名</p>
                  <p className="font-semibold text-[#1C2B3A]">{appointment.name || '未填写'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#ECFDF5] flex items-center justify-center">
                  <Phone size={16} className="text-[#059669]" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">联系电话</p>
                  <p className="font-semibold text-[#1C2B3A]">{appointment.phone || '未填写'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#F5F3FF] flex items-center justify-center">
                  <span className="text-[#7C3AED] text-sm font-bold">🏢</span>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">选择校区</p>
                  <p className="font-semibold text-[#1C2B3A]">
                    {CAMPUS_LABELS[appointment.campus] || appointment.campus || '未填写'}
                  </p>
                </div>
              </div>
              {appointment.age && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#FEF3C7] flex items-center justify-center">
                    <span className="text-[#D97706] text-sm font-bold">📅</span>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">孩子年龄</p>
                    <p className="font-semibold text-[#1C2B3A]">{appointment.age} 岁</p>
                  </div>
                </div>
              )}
              {appointment.course && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#FCE7F3] flex items-center justify-center">
                    <span className="text-[#DB2777] text-sm font-bold">📚</span>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">意向课程</p>
                    <p className="font-semibold text-[#1C2B3A]">
                      {COURSE_LABELS[appointment.course] || appointment.course}
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
                    <p className="text-xs text-muted-foreground">期望时段</p>
                    <p className="font-semibold text-[#1C2B3A]">
                      {TIME_SLOT_LABELS[appointment.preferredTimeSlot] || appointment.preferredTimeSlot}
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
                    <p className="text-xs text-muted-foreground">备注</p>
                    <p className="font-semibold text-[#1C2B3A]">{appointment.message}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-[#FFF3E5] rounded-xl p-4 mb-8">
            <p className="text-sm text-[#F5851F]">
              如果您有任何疑问，请拨打客服热线：<span className="font-bold">400-888-8888</span>
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-white font-semibold"
              style={{ background: 'linear-gradient(135deg, #F5851F, #FF6B35)' }}
            >
              返回首页
            </Link>
            <Link
              href="/courses"
              className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-xl text-[#1C2B3A] font-semibold border border-border hover:bg-muted transition-colors"
            >
              <ArrowLeft size={16} />
              继续了解课程
            </Link>
          </div>
        </div>

        <p className="text-center text-muted-foreground text-sm mt-8">
          © 2026 佑森小课堂
        </p>
      </div>
    </div>
  );
}
