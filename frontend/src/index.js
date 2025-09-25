import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css'; // Import Tailwind CSS

// Create root element if it doesn't exist
const rootElement = document.getElementById('root') || (() => {
  const element = document.createElement('div');
  element.id = 'root';
  document.body.appendChild(element);
  return element;
})();

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);