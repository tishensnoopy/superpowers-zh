import { Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function CourseCTA({ courseName }: { courseName: string }) {
  return (
    <section className="py-16" style={{ background: 'linear-gradient(135deg, #F5851F, #FF6B35)' }}>
      <div className="max-w-[1400px] mx-auto px-8 text-center">
        <h2
          className="text-white mb-4"
          style={{
            fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
            fontSize: '2rem',
            fontWeight: 800,
          }}
        >
          预约免费试听{courseName ? <> — <span>{courseName}</span></> : ''}
        </h2>
        <p className="text-white/90 text-base mb-8 max-w-[480px] mx-auto">
          立即预约，让孩子体验专业、有趣的课程
        </p>
        <Link
          to={`/?course=${courseName}#appointment`}
          className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-white text-[#F5851F] font-bold text-base hover:bg-white/90 transition-colors duration-200 shadow-lg"
        >
          <Calendar size={20} />
          立即预约
        </Link>
      </div>
    </section>
  );
}
