import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { installGlobalDiagnostics } from './lib/clientDiagnostics';
import { clientDiagnostics } from './lib/clientDiagnosticsRuntime';
import { registerPwaUpdateController } from './lib/pwaUpdateController';
import reportWebVitals from './reportWebVitals';

installGlobalDiagnostics(window, clientDiagnostics);
registerPwaUpdateController();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ErrorBoundary onError={clientDiagnostics.recordError}>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
