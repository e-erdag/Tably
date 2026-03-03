import React, { useState } from "react";

const FileUpload = () => {
    const [file, setFile] = useState(null);
    const [message, setMessage] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleFileChange = (event) => {
        setFile(event.target.files[0]);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!file) {
            setMessage("Please select a file");
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
                setMessage(`Error: ${errorData.detail || "Unknown error occurred"}`);
                console.error("Backend error:", errorData);
                return;
            }

            const data = await response.json();
            if (data && data.content) {
                const blob = new Blob([data.content], { type: "application/xml" });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = data.filename || "converted.musicxml";
                link.click();
                setMessage("File converted successfully!");
            } else {
                setMessage("Error: Invalid response from server.");
                console.error("Invalid response structure:", data);
            }
        } catch (error) {
            setMessage(`Error: ${error.message}`);
            console.error("Fetch error:", error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div>
            <form onSubmit={handleSubmit}>
                <input type="file" accept=".mscz" onChange={handleFileChange} />
                <button type="submit" disabled={isLoading}>
                    {isLoading ? "Converting..." : "Convert"}
                </button>
            </form>
            {message && <p>{message}</p>}
        </div>
    );
};

export default FileUpload;