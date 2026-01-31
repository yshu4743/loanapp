
import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
}

export const Layout: React.FC<LayoutProps> = ({ children, title }) => {
  return (
    <div className="max-w-md mx-auto min-h-screen bg-white shadow-xl flex flex-col relative overflow-hidden">
      {title && (
        <header className="p-6 bg-blue-600 text-white sticky top-0 z-50 flex items-center justify-between shadow-md">
          <h1 className="text-xl font-bold">{title}</h1>
          <div className="w-8 h-8 rounded-full bg-blue-500/30 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
          </div>
        </header>
      )}
      <main className="flex-1 overflow-y-auto px-5 py-6 pb-24">
        {children}
      </main>
    </div>
  );
};
