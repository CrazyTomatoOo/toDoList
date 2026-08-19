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
        className="btn btn-ghost"
        onClick={() => void onImport()}
        data-testid="import-button"
      >
        导入
      </button>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => void onExportJson()}
        data-testid="export-json-button"
      >
        导出 JSON
      </button>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => void onExportCsv()}
        data-testid="export-csv-button"
      >
        导出 CSV
      </button>
    </div>
  )
}
