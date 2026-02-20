import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './styles/App.css'
import FileDropBox from './components/FileDropBox'

function App() {
  const handleFile = (file) => {
    console.log("Selected file:", file);
  };

  return (
    <div>
      <h1>Upload a File</h1>
      <FileDropBox onFileSelect={handleFile} />
    </div>
  );
}

export default App;