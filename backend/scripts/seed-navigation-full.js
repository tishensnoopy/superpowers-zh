const fetch = require('node-fetch');

const API_URL = 'http://localhost:1337/api';

async function getNavItems() {
  const res = await fetch(`${API_URL}/navigation?populate=*`);
  return res.json();
}

async function createNavItem(data) {
  const res = await fetch(`${API_URL}/navigation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data })
  });
  return res.json();
}

async function updateNavItem(id, data) {
  const res = await fetch(`${API_URL}/navigation/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data })
  });
  return res.json();
}

async function main() {
  console.log('=== Seeding Full Navigation Data ===\n');

  const existing = await getNavItems();
  const navMap = new Map();
  existing.data.forEach(item => {
    navMap.set(item.attributes.name, item);
  });

  console.log('Existing items:', [...navMap.keys()]);

  if (navMap.has('课程体系') && navMap.get('课程体系').attributes.url !== '/courses') {
    await updateNavItem(navMap.get('课程体系').id, { url: '/courses' });
    console.log('Updated 课程体系 URL to /courses');
  }

  const navItems = [
    { name: '校区介绍', url: '/campuses', position: 4 },
    { name: '师资团队', url: '/team', position: 5 },
  ];

  for (const item of navItems) {
    if (!navMap.has(item.name)) {
      const result = await createNavItem(item);
      navMap.set(item.name, result.data);
      console.log(`Created: ${item.name} (${item.url})`);
    } else {
      console.log(`Already exists: ${item.name}`);
    }
  }

  const childrenData = {
    '关于我们': [
      { name: '学校介绍', url: '/about/school', position: 0 },
      { name: '办学理念', url: '/about/philosophy', position: 1 },
      { name: '资质荣誉', url: '/about/achievements', position: 2 },
    ],
    '课程体系': [
      { name: '语言启蒙', url: '/courses/language', position: 0 },
      { name: '数学思维', url: '/courses/math', position: 1 },
      { name: '英语口语', url: '/courses/english', position: 2 },
      { name: '综合素养', url: '/courses/comprehensive', position: 3 },
    ],
    '校区介绍': [
      { name: '朝阳校区', url: '/campuses/chaoyang', position: 0 },
      { name: '海淀校区', url: '/campuses/haidian', position: 1 },
      { name: '西城校区', url: '/campuses/xicheng', position: 2 },
      { name: '丰台校区', url: '/campuses/fengtai', position: 3 },
    ],
  };

  const allItems = await getNavItems();
  const childByParent = new Map();
  allItems.data.forEach(item => {
    const parentId = item.attributes.parent?.data?.id;
    if (parentId) {
      if (!childByParent.has(parentId)) {
        childByParent.set(parentId, new Set());
      }
      childByParent.get(parentId).add(item.attributes.name);
    }
  });

  const freshMap = new Map();
  allItems.data.forEach(item => {
    freshMap.set(item.attributes.name, item);
  });

  for (const [parentName, children] of Object.entries(childrenData)) {
    const parent = freshMap.get(parentName);
    if (!parent) {
      console.log(`Warning: Parent not found: ${parentName}`);
      continue;
    }

    const existingChildNames = childByParent.get(parent.id) || new Set();

    for (const child of children) {
      if (!existingChildNames.has(child.name)) {
        const result = await createNavItem({ ...child, parent: parent.id });
        console.log(`Created child: ${parentName} > ${child.name}`);
      } else {
        console.log(`Child already exists: ${parentName} > ${child.name}`);
      }
    }
  }

  console.log('\n=== Verifying navigation tree ===');
  const verify = await fetch(`${API_URL}/navigation?populate=children`);
  const verifyJson = await verify.json();
  
  verifyJson.data.forEach(item => {
    const children = item.attributes.children?.data || [];
    console.log(`- ${item.attributes.name} (${item.attributes.url})${children.length > 0 ? ` [${children.map(c => c.attributes.name).join(', ')}]` : ''}`);
  });

  console.log('\n=== Done ===');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});