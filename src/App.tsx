import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Join from './pages/Join'
import Mp4Test from './pages/Mp4Test'
import PickName from './pages/PickName'
import Connect from './pages/student/Connect'
import Greet from './pages/student/Greet'
import Preview from './pages/student/Preview'
import Send from './pages/student/Send'
import Shell from './pages/student/Shell'
import Shoot from './pages/student/Shoot'
import View from './pages/student/View'
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
        <Route path="r/:code/s/:sid" element={<Shell />}>
          <Route index element={<Navigate to="view" replace />} />
          <Route path="view" element={<View />} />
          <Route path="shoot" element={<Shoot />} />
          <Route path="connect" element={<Connect />} />
          <Route path="greet" element={<Greet />} />
          <Route path="preview" element={<Preview />} />
          <Route path="send" element={<Send />} />
        </Route>
        <Route path="teacher" element={<TeacherHome />} />
        <Route path="teacher/new" element={<TeacherNew />} />
        <Route path="teacher/recover" element={<TeacherRecover />} />
        <Route path="teacher/room/:id" element={<TeacherRoom />} />
        <Route path="test-mp4" element={<Mp4Test />} />
      </Route>
    </Routes>
  )
}
