import React from 'react';

interface PortalLoaderProps {
  message?: string;
  fullScreen?: boolean;
}

export default function PortalLoader({
  message = 'Cargando información...',
  fullScreen = false,
}: PortalLoaderProps) {
  const content = (
    <div className="flex items-center space-x-3 text-gray-500 text-sm font-medium">
      <span className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent inline-block" />
      <span>{message}</span>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center font-sans">
        <div className="bg-white border border-gray-200 px-6 py-4 rounded-xl shadow-xs">
          {content}
        </div>
      </div>
    );
  }

  return <div className="flex justify-center items-center py-24">{content}</div>;
}
