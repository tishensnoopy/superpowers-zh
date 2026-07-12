import TeamPage from '@/components/team/TeamPage';
import type { Metadata } from 'next';

export const revalidate = 300;

export const metadata: Metadata = {
  title: '师资团队',
  description: '启航教育资深教师团队',
};

export default function TeachersPage() {
  return <TeamPage />;
}
