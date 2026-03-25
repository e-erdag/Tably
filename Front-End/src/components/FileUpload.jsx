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

            const blob = await response.blob();
            const disposition = response.headers.get("Content-Disposition");
            const match = disposition?.match(/filename="(.+)"/);
            const downloadName = match?.[1] || "converted.musicxml";

            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = downloadName;
            link.click();
            window.URL.revokeObjectURL(url);

            setMessage("File converted successfully!");
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
                <input
                    type="file"
                    accept=".mscz,.musicxml,.xml,.png,.jpg,.jpeg"
                    onChange={handleFileChange}
                />
                <button type="submit" disabled={isLoading}>
                    {isLoading ? "Converting..." : "Convert"}
                </button>
            </form>
            {message && <p>{message}</p>}
        </div>
    );
};

export default FileUpload;
