import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * SSE Agent Stream Manager
 * Handles Server-Sent Events for AI agent streaming responses
 */

export interface StreamMessage {
  type: 'stream_start' | 'stream_chunk' | 'stream_end' | 'error' | 'connected';
  chunk?: string;
  error?: string;
  userId?: string;
  metadata?: any;
}

export class SSEStream {
  private res: Response;
  private streamId: string;
  private isClosed: boolean = false;
  private keepAliveInterval?: NodeJS.Timeout;

  constructor(res: Response, streamId: string) {
    this.res = res;
    this.streamId = streamId;
    this.setupHeaders();
    this.setupKeepAlive();
  }

  private setupHeaders() {
    // Set SSE headers
    this.res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    });
  }

  private setupKeepAlive() {
    // Send comment lines every 15 seconds to keep connection alive
    this.keepAliveInterval = setInterval(() => {
      if (!this.isClosed) {
        this.res.write(': keepalive\n\n');
        this.res.flush?.();
      }
    }, 15000);
  }

  /**
   * Send SSE event to client
   */
  sendEvent(message: StreamMessage) {
    if (this.isClosed) {
      console.warn(`[SSE ${this.streamId}] Attempted to send to closed stream`);
      return;
    }

    try {
      // Format as SSE event
      this.res.write(`event: message\n`);
      this.res.write(`data: ${JSON.stringify(message)}\n\n`);
      this.res.flush?.(); // Ensure data is sent immediately
    } catch (error) {
      console.error(`[SSE ${this.streamId}] Error sending event:`, error);
      this.close();
    }
  }

  /**
   * Send stream start event
   */
  start(metadata?: any) {
    this.sendEvent({ type: 'stream_start', metadata });
  }

  /**
   * Send chunk of streamed content
   */
  chunk(text: string) {
    this.sendEvent({ type: 'stream_chunk', chunk: text });
  }

  /**
   * Send stream end event
   */
  end(metadata?: any) {
    this.sendEvent({ type: 'stream_end', metadata });
  }

  /**
   * Send error event
   */
  error(error: string) {
    this.sendEvent({ type: 'error', error });
  }

  /**
   * Close the stream
   */
  close() {
    if (this.isClosed) {
      return;
    }

    this.isClosed = true;

    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = undefined;
    }

    try {
      this.res.end();
    } catch (error) {
      console.error(`[SSE ${this.streamId}] Error closing stream:`, error);
    }

    console.log(`[SSE ${this.streamId}] Stream closed`);
  }

  /**
   * Check if stream is closed
   */
  get closed(): boolean {
    return this.isClosed;
  }
}

/**
 * Stream metadata for authorization and auditing
 */
export interface StreamMetadata {
  streamId: string;
  userId: string;
  organizationId?: string;
  sessionId: string;
  agentSlug: string;
  createdAt: Date;
}

/**
 * Stream Registry
 * Manages active SSE streams with automatic cleanup and authorization
 */
class StreamRegistry {
  private streams = new Map<string, SSEStream>();
  private metadata = new Map<string, StreamMetadata>();
  private streamTimeouts = new Map<string, NodeJS.Timeout>();
  private readonly STREAM_TIMEOUT = 5 * 60 * 1000; // 5 minutes

  /**
   * Create stream metadata (called during POST /stream)
   */
  createMetadata(metadata: StreamMetadata): void {
    this.metadata.set(metadata.streamId, metadata);
    console.log(`[SSE Registry] Metadata created for stream ${metadata.streamId} (user: ${metadata.userId})`);
    
    // Auto-cleanup metadata after timeout
    const timeout = setTimeout(() => {
      console.log(`[SSE Registry] Stream ${metadata.streamId} timed out, cleaning up`);
      this.cleanup(metadata.streamId);
    }, this.STREAM_TIMEOUT);

    this.streamTimeouts.set(metadata.streamId, timeout);
  }

  /**
   * Register an SSE stream connection
   * Only allowed if metadata exists and user matches
   */
  register(streamId: string, stream: SSEStream, userId: string, organizationId?: string): boolean {
    const meta = this.metadata.get(streamId);
    
    if (!meta) {
      console.warn(`[SSE Registry] Attempted to register unknown stream ${streamId}`);
      return false;
    }
    
    // Verify ownership
    if (meta.userId !== userId) {
      console.warn(`[SSE Registry] Authorization failed: user ${userId} attempted to access stream owned by ${meta.userId}`);
      return false;
    }
    
    // Verify organization (if applicable)
    if (meta.organizationId && meta.organizationId !== organizationId) {
      console.warn(`[SSE Registry] Authorization failed: org mismatch for stream ${streamId}`);
      return false;
    }
    
    this.streams.set(streamId, stream);
    console.log(`[SSE Registry] Stream ${streamId} registered for user ${userId}`);
    return true;
  }
  
  /**
   * Verify stream ownership
   */
  verifyOwnership(streamId: string, userId: string, organizationId?: string): boolean {
    const meta = this.metadata.get(streamId);
    
    if (!meta) {
      return false;
    }
    
    if (meta.userId !== userId) {
      return false;
    }
    
    if (meta.organizationId && meta.organizationId !== organizationId) {
      return false;
    }
    
    return true;
  }

  /**
   * Get stream by ID
   */
  get(streamId: string): SSEStream | undefined {
    return this.streams.get(streamId);
  }

  /**
   * Cleanup stream and metadata
   */
  cleanup(streamId: string): void {
    const stream = this.streams.get(streamId);
    if (stream) {
      stream.close();
      this.streams.delete(streamId);
    }

    this.metadata.delete(streamId);

    const timeout = this.streamTimeouts.get(streamId);
    if (timeout) {
      clearTimeout(timeout);
      this.streamTimeouts.delete(streamId);
    }
    
    console.log(`[SSE Registry] Cleaned up stream ${streamId}`);
  }

  /**
   * Get metadata for a stream
   */
  getMetadata(streamId: string): StreamMetadata | undefined {
    return this.metadata.get(streamId);
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      activeStreams: this.streams.size,
      totalMetadata: this.metadata.size,
    };
  }
}

export const streamRegistry = new StreamRegistry();

/**
 * Create a unique stream ID
 */
export function createStreamId(): string {
  return uuidv4();
}
