import React from "react";
import ReactDOM from "react-dom/client";

function App() {
  return (
    <main>
      <h1>Ultra RSS Reader</h1>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
