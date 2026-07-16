export interface ImportExportButtonsProps {
  onImport: () => Promise<void>
  onExportJson: () => Promise<void>
  onExportCsv: () => Promise<void>
}

export default function ImportExportButtons({
  onImport,
  onExportJson,
  onExportCsv,
}: ImportExportButtonsProps) {
  return (
    <div className="import-export-actions">
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => void onImport()}
        data-testid="import-button"
      >
        Import
      </button>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => void onExportJson()}
        data-testid="export-json-button"
      >
        Export JSON
      </button>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => void onExportCsv()}
        data-testid="export-csv-button"
      >
        Export CSV
      </button>
    </div>
  )
}
