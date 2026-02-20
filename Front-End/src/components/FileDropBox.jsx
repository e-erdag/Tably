import React from "react";

function FileDropBox({ onFileSelect }) {
  const handleChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      onFileSelect(file);
    }
  };

  return (
    <div>
      <input type="file" onChange={handleChange} />
    </div>
  );
}

export default FileDropBox;