import { dialog } from 'electron'
import fs from 'node:fs'
import { IPC_CHANNELS, type IpcHandlers, type ImportResult, type ExportResult } from '../../../shared/ipc.js'
import { exportToCsv, exportToJson, importFromCsv, importFromJson } from '../../services/importExport.js'

interface DialogMock {
  showSaveDialog: (options?: Electron.SaveDialogOptions) => Promise<Electron.SaveDialogReturnValue>
  showOpenDialog: (options?: Electron.OpenDialogOptions) => Promise<Electron.OpenDialogReturnValue>
}

function getDialogMock(): DialogMock | undefined {
  return (globalThis as unknown as { __dialogMock?: DialogMock }).__dialogMock
}

async function showSaveDialogWithMock(options: Electron.SaveDialogOptions): Promise<Electron.SaveDialogReturnValue> {
  const mock = getDialogMock()
  if (mock) {
    return mock.showSaveDialog(options)
  }
  return dialog.showSaveDialog(options)
}

async function showOpenDialogWithMock(options: Electron.OpenDialogOptions): Promise<Electron.OpenDialogReturnValue> {
  const mock = getDialogMock()
  if (mock) {
    return mock.showOpenDialog(options)
  }
  return dialog.showOpenDialog(options)
}

async function exportJson(): Promise<ExportResult> {
  const result = await showSaveDialogWithMock({
    title: 'Export as JSON',
    defaultPath: 'todolist-export.json',
    filters: [{ name: 'JSON files', extensions: ['json'] }],
  })

  if (result.canceled || !result.filePath) {
    throw new Error('Export cancelled')
  }

  fs.writeFileSync(result.filePath, exportToJson(), 'utf-8')
  return { filePath: result.filePath }
}

async function exportCsv(): Promise<ExportResult> {
  const result = await showSaveDialogWithMock({
    title: 'Export as CSV',
    defaultPath: 'todolist-export.csv',
    filters: [{ name: 'CSV files', extensions: ['csv'] }],
  })

  if (result.canceled || !result.filePath) {
    throw new Error('Export cancelled')
  }

  fs.writeFileSync(result.filePath, exportToCsv(), 'utf-8')
  return { filePath: result.filePath }
}

async function importFile(): Promise<ImportResult> {
  const result = await showOpenDialogWithMock({
    title: 'Import from JSON or CSV',
    filters: [
      { name: 'JSON files', extensions: ['json'] },
      { name: 'CSV files', extensions: ['csv'] },
    ],
    properties: ['openFile'],
  })

  if (result.canceled || result.filePaths.length === 0) {
    throw new Error('Import cancelled')
  }

  const filePath = result.filePaths[0]
  const content = fs.readFileSync(filePath, 'utf-8')
  const lowerPath = filePath.toLowerCase()

  if (lowerPath.endsWith('.json')) {
    return importFromJson(content)
  }

  if (lowerPath.endsWith('.csv')) {
    return importFromCsv(content)
  }

  throw new Error('Unsupported file format. Please choose a .json or .csv file.')
}

export const importExportHandlers = [
  { channel: IPC_CHANNELS.IMPORT_EXPORT_EXPORT_JSON, handler: exportJson },
  { channel: IPC_CHANNELS.IMPORT_EXPORT_EXPORT_CSV, handler: exportCsv },
  { channel: IPC_CHANNELS.IMPORT_EXPORT_IMPORT_FILE, handler: importFile },
] satisfies {
  [K in keyof Pick<
    IpcHandlers,
    | typeof IPC_CHANNELS.IMPORT_EXPORT_EXPORT_JSON
    | typeof IPC_CHANNELS.IMPORT_EXPORT_EXPORT_CSV
    | typeof IPC_CHANNELS.IMPORT_EXPORT_IMPORT_FILE
  >]: { channel: K; handler: IpcHandlers[K] }
}[keyof Pick<
  IpcHandlers,
  | typeof IPC_CHANNELS.IMPORT_EXPORT_EXPORT_JSON
  | typeof IPC_CHANNELS.IMPORT_EXPORT_EXPORT_CSV
  | typeof IPC_CHANNELS.IMPORT_EXPORT_IMPORT_FILE
>][]
