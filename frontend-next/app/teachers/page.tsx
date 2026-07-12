import TeamPage from '@/components/team/TeamPage';
import type { Metadata } from 'next';

export const revalidate = 300;

export const metadata: Metadata = {
  title: '师资团队',
  description:
    '认识我们的资深教师团队，所有教师均持有教师资格证，拥有丰富的幼小衔接教学经验。',
};

export default function TeachersPage() {
  return <TeamPage />;
}
