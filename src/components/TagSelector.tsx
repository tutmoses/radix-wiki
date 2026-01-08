// src/components/TagSelector.tsx

'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TAG_HIERARCHY, type TagNode } from '@/lib/tags';

interface TagSelectorProps {
  value: string;
  onChange: (path: string) => void;
}

function TagNodeItem({ 
  node, 
  parentPath, 
  selectedPath, 
  onSelect, 
  depth 
}: { 
  node: TagNode; 
  parentPath: string; 
  selectedPath: string; 
  onSelect: (path: string) => void;
  depth: number;
}) {
  const currentPath = parentPath ? `${parentPath}/${node.slug}` : node.slug;
  const isSelected = selectedPath === currentPath;
  const isInPath = selectedPath.startsWith(currentPath + '/') || isSelected;
  const hasChildren = node.children && node.children.length > 0;
  const [isExpanded, setIsExpanded] = useState(isInPath);

  const handleClick = () => {
    if (hasChildren) {
      setIsExpanded(!isExpanded);
    } else {
      onSelect(currentPath);
    }
  };

  const handleSelect = () => {
    if (!hasChildren) {
      onSelect(currentPath);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors text-left',
          isSelected ? 'bg-accent text-text-inverted' : 'hover:bg-surface-2',
          depth > 0 && 'ml-4'
        )}
      >
        {hasChildren ? (
          isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />
        ) : (
          <span className="w-4" />
        )}
        <span className="flex-1">{node.name}</span>
        {isSelected && <Check size={16} />}
      </button>
      
      {hasChildren && isExpanded && (
        <div className="mt-1">
          {node.children!.map(child => (
            <TagNodeItem
              key={child.slug}
              node={child}
              parentPath={currentPath}
              selectedPath={selectedPath}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TagSelector({ value, onChange }: TagSelectorProps) {
  return (
    <div className="flex flex-col gap-1 p-2 bg-surface-1 rounded-lg border border-border max-h-64 overflow-y-auto">
      {TAG_HIERARCHY.map(node => (
        <TagNodeItem
          key={node.slug}
          node={node}
          parentPath=""
          selectedPath={value}
          onSelect={onChange}
          depth={0}
        />
      ))}
    </div>
  );
}

export function TagPathDisplay({ path }: { path: string }) {
  if (!path) return <span className="text-text-muted">Select a category</span>;
  
  const segments = path.split('/');
  return (
    <span className="text-sm">
      {segments.map((segment, i) => (
        <span key={segment}>
          {i > 0 && <span className="text-text-muted mx-1">/</span>}
          <span className="capitalize">{segment.replace(/-/g, ' ')}</span>
        </span>
      ))}
    </span>
  );
}

export default TagSelector;