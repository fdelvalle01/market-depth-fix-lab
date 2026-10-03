import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './ui/App';
import '@fontsource-variable/ibm-plex-sans';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import './ui/styles.css';

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
