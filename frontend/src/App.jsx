import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Trending from './pages/Trending';
import Dashboard from './pages/Dashboard';
import DashboardOverview from './pages/DashboardOverview';
import DashboardCategories from './pages/DashboardCategories';
import DashboardPosts from './pages/DashboardPosts';
import DashboardUsers from './pages/DashboardUsers';
import DashboardClusters from './pages/DashboardClusters';
import DashboardWikiBoard from './pages/DashboardWikiBoard';
import EditProfile from './pages/EditProfile';

import Profile from './pages/Profile';
import Search from './pages/Search';
import CategoryPosts from './pages/CategoryPosts';
import WikiArticle from './pages/WikiArticle';
import DoomScroll from './pages/DoomScroll';
import SinglePost from './pages/SinglePost';
import NotFound from './pages/NotFound';

function AppContent() {
  const location = useLocation();
  const hideGlobalFooter = location.pathname === '/trending';

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/trending" element={<Trending />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/search" element={<Search />} />
          <Route path="/doom-scroll" element={<DoomScroll />} />
          <Route path="/stats" element={<DashboardOverview />} />
          <Route path="/category/:id" element={<CategoryPosts />} />
          <Route path="/wiki/:title" element={<WikiArticle />} />

          <Route path="/dashboard" element={<Dashboard />}>
            <Route index element={<DashboardOverview />} />
            <Route path="categories" element={<DashboardCategories />} />
            <Route path="posts" element={<DashboardPosts />} />
            <Route path="clusters" element={<DashboardClusters />} />
            <Route path="wiki-board" element={<DashboardWikiBoard />} />
            <Route path="users" element={<DashboardUsers />} />
          </Route>

          <Route path="/post/:slug" element={<SinglePost />} />
          <Route path="/profile/edit" element={<EditProfile />} />
          <Route path="/profile/:username" element={<Profile />} />

          {/* Catch-all 404 Route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      {!hideGlobalFooter && <Footer />}
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
