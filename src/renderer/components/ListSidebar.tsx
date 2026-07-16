import { useState } from 'react'
import { Plus, Edit2, Trash2 } from 'lucide-react'
import type { ListWithTaskCount } from '../../shared/ipc'
import ListForm from './ListForm'

interface ListSidebarProps {
  lists: ListWithTaskCount[]
  selectedListId: number | null
  onSelectList: (id: number) => void
  onCreateList: (name: string) => Promise<void>
  onUpdateList: (id: number, name: string) => Promise<void>
  onDeleteList: (id: number) => Promise<void>
  loading: boolean
}

export default function ListSidebar({
  lists,
  selectedListId,
  onSelectList,
  onCreateList,
  onUpdateList,
  onDeleteList,
  loading
}: ListSidebarProps) {
  const [showForm, setShowForm] = useState(false)
  const [editingList, setEditingList] = useState<ListWithTaskCount | null>(null)

  const handleDelete = async (id: number, name: string) => {
    if (window.confirm(`Delete "${name}" and all its tasks?`)) {
      await onDeleteList(id)
    }
  }

  const handleCreate = async (name: string) => {
    await onCreateList(name)
    setShowForm(false)
  }

  const handleUpdate = async (name: string) => {
    if (!editingList) return
    await onUpdateList(editingList.id, name)
    setEditingList(null)
  }

  const existingNames = lists.map((l) => l.name)

  return (
    <aside className="sidebar" data-testid="list-sidebar">
      <div className="sidebar-header">
        <h2>Lists</h2>
        <button
          className="btn btn-ghost btn-icon"
          onClick={() => {
            setEditingList(null)
            setShowForm(true)
          }}
          data-testid="add-list-button"
          title="Add list"
        >
          <Plus size={20} />
        </button>
      </div>

      <div className="sidebar-list">
        {loading && lists.length === 0 ? (
          <div className="sidebar-empty sidebar-card" data-testid="sidebar-loading">
            Loading...
          </div>
        ) : lists.length === 0 ? (
          <div className="sidebar-empty sidebar-card" data-testid="sidebar-empty">
            No lists yet.
            <br />
            Click + to create one.
          </div>
        ) : (
          lists.map((list) =>
            editingList?.id === list.id ? (
              <div className="sidebar-item-editor" key={list.id}>
                <ListForm
                  onSubmit={handleUpdate}
                  onCancel={() => setEditingList(null)}
                  initialName={list.name}
                  existingNames={existingNames}
                />
              </div>
            ) : (
              <button
                type="button"
                key={list.id}
                className={`sidebar-item${list.id === selectedListId ? ' active' : ''}`}
                onClick={() => onSelectList(list.id)}
                data-testid="sidebar-item"
                aria-current={list.id === selectedListId ? 'page' : undefined}
              >
                <span className="sidebar-item-name" data-testid="sidebar-item-name">
                  {list.name}
                </span>
                <span className="sidebar-item-count" data-testid="sidebar-item-count">
                  {list.totalCount}
                </span>
                <div className="sidebar-item-actions">
                  <button
                    className="sidebar-item-action"
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowForm(false)
                      setEditingList(list)
                    }}
                    data-testid="sidebar-item-edit"
                    title="Edit list"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    className="sidebar-item-action sidebar-item-delete"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(list.id, list.name)
                    }}
                    data-testid="sidebar-item-delete"
                    title="Delete list"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </button>
            ),
          )
        )}

        {showForm && (
          <ListForm
            onSubmit={handleCreate}
            onCancel={() => setShowForm(false)}
            existingNames={existingNames}
          />
        )}
      </div>
    </aside>
  )
}
