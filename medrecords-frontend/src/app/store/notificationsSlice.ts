/**
 * Notifications state Redux Toolkit slice.
 *
 * Manages in-app notification items and unread count. Supports:
 * - Adding new notifications (info, success, warning, error)
 * - Marking notifications as read (individually or all)
 * - Removing notifications
 * - Auto-computing unread count
 *
 * Requirements: 4.1
 */

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  message: string;
  title?: string;
  timestamp: string;
  read: boolean;
  /** Auto-dismiss duration in ms (null = persistent) */
  autoDismissMs?: number | null;
}

export interface NotificationsState {
  items: NotificationItem[];
  unreadCount: number;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const initialState: NotificationsState = {
  items: [],
  unreadCount: 0,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeUnreadCount(items: NotificationItem[]): number {
  return items.filter((item) => !item.read).length;
}

function generateId(): string {
  return `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ---------------------------------------------------------------------------
// Slice
// ---------------------------------------------------------------------------

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    /**
     * Add a new notification to the list.
     * Auto-generates an id and timestamp if not provided.
     */
    addNotification(
      state,
      action: PayloadAction<Omit<NotificationItem, 'id' | 'timestamp' | 'read'> & { id?: string; timestamp?: string }>,
    ) {
      const notification: NotificationItem = {
        id: action.payload.id ?? generateId(),
        type: action.payload.type,
        message: action.payload.message,
        title: action.payload.title,
        timestamp: action.payload.timestamp ?? new Date().toISOString(),
        read: false,
        autoDismissMs: action.payload.autoDismissMs,
      };

      state.items.unshift(notification);
      state.unreadCount = computeUnreadCount(state.items);
    },

    /**
     * Mark a specific notification as read.
     */
    markAsRead(state, action: PayloadAction<string>) {
      const notification = state.items.find((item) => item.id === action.payload);
      if (notification && !notification.read) {
        notification.read = true;
        state.unreadCount = computeUnreadCount(state.items);
      }
    },

    /**
     * Mark all notifications as read.
     */
    markAllAsRead(state) {
      state.items.forEach((item) => {
        item.read = true;
      });
      state.unreadCount = 0;
    },

    /**
     * Remove a specific notification by id.
     */
    removeNotification(state, action: PayloadAction<string>) {
      state.items = state.items.filter((item) => item.id !== action.payload);
      state.unreadCount = computeUnreadCount(state.items);
    },

    /**
     * Clear all notifications.
     */
    clearAllNotifications(state) {
      state.items = [];
      state.unreadCount = 0;
    },

    /**
     * Remove notifications older than the given timestamp.
     */
    pruneOldNotifications(state, action: PayloadAction<string>) {
      const cutoff = new Date(action.payload).getTime();
      state.items = state.items.filter(
        (item) => new Date(item.timestamp).getTime() >= cutoff,
      );
      state.unreadCount = computeUnreadCount(state.items);
    },
  },
});

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const {
  addNotification,
  markAsRead,
  markAllAsRead,
  removeNotification,
  clearAllNotifications,
  pruneOldNotifications,
} = notificationsSlice.actions;

export default notificationsSlice.reducer;
