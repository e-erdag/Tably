import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import '../styles/GuitarTabPage.css'

function GuitarTabPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const convertedFile = location.state?.file;

  if (!convertedFile) {
    navigate("/");
    return null;
  }

  return (
    <div className="tab-page">
      <button onClick={() => navigate("/")}>⬅ Return</button>
      <h2>Your file is ready!</h2>
      <a
        href={URL.createObjectURL(convertedFile.blob)}
        download={convertedFile.name}
      >
        Download Converted File
      </a>
      {/* TODO: Render the guitar tab preview here */}
    </div>
  );
}

export default GuitarTabPage;