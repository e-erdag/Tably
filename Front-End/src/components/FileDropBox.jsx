import { useState } from "react";
import '../styles/FileDropBox.css';

function FileDropBox({ onFileConverted }) {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsLoading(true);
    setMessage("Waiting for conversion...");

    try {
      const formData = new FormData();
      formData.append("file", file);

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

      // Send the converted file to parent
      onFileConverted({ blob, name: downloadName });

    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="file-dropbox-container">
      <label className="file-dropbox-label" htmlFor="fileDropBox">
        Upload Your Music File
      </label>
      <input
        type="file"
        id="fileDropBox"
        className="file-dropbox-input"
        onChange={handleChange}
        accept=".mscz,.musicxml,.jpg,.png"
      />
      <p className="file-dropbox-hint">
        Supported formats: MSCZ, MUSICXML, JPG, PNG.
      </p>
      {isLoading && <p className="file-dropbox-loading">{message}</p>}
    </div>
  );
}

export default FileDropBox;