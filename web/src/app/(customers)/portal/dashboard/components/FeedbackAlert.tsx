'use client';

import React from 'react';
import { FeedbackMessage } from './types';

interface FeedbackAlertProps {
  message: FeedbackMessage | null;
  onDismiss: () => void;
}

export default function FeedbackAlert({ message, onDismiss }: FeedbackAlertProps) {
  if (!message) return null;

  const isSuccess = message.type === 'success';

  return (
    <div
      className={`p-4 rounded-xl text-sm border flex items-center justify-between shadow-xs transition-all ${
        isSuccess
          ? 'bg-green-50 border-green-200 text-green-800'
          : 'bg-red-50 border-red-200 text-red-800'
      }`}
    >
      <div className="flex items-center space-x-2">
        <span className="font-bold text-base">{isSuccess ? '✓' : '⚠️'}</span>
        <span className="font-medium">{message.text}</span>
      </div>

      <button
        onClick={onDismiss}
        className="text-xs opacity-70 hover:opacity-100 font-bold ml-4 p-1 cursor-pointer transition-opacity"
        aria-label="Cerrar notificación"
      >
        ✕
      </button>
    </div>
  );
}
