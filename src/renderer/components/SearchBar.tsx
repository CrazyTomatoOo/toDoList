import { X } from 'lucide-react'

interface SearchBarProps {
  query: string
  onQueryChange: (query: string) => void
}

export default function SearchBar({ query, onQueryChange }: SearchBarProps) {
  return (
    <div className="search-bar" data-testid="search-bar">
      <input
        type="text"
        className="search-input"
        placeholder="搜索任务…"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        data-testid="search-input"
        aria-label="搜索任务"
      />
      {query && (
        <button
          className="search-clear"
          onClick={() => onQueryChange('')}
          data-testid="search-clear"
          aria-label="清除搜索"
          title="清除搜索"
        >
          <X size={16} />
        </button>
      )}
    </div>
  )
}
