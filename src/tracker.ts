interface Tracker {
  track(event: string, ...tags: string[]): void;
}

interface EventObject {
  event: string;
  tags: string[];
  url: string;
  title: string;
  ts: number;
}

class EventTracker implements Tracker {
  private readonly port = 8888;
  private readonly bufferSizeLimit: number = 3;
  private readonly endpoint: string = `http://localhost:${this.port}/track`;
  private buffer: Array<EventObject> = [];
  private isSending: boolean = false;
  private lastSentTime: number = 0;
  private isSentBeforeLeave = false;

  constructor() {
    window.addEventListener('beforeunload', () => {
      this.sendBufferBeforeLeave();
    });
    window.addEventListener('unload', () => {
      this.sendBufferBeforeLeave();
    });
  }

  private sendBufferBeforeLeave(): void {
    if (this.buffer.length > 0 && !this.isSentBeforeLeave) {
      this.isSentBeforeLeave = true;
      navigator.sendBeacon(this.endpoint, JSON.stringify(this.buffer));
    }
  }

  private async sendBuffer(): Promise<void> {
    // Checking the conditions
    const isBufferBelowLimitAndRecentlySent =
      this.buffer.length < this.bufferSizeLimit &&
      Date.now() - this.lastSentTime <= 1000;
    if (
      this.isSending ||
      this.buffer.length === 0 ||
      isBufferBelowLimitAndRecentlySent
    ) {
      return;
    }

    this.isSending = true;
    this.lastSentTime = Date.now();

    const payload = this.buffer;
    this.buffer = [];
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: `-${JSON.stringify(payload)}`,
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
    } catch (err) {
      console.error('Failed to send events:', err);
      // Wait a second, then return events to the buffer and send buffer
      setTimeout(() => {
        this.buffer.push(...payload);
        this.sendBuffer();
      }, 1000);
      return;
    } finally {
      this.isSending = false;
    }
  }

  /**
   * Events logging method
   * @param event
   * @param tags
   */
  track(event: string, ...tags: string[]): void {
    const eventObject: EventObject = {
      event,
      tags,
      url: location.href,
      title: document.title,
      ts: Math.floor(Date.now() / 1000),
    };

    this.buffer.push(eventObject);
    this.sendBuffer();
  }
}

interface Window {
  tracker: Tracker;
}

// Overloading the Tracker interface
interface Tracker {
  q?: Array<string[]>;
}

{
  const arr = window.tracker.q;

  window.tracker = new EventTracker();

  arr?.forEach((event) => {
    window.tracker.track(event[0], ...Array(...event).slice(1));
  });
}
