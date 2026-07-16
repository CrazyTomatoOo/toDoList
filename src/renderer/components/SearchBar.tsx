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
        placeholder="Search tasks..."
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        data-testid="search-input"
        aria-label="Search tasks"
      />
      {query && (
        <button
          className="search-clear"
          onClick={() => onQueryChange('')}
          data-testid="search-clear"
          aria-label="Clear search"
          title="Clear search"
        >
          <X size={16} />
        </button>
      )}
    </div>
  )
}
