import { useState } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import '../styles/App.css';
import FileDropBox from '../components/FileDropBox';
import DescriptionBox from "../components/DescriptionBox";
import GuitarTabPage from "./GuitarTabPage";
import { Button, createTheme, MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css'

function Home({ savedFiles, savedConvertedFiles, onSaveFiles, onSaveConvertedFiles }: {
  savedFiles: File[];
  savedConvertedFiles: File[];
  onSaveFiles: (files: File[]) => void;
  onSaveConvertedFiles: (files: File[]) => void;
}) {
  const navigate = useNavigate();

  const handleFile = async (converted: { blob: Blob, name: string }) => {
    const file = new File([converted.blob], converted.name);

    if (savedFiles.length > 0) {

      onSaveFiles([...savedFiles, file]);
      onSaveConvertedFiles([...savedConvertedFiles, file]);
    } else {
      onSaveFiles([file]);
      onSaveConvertedFiles([file]);
    }

    navigate("/tab");  
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
          <p>After conversion you can upload new files, make use of a suite of playback features, or download it for future use!</p>
        </div>

      </div>

    </div>
  );
}

const theme = createTheme({
  defaultRadius: 'md',
  fontFamily: 'Inter, sans-serif',
  components: {
    Button: Button.extend({
      defaultProps: {
        variant: 'gradient',
        gradient: { from: '#F56960', to: '#ff8a75', deg: 135 },
      },
      styles: {
        root: {
          boxShadow: '0 4px 12px rgba(245, 105, 96, 0.25)',
          transition: 'all 0.25s ease'
        }
      }
    })
  }
});


export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [savedFiles, setSavedFiles] = useState<File[]>([]);
  const [savedConvertedFiles, setSavedConvertedFiles] = useState<File[]>([]);

  const isTabPage = location.pathname === "/tab";
  const hasSavedFiles = savedFiles.length > 0;

  return (
    <MantineProvider theme={theme}>
      <header className="tably-header">
        <h1>Tably𝄞</h1>

        {/* ✅ Show Return button ONLY on /tab */}
        {isTabPage && (
          <button className="return-btn" onClick={() => navigate("/")}>
            Return
          </button>
        )}

        {/* return to tabs button */}
        {!isTabPage && hasSavedFiles && (
          <button className="return-btn" onClick={() => navigate("/tab")}>
            Back to Tabs
          </button>
        )}
      </header>

      <Routes>
        <Route path="/" element={
          <Home
            savedFiles={savedFiles}
            savedConvertedFiles={savedConvertedFiles}
            onSaveFiles={setSavedFiles}
            onSaveConvertedFiles={setSavedConvertedFiles}
          />} />
        <Route path="/tab" element={<GuitarTabPage 
            savedFiles={savedFiles}
            savedConvertedFiles={savedConvertedFiles}
            onSaveFiles={setSavedFiles}
            onSaveConvertedFiles={setSavedConvertedFiles}
          />} 
        />
      </Routes>
    </MantineProvider>
  );
}





