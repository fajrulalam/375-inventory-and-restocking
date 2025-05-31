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
      className={`px-4 py-2 text-sm font-medium border-b-2 ${
        active
          ? "text-indigo-600 border-indigo-600"
          : "text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300"
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
    <div className="border-b border-gray-200">
      <div className="flex space-x-4">
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
