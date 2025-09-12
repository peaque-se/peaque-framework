// HMR client for development
class HMRClient2 {
  ws = null;
  reconnectAttempts = 0;
  maxReconnectAttempts = 10;
  reconnectInterval = 1000;

  constructor() {
    this.connect();
  }

  connect() {
    try {
      this.ws = new WebSocket('ws://localhost:3000/hmr');

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        const message = JSON.parse(event.data);

        switch (message.type) {
          case 'reload':
            window.location.reload();
            break;
          case 'css-update':
            this.handleCSSUpdate(message.data);
            break;
          case 'page-update':
            this.handlePageUpdate(message.data);
            break;
          case 'api-update':
            this.handleAPIUpdate(message.data);
            break;
          case 'build-error':
            this.handleBuildError(message.data);
            break;
          case 'update':
            this.handleUpdate(message.data);
            break;
        }
      };

      this.ws.onclose = () => {
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        //console.error('HMR WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to connect to HMR server:', error);
      this.attemptReconnect();
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max HMR reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;

    setTimeout(() => {
      this.connect();
    }, this.reconnectInterval);
  }

  handleUpdate(data) {
    // Handle hot module replacement
    // This would typically involve updating specific modules
  }

  handleCSSUpdate(data) {
    // Reload CSS by updating the link href with cache busting
    const links = document.querySelectorAll('link[rel="stylesheet"]');
    links.forEach((link) => {
      const href = link.href;
      if (href.includes('peaque.css')) {
        const newHref = href + '?t=' + Date.now();
        link.href = newHref;
      }
    });
  }

  handlePageUpdate(data) {
    // For page updates, we need to reload the page to get the new JavaScript
    window.location.reload();
  }

  handleAPIUpdate(data) {
    // API updates don't require client action, just log it
  }

  handleBuildError(data) {
    console.error('🚨 Build Error:', data.message);
    if (data.errors && data.errors.length > 0) {
      data.errors.forEach((error) => {
        console.error(`  ${error.location?.file}:${error.location?.line}:${error.location?.column}: ${error.text}`);
      });
    }
    // Could show an overlay or notification in the future
  }
}

// Initialize HMR client when the page loads
if (typeof window !== 'undefined') {
  new HMRClient2();
}
