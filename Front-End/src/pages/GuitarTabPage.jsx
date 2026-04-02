import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from "react-router-dom"; 
import '../styles/GuitarTabPage.css';
import AlphaTabViewer from '../components/AlphaTabViewer';

function GuitarTabPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const initialFile = location.state?.file;

  const [files, setFiles] = useState(initialFile ? [initialFile] : []); // all uploaded files
  const [convertedFiles, setConvertedFiles] = useState(initialFile ? [initialFile] : []); // files done converting
  const [currentIndex, setCurrentIndex] = useState(0);
  const [convertingIndices, setConvertingIndices] = useState([]); // tracks which files are converting

  if (files.length === 0) {
    return <Navigate to='/' />
  }

  // Handle uploading a new file
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

      const response = await fetch("http://localhost:8000/convert", {
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
      const disposition = response.headers.get("Content-Disposition");
      const match = disposition?.match(/filename="(.+)"/);
      const downloadName = match?.[1] || "converted.musicxml";

      const convertedFile = new File([blob], downloadName);

      setConvertedFiles(prev => [...prev, convertedFile]);
      setConvertingIndices(prev => prev.filter(i => i !== newIndex));

    } catch (err) {
      alert(`Error: ${err.message}`);
      setConvertingIndices(prev => prev.filter(i => i !== newIndex));
    }
  };

  return (
    <>
      <div className="tab-page">
        <button onClick={() => navigate('/')}>Return</button>

        <h2>Your file is ready!</h2>

        {/* Upload another file */}
        <label className="file-dropbox-label">
          Upload Another File
          <input
            type="file"
            className="file-dropbox-input"
            onChange={handleNewFile}
            accept=".mscz,.musicxml,.jpg,.png"
          />
        </label>

        {/* Download current file */}
        {convertedFiles[currentIndex] && (
          <a
            href={URL.createObjectURL(convertedFiles[currentIndex])}
            download={convertedFiles[currentIndex].name}
          >
            Download Current File
          </a>
        )}
      </div>

      <AlphaTabViewer
        file={convertedFiles[currentIndex]}
        files={files}
        convertingIndices={convertingIndices}
        currentIndex={currentIndex}
        setCurrentIndex={setCurrentIndex}
      />
    </>
  );
}

export default GuitarTabPage;