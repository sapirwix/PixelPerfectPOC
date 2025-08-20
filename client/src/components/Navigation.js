import React from 'react';
import { Camera, Clock, Home, FileText } from 'lucide-react';
import './Navigation.css';

const Navigation = ({ currentPage, onPageChange }) => {
  const navItems = [
    {
      id: 'compare',
      label: 'Compare',
      icon: Camera,
      description: 'Compare two websites'
    },
    {
      id: 'text-extraction',
      label: 'Text Extraction',
      icon: FileText,
      description: 'Extract pure text content from URLs'
    },
    {
      id: 'history',
      label: 'History',
      icon: Clock,
      description: 'View comparison history'
    }
  ];

  return (
    <nav className="navigation">
      <div className="nav-container">
        <div className="nav-brand" onClick={() => onPageChange('compare')}>
          <Home size={24} />
          <span>Pixel Perfect POC</span>
        </div>
        
        <div className="nav-items">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            
            return (
              <button
                key={item.id}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => onPageChange(item.id)}
                title={item.description}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
