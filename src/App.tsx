import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Mp4Test from './pages/Mp4Test'
import Teacher from './pages/Teacher'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="teacher" element={<Teacher />} />
        <Route path="test-mp4" element={<Mp4Test />} />
      </Route>
    </Routes>
  )
}
