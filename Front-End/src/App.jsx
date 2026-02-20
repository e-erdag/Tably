import { useState } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom';
import './styles/App.css'
import FileDropBox from './components/FileDropBox'
import DescriptionBox from "./components/DescriptionBox";
import GuitarTabPage from "./pages/GuitarTabPage";


function Home() {
  const navigate = useNavigate();

  const handleFile = (file) => {
    console.log("Selected file:", file);
    navigate("/tab"); // Navigate to tab placeholder page
  };

  return (
    <div className="app-container">
      <DescriptionBox
        title="Welcome to Table"
        description="Upload MuseScore files (MSCZ, MUSICXML) or images (JPG, PNG) and receive formatted guitar tabs instantly."
      />
      <FileDropBox onFileSelect={handleFile} />
    </div>
  );
}

function App() {
  return (
    <>
      <header className = "tably-header">
        <h1>Tably</h1>
      </header>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/tab" element={<GuitarTabPage />} />
        </Routes>
    </>
  );
}

export default App;