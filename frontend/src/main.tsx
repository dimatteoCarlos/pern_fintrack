import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
// First, and before every other stylesheet: it declares the values the rest
// consume. Nothing consumes them yet.
import './styles/tokens.css';
import './index.css';
// A shared control with no component of its own. Loaded here because the one
// view that mounts outside <Layout /> would not see it from generalStyles.css.
import './styles/backArrow.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
