import React, { useState } from "react";
import FileDropBox from "../components/FileDropBox";
import "../styles/GuitarTabPage.css";

function GuitarTabPage() {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState(null);

  const handleFileSelect = (selectedFile) => {
    setFile(selectedFile);
    setMessage("");
    setDownloadUrl(null);
  };

  const handleConvert = async () => {
    if (!file) {
      setMessage("Please select a file first");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch("http://localhost:8000/convert", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        setMessage(`Error: ${errorData.detail || "Unknown error"}`);
        return;
      }

      const blob = await response.blob();

      const disposition = response.headers.get("Content-Disposition");
      const match = disposition?.match(/filename="(.+)"/);
      const downloadName = match?.[1] || "converted.musicxml";

      const url = window.URL.createObjectURL(blob);
      setDownloadUrl({ url, name: downloadName });

      setMessage("File converted successfully!");
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="tab-page">
      <h2>Upload & Convert Music</h2>

      <FileDropBox onFileSelect={handleFileSelect} />

      <button onClick={handleConvert} disabled={isLoading}>
        {isLoading ? "Converting..." : "Convert File"}
      </button>

      {message && <p>{message}</p>}

      {downloadUrl && (
        <div>
          <a href={downloadUrl.url} download={downloadUrl.name}>
            Download Converted File
          </a>
        </div>
      )}
    </div>
  );
}

export default GuitarTabPage;