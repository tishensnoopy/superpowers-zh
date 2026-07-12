export const mockSiteSettings = {
  data: {
    id: 1,
    attributes: {
      name: '超级能力教育',
      slogan: '让每个孩子都能成为超级英雄',
      phone: '400-888-8888',
      email: 'contact@superpowers-zh.com',
      address: '北京市朝阳区xxx路xxx号',
      seo: {
        metaTitle: '超级能力教育 - 幼小衔接专家',
        metaDescription: '专业的幼小衔接教育机构',
      },
    },
  },
};

export const mockNavigation = {
  data: [
    { id: 1, attributes: { name: '首页', url: '/', position: 1, isActive: true, children: null } },
    { id: 2, attributes: { name: '课程中心', url: '/courses', position: 2, isActive: false, children: { data: [{ id: 101, attributes: { name: '幼小衔接', url: '/courses/kindergarten', position: 1 } }] } } },
    { id: 3, attributes: { name: '师资团队', url: '/team', position: 3, isActive: false, children: null } },
    { id: 4, attributes: { name: '家长问答', url: '/faq', position: 4, isActive: false, children: null } },
    { id: 5, attributes: { name: '联系我们', url: '/contact', position: 5, isActive: false, children: null } },
  ],
};

export const mockFooter = {
  data: {
    id: 1,
    attributes: {
      copyright: '© 2026 超级能力教育 版权所有',
      socialLinks: {
        data: [
          { id: 1, attributes: { platform: '微信', url: '#', icon: 'wechat' } },
          { id: 2, attributes: { platform: '抖音', url: '#', icon: 'douyin' } },
        ],
      },
      quickLinks: {
        data: [
          { id: 1, attributes: { name: '关于我们', url: '/about' } },
          { id: 2, attributes: { name: '隐私政策', url: '/privacy' } },
          { id: 3, attributes: { name: '服务条款', url: '/terms' } },
        ],
      },
    },
  },
};

export const mockHomepage = {
  data: {
    id: 1,
    attributes: {
      title: '首页',
      slug: 'homepage',
      isHomepage: true,
      sections: [
        {
          id: 1,
          __component: 'section.hero',
          title: '让孩子赢在起跑线',
          subtitle: '专业幼小衔接教育，陪伴成长每一天',
          buttonText: '免费预约体验课',
          buttonUrl: '/appointment',
        },
        {
          id: 2,
          __component: 'section.advantages',
          title: '为什么选择我们',
          description: '我们深知每位家长对孩子教育的期望与用心',
          advantages: {
            data: [
              { id: 1, attributes: { title: '专业师资', description: '8年幼小衔接教学经验', icon: 'GraduationCap', color: '#F5851F', bgColor: '#FFF3E5' } },
              { id: 2, attributes: { title: '科学课程', description: '对标小学课程标准', icon: 'BookOpen', color: '#2563EB', bgColor: '#EFF6FF' } },
              { id: 3, attributes: { title: '安全环境', description: '全程监控覆盖', icon: 'Shield', color: '#059669', bgColor: '#ECFDF5' } },
              { id: 4, attributes: { title: '小班教学', description: '每班不超过12人', icon: 'Users', color: '#7C3AED', bgColor: '#F5F3FF' } },
            ],
          },
        },
        {
          id: 3,
          __component: 'section.features',
          title: '课程特色',
          description: '全面发展，培养综合素质',
          features: {
            data: [
              { id: 1, attributes: { title: '语言表达', description: '培养孩子的语言能力', icon: 'MessageCircle' } },
              { id: 2, attributes: { title: '数学思维', description: '建立数学逻辑思维', icon: 'Calculator' } },
              { id: 3, attributes: { title: '专注力训练', description: '提升注意力和专注力', icon: 'Target' } },
            ],
          },
        },
        {
          id: 4,
          __component: 'section.product-grid',
          title: '热门课程',
          products: {
            data: [
              { id: 1, attributes: { name: '拼音启蒙班', shortDescription: '轻松掌握拼音', price: 1999, originalPrice: 2999, isFeatured: true } },
              { id: 2, attributes: { name: '数学思维班', shortDescription: '培养数学兴趣', price: 2599, originalPrice: 3599, isNew: true } },
              { id: 3, attributes: { name: '识字阅读班', shortDescription: '快速识字阅读', price: 1799, originalPrice: 2599 } },
              { id: 4, attributes: { name: '专注力特训', shortDescription: '提升学习效率', price: 2299, originalPrice: 3299 } },
            ],
          },
        },
        {
          id: 5,
          __component: 'section.faq',
          title: '家长常见问题',
          faqs: {
            data: [
              { id: 1, attributes: { question: '课程适合多大年龄的孩子?', answer: '我们的课程适合5-7岁的学龄前儿童。', isActive: false } },
              { id: 2, attributes: { question: '每班有多少学生?', answer: '为保证教学质量，每班不超过12人。', isActive: false } },
              { id: 3, attributes: { question: '如何预约体验课?', answer: '您可以通过在线预约表单或拨打客服电话预约。', isActive: false } },
            ],
          },
        },
        {
          id: 6,
          __component: 'section.contact-form',
          title: '预约免费体验课',
          description: '填写信息，我们的课程顾问将在24小时内联系您',
        },
      ],
    },
  },
};

export const mockFaqItems = {
  data: [
    { id: 1, attributes: { question: '课程适合多大年龄的孩子?', answer: '我们的课程适合5-7岁的学龄前儿童。', category: '课程咨询', isActive: true, helpfulCount: 100, notHelpfulCount: 5 } },
    { id: 2, attributes: { question: '每班有多少学生?', answer: '为保证教学质量，每班不超过12人。', category: '教学安排', isActive: false, helpfulCount: 85, notHelpfulCount: 3 } },
    { id: 3, attributes: { question: '如何预约体验课?', answer: '您可以通过在线预约表单或拨打客服电话预约。', category: '预约咨询', isActive: false, helpfulCount: 120, notHelpfulCount: 2 } },
    { id: 4, attributes: { question: '上课时间如何安排?', answer: '我们提供周末和工作日课后班，可灵活选择。', category: '教学安排', isActive: false, helpfulCount: 60, notHelpfulCount: 4 } },
    { id: 5, attributes: { question: '是否提供试听课程?', answer: '是的，我们提供免费的试听课程体验。', category: '课程咨询', isActive: false, helpfulCount: 95, notHelpfulCount: 1 } },
  ],
};

export const mockProducts = {
  data: [
    { id: 1, attributes: { name: '拼音启蒙班', slug: 'pinyin-basic', shortDescription: '轻松掌握拼音', description: '系统学习汉语拼音，培养正确发音', price: 1999, originalPrice: 2999, isFeatured: true, isNew: false } },
    { id: 2, attributes: { name: '数学思维班', slug: 'math-thinking', shortDescription: '培养数学兴趣', description: '建立数学逻辑思维，激发学习兴趣', price: 2599, originalPrice: 3599, isFeatured: false, isNew: true } },
    { id: 3, attributes: { name: '识字阅读班', slug: 'reading-basic', shortDescription: '快速识字阅读', description: '掌握常用汉字，培养阅读能力', price: 1799, originalPrice: 2599, isFeatured: false, isNew: false } },
    { id: 4, attributes: { name: '专注力特训', slug: 'focus-training', shortDescription: '提升学习效率', description: '专业专注力训练课程', price: 2299, originalPrice: 3299, isFeatured: true, isNew: false } },
  ],
  meta: { page: 1, pageSize: 10, pageCount: 1, total: 4 },
};

export const mockProductCategories = {
  data: [
    { id: 1, attributes: { name: '语言学习', slug: 'language', description: '语言相关课程', children: null } },
    { id: 2, attributes: { name: '数学思维', slug: 'math', description: '数学相关课程', children: null } },
    { id: 3, attributes: { name: '能力培养', slug: 'skill', description: '综合能力培养', children: null } },
  ],
};

export const mockCourseDetailFull = {
  data: {
    id: 1,
    documentId: 'abc-1',
    attributes: {
      name: '拼音启蒙班',
      slug: 'pinyin-basic',
      shortDescription: '轻松掌握拼音，打牢语文基础',
      description: '系统学习汉语拼音，培养正确发音。通过趣味教学方式，让孩子在快乐中掌握拼音规则，为后续阅读和写作打下坚实基础。',
      price: 1999,
      originalPrice: 2999,
      specValues: {
        course_hours: '48课时',
        class_size: '小班12人',
        age_range: '4-6岁',
        duration: '6个月',
      },
      teachingMethod: '采用游戏化教学法，结合多媒体课件和实物教具，让孩子在互动中学习。每节课设置拼音游戏、儿歌律动和发音练习三个环节。',
      objectives: [
        { id: 1, title: '掌握 23 个声母', description: '正确认读和书写所有声母' },
        { id: 2, title: '掌握 24 个韵母', description: '准确发音所有单韵母和复韵母' },
        { id: 3, title: '拼读能力', description: '能独立拼读简单音节' },
      ],
      outline: [
        { id: 1, title: '第 1-12 课：声母学习', description: '学习 b p m f d t n l 等声母', lessonCount: 12 },
        { id: 2, title: '第 13-24 课：韵母学习', description: '学习 a o e i u ü 等韵母', lessonCount: 12 },
        { id: 3, title: '第 25-36 课：拼读练习', description: '声母韵母拼读组合训练', lessonCount: 12 },
      ],
      testimonials: [
        { id: 1, parentName: '张妈妈', content: '孩子上了一学期，拼音发音很标准！', rating: 5 },
        { id: 2, parentName: '李爸爸', content: '老师很专业，孩子很喜欢上课。', rating: 5 },
      ],
    },
  },
  meta: {},
};

export const mockCourseDetailEmpty = {
  data: {
    id: 2,
    documentId: 'abc-2',
    attributes: {
      name: '数学思维班',
      slug: 'math-thinking',
      shortDescription: '培养数学兴趣，建立逻辑思维',
      description: '通过趣味数学游戏和思维训练，激发孩子对数学的兴趣。',
      price: 2599,
      originalPrice: 3599,
      specValues: {
        course_hours: '36课时',
        class_size: '小班10人',
        age_range: '5-7岁',
        duration: '4个月',
      },
      teachingMethod: '',
      objectives: [],
      outline: [],
      testimonials: [],
    },
  },
  meta: {},
};

export const mockCourseDetailNotFound = {
  error: '课程不存在',
};

export const mockNavigationTree = {
  data: [
    {
      id: 1,
      attributes: { name: '首页', url: '/', position: 1, isActive: true },
      children: [],
    },
    {
      id: 2,
      attributes: { name: '课程中心', url: '/courses', position: 2, isActive: false },
      children: [
        { id: 101, attributes: { name: '幼小衔接', url: '/courses/kindergarten', position: 1, isActive: false } },
        { id: 102, attributes: { name: '拼音课程', url: '/courses/pinyin', position: 2, isActive: false } },
      ],
    },
    { id: 3, attributes: { name: '师资团队', url: '/team', position: 3, isActive: false }, children: [] },
    { id: 4, attributes: { name: '家长问答', url: '/faq', position: 4, isActive: false }, children: [] },
    { id: 5, attributes: { name: '联系我们', url: '/contact', position: 5, isActive: false }, children: [] },
  ],
};