import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'node:events';

/** Payload emitted for every audit-log entry (NFR-5). */
export interface AuditEvent {
  userId: number;
  action: string;
  entity: string;
  entityId?: number;
}

/**
 * Tiny in-process pub/sub so cross-cutting listeners (e.g. the Telegram
 * bot) can react to domain events without a module dependency cycle.
 * It is a leaf provider — it imports nothing — so any module may depend
 * on it safely.
 */
@Injectable()
export class EventBus extends EventEmitter {
  emitAudit(event: AuditEvent): void {
    this.emit('audit', event);
  }

  onAudit(handler: (event: AuditEvent) => void): void {
    this.on('audit', handler);
  }
}
