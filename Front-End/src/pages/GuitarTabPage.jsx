import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from "react-router-dom"; 
import '../styles/GuitarTabPage.css';
import AlphaTabViewer from '../components/AlphaTabViewer';

function GuitarTabPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const initialFile = location.state?.file;

  const [files, setFiles] = useState(initialFile ? [initialFile] : []);
  const [convertedFiles, setConvertedFiles] = useState(initialFile ? [initialFile] : []);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [convertingIndices, setConvertingIndices] = useState([]);

  if (files.length === 0) {
    return <Navigate to='/' />;
  }

  const handleNewFile = async (e) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const newFile = e.target.files[0];
    const newIndex = files.length;

    setFiles(prev => [...prev, newFile]);
    setConvertingIndices(prev => [...prev, newIndex]);
    setCurrentIndex(newIndex);

    try {
      const formData = new FormData();
      formData.append("file", newFile);

      const response = await fetch("/api/convert", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        alert(`Error: ${errorData.detail || "Unknown error"}`);
        setConvertingIndices(prev => prev.filter(i => i !== newIndex));
        return;
      }

      const blob = await response.blob();
      const displayName = newFile.name.replace(/\.[^/.]+$/, '').replace(/ /g, '_') + '.musicxml';
      const convertedFile = new File([blob], displayName);

      setConvertedFiles(prev => [...prev, convertedFile]);
      setConvertingIndices(prev => prev.filter(i => i !== newIndex));

    } catch (err) {
      alert(`Error: ${err.message}`);
      setConvertingIndices(prev => prev.filter(i => i !== newIndex));
    }
  };

  return (
    <>
      <AlphaTabViewer
        file={convertedFiles[currentIndex]}
        files={files}
        convertingIndices={convertingIndices}
        currentIndex={currentIndex}
        setCurrentIndex={setCurrentIndex}
        onUpload={handleNewFile}
        convertedFiles={convertedFiles}   // ✅ THIS WAS MISSING
      />

      {/* <div className="tab-page">

        {convertedFiles[currentIndex] && (
          <a
            href={URL.createObjectURL(convertedFiles[currentIndex])}
            download={convertedFiles[currentIndex].name}
          >
            Download Current File
          </a>
        )}
      </div> */}
    </>
  );
}

export default GuitarTabPage;