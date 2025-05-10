
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'
import { defineCustomElements } from '@ionic/pwa-elements/loader';

// Call the element loader after the platform has been bootstrapped
defineCustomElements(window);

// Check if running in Electron
const isElectron = window.navigator.userAgent.toLowerCase().indexOf('electron') !== -1;

// Mount the app
const rootElement = document.getElementById("root")
if (rootElement) {
  createRoot(rootElement).render(
    <BrowserRouter>
      <App />
    </BrowserRouter>
  )
} else {
  console.error("Root element not found!")
}

// Add Electron-specific initialization if needed
if (isElectron && window.electron) {
  console.log("Running in Electron environment");
  
  // Example of sending a message to the main process
  window.electron.send('app-message', 'App initialized');
  
  // Listen for messages from the main process
  window.electron.receive('app-reply', (message) => {
    console.log('Received from main process:', message);
  });
}
