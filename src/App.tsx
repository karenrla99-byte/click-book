import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Join from './pages/Join'
import Mp4Test from './pages/Mp4Test'
import PickName from './pages/PickName'
import StudentHome from './pages/StudentHome'
import TeacherHome from './pages/TeacherHome'
import TeacherNew from './pages/TeacherNew'
import TeacherRecover from './pages/TeacherRecover'
import TeacherRoom from './pages/TeacherRoom'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="join" element={<Join />} />
        <Route path="r/:code" element={<PickName />} />
        <Route path="r/:code/s/:sid" element={<StudentHome />} />
        <Route path="teacher" element={<TeacherHome />} />
        <Route path="teacher/new" element={<TeacherNew />} />
        <Route path="teacher/recover" element={<TeacherRecover />} />
        <Route path="teacher/room/:id" element={<TeacherRoom />} />
        <Route path="test-mp4" element={<Mp4Test />} />
      </Route>
    </Routes>
  )
}
