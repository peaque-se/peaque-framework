// HMR client for development
class HMRClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectInterval = 1000;

  constructor() {
    this.connect();
  }

  private connect(): void {
    try {
      this.ws = new WebSocket('ws://localhost:24678');

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
          case 'update':
            this.handleUpdate(message.data);
            break;
        }
      };

      this.ws.onclose = () => {
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('HMR WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to connect to HMR server:', error);
      this.attemptReconnect();
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max HMR reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;

    setTimeout(() => {
      this.connect();
    }, this.reconnectInterval);
  }

  private handleUpdate(data: any): void {
    // Handle hot module replacement
    // This would typically involve updating specific modules
  }

  private handleCSSUpdate(data: any): void {
    // Reload CSS by updating the link href with cache busting
    const links = document.querySelectorAll('link[rel="stylesheet"]');
    links.forEach((link: any) => {
      const href = link.href;
      if (href.includes('peaque.css')) {
        const newHref = href + '?t=' + Date.now();
        link.href = newHref;
      }
    });
  }

  private handlePageUpdate(data: any): void {
    // For page updates, we need to reload the page to get the new JavaScript
    window.location.reload();
  }

  private handleAPIUpdate(data: any): void {
    // API updates don't require client action, just log it
  }
}

// Initialize HMR client when the page loads
if (typeof window !== 'undefined') {
  new HMRClient();
}
