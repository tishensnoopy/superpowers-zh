import { useLocation, Link } from 'react-router-dom';
import { CheckCircle, Phone, Calendar, ArrowLeft } from 'lucide-react';

export default function AppointmentSuccess() {
  const location = useLocation();
  const appointmentData = (location.state as any)?.appointment || {};

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
                  <p className="text-xs text-muted-foreground">孩子姓名</p>
                  <p className="font-semibold text-[#1C2B3A]">{appointmentData.childName || '未填写'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#ECFDF5] flex items-center justify-center">
                  <Phone size={16} className="text-[#059669]" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">联系电话</p>
                  <p className="font-semibold text-[#1C2B3A]">{appointmentData.phone || '未填写'}</p>
                </div>
              </div>
              {appointmentData.course && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#F5F3FF] flex items-center justify-center">
                    <span className="text-[#7C3AED] text-sm font-bold">📚</span>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">感兴趣的课程</p>
                    <p className="font-semibold text-[#1C2B3A]">{appointmentData.course}</p>
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
              to="/"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-white font-semibold"
              style={{ background: 'linear-gradient(135deg, #F5851F, #FF6B35)' }}
            >
              返回首页
            </Link>
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-xl text-[#1C2B3A] font-semibold border border-border hover:bg-muted transition-colors"
            >
              <ArrowLeft size={16} />
              继续了解课程
            </Link>
          </div>
        </div>

        <p className="text-center text-muted-foreground text-sm mt-8">
          © 2026 启航幼小教育集团 · 沪ICP备2024XXXXXXX号
        </p>
      </div>
    </div>
  );
}
