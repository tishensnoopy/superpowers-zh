import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './layout/Layout';
import PageRenderer from './pages/PageRenderer';
import AppointmentSuccess from './pages/AppointmentSuccess';
import CourseDetailPage from './pages/CourseDetailPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout><PageRenderer /></Layout>} />
        <Route path="/:slug" element={<Layout><PageRenderer slug={''} /></Layout>} />
        <Route path="/courses/:slug" element={<Layout><CourseDetailPage /></Layout>} />
        <Route path="/appointment-success" element={<AppointmentSuccess />} />
      </Routes>
    </BrowserRouter>
  );
}
