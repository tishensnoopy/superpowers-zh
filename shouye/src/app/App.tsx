import { useState } from "react";
import {
  BookOpen,
  Users,
  Shield,
  Star,
  Phone,
  MapPin,
  Mail,
  Clock,
  ChevronRight,
  Menu,
  X,
  Award,
  GraduationCap,
  Heart,
  Sparkles,
  CheckCircle,
  CalendarDays,
  ArrowRight,
} from "lucide-react";

const NAV_LINKS = ["首页", "课程体系", "师资团队", "校区环境", "新闻动态", "联系我们"];

const ADVANTAGES = [
  {
    icon: GraduationCap,
    title: "专业师资",
    desc: "全部教师持有教师资格证，平均教龄8年以上，来自知名师范院校，专注幼小衔接领域深耕。",
    color: "#FF7043",
    bg: "#FFF3F0",
  },
  {
    icon: Users,
    title: "小班教学",
    desc: "每班严格控制在12人以内，师生比1:6，确保每个孩子都能获得充分的关注与个性化指导。",
    color: "#2563EB",
    bg: "#EFF6FF",
  },
  {
    icon: BookOpen,
    title: "全科衔接",
    desc: "语文、数学、英语、专注力全面覆盖，与小学课程体系无缝对接，让孩子入学零焦虑。",
    color: "#059669",
    bg: "#ECFDF5",
  },
  {
    icon: Shield,
    title: "安全陪护",
    desc: "全天候监控覆盖，双重门禁系统，专职安保人员，家长实时查看课堂，放心托管无后顾之忧。",
    color: "#7C3AED",
    bg: "#F5F3FF",
  },
];

const COURSES = [
  {
    icon: "🔤",
    title: "拼音识字",
    tag: "语文基础",
    tagColor: "#FF7043",
    tagBg: "#FFF3F0",
    desc: "系统学习汉语拼音，掌握声母韵母拼读规律，识字量达到小学一年级要求，为阅读打下坚实基础。",
    features: ["声母韵母系统讲解", "拼读规律强化训练", "常用字词记忆方法", "趣味阅读启蒙"],
    lessons: "48课时",
  },
  {
    icon: "🔢",
    title: "数学思维",
    tag: "逻辑培养",
    tagColor: "#2563EB",
    tagBg: "#EFF6FF",
    desc: "从数感启蒙到运算思维，培养孩子的数学逻辑能力，让孩子爱上数学，轻松面对小学数学挑战。",
    features: ["数感与运算基础", "图形与空间思维", "应用题理解训练", "趣味数学游戏"],
    lessons: "48课时",
  },
  {
    icon: "🧘",
    title: "专注力训练",
    tag: "习惯养成",
    tagColor: "#059669",
    tagBg: "#ECFDF5",
    desc: "通过科学的注意力训练课程，帮助孩子建立良好的学习专注习惯，课堂听讲能力全面提升。",
    features: ["注意力持续性训练", "课堂规则与礼仪", "自主学习习惯培养", "情绪管理引导"],
    lessons: "32课时",
  },
  {
    icon: "🌟",
    title: "综合衔接",
    tag: "全面发展",
    tagColor: "#7C3AED",
    tagBg: "#F5F3FF",
    desc: "语数英综合强化，配合入学适应训练，让孩子从心理到学习全面准备好，自信迎接小学新生活。",
    features: ["语数英综合强化", "入学心理适应", "书写姿势与习惯", "校园礼仪模拟"],
    lessons: "64课时",
  },
];

const PHOTOS = [
  {
    url: "https://images.unsplash.com/photo-1636202339022-7d67f7447e3a?w=600&h=400&fit=crop&auto=format",
    alt: "孩子们在教室里专注学习",
    caption: "专注课堂",
  },
  {
    url: "https://images.unsplash.com/photo-1586694680938-9682c9e1f736?w=600&h=400&fit=crop&auto=format",
    alt: "小女孩在写字练习",
    caption: "书写训练",
  },
  {
    url: "https://images.unsplash.com/photo-1617117206620-b01f2919ff86?w=600&h=400&fit=crop&auto=format",
    alt: "孩子们一起画画",
    caption: "艺术创作",
  },
  {
    url: "https://images.unsplash.com/photo-1709301264789-0f8392d72627?w=600&h=400&fit=crop&auto=format",
    alt: "小男孩认真写作业",
    caption: "独立作业",
  },
  {
    url: "https://images.unsplash.com/photo-1583468991267-3f068b607ae1?w=600&h=400&fit=crop&auto=format",
    alt: "老师与孩子互动学习",
    caption: "师生互动",
  },
  {
    url: "https://images.unsplash.com/photo-1587323655395-b1c77a12c89a?w=600&h=400&fit=crop&auto=format",
    alt: "孩子们愉快地涂色",
    caption: "快乐探索",
  },
];

const TEACHERS = [
  {
    name: "李晓慧",
    title: "语文主教老师",
    years: 10,
    specialty: "拼音识字 · 阅读理解",
    avatar: "https://images.unsplash.com/photo-1573496799652-408c2ac9fe98?w=200&h=200&fit=crop&auto=format",
    badge: "金牌教师",
  },
  {
    name: "张明远",
    title: "数学主教老师",
    years: 8,
    specialty: "数学思维 · 逻辑训练",
    avatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200&h=200&fit=crop&auto=format",
    badge: "优秀导师",
  },
  {
    name: "王雅婷",
    title: "专注力训练师",
    years: 6,
    specialty: "注意力训练 · 习惯养成",
    avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&h=200&fit=crop&auto=format",
    badge: "资深讲师",
  },
  {
    name: "陈思远",
    title: "综合课程主任",
    years: 12,
    specialty: "课程研发 · 英语启蒙",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&auto=format",
    badge: "课程总监",
  },
];

const NEWS = [
  {
    img: "https://images.unsplash.com/photo-1588075592446-265fd1e6e76f?w=600&h=360&fit=crop&auto=format",
    alt: "家长开放日活动",
    category: "校园活动",
    categoryColor: "#FF7043",
    date: "2026年6月18日",
    title: "2026年春季家长开放日圆满举办，近200位家长到场参观体验",
    desc: "本次开放日吸引了来自全市各地的家长参与，大家近距离感受了我们的教学环境和师资力量，获得了广泛好评。",
  },
  {
    img: "https://images.unsplash.com/photo-1554721299-e0b8aa7666ce?w=600&h=360&fit=crop&auto=format",
    alt: "数学思维竞赛",
    category: "学员成果",
    categoryColor: "#2563EB",
    date: "2026年5月30日",
    title: "我校学员在区级幼小衔接数学思维大赛中荣获团体一等奖",
    desc: "经过一学期的系统训练，我校12名学员参加区教育局举办的数学思维比赛，成绩优异，充分体现了教学质量。",
  },
  {
    img: "https://images.unsplash.com/photo-1567746455504-cb3213f8f5b8?w=600&h=360&fit=crop&auto=format",
    alt: "新校区开业",
    category: "校区动态",
    categoryColor: "#059669",
    date: "2026年5月10日",
    title: "星桥路新校区正式开放招生，环境更优质，设施更完善",
    desc: "全新星桥路校区建筑面积达1200㎡，配备专业音体美功能室及智能互动黑板，即日起开放免费参观预约。",
  },
];

const FOOTER_LINKS = {
  "课程体系": ["拼音识字课程", "数学思维课程", "专注力训练", "综合衔接课程"],
  "关于我们": ["机构简介", "师资团队", "校区环境", "荣誉资质"],
  "家长服务": ["在线预约", "家长社群", "常见问题", "学员反馈"],
};

export default function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div
      className="min-h-screen bg-background text-foreground"
      style={{ fontFamily: "'Noto Sans SC', sans-serif" }}
    >
      {/* ─── 1. NAVBAR ─── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-border shadow-sm">
        <div className="max-w-[1400px] mx-auto px-8 h-[72px] flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3 shrink-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg font-black shadow-sm"
              style={{ background: "linear-gradient(135deg, #F5851F, #FF6B35)" }}
            >
              小
            </div>
            <div>
              <div className="font-black text-[18px] leading-tight text-[#1C2B3A]" style={{ fontFamily: "'Nunito', sans-serif" }}>
                启航幼小
              </div>
              <div className="text-[10px] text-muted-foreground tracking-widest">EDUCATION</div>
            </div>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map((link, i) => (
              <a
                key={link}
                href="#"
                className={`px-4 py-2 text-sm rounded-lg transition-all duration-200 ${
                  i === 0
                    ? "text-[#F5851F] font-semibold bg-[#FFF3E5]"
                    : "text-[#4A5568] hover:text-[#F5851F] hover:bg-[#FFF3E5]"
                }`}
              >
                {link}
              </a>
            ))}
          </nav>

          {/* CTA */}
          <div className="flex items-center gap-3">
            <a
              href="tel:400-888-6688"
              className="hidden md:flex items-center gap-2 text-sm text-[#4A5568]"
            >
              <Phone size={15} className="text-[#F5851F]" />
              <span className="font-medium">400-888-6688</span>
            </a>
            <button
              className="hidden md:flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold shadow-md hover:shadow-lg transition-all duration-200 hover:scale-[1.03]"
              style={{ background: "linear-gradient(135deg, #F5851F, #FF6B35)" }}
            >
              <CalendarDays size={15} />
              预约免费试听
            </button>
            <button
              className="lg:hidden p-2 rounded-lg text-foreground"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-t border-border px-8 py-4 flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <a key={link} href="#" className="py-2.5 text-sm text-foreground hover:text-[#F5851F]">
                {link}
              </a>
            ))}
            <button
              className="mt-3 py-3 rounded-xl text-white text-sm font-semibold"
              style={{ background: "linear-gradient(135deg, #F5851F, #FF6B35)" }}
            >
              预约免费试听
            </button>
          </div>
        )}
      </header>

      {/* ─── 2. HERO ─── */}
      <section className="relative pt-[72px] min-h-screen flex items-center overflow-hidden">
        {/* Background image */}
        <div className="absolute inset-0 bg-[#1C2B3A]">
          <img
            src="https://images.unsplash.com/photo-1636202339022-7d67f7447e3a?w=1920&h=1080&fit=crop&auto=format"
            alt="孩子们在教室学习"
            className="w-full h-full object-cover opacity-30"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(105deg, rgba(28,43,58,0.96) 0%, rgba(28,43,58,0.80) 45%, rgba(245,133,31,0.25) 100%)",
            }}
          />
        </div>

        {/* Decorative shapes */}
        <div
          className="absolute top-24 right-0 w-[520px] h-[520px] rounded-full opacity-10 blur-3xl pointer-events-none"
          style={{ background: "#F5851F" }}
        />
        <div
          className="absolute bottom-0 left-1/3 w-[300px] h-[300px] rounded-full opacity-5 blur-2xl pointer-events-none"
          style={{ background: "#4ECDC4" }}
        />

        <div className="relative z-10 max-w-[1400px] mx-auto px-8 w-full">
          <div className="grid grid-cols-12 gap-6 items-center">
            <div className="col-span-12 lg:col-span-7">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-white/80 text-sm mb-8">
                <Sparkles size={14} className="text-[#F5851F]" />
                <span>2026年秋季班正在招生 · 名额有限</span>
              </div>

              <h1
                className="text-white leading-[1.2] mb-6"
                style={{
                  fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
                  fontSize: "clamp(2.4rem, 4vw, 3.6rem)",
                  fontWeight: 800,
                }}
              >
                让每个孩子
                <br />
                <span style={{ color: "#F5851F" }}>自信迈入</span>小学大门
              </h1>

              <p className="text-white/75 text-lg leading-relaxed mb-10 max-w-[520px]">
                专注幼小衔接教育8年，科学课程体系 + 专业师资团队，帮助3-6岁儿童在入学前全面准备，让孩子赢在起跑线。
              </p>

              {/* Stats row */}
              <div className="flex items-center gap-8 mb-10">
                {[
                  { num: "8年+", label: "专注幼教" },
                  { num: "3000+", label: "毕业学员" },
                  { num: "98%", label: "家长满意度" },
                  { num: "6所", label: "直营校区" },
                ].map((stat) => (
                  <div key={stat.label} className="text-center">
                    <div
                      className="text-2xl font-black text-white leading-none mb-1"
                      style={{ fontFamily: "'Nunito', sans-serif", color: "#F5851F" }}
                    >
                      {stat.num}
                    </div>
                    <div className="text-white/60 text-xs">{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* CTAs */}
              <div className="flex items-center gap-4 flex-wrap">
                <button
                  className="flex items-center gap-2 px-8 py-4 rounded-xl text-white font-bold text-base shadow-xl hover:shadow-2xl transition-all duration-200 hover:scale-[1.03]"
                  style={{ background: "linear-gradient(135deg, #F5851F, #FF6B35)" }}
                >
                  <CalendarDays size={18} />
                  立即预约试听
                </button>
                <button className="flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-base border border-white/30 text-white hover:bg-white/10 transition-all duration-200">
                  了解课程体系
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>

            {/* Right: image card cluster */}
            <div className="hidden lg:block col-span-5">
              <div className="relative h-[520px]">
                <div className="absolute top-0 right-0 w-72 h-80 rounded-2xl overflow-hidden shadow-2xl border-4 border-white/20">
                  <img
                    src="https://images.unsplash.com/photo-1586694680938-9682c9e1f736?w=400&h=480&fit=crop&auto=format"
                    alt="小女孩认真学习写字"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute bottom-10 left-0 w-60 h-64 rounded-2xl overflow-hidden shadow-2xl border-4 border-white/20">
                  <img
                    src="https://images.unsplash.com/photo-1617117206620-b01f2919ff86?w=340&h=360&fit=crop&auto=format"
                    alt="孩子们快乐学习"
                    className="w-full h-full object-cover"
                  />
                </div>
                {/* Floating badge */}
                <div className="absolute bottom-32 right-4 bg-white rounded-2xl p-4 shadow-xl flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                    style={{ background: "#F5851F" }}
                  >
                    <Star size={18} fill="white" />
                  </div>
                  <div>
                    <div className="font-black text-sm text-[#1C2B3A]">口碑认证</div>
                    <div className="text-xs text-muted-foreground">连续5年优质教育机构</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom wave */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 80L1440 80V40C1200 80 960 0 720 20C480 40 240 80 0 40V80Z" fill="#FFFCF8" />
          </svg>
        </div>
      </section>

      {/* ─── 3. CORE ADVANTAGES ─── */}
      <section className="py-24 bg-background">
        <div className="max-w-[1400px] mx-auto px-8">
          {/* Section header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#FFF3E5] text-[#F5851F] text-sm font-medium mb-5">
              <Award size={14} />
              为什么选择我们
            </div>
            <h2
              className="text-[#1C2B3A] mb-4"
              style={{
                fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
                fontSize: "2.25rem",
                fontWeight: 800,
              }}
            >
              4大核心优势，给孩子最好的起点
            </h2>
            <p className="text-muted-foreground text-base max-w-[560px] mx-auto leading-relaxed">
              我们深知每位家长对孩子教育的期望与用心，以专业、安全、温暖的教育环境陪伴每一个孩子成长。
            </p>
          </div>

          <div className="grid grid-cols-12 gap-6">
            {ADVANTAGES.map((adv, i) => {
              const Icon = adv.icon;
              return (
                <div
                  key={adv.title}
                  className="col-span-12 sm:col-span-6 lg:col-span-3 group"
                >
                  <div className="h-full bg-card rounded-2xl p-8 border border-border shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-transform duration-300 group-hover:scale-110"
                      style={{ background: adv.bg }}
                    >
                      <Icon size={26} style={{ color: adv.color }} />
                    </div>
                    <h3
                      className="text-xl font-bold text-[#1C2B3A] mb-3"
                      style={{ fontFamily: "'Nunito', 'Noto Sans SC', sans-serif" }}
                    >
                      {adv.title}
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed flex-1">{adv.desc}</p>
                    <div
                      className="mt-6 flex items-center gap-1 text-sm font-medium transition-colors duration-200"
                      style={{ color: adv.color }}
                    >
                      了解详情 <ChevronRight size={15} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── 4. COURSES ─── */}
      <section className="py-24" style={{ background: "linear-gradient(180deg, #F8F9FF 0%, #FFFCF8 100%)" }}>
        <div className="max-w-[1400px] mx-auto px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#EFF6FF] text-[#2563EB] text-sm font-medium mb-5">
              <BookOpen size={14} />
              精品课程体系
            </div>
            <h2
              className="text-[#1C2B3A] mb-4"
              style={{
                fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
                fontSize: "2.25rem",
                fontWeight: 800,
              }}
            >
              科学课程，全面衔接小学学习
            </h2>
            <p className="text-muted-foreground text-base max-w-[560px] mx-auto leading-relaxed">
              由资深教研团队研发，严格对标小学课程标准，让孩子学得快乐、学得扎实。
            </p>
          </div>

          <div className="grid grid-cols-12 gap-6">
            {COURSES.map((course) => (
              <div key={course.title} className="col-span-12 sm:col-span-6 lg:col-span-3">
                <div className="h-full bg-card rounded-2xl overflow-hidden border border-border shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col">
                  {/* Card header */}
                  <div className="p-6 border-b border-border" style={{ background: course.tagBg }}>
                    <div className="text-4xl mb-4">{course.icon}</div>
                    <div className="flex items-center gap-2 mb-2">
                      <h3
                        className="text-xl font-bold text-[#1C2B3A]"
                        style={{ fontFamily: "'Nunito', 'Noto Sans SC', sans-serif" }}
                      >
                        {course.title}
                      </h3>
                    </div>
                    <span
                      className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium"
                      style={{ color: course.tagColor, background: `${course.tagColor}18` }}
                    >
                      {course.tag}
                    </span>
                  </div>

                  {/* Card body */}
                  <div className="p-6 flex-1 flex flex-col">
                    <p className="text-muted-foreground text-sm leading-relaxed mb-5">{course.desc}</p>
                    <ul className="space-y-2 flex-1">
                      {course.features.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-sm text-[#4A5568]">
                          <CheckCircle size={14} style={{ color: course.tagColor }} className="shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-6 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock size={12} /> 共{course.lessons}
                      </span>
                      <button
                        className="text-sm font-semibold flex items-center gap-1 hover:gap-2 transition-all"
                        style={{ color: course.tagColor }}
                      >
                        查看详情 <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 5. PHOTO WALL ─── */}
      <section className="py-24 bg-background">
        <div className="max-w-[1400px] mx-auto px-8">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#ECFDF5] text-[#059669] text-sm font-medium mb-5">
              <Heart size={14} />
              课堂瞬间
            </div>
            <h2
              className="text-[#1C2B3A] mb-4"
              style={{
                fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
                fontSize: "2.25rem",
                fontWeight: 800,
              }}
            >
              记录每一个精彩成长时刻
            </h2>
            <p className="text-muted-foreground text-base max-w-[480px] mx-auto">
              真实课堂，真实笑脸。每一张照片都是孩子成长的珍贵印记。
            </p>
          </div>

          <div className="grid grid-cols-12 gap-4">
            {PHOTOS.map((photo, i) => (
              <div
                key={i}
                className={`group relative overflow-hidden rounded-2xl bg-muted ${
                  i === 0 ? "col-span-12 md:col-span-6 row-span-2 h-[400px]" :
                  i === 3 ? "col-span-12 md:col-span-6 h-[196px]" :
                  "col-span-12 md:col-span-3 h-[196px]"
                }`}
              >
                <img
                  src={photo.url}
                  alt={photo.alt}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                  <span className="text-white text-sm font-semibold bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
                    {photo.caption}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 6. TEACHERS ─── */}
      <section className="py-24" style={{ background: "#F8F9FF" }}>
        <div className="max-w-[1400px] mx-auto px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#F5F3FF] text-[#7C3AED] text-sm font-medium mb-5">
              <GraduationCap size={14} />
              师资团队
            </div>
            <h2
              className="text-[#1C2B3A] mb-4"
              style={{
                fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
                fontSize: "2.25rem",
                fontWeight: 800,
              }}
            >
              专业教师团队，用心陪伴每个孩子
            </h2>
            <p className="text-muted-foreground text-base max-w-[560px] mx-auto">
              所有老师均持证上岗，平均教龄9年，热爱儿童教育事业，耐心温暖是我们的共同特质。
            </p>
          </div>

          <div className="grid grid-cols-12 gap-6">
            {TEACHERS.map((teacher) => (
              <div key={teacher.name} className="col-span-12 sm:col-span-6 lg:col-span-3">
                <div className="bg-card rounded-2xl p-8 border border-border shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 text-center flex flex-col items-center">
                  {/* Avatar */}
                  <div className="relative mb-5">
                    <div className="w-24 h-24 rounded-full overflow-hidden bg-muted border-4 border-white shadow-lg">
                      <img
                        src={teacher.avatar}
                        alt={teacher.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div
                      className="absolute -bottom-1 -right-1 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow"
                      style={{ background: "linear-gradient(135deg, #F5851F, #FF6B35)" }}
                    >
                      {teacher.badge}
                    </div>
                  </div>

                  <h3
                    className="text-xl font-bold text-[#1C2B3A] mb-1"
                    style={{ fontFamily: "'Nunito', 'Noto Sans SC', sans-serif" }}
                  >
                    {teacher.name}
                  </h3>
                  <p className="text-muted-foreground text-sm mb-4">{teacher.title}</p>

                  <div className="flex items-center gap-1 mb-4">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} size={13} fill="#F5851F" className="text-[#F5851F]" />
                    ))}
                  </div>

                  <div className="w-full bg-[#FFF3E5] rounded-xl p-3 flex items-center justify-between mb-3">
                    <span className="text-xs text-muted-foreground">教龄</span>
                    <span className="text-sm font-bold text-[#F5851F]">{teacher.years}年</span>
                  </div>
                  <div className="w-full bg-muted rounded-xl p-3">
                    <p className="text-xs text-muted-foreground text-center">{teacher.specialty}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 7. NEWS ─── */}
      <section className="py-24 bg-background">
        <div className="max-w-[1400px] mx-auto px-8">
          <div className="flex items-end justify-between mb-14 flex-wrap gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#FFF3E5] text-[#F5851F] text-sm font-medium mb-5">
                <Sparkles size={14} />
                新闻资讯
              </div>
              <h2
                className="text-[#1C2B3A]"
                style={{
                  fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
                  fontSize: "2.25rem",
                  fontWeight: 800,
                }}
              >
                校园动态，实时更新
              </h2>
            </div>
            <button className="flex items-center gap-2 text-sm font-medium text-[#F5851F] hover:gap-3 transition-all">
              查看全部资讯 <ArrowRight size={16} />
            </button>
          </div>

          <div className="grid grid-cols-12 gap-6">
            {NEWS.map((article, i) => (
              <div key={i} className="col-span-12 md:col-span-4 group cursor-pointer">
                <div className="bg-card rounded-2xl overflow-hidden border border-border shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 h-full flex flex-col">
                  {/* Image */}
                  <div className="relative h-48 overflow-hidden bg-muted">
                    <img
                      src={article.img}
                      alt={article.alt}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <span
                      className="absolute top-4 left-4 text-white text-xs font-semibold px-3 py-1 rounded-full"
                      style={{ background: article.categoryColor }}
                    >
                      {article.category}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="p-6 flex-1 flex flex-col">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                      <CalendarDays size={12} />
                      {article.date}
                    </div>
                    <h3
                      className="text-[#1C2B3A] font-bold text-base leading-snug mb-3 group-hover:text-[#F5851F] transition-colors line-clamp-2"
                      style={{ fontFamily: "'Noto Sans SC', sans-serif" }}
                    >
                      {article.title}
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed flex-1 line-clamp-3">
                      {article.desc}
                    </p>
                    <div className="mt-5 flex items-center gap-1 text-sm font-medium text-[#F5851F] group-hover:gap-2 transition-all">
                      阅读全文 <ArrowRight size={14} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 8. CTA BANNER ─── */}
      <section className="py-24 relative overflow-hidden">
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(135deg, #1C2B3A 0%, #2D4A6B 100%)" }}
        />
        {/* Decorative blobs */}
        <div
          className="absolute -top-20 -right-20 w-96 h-96 rounded-full opacity-20 blur-3xl"
          style={{ background: "#F5851F" }}
        />
        <div
          className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full opacity-10 blur-3xl"
          style={{ background: "#4ECDC4" }}
        />
        {/* Dot pattern */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        <div className="relative z-10 max-w-[1400px] mx-auto px-8">
          <div className="grid grid-cols-12 gap-8 items-center">
            <div className="col-span-12 lg:col-span-7">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-white/80 text-sm mb-6">
                <Sparkles size={13} className="text-[#F5851F]" />
                限时福利 · 免费体验课
              </div>
              <h2
                className="text-white mb-4"
                style={{
                  fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
                  fontSize: "2.5rem",
                  fontWeight: 800,
                  lineHeight: 1.25,
                }}
              >
                立即预约，
                <span style={{ color: "#F5851F" }}>免费体验</span>
                一节精品课
              </h2>
              <p className="text-white/70 text-base leading-relaxed mb-8 max-w-[540px]">
                无需任何费用，带孩子来亲身感受我们的课堂氛围。专业老师一对一测评，为您的孩子定制专属学习方案。
              </p>
              <div className="flex flex-wrap gap-4 mb-8">
                {["免费测评", "专属方案", "试听无压力", "当天即可安排"].map((tag) => (
                  <div key={tag} className="flex items-center gap-2 text-white/80 text-sm">
                    <CheckCircle size={15} className="text-[#F5851F]" />
                    {tag}
                  </div>
                ))}
              </div>
            </div>

            <div className="col-span-12 lg:col-span-5">
              <div className="bg-white/95 backdrop-blur-sm rounded-3xl p-8 shadow-2xl">
                <h3
                  className="text-[#1C2B3A] font-bold text-xl mb-6"
                  style={{ fontFamily: "'Nunito', 'Noto Sans SC', sans-serif" }}
                >
                  预约免费试听课
                </h3>
                <div className="space-y-4">
                  <input
                    type="text"
                    placeholder="孩子姓名"
                    className="w-full px-4 py-3 rounded-xl border border-border bg-[#F8F9FF] text-sm focus:outline-none focus:border-[#F5851F] transition-colors"
                  />
                  <input
                    type="text"
                    placeholder="家长手机号"
                    className="w-full px-4 py-3 rounded-xl border border-border bg-[#F8F9FF] text-sm focus:outline-none focus:border-[#F5851F] transition-colors"
                  />
                  <select className="w-full px-4 py-3 rounded-xl border border-border bg-[#F8F9FF] text-sm text-muted-foreground focus:outline-none focus:border-[#F5851F] transition-colors appearance-none">
                    <option value="">感兴趣的课程</option>
                    <option>拼音识字课程</option>
                    <option>数学思维课程</option>
                    <option>专注力训练</option>
                    <option>综合衔接课程</option>
                  </select>
                  <button
                    className="w-full py-4 rounded-xl text-white font-bold text-base shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02]"
                    style={{ background: "linear-gradient(135deg, #F5851F, #FF6B35)" }}
                  >
                    立即预约体验课 →
                  </button>
                  <p className="text-center text-xs text-muted-foreground">
                    预约成功后，老师将在24小时内与您联系
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 9. FOOTER ─── */}
      <footer className="bg-[#111827] text-white">
        <div className="max-w-[1400px] mx-auto px-8 py-16">
          <div className="grid grid-cols-12 gap-8">
            {/* Brand column */}
            <div className="col-span-12 lg:col-span-4">
              <div className="flex items-center gap-3 mb-5">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg font-black"
                  style={{ background: "linear-gradient(135deg, #F5851F, #FF6B35)" }}
                >
                  小
                </div>
                <div>
                  <div
                    className="font-black text-[18px] leading-tight text-white"
                    style={{ fontFamily: "'Nunito', sans-serif" }}
                  >
                    启航幼小教育
                  </div>
                  <div className="text-[10px] text-white/40 tracking-widest">QIHANG EDUCATION</div>
                </div>
              </div>
              <p className="text-white/55 text-sm leading-relaxed mb-6 max-w-[300px]">
                专注幼小衔接教育8年，以专业、安全、温暖的理念陪伴每一个孩子顺利开启人生第一个重要阶段。
              </p>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-white/60 text-sm">
                  <MapPin size={15} className="text-[#F5851F] shrink-0" />
                  上海市浦东新区张江高科技园区博云路2号
                </div>
                <div className="flex items-center gap-3 text-white/60 text-sm">
                  <Phone size={15} className="text-[#F5851F] shrink-0" />
                  400-888-6688（周一至周日 9:00-20:00）
                </div>
                <div className="flex items-center gap-3 text-white/60 text-sm">
                  <Mail size={15} className="text-[#F5851F] shrink-0" />
                  service@qihang-edu.com
                </div>
              </div>
            </div>

            {/* Nav columns */}
            {Object.entries(FOOTER_LINKS).map(([category, links]) => (
              <div key={category} className="col-span-6 sm:col-span-4 lg:col-span-2">
                <h4 className="text-white font-bold text-sm mb-5 pb-2 border-b border-white/10">
                  {category}
                </h4>
                <ul className="space-y-3">
                  {links.map((link) => (
                    <li key={link}>
                      <a
                        href="#"
                        className="text-white/50 text-sm hover:text-[#F5851F] transition-colors"
                      >
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {/* QR / Contact */}
            <div className="col-span-12 sm:col-span-4 lg:col-span-2">
              <h4 className="text-white font-bold text-sm mb-5 pb-2 border-b border-white/10">
                扫码咨询
              </h4>
              <div className="w-28 h-28 bg-white rounded-xl flex items-center justify-center mb-3">
                <div className="w-24 h-24 grid grid-cols-5 gap-0.5">
                  {Array.from({ length: 25 }).map((_, i) => (
                    <div
                      key={i}
                      className="rounded-sm"
                      style={{
                        background:
                          [0,1,2,3,4,5,9,10,14,15,19,20,21,22,23,24,6,12,18].includes(i)
                            ? "#1C2B3A"
                            : "transparent",
                      }}
                    />
                  ))}
                </div>
              </div>
              <p className="text-white/40 text-xs">微信扫码立即咨询</p>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-white/10 mt-12 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-white/35 text-sm">
              © 2026 启航幼小教育集团 · 沪ICP备2024XXXXXXX号 · 沪公网安备31XXXXXXXXXX号
            </p>
            <div className="flex items-center gap-6 text-white/35 text-sm">
              <a href="#" className="hover:text-white/60 transition-colors">隐私政策</a>
              <a href="#" className="hover:text-white/60 transition-colors">用户协议</a>
              <a href="#" className="hover:text-white/60 transition-colors">举报中心</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
