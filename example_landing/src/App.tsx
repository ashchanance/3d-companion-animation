import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import Chat from './pages/Chat';
import VideoChat from './pages/VideoChat';

export default function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/chat" element={<Chat />} />
                <Route path="/video-chat" element={<VideoChat />} />
            </Routes>
        </Router>
    );
}
