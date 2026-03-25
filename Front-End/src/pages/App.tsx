import { useState } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom';
import '../styles/App.css'
import FileDropBox from '../components/FileDropBox'
import DescriptionBox from "../components/DescriptionBox";
import GuitarTabPage from "./GuitarTabPage";
import AlphaTabViewer from '../components/AlphaTabViewer';

function Home() {
  const navigate = useNavigate();

  const handleFile = async (inputFile: File) => {
    const res = await fetch('http://localhost:8000/upload');
    const blob = await res.blob();
    const outputFile = new File([blob], `${inputFile}.musicxml`, { type: 'application/xml' });

    navigate("/tab"); // nav to tab placeholder page
  };

  return (
    <div className="app-container">
      <DescriptionBox
        title="Welcome to Tably"
        description="Upload MuseScore files (MSCZ, MUSICXML) or images (JPG, PNG) and receive formatted guitar tabs instantly."
      />
      {/* <FileDropBox onFileSelect={handleFile} /> */}
      <AlphaTabViewer />
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