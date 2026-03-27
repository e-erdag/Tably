import { useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import '../styles/App.css';
import FileDropBox from '../components/FileDropBox';
import DescriptionBox from "../components/DescriptionBox";
import GuitarTabPage from "./GuitarTabPage";

function Home() {
  const navigate = useNavigate();

  // This function is called when the file is converted
  const handleFileConverted = (convertedFile) => {
    navigate("/tab", { state: { file: convertedFile } });
  };

  return (
    <div className="app-container">
      <DescriptionBox
        title="Welcome to Tably"
        description="Upload MuseScore files (MSCZ, MUSICXML) or images (JPG, PNG) and receive formatted guitar tabs instantly."
      />
      <FileDropBox onFileConverted={handleFileConverted} />
    </div>
  );
}

function App() {
  return (
    <>
      <header className="tably-header">
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