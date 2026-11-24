import { describe, expect, it } from 'vitest';
import { getNotificationDisplayTitle, getNotificationTargetPath } from './notificationNavigation';

describe('getNotificationTargetPath', () => {
  it('opens the product comments for a comment notification', () => {
    expect(getNotificationTargetPath({
      id: 'notification-1',
      type: 'comment',
      metadata: { product_id: 'product-1', comment_id: 'comment-1' },
    })).toBe('/produto/product-1?comments=1#comments');
  });

  it('opens the related product for a reaction notification', () => {
    expect(getNotificationTargetPath({
      id: 'notification-2',
      type: 'reaction',
      metadata: { product_id: 'product-2' },
    })).toBe('/produto/product-2');
  });

  it('opens the specific product instead of the profile product list', () => {
    expect(getNotificationTargetPath({
      id: 'notification-4',
      type: 'product',
      metadata: { product_id: 'product-4' },
    })).toBe('/produto/product-4');
  });

  it('encodes product identifiers before adding them to a route', () => {
    expect(getNotificationTargetPath({
      id: 'notification-3',
      type: 'comment',
      metadata: { product_id: 'product/unsafe' },
    })).toBe('/produto/product%2Funsafe?comments=1#comments');
  });

  it('replaces an invalid NAO/NÃO title with a useful type label', () => {
    expect(getNotificationDisplayTitle('NAO', 'comment')).toBe('Novo comentário');
    expect(getNotificationDisplayTitle('NÃO', 'message')).toBe('Nova mensagem');
  });
});