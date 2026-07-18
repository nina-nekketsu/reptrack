import React from 'react';
import './ErrorBoundary.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
    this.headingRef = React.createRef();
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    this.props.onError?.(error, { source: 'react-boundary', category: 'runtime' });
    this.headingRef.current?.focus();
  }

  handleReload = () => {
    if (this.props.onReload) {
      this.props.onReload();
      return;
    }
    window.location.reload();
  };

  handleRetry = () => {
    this.props.onReset?.();
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main
        className="error-boundary"
        role="alert"
        aria-labelledby="error-boundary-title"
      >
        <section className="error-boundary__card">
          <p className="error-boundary__eyebrow">Recovery mode</p>
          <h1
            id="error-boundary-title"
            ref={this.headingRef}
            tabIndex="-1"
          >
            RepTrack needs a restart
          </h1>
          <p>
            Something interrupted this screen. Your locally saved workout data has not been deleted.
          </p>
          <div className="error-boundary__actions">
            <button type="button" className="error-boundary__primary" onClick={this.handleReload}>
              Reload RepTrack
            </button>
            <button type="button" className="error-boundary__secondary" onClick={this.handleRetry}>
              Try again
            </button>
          </div>
        </section>
      </main>
    );
  }
}

export default ErrorBoundary;
