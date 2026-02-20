import React from "react";
import '../styles/FileDropBox.css'


function FileDropBox({ onFileSelect }) {
  const handleChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      onFileSelect(file);
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
    </div>
  );
}

export default FileDropBox;

