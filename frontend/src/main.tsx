import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
// First, and before every other stylesheet: it declares the values the rest
// consume. Nothing consumes them yet.
import './styles/tokens.css';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
