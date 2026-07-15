import { useParams } from 'react-router-dom';
import CourseDetail from '../components/course/CourseDetail';

export default function CourseDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  return <CourseDetail slug={slug || ''} />;
}
