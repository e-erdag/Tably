import { useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import '../styles/App.css';
import FileDropBox from '../components/FileDropBox';
import DescriptionBox from "../components/DescriptionBox";
import GuitarTabPage from "./GuitarTabPage";

function Home() {
  const navigate = useNavigate();

  const handleFile = async (converted: { blob: Blob, name: string }) => {
    const file = new File([converted.blob], converted.name);
    navigate("/tab", { state: { file } });
  };

  return (
    <div className="dashboard">

      {/* LEFT BIG TITLE BOX */}
      <div className="title-box">
        <DescriptionBox
          title="Welcome to Tably"
          description="Convert MuseScore or images into guitar tabs instantly."
        />
      </div>

      {/* RIGHT COLUMN STACK */}
      <div className="right-stack">

        <div className="upload-box">
          <FileDropBox onFileConverted={handleFile} />
        </div>

        <div className="instruction-box">
          <h3>How does it work?</h3>
          <p>Simply upload a MuseScore or image file, and wait for it to be converted to guitar tabs </p>
        </div>

        <div className="instruction-box">
          <h3>What can I do?</h3>
          <p>After convertion you can upload new files, make use of a suite of playback features, or download it for future use!</p>
        </div>

      </div>

    </div>
  );
}

function App() {
  return (
    <>
      <header className="tably-header">
        <h1>Tably𝄞</h1>
      </header>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/tab" element={<GuitarTabPage />} />
      </Routes>
    </>
  );
}
export default App;