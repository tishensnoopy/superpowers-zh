#!/usr/bin/env node
/**
 * 佑森小课堂 Strapi 内容 Seed 脚本
 * 用法: docker compose exec backend node scripts/seed-yousen.js [--only=...] [--force] [--remove]
 *
 * 图片路径映射（容器内 /data/yousen 对应宿主机 ./佑森）：
 *   - 校区封面/图集: /data/yousen/六大校区环境/{校区名}1.jpg 等
 *   - 教师头像:      /data/yousen/佑森小课堂老师照片/{教师照片文件夹}/第1张.jpg
 *     注意：教师照片文件夹名与校区名不完全一致（金桥校区 → 百步亭校区）
 *   - 课程缩略图:    /data/yousen/课程介绍/{对应图片}.JPG
 *   - 新闻封面:      /data/yousen/海报图片/outputs/website-materials-v2/{子目录}/A0X-*.png
 */

const fs = require('fs');
const path = require('path');
const { createStrapi } = require('@strapi/strapi');

// === CLI 解析 ===
const argv = process.argv.slice(2);
const force = argv.includes('--force');
const remove = argv.includes('--remove');
const onlyArg = argv.find(a => a.startsWith('--only='));
const only = onlyArg ? onlyArg.split('=')[1].split(',') : null;

const ALL_ENTITIES = ['settings', 'navigation', 'footer', 'categories', 'courses', 'campuses', 'teachers', 'faqs', 'news', 'pages'];
const entities = only || ALL_ENTITIES;

// === 图片基础路径（容器内） ===
const IMG = '/data/yousen';

// === 图片路径映射 ===
const CAMPUS_IMG = {
  baibuting:   { cover: `${IMG}/六大校区环境/百步亭1.jpg`,     gallery: [`${IMG}/六大校区环境/百步亭2.jpg`, `${IMG}/六大校区环境/百步亭4.jpg`] },
  sanyanglu:   { cover: `${IMG}/六大校区环境/三阳路1.jpg`,     gallery: [`${IMG}/六大校区环境/三阳路2.jpg`, `${IMG}/六大校区环境/三阳路3.jpg`] },
  dongwuyuan:  { cover: `${IMG}/六大校区环境/动物园1.pic.jpg`, gallery: [`${IMG}/六大校区环境/动物园2.pic.jpg`, `${IMG}/六大校区环境/动物园3.pic.jpg`] },
  zhongjiacun: { cover: `${IMG}/六大校区环境/钟家村1.jpg`,     gallery: [`${IMG}/六大校区环境/钟家村2.jpg`, `${IMG}/六大校区环境/钟家村3.jpg`] },
  sixin:       { cover: `${IMG}/六大校区环境/四新1.jpg`,       gallery: [`${IMG}/六大校区环境/四新2.jpg`, `${IMG}/六大校区环境/四新3.jpg`] },
  zhuankou:    { cover: `${IMG}/六大校区环境/沌口1.jpg`,       gallery: [`${IMG}/六大校区环境/沌口2.jpg`, `${IMG}/六大校区环境/沌口3.jpg`] },
};

// 教师照片文件夹名 → 校区 slug（key 去掉 yousen- 前缀）映射
// 注意：金桥校区对应百步亭校区（金桥无独立校区环境文件夹）
const TEACHER_IMG = {
  baibuting:   `${IMG}/佑森小课堂老师照片/金桥校区/F63A0042.jpg`,
  sanyanglu:   `${IMG}/佑森小课堂老师照片/三阳路校区/F63A3060.jpg`,
  dongwuyuan:  `${IMG}/佑森小课堂老师照片/动物园校区/F63A0178.jpg`,
  zhongjiacun: `${IMG}/佑森小课堂老师照片/钟家村校区/F63A0070.jpg`,
  sixin:       `${IMG}/佑森小课堂老师照片/四新校区/F63A3487.jpg`,
  zhuankou:    `${IMG}/佑森小课堂老师照片/沌口校区/F63A2857.jpg`,
};

const COURSE_IMG = {
  youxiao: `${IMG}/课程介绍/6学前衔接.JPG`,
  kehao:   `${IMG}/课程介绍/11衔接托管班.JPG`,
  tuoban:  `${IMG}/课程介绍/5习惯养成.jpg`,
};

const LOGO_IMG = `${IMG}/LOGO/3FB0E536B592AE2334D3F049ECB0CFEB(1).png`;

const NEWS_IMG = [
  `${IMG}/海报图片/outputs/website-materials-v2/07-品牌故事横幅/A07-Wide_horizontal_bran-720x640.png`,
  `${IMG}/海报图片/outputs/website-materials-v2/05-课程专题横幅/A05-Wide_horizontal_cour-720x640.png`,
  `${IMG}/海报图片/outputs/website-materials-v2/06-信任数据卡片/A06-Horizontal_trust_dat-720x640.png`,
  `${IMG}/海报图片/outputs/website-materials-v2/03-校区展示/A03-Illustration_of_a_wa-720x640.png`,
  `${IMG}/海报图片/outputs/website-materials-v2/04-课程体系图标/A04-Square_icon_illustra-1024x904.png`,
  `${IMG}/海报图片/outputs/website-materials-v2/01-首页轮播图-PC/A01-Warm_children_educat-720x640.png`,
  `${IMG}/海报图片/outputs/website-materials-v2/08-荣誉资质区/A08-Illustration_of_a_pr-720x640.png`,
  `${IMG}/海报图片/outputs/website-materials-v2/09-学员好评区/A09-Illustration_for_stu-720x640.png`,
  `${IMG}/海报图片/outputs/website-materials-v2/10-联系我们/A10-Warm_illustration_fo-720x640.png`,
  `${IMG}/海报图片/outputs/website-materials-v2/14-SEO分享图/A14-Horizontal_SEO_socia-720x640.png`,
];

// === 数据定义 ===

const SITE_SETTINGS = {
  name: '武汉佑森小课堂艺术培训学校有限公司',
  slogan: '专注幼小衔接教育8年',
  phone: '',
  email: '',
  address: '武汉市',
  wechat: '',
  icp: '',
  publicSecurityRecord: '',
};

const NAVIGATION = [
  { name: '首页',     url: '/',           position: 1, isExternal: false, children: [] },
  { name: '课程体系', url: '/courses',    position: 2, isExternal: false, children: [
    { name: '幼小衔接全能班', url: '/courses/yousen-youxiao-xianjie', position: 1, isExternal: false },
    { name: '课后托管班',     url: '/courses/yousen-kehao-tuoguan',    position: 2, isExternal: false },
    { name: '全日制托班',     url: '/courses/yousen-tuoban',            position: 3, isExternal: false },
  ]},
  { name: '校区环境', url: '/campuses',   position: 3, isExternal: false, children: [
    { name: '百步亭校区', url: '/campuses/yousen-baibuting',   position: 1, isExternal: false },
    { name: '三阳路校区', url: '/campuses/yousen-sanyanglu',   position: 2, isExternal: false },
    { name: '动物园校区', url: '/campuses/yousen-dongwuyuan',  position: 3, isExternal: false },
    { name: '钟家村校区', url: '/campuses/yousen-zhongjiacun', position: 4, isExternal: false },
    { name: '四新校区',   url: '/campuses/yousen-sixin',        position: 5, isExternal: false },
    { name: '沌口校区',   url: '/campuses/yousen-zhuankou',     position: 6, isExternal: false },
  ]},
  { name: '师资团队', url: '/teachers',   position: 4, isExternal: false, children: [] },
  { name: '新闻资讯', url: '/news',       position: 5, isExternal: false, children: [
    { name: '公司动态', url: '/news?category=company_news',   position: 1, isExternal: false },
    { name: '行业资讯', url: '/news?category=industry_news',  position: 2, isExternal: false },
    { name: '活动通知', url: '/news?category=event_notice',   position: 3, isExternal: false },
  ]},
  { name: '关于我们', url: '/about',      position: 6, isExternal: false, children: [] },
  { name: '联系我们', url: '/contact',    position: 7, isExternal: false, children: [] },
];

const FOOTER = {
  copyright: '© 2026 佑森小课堂. All rights reserved.',
  aboutText: '武汉佑森小课堂艺术培训学校有限公司，专注幼小衔接教育8年，6大校区遍布武汉三镇。',
  quickLinks: [
    { title: '预约试听', url: '/appointment' },
    { title: '联系客服', url: '/contact' },
    { title: '退费政策', url: '/refund-policy' },
    { title: '常见问题', url: '/faq' },
    { title: '关于我们', url: '/about' },
  ],
  socialLinks: [
    { platform: 'wechat', url: '#', label: '微信' },
    { platform: 'weibo',  url: '#', label: '微博' },
    { platform: 'douyin', url: '#', label: '抖音' },
  ],
};

const CATEGORIES = [
  { name: '幼小衔接', slug: 'yousen-youxiao-xianjie', description: '5大模块系统课程，帮助孩子顺利过渡到小学', position: 1, isActive: true },
  { name: '课后托管', slug: 'yousen-kehao-tuoguan',  description: '放学后作业辅导 + 兴趣拓展', position: 2, isActive: true },
  { name: '托班',     slug: 'yousen-tuoban',         description: '3-5岁幼儿全日制托管', position: 3, isActive: true },
];

const SPECS = [
  { name: '课时',     code: 'class_hours', unit: '课时', type: 'text', isVisible: true, position: 1 },
  { name: '班额',     code: 'class_size',  unit: '人',  type: 'text', isVisible: true, position: 2 },
  { name: '适合年龄', code: 'age_range',   unit: '',    type: 'text', isVisible: true, position: 3 },
  { name: '课程周期', code: 'duration',    unit: '',    type: 'text', isVisible: true, position: 4 },
];

const COURSES = [
  {
    name: '幼小衔接全能班',
    slug: 'yousen-youxiao-xianjie',
    sku: 'YOUSEN-YOUXIAO-001',
    shortDescription: '5大模块系统课程，帮助孩子顺利过渡到小学',
    description: '覆盖语文素养、数学思维、英语启蒙、学习习惯、社交适应5大核心模块，16-20人小班教学，师资分科教学，室内课堂与户外研学相结合。',
    price: 0,
    isInStock: true,
    isFeatured: true,
    specValues: { '课时': '160课时', '班额': '16-20人', '适合年龄': '5-6岁', '课程周期': '1学年' },
    teachingMethod: '<p>小班教学 + 分科授课 + 室内课堂 + 户外研学</p>',
    objectives: [
      { title: '拼音识字基础', description: '掌握声韵母、整体认读音节，能自主拼读' },
      { title: '数学逻辑思维', description: '20以内加减法，图形认知，逻辑推理启蒙' },
      { title: '英语听说入门', description: '26个字母，基础词汇，简单日常对话' },
      { title: '良好学习习惯', description: '握笔姿势、坐姿、专注力训练、时间管理' },
      { title: '社交适应能力', description: '课堂规则意识、团队合作、情绪管理' },
    ],
    outline: [
      { title: '语文素养模块', description: '拼音、识字、阅读理解', lessonCount: 40 },
      { title: '数学思维模块', description: '数感、运算、图形、逻辑', lessonCount: 40 },
      { title: '英语启蒙模块', description: '字母、词汇、口语', lessonCount: 30 },
      { title: '学习习惯模块', description: '专注力、坐姿、时间管理', lessonCount: 25 },
      { title: '社交适应模块', description: '规则意识、团队合作', lessonCount: 25 },
    ],
    testimonials: [
      { parentName: '梓涵妈妈', content: '孩子上了一年后，拼音和数学基础很扎实，上小学完全不用操心。', rating: 5 },
      { parentName: '子轩爸爸', content: '老师非常负责，小班教学关注到每个孩子，习惯养成效果很好。', rating: 5 },
    ],
    categorySlug: 'yousen-youxiao-xianjie',
    imgKey: 'youxiao',
  },
  {
    name: '课后托管班',
    slug: 'yousen-kehao-tuoguan',
    sku: 'YOUSEN-KEHAO-002',
    shortDescription: '放学后作业辅导 + 兴趣拓展',
    description: '为已入学小学生提供课后作业辅导、查漏补缺、兴趣培养服务，安全温馨的托管环境。',
    price: 0,
    isInStock: true,
    isFeatured: false,
    specValues: { '服务时间': '放学-18:30', '班额': '10-15人', '适合年龄': '6-8岁' },
    teachingMethod: '<p>作业辅导 + 查漏补缺 + 兴趣拓展</p>',
    objectives: [
      { title: '作业完成',   description: '当日作业在校完成，教师批改讲解' },
      { title: '查漏补缺',   description: '针对薄弱知识点强化练习' },
    ],
    outline: [
      { title: '作业辅导',   description: '语文、数学、英语作业辅导', lessonCount: 0 },
      { title: '兴趣拓展',   description: '阅读、手工、益智游戏', lessonCount: 0 },
    ],
    testimonials: [],
    categorySlug: 'yousen-kehao-tuoguan',
    imgKey: 'kehao',
  },
  {
    name: '全日制托班',
    slug: 'yousen-tuoban',
    sku: 'YOUSEN-TUOBAN-003',
    shortDescription: '3-5岁幼儿全日制托管',
    description: '提供安全、温暖的日间托管环境，含两餐一点、午休、游戏活动、启蒙教育。',
    price: 0,
    isInStock: true,
    isFeatured: false,
    specValues: { '服务时间': '8:00-17:00', '班额': '12-15人', '适合年龄': '3-5岁' },
    teachingMethod: '<p>游戏化教学 + 生活照料 + 启蒙教育</p>',
    objectives: [
      { title: '生活自理', description: '培养独立吃饭、穿衣、如厕能力' },
      { title: '社交启蒙', description: '与同伴友好相处，学会分享与合作' },
    ],
    outline: [
      { title: '日常生活', description: '两餐一点、午休、生活照料', lessonCount: 0 },
      { title: '启蒙活动', description: '绘本阅读、音乐律动、手工', lessonCount: 0 },
    ],
    testimonials: [],
    categorySlug: 'yousen-tuoban',
    imgKey: 'tuoban',
  },
];

const CAMPUSES = [
  { name: '百步亭校区', slug: 'yousen-baibuting',   area: '江岸区', address: '武汉市江岸区百步亭',     phone: '', businessHours: '8:00-18:00', transportation: '地铁3号线百步亭站',     description: '旗舰校区，设施完善，师资力量雄厚。',     sortOrder: 1, imgKey: 'baibuting' },
  { name: '三阳路校区', slug: 'yousen-sanyanglu',   area: '江岸区', address: '武汉市江岸区三阳路',     phone: '', businessHours: '8:00-18:00', transportation: '地铁1/6号线三阳路站',   description: '师资强校，资深教师团队执教。',           sortOrder: 2, imgKey: 'sanyanglu' },
  { name: '动物园校区', slug: 'yousen-dongwuyuan',  area: '汉阳区', address: '武汉市汉阳区动物园附近', phone: '', businessHours: '8:00-18:00', transportation: '公交动物园站',         description: '交通便利，紧邻武汉动物园。',             sortOrder: 3, imgKey: 'dongwuyuan' },
  { name: '钟家村校区', slug: 'yousen-zhongjiacun', area: '汉阳区', address: '武汉市汉阳区钟家村',     phone: '', businessHours: '8:00-18:00', transportation: '地铁3/4号线钟家村站',   description: '口碑老校，深受家长信赖。',               sortOrder: 4, imgKey: 'zhongjiacun' },
  { name: '四新校区',   slug: 'yousen-sixin',       area: '汉阳区', address: '武汉市汉阳区四新',       phone: '', businessHours: '8:00-18:00', transportation: '公交四新大道站',       description: '新兴校区，现代化教学设施。',             sortOrder: 5, imgKey: 'sixin' },
  { name: '沌口校区',   slug: 'yousen-zhuankou',    area: '经开区', address: '武汉市经开区沌口',       phone: '', businessHours: '8:00-18:00', transportation: '地铁3号线沌口站',       description: '环境优美，紧邻沌口公园。',               sortOrder: 6, imgKey: 'zhuankou' },
];

const TEACHERS = [
  { name: '王老师', slug: 'yousen-teacher-wang', title: '高级教师', campusSlug: 'yousen-baibuting',   subject: 'pinyin',        teachingYears: 8,  education: '本科', teachingFeatures: '小班教学经验丰富，善于激发孩子学习兴趣', isFeatured: true,  sortOrder: 1 },
  { name: '李老师', slug: 'yousen-teacher-li',   title: '特级教师', campusSlug: 'yousen-sanyanglu',   subject: 'math',          teachingYears: 10, education: '本科', teachingFeatures: '数学思维教学专家，深入浅出',           isFeatured: true,  sortOrder: 2 },
  { name: '张老师', slug: 'yousen-teacher-zhang', title: '高级教师', campusSlug: 'yousen-dongwuyuan', subject: 'english',       teachingYears: 6,  education: '本科', teachingFeatures: '英语启蒙教学，互动式课堂',             isFeatured: false, sortOrder: 3 },
  { name: '陈老师', slug: 'yousen-teacher-chen', title: '资深教师', campusSlug: 'yousen-zhongjiacun', subject: 'comprehensive', teachingYears: 9,  education: '本科', teachingFeatures: '综合素养教学，注重习惯养成',           isFeatured: true,  sortOrder: 4 },
  { name: '刘老师', slug: 'yousen-teacher-liu',  title: '优秀教师', campusSlug: 'yousen-sixin',       subject: 'pinyin',        teachingYears: 5,  education: '本科', teachingFeatures: '年轻有活力，深受孩子喜爱',             isFeatured: false, sortOrder: 5 },
  { name: '赵老师', slug: 'yousen-teacher-zhao', title: '资深教师', campusSlug: 'yousen-zhuankou',    subject: 'math',          teachingYears: 7,  education: '本科', teachingFeatures: '耐心细致，善于因材施教',               isFeatured: false, sortOrder: 6 },
];

const FAQS = [
  { question: '幼小衔接有必要上吗？',           answer: '幼小衔接帮助孩子从幼儿园的"以玩为主"过渡到小学的"以学为主"，培养学习习惯、社交能力和基础知识。佑森小课堂8年专注幼小衔接教育，98%家长满意度。',                              category: 'course',  tags: '幼小衔接,入学准备', sortOrder: 1 },
  { question: '佑森的幼小衔接课程包括什么？',   answer: '课程覆盖语文素养（拼音识字）、数学思维（运算逻辑）、英语启蒙（字母口语）、学习习惯（专注力时间管理）、社交适应（规则意识团队合作）5大核心模块，共160课时。', category: 'course',  tags: '课程内容,幼小衔接', sortOrder: 2 },
  { question: '课后托管和晚托有什么区别？',     answer: '课后托管针对已入学小学生，服务时间为放学后至18:30，包含作业辅导和兴趣拓展。晚托时间更晚，适合家长下班较晚的家庭。',                                                          category: 'service', tags: '课后托管,晚托',     sortOrder: 3 },
  { question: '佑森的班额是多少？',             answer: '幼小衔接班额16-20人，课后托管10-15人，托班12-15人。坚持小班教学，确保老师能关注到每个孩子。',                                                                                    category: 'course',  tags: '班额,小班教学',     sortOrder: 4 },
  { question: '孩子没有基础可以上吗？',         answer: '完全可以。佑森的课程设计从零基础开始，循序渐进。入学前会进行简单评估，帮助孩子选择最合适的班级。',                                                                              category: 'course',  tags: '零基础,入学',       sortOrder: 5 },
  { question: '校区地址在哪里？',               answer: '佑森在武汉三镇共有6大校区：百步亭、三阳路、动物园、钟家村、四新、沌口。各校区交通便利，可就近选择。',                                                                          category: 'service', tags: '校区,地址',         sortOrder: 6 },
  { question: '怎么预约试听？',                 answer: '可通过网站首页的"预约免费试听"表单，或拨打校区电话预约。试听课免费，建议家长陪同体验。',                                                                                          category: 'service', tags: '预约,试听',         sortOrder: 7 },
  { question: '退费政策是什么？',               answer: '开课前退费全额退还，开课后按剩余课时比例退还。具体退费流程请咨询各校区前台或查看退费政策页面。',                                                                                category: 'policy',  tags: '退费,退款',         sortOrder: 8 },
];

const NEWS = [
  {
    title: '佑森小课堂：8年专注幼小衔接教育',
    slug: 'yousen-news-8years',
    excerpt: '从2018年至今，佑森小课堂已陪伴超过3000个家庭顺利完成幼小衔接，成为武汉家长信赖的教育品牌。',
    content: '<p>2018年，佑森小课堂在武汉成立了第一家校区。8年来，我们始终专注幼小衔接教育，从最初的1个校区发展到现在的6大校区，从几十名学员发展到累计服务超过3000个家庭。</p><p>我们的成功源于对教育质量的执着追求：16-20人小班教学、师资分科教学、室内课堂与户外研学相结合。14位认证教师，每一位都经过严格筛选和专业培训。</p><p>98%的家长满意度，是我们最引以为豪的成绩。未来，佑森将继续深耕幼小衔接教育，帮助更多孩子自信迈入小学大门。</p>',
    category: 'company_news',
    tags: '品牌故事,幼小衔接',
    isFeatured: true,
    sortOrder: 1,
  },
  {
    title: '2026年秋季班招生开启',
    slug: 'yousen-news-2026-fall',
    excerpt: '2026年秋季幼小衔接班开始报名，6大校区同步招生，名额有限，预约从速。',
    content: '<p>2026年秋季班招生正式启动！幼小衔接全能班、课后托管班、全日制托班三大课程体系，6大校区同步招生。</p><p>幼小衔接全能班覆盖语文素养、数学思维、英语启蒙、学习习惯、社交适应5大模块，共160课时。坚持16-20人小班教学，师资分科授课。</p><p>即日起可通过网站预约免费试听，名额有限，先到先得。各校区联系电话请查看校区环境页面。</p>',
    category: 'event_notice',
    tags: '招生,秋季班',
    isFeatured: true,
    sortOrder: 2,
  },
  {
    title: '科学幼小衔接：不只是知识，更是习惯',
    slug: 'yousen-news-science-transition',
    excerpt: '幼小衔接不是提前学完小学知识，而是培养孩子适应小学生活的能力和习惯。',
    content: '<p>很多家长认为幼小衔接就是提前学拼音、学算术。但真正的科学幼小衔接，核心是培养孩子的学习习惯和社交适应能力。</p><p>在佑森，我们特别设置"学习习惯"模块，训练孩子的专注力、握笔姿势、坐姿和时间管理能力。这些看似简单的习惯，却是影响孩子整个学习生涯的基础。</p><p>同时，"社交适应"模块帮助孩子理解课堂规则、学会团队合作、管理情绪。从"以玩为主"到"以学为主"的过渡，不仅是知识的衔接，更是心理和行为的衔接。</p>',
    category: 'industry_news',
    tags: '教学理念,学习习惯',
    isFeatured: true,
    sortOrder: 3,
  },
  {
    title: '佑森6大校区全面升级',
    slug: 'yousen-news-campus-upgrade',
    excerpt: '2026年，佑森6大校区完成环境升级，为孩子们提供更舒适的学习空间。',
    content: '<p>为了给孩子们提供更好的学习环境，佑森在2026年对6大校区进行了全面升级。百步亭旗舰校区新增了多功能活动室，三阳路校区更新了全部教学设备，动物园校区扩大了户外活动区域。</p><p>钟家村校区、四新校区和沌口校区也分别完成了教室装修和设施更新。每个校区都配备了安全环保的教学设施、丰富的图书角和温馨的休息区。</p><p>欢迎家长带孩子来校区参观体验，感受佑森的学习环境。</p>',
    category: 'company_news',
    tags: '校区,升级',
    isFeatured: false,
    sortOrder: 4,
  },
  {
    title: '户外研学：让孩子在实践中成长',
    slug: 'yousen-news-outdoor-learning',
    excerpt: '佑森坚持室内课堂与户外研学相结合，每学期组织丰富的研学活动。',
    content: '<p>佑森小课堂的教学理念是"读万卷书，行万里路"。除了室内课堂学习，我们每学期都组织丰富的户外研学活动。</p><p>过去一年，我们组织了武汉动物园自然探索、植物园科学观察、博物馆文化体验、社区职业体验等研学活动。孩子们在实践中观察、思考、表达，将课堂知识与现实世界连接。</p><p>户外研学不仅拓展了孩子的视野，更培养了他们的观察力、好奇心和社交能力。这是传统课堂教学无法替代的成长体验。</p>',
    category: 'industry_news',
    tags: '研学,户外活动',
    isFeatured: false,
    sortOrder: 5,
  },
  {
    title: '师资团队：14位认证教师保驾护航',
    slug: 'yousen-news-teacher-team',
    excerpt: '佑森拥有14位认证教师，涵盖语文、数学、英语、综合素养各学科，平均教龄7年。',
    content: '<p>师资是教育质量的核心保障。佑森小课堂目前拥有14位认证教师，涵盖语文素养、数学思维、英语启蒙、综合素养等各个学科。</p><p>我们的教师团队平均教龄7年，全部本科及以上学历。每位教师都经过严格筛选和专业培训，不仅具备扎实的学科知识，更懂得如何与5-6岁的孩子沟通和互动。</p><p>佑森采用"师资分科教学"模式，每个学科由专业教师授课，确保教学深度和专业性。同时，小班教学让老师能关注到每个孩子的个性化需求。</p>',
    category: 'company_news',
    tags: '师资,教师团队',
    isFeatured: true,
    sortOrder: 6,
  },
  {
    title: '口碑认证：连续5年优质教育机构',
    slug: 'yousen-news-reputation',
    excerpt: '佑森小课堂连续5年获得优质教育机构认证，98%家长满意度是我们最大的动力。',
    content: '<p>佑森小课堂连续5年获得武汉市优质教育机构认证。这一荣誉背后，是我们对教育质量的坚持和对每个孩子的负责。</p><p>在家长满意度调查中，98%的家长对佑森的教学质量表示满意或非常满意。很多家长反馈，孩子在佑森不仅学到了知识，更养成了良好的学习习惯和社交能力。</p><p>7面铜匾、2项榜单荣誉、近百条家长好评截图，是佑森8年耕耘的最好见证。我们将继续努力，不辜负每一位家长的信任。</p>',
    category: 'company_news',
    tags: '口碑,荣誉',
    isFeatured: false,
    sortOrder: 7,
  },
  {
    title: '幼小衔接家长常见误区',
    slug: 'yousen-news-parent-mistakes',
    excerpt: '提前学完小学课本就是好的幼小衔接？不一定。家长常见的几个误区。',
    content: '<p>在幼小衔接这件事上，家长常有几个误区：</p><p><strong>误区一：提前学完小学知识就是好的衔接。</strong>实际上，过早灌输小学知识可能让孩子产生厌学情绪。科学的衔接是培养学习能力和习惯，而非知识的提前灌输。</p><p><strong>误区二：幼小衔接不需要，上学自然就会了。</strong>从"以玩为主"到"以学为主"的转变，孩子需要适应期。没有衔接的孩子可能面临专注力不足、规则意识弱等问题。</p><p><strong>误区三：选机构只看名气。</strong>适合自己的才是最好的。建议家长实地考察、试听体验，关注师生比、教学理念和老师专业度。</p>',
    category: 'industry_news',
    tags: '家长指南,误区',
    isFeatured: false,
    sortOrder: 8,
  },
  {
    title: '2026暑期班圆满结业',
    slug: 'yousen-news-2026-summer',
    excerpt: '为期2个月的暑期班圆满结业，孩子们在快乐中收获了成长。',
    content: '<p>2026年8月，佑森小课堂暑期班圆满结业。为期2个月的暑期课程中，孩子们在快乐中收获了知识、习惯和友谊。</p><p>本次暑期班包含拼音启蒙、数学思维、英语口语、手工创意、户外研学等丰富内容。结业仪式上，孩子们展示了自己制作的手工作品，表演了英语儿歌，每位孩子都获得了结业证书。</p><p>家长们纷纷表示，孩子在暑期班中不仅学到了知识，更变得更自信、更独立。感谢家长们的信任与支持，佑森将继续为孩子们的成长保驾护航。</p>',
    category: 'event_notice',
    tags: '暑期班,结业',
    isFeatured: false,
    sortOrder: 9,
  },
  {
    title: 'AI时代下的幼儿教育探索',
    slug: 'yousen-news-ai-education',
    excerpt: 'AI技术飞速发展，幼儿教育应如何应对？佑森的思考与实践。',
    content: '<p>AI时代已经到来，ChatGPT、AI绘画等技术正在改变世界。作为幼儿教育工作者，我们不禁思考：AI时代的孩子需要什么样的能力？</p><p>在佑森，我们认为AI时代最重要的不是知识的记忆，而是：1）好奇心与探索欲——AI能给出答案，但提出好问题更重要；2）创造力——AI擅长模仿，但原创思维是人类的独特优势；3）社交与情感能力——人际交往和情感理解是AI无法替代的。</p><p>因此，佑森在课程中特别注重培养孩子的提问能力、创造力和社交能力。我们相信，这些能力将帮助孩子在AI时代保持竞争力和幸福感。</p>',
    category: 'industry_news',
    tags: 'AI教育,创新',
    isFeatured: false,
    sortOrder: 10,
  },
];

// === Helper 函数 ===

const log = (msg) => console.log(msg);
const warn = (msg) => console.warn(`  ⚠ ${msg}`);
const ok = (msg) => console.log(`  ✓ ${msg}`);
const info = (msg) => console.log(`  → ${msg}`);

async function uploadImage(strapi, filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    warn(`图片不存在: ${filePath}`);
    return null;
  }
  const stats = fs.statSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp' };
  const type = mimeMap[ext] || 'image/jpeg';
  // Strapi v5 upload service 期望 formidable 格式的 file 对象
  // （originalFilename / mimetype / size / filepath，tmpWorkingDirectory 由 service 自动添加）
  const uploadService = strapi.plugins.upload.services.upload;
  const result = await uploadService.upload({
    files: {
      originalFilename: path.basename(filePath),
      mimetype: type,
      size: stats.size,
      filepath: filePath,
    },
    data: {},
  });
  return Array.isArray(result) ? result[0].id : result.id;
}

// 检测 content type 是否启用 i18n
// 注意：即使 schema.json 没有 pluginOptions.i18n.localized，数据库表可能有 locale 字段
// 对有 locale 字段的表，无条件传 locale 参数避免 locale=NULL
function isLocalizedContentType(strapi, uid) {
  const ct = strapi.contentTypes[uid];
  return ct?.pluginOptions?.i18n?.localized === true;
}

async function findBySlug(strapi, uid, slug) {
  const found = await strapi.documents(uid).findFirst({
    filters: { slug: { $eq: slug } },
  });
  return found || null;
}

async function seedEntity(strapi, uid, slug, data, force) {
  const existing = await findBySlug(strapi, uid, slug);
  // Strapi v5: status 是 create/update 的顶层参数，不能放在 data 里
  const { status, ...fields } = data;
  const publishStatus = status || 'published';
  // 无条件传 locale: 'zh-CN'
  // 即使 schema.json 没声明 i18n pluginOptions，数据库表有 locale 字段时此参数会写入
  // 如果 Strapi 因 content type 不支持 locale 而报错，catch 后不传 locale 重试
  const doCreate = async (localeOpts) => strapi.documents(uid).create({
    data: fields,
    status: publishStatus,
    ...localeOpts,
  });
  const doUpdate = async (localeOpts) => strapi.documents(uid).update({
    documentId: existing.documentId,
    data: fields,
    status: publishStatus,
    ...localeOpts,
  });
  if (existing && !force) {
    info(`已存在，跳过 (slug=${slug})`);
    return existing;
  }
  try {
    if (existing && force) {
      const updated = await doUpdate({ locale: 'zh-CN' });
      ok(`更新成功 (slug=${slug})`);
      return updated;
    }
    const created = await doCreate({ locale: 'zh-CN' });
    ok(`创建成功 (slug=${slug})`);
    return created;
  } catch (e) {
    // 如果 locale 参数不被支持，回退到不传 locale
    if (e.message && /locale/i.test(e.message)) {
      warn(`locale 不支持，回退 (slug=${slug}): ${e.message}`);
      if (existing && force) {
        const updated = await doUpdate({});
        ok(`更新成功 (slug=${slug})`);
        return updated;
      }
      const created = await doCreate({});
      ok(`创建成功 (slug=${slug})`);
      return created;
    }
    throw e;
  }
}

async function removeEntity(strapi, uid, slug) {
  const existing = await findBySlug(strapi, uid, slug);
  if (!existing) {
    info(`不存在，跳过 (slug=${slug})`);
    return;
  }
  await strapi.documents(uid).delete({ documentId: existing.documentId });
  ok(`删除成功 (slug=${slug})`);
}

// === Entity Seeders ===

async function seedSiteSettings(strapi, force, remove) {
  log('\n=== Site Settings ===');
  if (remove) { info('site-settings 是 single type，跳过删除'); return; }
  const uid = 'api::site-settings.site-settings';
  const existing = await strapi.documents(uid).findFirst({});

  // 上传 logo
  let logoId = null;
  if (existing?.logo) {
    info('logo 已存在，保留');
    logoId = existing.logo.id || existing.logo.documentId;
  } else {
    logoId = await uploadImage(strapi, LOGO_IMG);
    if (logoId) ok(`logo 上传成功 (id=${logoId})`);
    else warn('logo 上传失败，使用占位');
  }

  const data = { ...SITE_SETTINGS, ...(logoId ? { logo: logoId } : {}) };

  if (existing && !force) { info('已存在，跳过'); return; }
  if (existing && force) {
    await strapi.documents(uid).update({ documentId: existing.documentId, data, status: 'published' });
    ok('更新成功');
  } else {
    await strapi.documents(uid).create({ data, status: 'published' });
    ok('创建成功');
  }
}

async function seedNavigation(strapi, force, remove) {
  log('\n=== Navigation ===');
  const uid = 'api::navigation.navigation';

  // 先收集所有已有记录（按 url 索引），便于查重和清理
  const allExisting = await strapi.documents(uid).findMany({ limit: 100 });
  const existingByUrl = new Map();
  for (const e of allExisting) { existingByUrl.set(e.url, e); }

  if (remove) {
    // 先删子项，再删父项
    for (const item of NAVIGATION) {
      for (const child of (item.children || [])) {
        const ex = existingByUrl.get(child.url);
        if (ex) { await strapi.documents(uid).delete({ documentId: ex.documentId }); ok(`删除子项 (url=${child.url})`); }
      }
      const ex = existingByUrl.get(item.url);
      if (ex) { await strapi.documents(uid).delete({ documentId: ex.documentId }); ok(`删除父项 (url=${item.url})`); }
    }
    return;
  }

  // 第一遍：创建/更新所有父项，记录 documentId
  const parentDocIds = new Map(); // url -> documentId
  for (const item of NAVIGATION) {
    const { children, ...parentData } = item;
    const data = { ...parentData, isActive: true };
    const existing = existingByUrl.get(item.url);
    let docId;
    if (existing && !force) { info(`父项已存在，跳过 (url=${item.url})`); docId = existing.documentId; }
    else if (existing && force) {
      const updated = await strapi.documents(uid).update({ documentId: existing.documentId, data, status: 'published' });
      ok(`父项更新成功 (url=${item.url})`);
      docId = updated.documentId;
    } else {
      const created = await strapi.documents(uid).create({ data, status: 'published' });
      ok(`父项创建成功 (url=${item.url})`);
      docId = created.documentId;
    }
    parentDocIds.set(item.url, docId);
  }

  // 第二遍：创建/更新子项，设置 parent 关系
  for (const item of NAVIGATION) {
    if (!item.children || item.children.length === 0) continue;
    const parentDocId = parentDocIds.get(item.url);
    for (const child of item.children) {
      const childData = { name: child.name, url: child.url, position: child.position, isExternal: child.isExternal, isActive: true, parent: parentDocId };
      const existing = existingByUrl.get(child.url);
      if (existing && !force) { info(`子项已存在，跳过 (url=${child.url})`); continue; }
      if (existing && force) {
        await strapi.documents(uid).update({ documentId: existing.documentId, data: childData, status: 'published' });
        ok(`子项更新成功 (url=${child.url})`);
      } else {
        await strapi.documents(uid).create({ data: childData, status: 'published' });
        ok(`子项创建成功 (url=${child.url})`);
      }
    }
  }
}

async function seedFooter(strapi, force, remove) {
  log('\n=== Footer ===');
  if (remove) { info('footer 是 single type，跳过删除'); return; }
  const uid = 'api::footer.footer';
  const existing = await strapi.documents(uid).findFirst({});
  if (existing && !force) { info('已存在，跳过'); return; }
  if (existing && force) {
    await strapi.documents(uid).update({ documentId: existing.documentId, data: FOOTER, status: 'published' });
    ok('更新成功');
  } else {
    await strapi.documents(uid).create({ data: FOOTER, status: 'published' });
    ok('创建成功');
  }
}

async function seedCategories(strapi, force, remove) {
  log('\n=== Product Categories ===');
  const uid = 'api::product-category.product-category';
  for (const cat of CATEGORIES) {
    if (remove) { await removeEntity(strapi, uid, cat.slug); continue; }
    await seedEntity(strapi, uid, cat.slug, { ...cat, status: 'published' }, force);
  }
}

async function seedSpecs(strapi, force, remove) {
  log('\n=== Product Specs ===');
  const uid = 'api::product-spec.product-spec';
  for (const spec of SPECS) {
    if (remove) {
      const existing = await strapi.documents(uid).findFirst({ filters: { code: { $eq: spec.code } } });
      if (existing) { await strapi.documents(uid).delete({ documentId: existing.documentId }); ok(`删除成功 (code=${spec.code})`); }
      else { info(`不存在，跳过 (code=${spec.code})`); }
      continue;
    }
    const existing = await strapi.documents(uid).findFirst({ filters: { code: { $eq: spec.code } } });
    const data = { ...spec };
    if (existing && !force) { info(`已存在，跳过 (code=${spec.code})`); continue; }
    if (existing && force) {
      await strapi.documents(uid).update({ documentId: existing.documentId, data, status: 'published' });
      ok(`更新成功 (code=${spec.code})`);
    } else {
      await strapi.documents(uid).create({ data, status: 'published' });
      ok(`创建成功 (code=${spec.code})`);
    }
  }
}

async function seedCourses(strapi, force, remove) {
  log('\n=== Courses (Products) ===');
  // 先确保 specs 和 categories 已存在
  await seedSpecs(strapi, force, false);
  await seedCategories(strapi, force, false);

  const uid = 'api::product.product';
  const catUid = 'api::product-category.product-category';
  const specUid = 'api::product-spec.product-spec';

  for (const course of COURSES) {
    if (remove) { await removeEntity(strapi, uid, course.slug); continue; }

    const category = await findBySlug(strapi, catUid, course.categorySlug);
    const allSpecs = await strapi.documents(specUid).findMany({ pagination: { limit: 100 } });
    const specIds = allSpecs.map(s => s.documentId);

    const thumbnailId = await uploadImage(strapi, COURSE_IMG[course.imgKey]);

    const data = {
      name: course.name,
      slug: course.slug,
      sku: course.sku,
      description: course.description,
      shortDescription: course.shortDescription,
      price: course.price,
      isInStock: course.isInStock,
      isFeatured: course.isFeatured,
      specValues: course.specValues,
      teachingMethod: course.teachingMethod,
      objectives: course.objectives,
      outline: course.outline,
      testimonials: course.testimonials,
      categories: category ? [category.documentId] : [],
      specs: specIds,
      ...(thumbnailId ? { thumbnail: thumbnailId } : {}),
      status: 'published',
    };

    await seedEntity(strapi, uid, course.slug, data, force);
  }
}

async function seedCampuses(strapi, force, remove) {
  log('\n=== Campuses ===');
  const uid = 'api::campus.campus';
  for (const campus of CAMPUSES) {
    if (remove) { await removeEntity(strapi, uid, campus.slug); continue; }

    const imgConfig = CAMPUS_IMG[campus.imgKey];
    const coverId = await uploadImage(strapi, imgConfig.cover);
    const galleryIds = [];
    for (const gPath of imgConfig.gallery) {
      const gid = await uploadImage(strapi, gPath);
      if (gid) galleryIds.push(gid);
    }

    const data = {
      name: campus.name,
      slug: campus.slug,
      area: campus.area,
      address: campus.address,
      phone: campus.phone,
      businessHours: campus.businessHours,
      transportation: campus.transportation,
      description: campus.description,
      sortOrder: campus.sortOrder,
      ...(coverId ? { coverImage: coverId } : {}),
      ...(galleryIds.length ? { gallery: galleryIds } : {}),
      status: 'published',
    };

    await seedEntity(strapi, uid, campus.slug, data, force);
  }
}

async function seedTeachers(strapi, force, remove) {
  log('\n=== Teachers ===');
  const uid = 'api::teacher.teacher';
  const campusUid = 'api::campus.campus';

  for (const teacher of TEACHERS) {
    if (remove) { await removeEntity(strapi, uid, teacher.slug); continue; }

    const campus = await findBySlug(strapi, campusUid, teacher.campusSlug);
    // TEACHER_IMG 的 key 是校区 slug 去掉 'yousen-' 前缀（如 baibuting）
    const teacherImgKey = teacher.campusSlug.replace('yousen-', '');
    const avatarId = await uploadImage(strapi, TEACHER_IMG[teacherImgKey]);

    const data = {
      name: teacher.name,
      slug: teacher.slug,
      title: teacher.title,
      subject: teacher.subject,
      teachingYears: teacher.teachingYears,
      education: teacher.education,
      teachingFeatures: teacher.teachingFeatures,
      isFeatured: teacher.isFeatured,
      sortOrder: teacher.sortOrder,
      ...(campus ? { campus: campus.documentId } : {}),
      ...(avatarId ? { avatar: avatarId } : {}),
      status: 'published',
    };

    await seedEntity(strapi, uid, teacher.slug, data, force);
  }
}

async function seedFaqs(strapi, force, remove) {
  log('\n=== FAQ Items ===');
  const uid = 'api::faq-item.faq-item';
  for (const faq of FAQS) {
    if (remove) {
      const existing = await strapi.documents(uid).findFirst({ filters: { question: { $eq: faq.question } } });
      if (existing) { await strapi.documents(uid).delete({ documentId: existing.documentId }); ok(`删除成功 (Q=${faq.question.substring(0, 20)}...)`); }
      else { info(`不存在，跳过 (Q=${faq.question.substring(0, 20)}...)`); }
      continue;
    }
    const existing = await strapi.documents(uid).findFirst({ filters: { question: { $eq: faq.question } } });
    const data = { ...faq, isActive: true };
    if (existing && !force) { info(`已存在，跳过 (Q=${faq.question.substring(0, 20)}...)`); continue; }
    if (existing && force) {
      await strapi.documents(uid).update({ documentId: existing.documentId, data });
      ok(`更新成功 (Q=${faq.question.substring(0, 20)}...)`);
    } else {
      await strapi.documents(uid).create({ data });
      ok(`创建成功 (Q=${faq.question.substring(0, 20)}...)`);
    }
  }
}

async function seedNews(strapi, force, remove) {
  log('\n=== News Articles ===');
  const uid = 'api::news-article.news-article';
  for (let i = 0; i < NEWS.length; i++) {
    const article = NEWS[i];
    if (remove) { await removeEntity(strapi, uid, article.slug); continue; }

    const coverId = await uploadImage(strapi, NEWS_IMG[i % NEWS_IMG.length]);

    const data = {
      title: article.title,
      slug: article.slug,
      excerpt: article.excerpt,
      content: article.content,
      category: article.category,
      tags: article.tags,
      isFeatured: article.isFeatured,
      viewCount: Math.floor(Math.random() * 500) + 50,
      sortOrder: article.sortOrder,
      ...(coverId ? { coverImage: coverId } : {}),
      status: 'published',
    };

    await seedEntity(strapi, uid, article.slug, data, force);
  }
}

async function seedPages(strapi, force, remove) {
  log('\n=== Pages + Sections ===');
  const uid = 'api::page.page';
  const productUid = 'api::product.product';
  const faqUid = 'api::faq-item.faq-item';

  const homepageSlug = 'homepage';
  if (remove) {
    await removeEntity(strapi, uid, homepageSlug);
    await removeEntity(strapi, uid, 'about');
    await removeEntity(strapi, uid, 'refund-policy');
    await removeEntity(strapi, uid, 'privacy-policy');
    await removeEntity(strapi, uid, 'user-agreement');
    return;
  }

  // 清理其他 isHomepage=true 的页面，避免 controller 返回旧首页
  const existingHomepages = await strapi.documents(uid).findMany({
    filters: { isHomepage: true },
    pagination: { limit: 50 },
  });
  for (const hp of existingHomepages) {
    if (hp.slug !== homepageSlug) {
      await strapi.documents(uid).update({
        documentId: hp.documentId,
        data: { isHomepage: false },
        status: hp.status || 'published',
      });
      warn(`已取消旧首页标记 (slug=${hp.slug}, id=${hp.id})`);
    }
  }

  const allProducts = await strapi.documents(productUid).findMany({ pagination: { limit: 100 } });
  const productIds = allProducts.map(p => p.documentId);

  const allFaqs = await strapi.documents(faqUid).findMany({ pagination: { limit: 100 } });
  const faqIds = allFaqs.map(f => f.documentId);

  const homepageSections = [
    {
      __component: 'section.hero',
      title: '让每个孩子自信迈入小学大门',
      subtitle: '2026年秋季班正在招生 · 名额有限',
      description: '专注幼小衔接教育8年，科学课程体系 + 专业师资团队，帮助3-6岁儿童在入学前全面准备。',
      buttonText: '立即预约试听',
      buttonUrl: '/contact',
      isFullWidth: true,
      overlayColor: 'rgba(0,0,0,0.3)',
    },
    {
      __component: 'section.advantages',
      title: '为什么选择佑森',
      description: '8年深耕幼小衔接教育，用专业和爱心陪伴每一个孩子',
      advantages: [
        { title: '8年+ 专注',       description: '专注幼小衔接教育8年',           icon: 'award',   color: '#3b82f6', bgColor: '#eff6ff' },
        { title: '3000+ 毕业学员', description: '累计服务超过3000个家庭',       icon: 'users',   color: '#10b981', bgColor: '#ecfdf5' },
        { title: '98% 家长满意度', description: '连续5年优质教育机构',           icon: 'heart',   color: '#f59e0b', bgColor: '#fffbeb' },
        { title: '6所 直营校区',    description: '遍布武汉三镇，就近选择',       icon: 'map-pin', color: '#8b5cf6', bgColor: '#f5f3ff' },
      ],
    },
    {
      __component: 'section.product-grid',
      title: '课程体系',
      description: '5大模块系统课程，科学衔接，全面准备',
      products: productIds,
      columns: '3',
      showFilter: false,
    },
    {
      __component: 'section.features',
      title: '教学特色',
      description: '科学的教学模式，让孩子在快乐中成长',
      features: [
        { title: '小班教学',  description: '16-20人小班，关注每个孩子',     icon: 'users' },
        { title: '分科授课',  description: '专业教师分科教学，更专业',       icon: 'book-open' },
        { title: '室内+户外', description: '室内课堂与户外活动结合',         icon: 'sun' },
        { title: '研学活动',  description: '每学期组织丰富研学体验',         icon: 'compass' },
      ],
    },
    {
      __component: 'section.testimonials',
      title: '家长口碑',
      testimonials: [
        { content: '孩子上了一年后，拼音和数学基础很扎实，上小学完全不用操心。老师非常负责！',     author: '梓涵妈妈', position: '幼小衔接班家长', company: '' },
        { content: '小班教学关注到每个孩子，习惯养成效果很好。户外研学活动孩子特别喜欢。',           author: '子轩爸爸', position: '幼小衔接班家长', company: '' },
        { content: '从试听到报名，整个流程很专业。孩子在这里变得更自信了，社交能力提升很大。',       author: '一诺妈妈', position: '托班家长',       company: '' },
      ],
    },
    {
      __component: 'section.contact-form',
      title: '预约免费试听',
      description: '填写以下信息，我们将尽快与您联系安排试听',
      submitText: '立即预约',
      successMessage: '预约成功！我们将在24小时内与您联系。',
      fields: [
        { label: '家长姓名', name: 'parentName', type: 'text',     required: true,  placeholder: '请输入家长姓名',  options: null },
        { label: '手机号码', name: 'phone',      type: 'phone',    required: true,  placeholder: '请输入手机号码',  options: null },
        { label: '孩子年龄', name: 'childAge',   type: 'select',   required: true,  placeholder: '请选择孩子年龄',  options: '{"options":["3岁","4岁","5岁","6岁","7岁+"]}' },
        { label: '意向课程', name: 'course',     type: 'select',   required: false, placeholder: '请选择意向课程',  options: '{"options":["幼小衔接","课后托管","托班"]}' },
        { label: '留言',     name: 'message',    type: 'textarea', required: false, placeholder: '其他需求或问题',  options: null },
      ],
    },
    {
      __component: 'section.faq',
      title: '常见问题',
      faqs: faqIds,
      showSearch: true,
    },
  ];

  const homepageData = {
    title: '佑森小课堂 - 专注幼小衔接教育8年',
    slug: homepageSlug,
    isHomepage: true,
    sections: homepageSections,
    layout: 'full-width',
    showNavigation: true,
    showFooter: true,
    status: 'published',
  };

  await seedEntity(strapi, uid, homepageSlug, homepageData, force);

  // === 关于我们页 ===
  const aboutData = {
    title: '关于我们',
    slug: 'about',
    isHomepage: false,
    sections: [
      {
        __component: 'section.advantages',
        title: '8年深耕，匠心育人',
        description: '用数据和成绩说话，每一个数字背后都是家长的信任与孩子的成长',
        advantages: [
          { title: '8年+',        description: '专注幼小衔接教育8年，深耕武汉市场',           icon: 'award',   color: '#3b82f6', bgColor: '#eff6ff' },
          { title: '3000+',       description: '累计服务超过3000个家庭，口碑传承',           icon: 'users',   color: '#10b981', bgColor: '#ecfdf5' },
          { title: '6大校区',     description: '遍布武汉三镇，就近选择优质教学',             icon: 'map-pin', color: '#8b5cf6', bgColor: '#f5f3ff' },
          { title: '98% 满意度',  description: '连续5年家长满意度调研达98%以上',             icon: 'heart',   color: '#f59e0b', bgColor: '#fffbeb' },
        ],
      },
      {
        __component: 'section.rich-text',
        title: '关于佑森小课堂',
        alignment: 'left',
        content: '<p>武汉佑森小课堂艺术培训学校有限公司，成立于2018年，是一家专注幼小衔接教育的专业培训机构。</p><p>8年来，我们从1个校区发展到6大校区，遍布武汉三镇（江岸区、汉阳区、经开区），累计服务超过3000个家庭，98%的家长满意度是我们最引以为豪的成绩。</p><p>作为武汉本土幼小衔接教育品牌，我们深知从幼儿园到小学这一关键过渡期的重要性。佑森小课堂以"科学衔接、快乐成长"为宗旨，致力于帮助3-6岁儿童在入学前做好知识、习惯、能力和心理的全面准备。</p>',
      },
      {
        __component: 'section.rich-text',
        title: '办学理念与师资力量',
        alignment: 'left',
        content: '<p><strong>办学理念</strong></p><p>我们相信，幼小衔接不只是知识的衔接，更是习惯、能力和心理的衔接。佑森坚持"科学衔接、快乐成长"的理念，通过5大核心模块（语文素养、数学思维、英语启蒙、学习习惯、社交适应），帮助孩子顺利过渡到小学生活。</p><p><strong>师资力量</strong></p><p>14位认证教师，平均教龄7年，全部本科及以上学历。师资分科教学，每个学科由专业教师授课，确保教学深度和专业性。教师团队定期参加教研培训，持续提升教学水平。</p><p><strong>教学特色</strong></p><p>16-20人小班教学、室内课堂与户外研学相结合、师资分科教学。我们不仅教知识，更培养习惯和能力，让每个孩子都能自信迈入小学大门。</p>',
      },
      {
        __component: 'section.features',
        title: '资质荣誉',
        description: '专业资质认证，值得家长信赖',
        features: [
          { title: '办学许可证',   description: '武汉市教育局批准的正规艺术培训学校，持证办学，合规合法', icon: 'shield' },
          { title: 'ISO质量认证',  description: '通过ISO9001质量管理体系认证，教学服务流程标准化',     icon: 'award' },
          { title: '家长信赖品牌', description: '连续5年荣获武汉家长推荐幼小衔接教育品牌',             icon: 'heart' },
        ],
      },
    ],
    layout: 'boxed',
    showNavigation: true,
    showFooter: true,
    status: 'published',
  };
  await seedEntity(strapi, uid, 'about', aboutData, force);

  // === 退费政策页 ===
  const refundData = {
    title: '退费政策',
    slug: 'refund-policy',
    isHomepage: false,
    sections: [
      {
        __component: 'section.rich-text',
        title: '退费政策',
        alignment: 'left',
        content: '<p>佑森小课堂秉承诚信办学原则，退费政策如下：</p><p><strong>一、退费标准</strong></p><p>1. 开课前申请退费：全额退还学费。</p><p>2. 开课后退费：按剩余课时比例退还学费（已上课时按单课时价格扣除）。</p><p>3. 教材费：已领取教材的，按实际费用扣除。</p><p><strong>二、退费流程</strong></p><p>1. 家长向所在校区前台提交退费申请。</p><p>2. 填写《退费申请表》，提交缴费凭证。</p><p>3. 校区审核后，7个工作日内退费至家长支付账户。</p><p><strong>三、特殊情况</strong></p><p>1. 因校区原因导致课程取消，全额退费。</p><p>2. 因不可抗力导致停课，按实际停课时间顺延或退费。</p><p>3. 转校不产生额外费用。</p><p>如有疑问，请咨询各校区前台或致电客服。</p>',
      },
    ],
    layout: 'boxed',
    showNavigation: true,
    showFooter: true,
    status: 'published',
  };
  await seedEntity(strapi, uid, 'refund-policy', refundData, force);

  // === 隐私政策页 ===
  const privacyData = {
    title: '隐私政策',
    slug: 'privacy-policy',
    isHomepage: false,
    sections: [
      {
        __component: 'section.rich-text',
        title: '隐私政策',
        alignment: 'left',
        content: '<p>武汉佑森小课堂艺术培训学校有限公司（以下简称"我们"）深知个人信息对您的重要性，我们将按照法律法规的规定，保护您的个人信息及隐私安全。</p><p>本隐私政策适用于您通过我们的官方网站、小程序等渠道使用我们的产品或服务。</p><p><strong>一、信息收集</strong></p><p>1. 您主动提供的信息：姓名、手机号码、孩子年龄、意向课程、留言等预约试听信息。</p><p>2. 自动收集的信息：访问时间、IP地址、浏览器类型、设备信息等。</p><p>3. Cookie信息：为提升用户体验，我们使用Cookie记住您的偏好设置。</p><p><strong>二、信息使用</strong></p><p>1. 提供试听预约服务，与您联系安排试听时间。</p><p>2. 改善我们的产品和服务，优化用户体验。</p><p>3. 发送教育资讯、课程通知等服务信息（您可随时退订）。</p><p>4. 遵守法律法规要求，配合监管需要。</p><p><strong>三、信息保护</strong></p><p>1. 我们采用严格的安全措施保护您的个人信息，防止未经授权的访问、使用或泄露。</p><p>2. 仅授权人员可在必要范围内访问您的个人信息，并签署保密协议。</p><p>3. 我们将在实现目的所必要的最短时间内保留您的信息。</p><p><strong>四、用户权利</strong></p><p>1. 您有权访问、更正、删除您的个人信息。</p><p>2. 您有权撤回信息处理授权。</p><p>3. 如需行使上述权利，请通过页面底部的联系方式与我们沟通。</p><p><strong>五、Cookie政策</strong></p><p>我们使用Cookie来记住您的偏好设置、分析网站流量。您可以通过浏览器设置管理或删除Cookie。</p><p><strong>六、政策更新</strong></p><p>本隐私政策可能不时更新，更新后我们将在网站公布。继续使用服务即视为您同意更新后的政策。</p><p>如有疑问，请咨询各校区前台或致电客服。</p>',
      },
    ],
    layout: 'boxed',
    showNavigation: true,
    showFooter: true,
    status: 'published',
  };
  await seedEntity(strapi, uid, 'privacy-policy', privacyData, force);

  // === 用户协议页 ===
  const agreementData = {
    title: '用户协议',
    slug: 'user-agreement',
    isHomepage: false,
    sections: [
      {
        __component: 'section.rich-text',
        title: '用户协议',
        alignment: 'left',
        content: '<p>欢迎使用武汉佑森小课堂艺术培训学校有限公司（以下简称"佑森小课堂"）提供的在线服务。请您在使用本服务前，仔细阅读并同意以下用户协议。</p><p><strong>一、服务说明</strong></p><p>1. 本服务由佑森小课堂提供，包括但不限于课程预约、在线咨询、资讯浏览等功能。</p><p>2. 我们保留随时修改、暂停或终止部分或全部服务的权利。</p><p><strong>二、用户注册</strong></p><p>1. 您应保证提供的信息真实、准确、完整。</p><p>2. 您应对您的账户和密码安全负责，因您保管不善造成的损失由您自行承担。</p><p>3. 不得将账户转让、出借给他人使用。</p><p><strong>三、用户行为规范</strong></p><p>1. 您不得利用本服务从事违法违规活动。</p><p>2. 您不得发布侵犯他人合法权益的内容。</p><p>3. 您不得干扰本服务的正常运行，包括但不限于攻击服务器、传播病毒等。</p><p>4. 您不得以任何方式获取、泄露他人个人信息。</p><p><strong>四、知识产权</strong></p><p>1. 本服务中的所有内容（包括但不限于文字、图片、音频、视频、软件等）的知识产权归佑森小课堂或相关权利人所有。</p><p>2. 未经授权，您不得复制、转载、传播或用于商业用途。</p><p>3. 您发布的内容，您授予佑森小课堂在全球范围内免费的、非独占的使用许可。</p><p><strong>五、免责声明</strong></p><p>1. 本服务按"现状"提供，我们不保证服务不中断或没有错误。</p><p>2. 因不可抗力、系统维护等原因导致服务中断，我们不承担赔偿责任。</p><p>3. 您因使用本服务产生的风险由您自行承担。</p><p><strong>六、协议修改</strong></p><p>我们有权随时修改本协议，修改后的协议一经公布即生效。继续使用服务即视为您同意修改后的协议。</p><p><strong>七、法律适用</strong></p><p>本协议的签订、履行、解释及争议解决均适用中华人民共和国法律。如发生争议，双方应友好协商解决；协商不成的，任何一方均可向佑森小课堂所在地有管辖权的人民法院提起诉讼。</p><p>如有疑问，请咨询各校区前台或致电客服。</p>',
      },
    ],
    layout: 'boxed',
    showNavigation: true,
    showFooter: true,
    status: 'published',
  };
  await seedEntity(strapi, uid, 'user-agreement', agreementData, force);
}

// === Main ===

async function main() {
  log('=== 佑森小课堂 Strapi Seed 脚本 ===');
  log(`模式: ${remove ? '删除' : force ? '强制更新' : '创建（跳过已存在）'}`);
  log(`实体: ${entities.join(', ')}`);

  // 显式指定 distDir：让 Strapi 从 dist/ 加载编译后的 .js 配置和 schemas
  // 否则配置加载器尝试加载 config/*.ts 会报 "extension must be one of .js,.json"
  // 这样在本地宿主机和 Docker 容器内都能执行
  const distDir = path.resolve(__dirname, '..', 'dist');
  const strapi = await createStrapi({ distDir }).load();
  log('Strapi 已启动\n');

  try {
    const shouldRun = (name) => entities.includes(name);

    if (shouldRun('settings'))   await seedSiteSettings(strapi, force, remove);
    if (shouldRun('navigation')) await seedNavigation(strapi, force, remove);
    if (shouldRun('footer'))     await seedFooter(strapi, force, remove);
    if (shouldRun('categories')) await seedCategories(strapi, force, remove);
    if (shouldRun('courses'))    await seedCourses(strapi, force, remove);
    if (shouldRun('campuses'))   await seedCampuses(strapi, force, remove);
    if (shouldRun('teachers'))   await seedTeachers(strapi, force, remove);
    if (shouldRun('faqs'))       await seedFaqs(strapi, force, remove);
    if (shouldRun('news'))       await seedNews(strapi, force, remove);
    if (shouldRun('pages'))      await seedPages(strapi, force, remove);

    log('\n=== 完成 ===');
  } catch (err) {
    console.error('\n❌ 错误:', err.message);
    console.error(err.stack);
    process.exitCode = 1;
  } finally {
    await strapi.destroy();
  }
}

main();
