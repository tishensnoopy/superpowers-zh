import ProductGrid from '../components/sections/ProductGrid';

export default function CoursesPage() {
  return (
    <div className="pt-[72px]">
      <ProductGrid
        section={{
          id: 0,
          __component: 'section.product-grid',
          title: '课程体系',
          description: '由资深教研团队研发，严格对标小学课程标准，让孩子学得快乐、学得扎实。',
        }}
      />
    </div>
  );
}
