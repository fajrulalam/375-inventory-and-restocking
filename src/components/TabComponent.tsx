"use client";

import React, { ReactNode } from "react";

interface TabItemProps {
  title: string;
  active: boolean;
  onClick: () => void;
}

export const TabItem: React.FC<TabItemProps> = ({ title, active, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors duration-150 ${
        active
          ? "text-gray-900 border-gray-900"
          : "text-gray-400 border-transparent hover:text-gray-600 hover:border-gray-200"
      }`}
    >
      {title}
    </button>
  );
};

interface TabContentProps {
  active: boolean;
  children: ReactNode;
}

export const TabContent: React.FC<TabContentProps> = ({ active, children }) => {
  if (!active) return null;
  return <div className="py-4">{children}</div>;
};

interface TabComponentProps {
  tabItems: {
    id: string;
    title: string;
  }[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

const TabComponent: React.FC<TabComponentProps> = ({
  tabItems,
  activeTab,
  onTabChange,
}) => {
  return (
    <div className="border-b border-gray-100">
      <div className="flex space-x-1">
        {tabItems.map((tab) => (
          <TabItem
            key={tab.id}
            title={tab.title}
            active={activeTab === tab.id}
            onClick={() => onTabChange(tab.id)}
          />
        ))}
      </div>
    </div>
  );
};

export default TabComponent;
