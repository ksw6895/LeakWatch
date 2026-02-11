import { Injectable } from '@nestjs/common';
import crypto from 'crypto';

const STATE_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class ShopifyAuthStateStore {
  private readonly stateMap = new Map<string, number>();

  createState() {
    const state = crypto.randomBytes(16).toString('hex');
    this.stateMap.set(state, Date.now() + STATE_TTL_MS);
    return state;
  }

  consumeState(state: string): boolean {
    const expiresAt = this.stateMap.get(state);
    this.stateMap.delete(state);
    if (!expiresAt) {
      return false;
    }

    return expiresAt > Date.now();
  }
}
