import React from "react";
import "../styles/DescriptionBox.css";

function DescriptionBox({
  title,
  description
} : {
  title: String,
  description: String,
}) {
  return (
    <div className="description-box">
      <h1><span className="shift-slow">Hi! Welcome to</span></h1>
      <h2><span className="shift-fast">Tably𝄞</span></h2>
      <p>A website for converting sheet music to guitar tabs</p>
    </div>
  );
}

export default DescriptionBox;